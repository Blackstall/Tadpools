import { describe, it, expect } from "vitest";
import { nameMatchingAgent } from "@tadpools/agents/agents/core/nameMatching";
import { makeCaseInput, makeContext } from "./helpers";

describe("NameMatchingAgent (deterministic fallback — no LLM)", () => {
  it("reports low risk when company and beneficiary names match", async () => {
    const ctx = makeContext(makeCaseInput({
      companyName: "Aqua Logistics Sdn Bhd",
      beneficiaryName: "Aqua Logistics Sdn Bhd",
    }));
    const f = await nameMatchingAgent.run(ctx);
    expect(f.riskLevel).toBe("low");
    expect(f.flags).not.toContain("NAME_MISMATCH");
  });

  it("ignores legal suffixes when comparing names", async () => {
    const ctx = makeContext(makeCaseInput({
      companyName: "Aqua Logistics Sdn Bhd",
      beneficiaryName: "Aqua Logistics",
    }));
    const f = await nameMatchingAgent.run(ctx);
    expect(f.riskLevel).toBe("low");
  });

  it("flags NAME_MISMATCH when names are entirely different entities", async () => {
    const ctx = makeContext(makeCaseInput({
      companyName: "Aqua Logistics Sdn Bhd",
      beneficiaryName: "Zenith Petro Holdings Ltd",
    }));
    const f = await nameMatchingAgent.run(ctx);
    expect(f.riskLevel).toBe("high");
    expect(f.flags).toContain("NAME_MISMATCH");
  });

  it("always populates reasoning[] including the similarity score", async () => {
    const ctx = makeContext(makeCaseInput());
    const f = await nameMatchingAgent.run(ctx);
    expect(f.reasoning.some((r) => r.toLowerCase().includes("similarity"))).toBe(true);
  });

  it("publishes to shared memory", async () => {
    const ctx = makeContext(makeCaseInput());
    await nameMatchingAgent.run(ctx);
    expect(ctx.sharedMemory.readAll().map((p) => p.agent)).toContain("NameMatchingAgent");
  });
});
