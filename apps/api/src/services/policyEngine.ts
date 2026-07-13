import type { AgentFinding, DecisionResult, DecisionStatus } from "@tadpools/shared/index";
import { db } from "../db/pool.js";

// ── Hard rule definitions ─────────────────────────────────────────────────────

interface PolicyRule {
  code: string;
  description: string;
  flags: string[];                  // any of these flags triggers this rule
  minStatus: DecisionStatus;        // minimum decision status
  scoreBoost: number;               // added to raw score
}

const POLICY_RULES: PolicyRule[] = [
  {
    code: "RULE_FORGERY",
    description: "Document forgery signal — automatic reject",
    flags: ["DOC_FORGERY_SIGNAL", "PATTERN_DOCUMENT_FRAUD_SIGNAL"],
    minStatus: "reject",
    scoreBoost: 100,
  },
  {
    code: "RULE_DIRECTORY_MATCH",
    description: "Suspicious entity directory match — must escalate",
    flags: ["DIRECTORY_MATCH", "DIRECTORY_MATCH_NAME", "DIRECTORY_MATCH_REGNUM", "DIRECTORY_MATCH_ACCOUNT"],
    minStatus: "escalate",
    scoreBoost: 60,
  },
  {
    code: "RULE_ACCOUNT_MISMATCH",
    description: "Account number mismatch — cannot auto-approve",
    flags: ["ACCOUNT_MISMATCH", "VOUCHER_ACCOUNT_MISMATCH"],
    minStatus: "manual_review",
    scoreBoost: 50,
  },
  {
    code: "RULE_NO_DOCS",
    description: "No documents uploaded — cannot auto-approve",
    flags: ["NO_DOCUMENTS_UPLOADED"],
    minStatus: "manual_review",
    scoreBoost: 30,
  },
  {
    code: "RULE_NEW_ENTITY_NO_DOCS",
    description: "New entity with no supporting documents — must escalate",
    flags: ["PATTERN_NEW_ENTITY_NO_DOCS"],
    minStatus: "escalate",
    scoreBoost: 70,
  },
  {
    code: "RULE_PROXY_ENTITY",
    description: "Proxy entity pattern detected — must escalate",
    flags: ["PATTERN_PROXY_ENTITY"],
    minStatus: "escalate",
    scoreBoost: 65,
  },
  {
    code: "RULE_HIGH_RISK_SECTOR_NEW",
    description: "New entity in high-risk sector",
    flags: ["PATTERN_NEW_HIGH_RISK_SECTOR"],
    minStatus: "escalate",
    scoreBoost: 55,
  },
  {
    code: "RULE_CUMULATIVE_MEDIUM",
    description: "Cumulative medium risk across multiple agents",
    flags: ["PATTERN_CUMULATIVE_MEDIUM_RISK"],
    minStatus: "manual_review",
    scoreBoost: 25,
  },
  {
    code: "RULE_CHAIR_REJECT",
    description: "ChairAgent explicitly recommends reject",
    flags: ["CHAIR_RECOMMENDS_REJECT"],
    minStatus: "reject",
    scoreBoost: 90,
  },
  {
    code: "RULE_CHAIR_ESCALATE",
    description: "ChairAgent explicitly recommends escalate",
    flags: ["CHAIR_RECOMMENDS_ESCALATE"],
    minStatus: "escalate",
    scoreBoost: 50,
  },
];

const STATUS_ORDER: DecisionStatus[] = ["approve", "manual_review", "escalate", "reject"];

function statusRank(s: DecisionStatus): number {
  return STATUS_ORDER.indexOf(s);
}

function maxStatus(a: DecisionStatus, b: DecisionStatus): DecisionStatus {
  return statusRank(a) >= statusRank(b) ? a : b;
}

// ── Base score from risk levels ───────────────────────────────────────────────

function baseScore(findings: AgentFinding[]): number {
  return findings.reduce((acc, f) => {
    if (f.riskLevel === "high") return acc + 40;
    if (f.riskLevel === "medium") return acc + 20;
    return acc + 5;
  }, 0);
}

// ── Main policy engine ────────────────────────────────────────────────────────

export async function decide(
  caseId: string,
  findings: AgentFinding[]
): Promise<DecisionResult> {
  const allFlags = findings.flatMap((f) => f.flags);
  const reasons: string[] = [];
  const triggeredRules: string[] = [];

  let score = baseScore(findings);
  let status: DecisionStatus = "approve";

  // Evaluate each policy rule
  for (const rule of POLICY_RULES) {
    const triggered = rule.flags.some((f) => allFlags.includes(f));
    if (triggered) {
      score += rule.scoreBoost;
      status = maxStatus(status, rule.minStatus);
      triggeredRules.push(rule.code);
      reasons.push(`[${rule.code}] ${rule.description}`);
    }
  }

  // Score-based floor (after rules)
  const scoreStatus: DecisionStatus =
    score >= 150 ? "reject" :
    score >= 90  ? "escalate" :
    score >= 40  ? "manual_review" :
    "approve";

  status = maxStatus(status, scoreStatus);

  // Add agent summaries as reasons
  for (const f of findings) {
    reasons.push(`[${f.agent}] ${f.summary}`);
  }

  const finalScore = Math.min(score, 999);

  // Persist triggered rules as risk_signals
  if (triggeredRules.length > 0) {
    const values = triggeredRules.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(", ");
    const params = triggeredRules.flatMap((code) => {
      const rule = POLICY_RULES.find((r) => r.code === code)!;
      return [caseId, code, "PolicyEngine", rule.description];
    });
    await db.query(
      `INSERT INTO risk_signals (case_id, signal_code, triggered_by, detail) VALUES ${values}`,
      params
    );
  }

  return {
    status,
    score: finalScore,
    reasons: [...new Set(reasons)],
    findings,
  };
}
