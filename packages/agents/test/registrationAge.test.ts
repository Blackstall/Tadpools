import { describe, it, expect } from "vitest";
import { registrationAgeAgent } from "@tadpools/agents/agents/core/registrationAge";
import { makeCaseInput, makeContext, monthsAgo } from "./helpers";

describe("RegistrationAgeAgent (deterministic fallback — no LLM)", () => {
  it("reports low risk for a company older than 24 months", async () => {
    const ctx = makeContext(makeCaseInput({ registrationDate: "2014-03-01" }));
    const f = await registrationAgeAgent.run(ctx);
    expect(f.riskLevel).toBe("low");
    expect(f.flags).toHaveLength(0);
  });

  it("reports high risk with AGE_UNDER_6M for a company under 6 months old", async () => {
    const ctx = makeContext(makeCaseInput({ registrationDate: monthsAgo(2) }));
    const f = await registrationAgeAgent.run(ctx);
    expect(f.riskLevel).toBe("high");
    expect(f.flags).toContain("AGE_UNDER_6M");
    expect(f.flags).toContain("NEW_ENTITY_HIGH_RISK");
  });

  it("reports medium risk between 6 and 24 months", async () => {
    const ctx = makeContext(makeCaseInput({ registrationDate: monthsAgo(12) }));
    const f = await registrationAgeAgent.run(ctx);
    expect(f.riskLevel).toBe("medium");
    expect(f.flags).toContain("NEW_ENTITY_HIGH_RISK");
  });

  it("always populates reasoning[] for explainability", async () => {
    const ctx = makeContext(makeCaseInput({ registrationDate: monthsAgo(2) }));
    const f = await registrationAgeAgent.run(ctx);
    expect(f.reasoning.length).toBeGreaterThan(0);
  });

  it("publishes its finding to shared memory and preserves the round", async () => {
    const ctx = makeContext(makeCaseInput(), 2);
    const f = await registrationAgeAgent.run(ctx);
    expect(f.round).toBe(2);
    const published = ctx.sharedMemory.readAll();
    expect(published.map((p) => p.agent)).toContain("RegistrationAgeAgent");
  });

  it("works when the LLM is unavailable (Ollama offline)", async () => {
    // offlineLLM always returns null — the agent must still produce a finding
    const ctx = makeContext(makeCaseInput({ registrationDate: monthsAgo(3) }));
    const f = await registrationAgeAgent.run(ctx);
    expect(f.summary.length).toBeGreaterThan(0);
    expect(f.riskLevel).toBe("high");
  });
});
