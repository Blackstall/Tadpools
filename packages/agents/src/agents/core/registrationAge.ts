import type { AgentFinding } from "@tadpools/shared/index";
import type { AgentContext, SwarmAgent } from "../../index.js";
import { getModelForAgent } from "../../llm/modelRouter.js";

const SYSTEM_PROMPT = `You are RegistrationAgeAgent in a KYC compliance swarm.
Assess the fraud risk implied by a company's registration age in the context of its sector.
Respond in 1-2 sentences only. Be direct.`;

export const registrationAgeAgent: SwarmAgent = {
  name: "RegistrationAgeAgent",

  async run(ctx: AgentContext): Promise<AgentFinding> {
    const { registrationDate } = ctx.caseInput.company;
    const regDate = new Date(registrationDate);
    const now = new Date();
    const ageMonths = (now.getFullYear() - regDate.getFullYear()) * 12
      + (now.getMonth() - regDate.getMonth());

    const reasoning: string[] = [];
    const flags: string[] = [];
    let riskLevel: AgentFinding["riskLevel"];
    let confidence: number;
    let summary: string;

    reasoning.push(`Registration date parsed: ${registrationDate}`);
    reasoning.push(`Company age: ${ageMonths} months`);

    if (ageMonths < 6) {
      riskLevel = "high";
      confidence = 0.92;
      flags.push("NEW_ENTITY_HIGH_RISK", "AGE_UNDER_6M");
      summary = `Company is only ${ageMonths} month(s) old — very high onboarding risk without strong supporting evidence.`;
      reasoning.push("< 6 months: insufficient operating history, elevated fraud risk.");
    } else if (ageMonths < 24) {
      riskLevel = "medium";
      confidence = 0.80;
      flags.push("NEW_ENTITY_HIGH_RISK");
      summary = `Company is ${ageMonths} months old — requires stronger supporting documentation.`;
      reasoning.push("6–24 months: early-stage entity; corroborating documents mandatory.");
    } else {
      riskLevel = "low";
      confidence = 0.88;
      summary = `Company has ${ageMonths} months of registration history — age is not a risk factor.`;
      reasoning.push("> 24 months: established registration age, no age-based flag.");
    }

    // ── LLM enrichment (age-sector risk context) ───────────────────────────────
    if (riskLevel !== "low") {
      const model = getModelForAgent(this.name);
      const llmResult = await ctx.llm.complete(
        model,
        SYSTEM_PROMPT,
        `Company age: ${ageMonths} months. Sector: "${ctx.caseInput.company.natureOfBusiness}". Risk level assigned: ${riskLevel}. What does this age profile suggest for onboarding risk?`,
        100
      );
      if (llmResult) {
        reasoning.push(`[LLM ${llmResult.model} ${llmResult.durationMs}ms] ${llmResult.content}`);
      }
    }
    // ───────────────────────────────────────────────────────────────────────────

    const finding: AgentFinding = {
      agent: this.name,
      summary,
      confidence,
      riskLevel,
      evidenceRefs: [`company.registrationDate:${registrationDate}`],
      flags,
      reasoning,
      round: ctx.round,
    };

    ctx.sharedMemory.publish(finding);
    return finding;
  },
};
