import { describe, it, expect } from "vitest";
import { evaluate, baseScore, maxStatus } from "../src/services/policyRules";
import type { AgentFinding, RiskLevel } from "@tadpools/shared/index";

function finding(overrides: Partial<AgentFinding> = {}): AgentFinding {
  return {
    agent: "TestAgent",
    summary: "test summary",
    confidence: 0.9,
    riskLevel: "low" as RiskLevel,
    evidenceRefs: [],
    flags: [],
    reasoning: ["because"],
    round: 1,
    ...overrides,
  };
}

describe("baseScore", () => {
  it("scores low=5, medium=20, high=40", () => {
    expect(baseScore([finding({ riskLevel: "low" })])).toBe(5);
    expect(baseScore([finding({ riskLevel: "medium" })])).toBe(20);
    expect(baseScore([finding({ riskLevel: "high" })])).toBe(40);
  });
});

describe("maxStatus", () => {
  it("never downgrades a decision", () => {
    expect(maxStatus("escalate", "approve")).toBe("escalate");
    expect(maxStatus("approve", "reject")).toBe("reject");
    expect(maxStatus("manual_review", "manual_review")).toBe("manual_review");
  });
});

describe("evaluate — decision mapping", () => {
  it("approves when all 7 agents report low risk with no flags", () => {
    const findings = Array.from({ length: 7 }, (_, i) =>
      finding({ agent: `Agent${i}` })
    );
    const r = evaluate(findings);
    expect(r.status).toBe("approve");
    expect(r.score).toBe(35);
    expect(r.triggeredRules).toEqual([]);
  });

  it("rejects on document forgery signal regardless of other findings", () => {
    const findings = [
      finding(),
      finding({ agent: "DocumentAuthenticityAgent", riskLevel: "high", flags: ["DOC_FORGERY_SIGNAL"] }),
    ];
    const r = evaluate(findings);
    expect(r.status).toBe("reject");
    expect(r.triggeredRules).toContain("RULE_FORGERY");
  });

  it("cannot auto-approve when no documents were uploaded", () => {
    const r = evaluate([finding({ flags: ["NO_DOCUMENTS_UPLOADED"] })]);
    expect(r.status).toBe("manual_review");
    expect(r.triggeredRules).toContain("RULE_NO_DOCS");
  });

  it("escalates when the Chair recommends escalation", () => {
    const r = evaluate([finding({ agent: "ChairAgent", flags: ["CHAIR_RECOMMENDS_ESCALATE"] })]);
    expect(r.status).toBe("escalate");
    expect(r.triggeredRules).toContain("RULE_CHAIR_ESCALATE");
  });

  it("rejects via score floor when many agents report high risk", () => {
    const findings = Array.from({ length: 4 }, (_, i) =>
      finding({ agent: `Agent${i}`, riskLevel: "high" })
    );
    const r = evaluate(findings); // 4 × 40 = 160 ≥ 150
    expect(r.status).toBe("reject");
    expect(r.score).toBe(160);
  });

  it("escalates via score floor between 90 and 149", () => {
    const findings = [
      finding({ agent: "A", riskLevel: "high" }),
      finding({ agent: "B", riskLevel: "high" }),
      finding({ agent: "C", riskLevel: "medium" }),
    ];
    const r = evaluate(findings); // 40+40+20 = 100
    expect(r.status).toBe("escalate");
  });

  it("caps the score at 999", () => {
    const findings = Array.from({ length: 30 }, (_, i) =>
      finding({ agent: `Agent${i}`, riskLevel: "high", flags: ["DOC_FORGERY_SIGNAL"] })
    );
    expect(evaluate(findings).score).toBe(999);
  });

  it("includes rule descriptions and agent summaries in reasons", () => {
    const r = evaluate([finding({ agent: "NameMatchingAgent", summary: "names differ", flags: ["ACCOUNT_MISMATCH"] })]);
    expect(r.reasons.some((x) => x.includes("RULE_ACCOUNT_MISMATCH"))).toBe(true);
    expect(r.reasons.some((x) => x.includes("names differ"))).toBe(true);
  });
});
