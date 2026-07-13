import type { AgentFinding, DecisionResult } from "@tadpools/shared/index";
import { db } from "../db/pool.js";
import { evaluate, POLICY_RULES } from "./policyRules.js";

/**
 * policyEngine — applies the pure decision logic in policyRules.ts,
 * then persists triggered rules as risk_signals.
 */
export async function decide(
  caseId: string,
  findings: AgentFinding[]
): Promise<DecisionResult> {
  const { status, score, reasons, triggeredRules } = evaluate(findings);

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

  return { status, score, reasons, findings };
}
