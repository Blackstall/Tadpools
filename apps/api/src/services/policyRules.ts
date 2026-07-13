import type { AgentFinding, DecisionStatus } from "@tadpools/shared/index";

/**
 * policyRules — pure, deterministic decision logic.
 *
 * No I/O, no DB: everything here is unit-testable.
 * policyEngine.ts wraps `evaluate` with persistence.
 */

export interface PolicyRule {
  code: string;
  description: string;
  flags: string[];                  // any of these flags triggers this rule
  minStatus: DecisionStatus;        // minimum decision status
  scoreBoost: number;               // added to raw score
}

export const POLICY_RULES: PolicyRule[] = [
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

export function statusRank(s: DecisionStatus): number {
  return STATUS_ORDER.indexOf(s);
}

export function maxStatus(a: DecisionStatus, b: DecisionStatus): DecisionStatus {
  return statusRank(a) >= statusRank(b) ? a : b;
}

// ── Base score from risk levels ───────────────────────────────────────────────

export function baseScore(findings: AgentFinding[]): number {
  return findings.reduce((acc, f) => {
    if (f.riskLevel === "high") return acc + 40;
    if (f.riskLevel === "medium") return acc + 20;
    return acc + 5;
  }, 0);
}

// ── Pure evaluation (no persistence) ──────────────────────────────────────────

export interface EvaluationResult {
  status: DecisionStatus;
  score: number;
  reasons: string[];
  triggeredRules: string[];
}

export function evaluate(findings: AgentFinding[]): EvaluationResult {
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

  return {
    status,
    score: Math.min(score, 999),
    reasons: [...new Set(reasons)],
    triggeredRules,
  };
}
