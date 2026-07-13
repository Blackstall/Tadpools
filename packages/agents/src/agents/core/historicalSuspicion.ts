import type { AgentFinding } from "@tadpools/shared/index";
import type { AgentContext, SwarmAgent } from "../../index.js";
import { getModelForAgent } from "../../llm/modelRouter.js";

const SYSTEM_PROMPT = `You are HistoricalSuspicionAgent in a KYC compliance swarm.
Assess whether the entity name or registration shows patterns associated with fraud or money laundering.
Consider: name patterns of shell companies, registration anomalies, common fraud indicators.
Respond in 1-2 sentences only.`;

/**
 * Mock suspicious directory — in Phase 5 this hits a real DB table or API.
 * Entries: [type, value, reason]
 */
const SUSPICIOUS_DIRECTORY: Array<{ type: "name" | "regnum" | "account"; value: string; reason: string }> = [
  { type: "name",   value: "shell holdings",        reason: "Known shell entity pattern" },
  { type: "name",   value: "phantom trading",        reason: "Previously flagged for fraud" },
  { type: "name",   value: "quick cash",             reason: "High-velocity cash flow pattern" },
  { type: "regnum", value: "202001999999",            reason: "Registration number in suspicious list" },
  { type: "account", value: "0000000000",             reason: "Blacklisted account number" },
];

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function checkDirectory(value: string, type: "name" | "regnum" | "account"): string | null {
  const n = normalize(value);
  const entry = SUSPICIOUS_DIRECTORY.find(
    (e) => e.type === type && (normalize(e.value) === n || n.includes(normalize(e.value)))
  );
  return entry ? entry.reason : null;
}

export const historicalSuspicionAgent: SwarmAgent = {
  name: "HistoricalSuspicionAgent",

  async run(ctx: AgentContext): Promise<AgentFinding> {
    const { companyName, registrationNumber } = ctx.caseInput.company;
    const { accountNumber } = ctx.caseInput.beneficiary;

    const reasoning: string[] = [];
    const flags: string[] = [];
    let riskLevel: AgentFinding["riskLevel"] = "low";
    let confidence = 0.80;
    let summary: string;

    reasoning.push("Checking against mock suspicious entity directory...");

    const nameHit = checkDirectory(companyName, "name");
    if (nameHit) {
      flags.push("DIRECTORY_MATCH_NAME");
      riskLevel = "high";
      confidence = 0.95;
      reasoning.push(`Company name "${companyName}" matched directory: ${nameHit}`);
    } else {
      reasoning.push(`Company name "${companyName}": no directory match.`);
    }

    const regHit = checkDirectory(registrationNumber, "regnum");
    if (regHit) {
      flags.push("DIRECTORY_MATCH_REGNUM");
      riskLevel = "high";
      confidence = 0.97;
      reasoning.push(`Registration number "${registrationNumber}" matched directory: ${regHit}`);
    } else {
      reasoning.push(`Registration number "${registrationNumber}": no directory match.`);
    }

    const accHit = checkDirectory(accountNumber, "account");
    if (accHit) {
      flags.push("DIRECTORY_MATCH_ACCOUNT");
      riskLevel = "high";
      confidence = 0.97;
      reasoning.push(`Account number "${accountNumber}" matched directory: ${accHit}`);
    } else {
      reasoning.push(`Account number "${accountNumber}": no directory match.`);
    }

    // Interaction: if RegistrationAgeAgent flagged new entity, add extra scrutiny note
    const ageAgent = ctx.sharedMemory.get("RegistrationAgeAgent");
    if (ageAgent?.flags.includes("NEW_ENTITY_HIGH_RISK")) {
      reasoning.push("Peer (RegistrationAgeAgent): new entity increases importance of clean directory result.");
      if (riskLevel === "low") {
        reasoning.push("No directory match found — provides some assurance for new entity.");
      }
    }

    reasoning.push("Note: full historical database cross-reference pending (Phase 5 integration).");
    flags.push("HISTORICAL_CHECK_PARTIAL");

    if (flags.filter((f) => f.startsWith("DIRECTORY_MATCH")).length > 0) {
      summary = `ALERT: Entity matched suspicious directory on ${flags.filter((f) => f.startsWith("DIRECTORY_MATCH")).join(", ")}.`;
    } else {
      summary = "No matches found in suspicious entity directory. Partial check — full scan pending.";
    }

    // ── LLM enrichment (pattern recognition) ──────────────────────────────────
    const model = getModelForAgent(this.name);
    const llmResult = await ctx.llm.complete(
      model,
      SYSTEM_PROMPT,
      `Company name: "${companyName}", reg: "${registrationNumber}", sector: "${ctx.caseInput.company.natureOfBusiness}". Beneficiary: "${ctx.caseInput.beneficiary.beneficiaryName}". Directory matches: ${flags.filter(f => f.startsWith("DIRECTORY_MATCH")).join(", ") || "none"}. Does this entity show patterns of fraud or shell company activity?`,
      120
    );
    if (llmResult) {
      reasoning.push(`[LLM ${llmResult.model} ${llmResult.durationMs}ms] ${llmResult.content}`);
    }
    // ───────────────────────────────────────────────────────────────────────────

    const finding: AgentFinding = {
      agent: this.name,
      summary,
      confidence,
      riskLevel,
      evidenceRefs: [
        `company.companyName:${companyName}`,
        `company.registrationNumber:${registrationNumber}`,
        `beneficiary.accountNumber:${accountNumber}`,
      ],
      flags,
      reasoning,
      round: ctx.round,
    };

    ctx.sharedMemory.publish(finding);
    return finding;
  },
};
