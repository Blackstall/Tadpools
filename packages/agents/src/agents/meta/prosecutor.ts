import type { AgentFinding } from "@tadpools/shared/index";
import type { AgentContext, SwarmAgent } from "../../index.js";
import { getModelForAgent } from "../../llm/modelRouter.js";

const SYSTEM_PROMPT = `You are ProsecutorAgent in a KYC compliance swarm.
Your role: identify hidden fraud patterns that individual agents may have missed.
You surface combinations of risk signals that together suggest fraud.
Respond in 2-3 sentences. Be precise. Reference specific flags or patterns.
Focus on: compound risks, proxy entity structures, layering signals, document fraud indicators.`;

/**
 * ProsecutorAgent — Round 2 meta-agent.
 *
 * Reads all Round 1 findings and looks for patterns that agents may have
 * missed individually. Surfaces combinations of signals that together
 * suggest fraud risk higher than any single agent identified.
 */
export const prosecutorAgent: SwarmAgent = {
  name: "ProsecutorAgent",

  async run(ctx: AgentContext): Promise<AgentFinding> {
    const round1 = ctx.sharedMemory.readRound(1);
    const reasoning: string[] = [];
    const flags: string[] = [];
    let riskLevel: AgentFinding["riskLevel"] = "low";
    let confidence = 0.80;

    const allFlags = round1.flatMap((f) => f.flags);
    const highRiskAgents = round1.filter((f) => f.riskLevel === "high");
    const mediumRiskAgents = round1.filter((f) => f.riskLevel === "medium");

    reasoning.push(`Analysing ${round1.length} Round-1 findings for hidden risk patterns...`);
    reasoning.push(`Total flags: ${allFlags.length}, High-risk agents: ${highRiskAgents.length}, Medium: ${mediumRiskAgents.length}`);

    // Pattern 1: New entity + no documents
    const isNew = allFlags.includes("NEW_ENTITY_HIGH_RISK");
    const noDocs = allFlags.includes("NO_DOCUMENTS_UPLOADED");
    if (isNew && noDocs) {
      flags.push("PATTERN_NEW_ENTITY_NO_DOCS");
      riskLevel = "high";
      confidence = 0.93;
      reasoning.push("PATTERN: New entity + zero documents uploaded = very high fraud risk combination.");
    }

    // Pattern 2: New entity + partial name mismatch + unknown bank
    const nameMismatch = allFlags.includes("NAME_PARTIAL_MISMATCH") || allFlags.includes("NAME_MISMATCH");
    const unknownBank = allFlags.includes("UNKNOWN_BANK");
    if (isNew && nameMismatch && unknownBank) {
      flags.push("PATTERN_PROXY_ENTITY");
      riskLevel = "high";
      confidence = 0.90;
      reasoning.push("PATTERN: New entity + name mismatch + unknown bank = possible proxy entity structure.");
    }

    // Pattern 3: Multiple medium-risk agents
    if (mediumRiskAgents.length >= 3) {
      flags.push("PATTERN_CUMULATIVE_MEDIUM_RISK");
      riskLevel = riskLevel === "high" ? "high" : "medium";
      confidence = Math.max(confidence, 0.85);
      reasoning.push(`PATTERN: ${mediumRiskAgents.length} agents independently rated medium risk — cumulative risk is higher than any single signal.`);
    }

    // Pattern 4: High-risk sector + new entity
    const highSector = allFlags.includes("HIGH_RISK_SECTOR");
    if (highSector && isNew) {
      flags.push("PATTERN_NEW_HIGH_RISK_SECTOR");
      riskLevel = "high";
      reasoning.push("PATTERN: High-risk sector + new entity = elevated money laundering risk.");
    }

    // Pattern 5: Any directory match is always escalated regardless
    const directoryMatch = allFlags.some((f) => f.startsWith("DIRECTORY_MATCH_"));
    if (directoryMatch) {
      flags.push("DIRECTORY_MATCH");
      riskLevel = "high";
      confidence = 0.97;
      reasoning.push("HARD RULE: Any directory match triggers automatic escalation — Prosecutor reinforces.");
    }

    // Pattern 6: Account mismatch + doc field mismatch
    const accMismatch = allFlags.includes("ACCOUNT_MISMATCH") || allFlags.includes("VOUCHER_ACCOUNT_MISMATCH");
    const issuerMismatch = allFlags.includes("INVOICE_ISSUER_MISMATCH");
    if (accMismatch && issuerMismatch) {
      flags.push("PATTERN_DOCUMENT_FRAUD_SIGNAL");
      riskLevel = "high";
      confidence = 0.95;
      flags.push("DOC_FORGERY_SIGNAL");
      reasoning.push("PATTERN: Account mismatch + issuer mismatch in documents = strong forgery signal.");
    }

    if (flags.length === 0) {
      reasoning.push("No compound risk patterns detected. Round-1 findings appear independent and non-compounding.");
    }

    // ── LLM enrichment ─────────────────────────────────────────────────────────
    const model = getModelForAgent(this.name);
    const findingsSummary = round1.map(
      (f) => `${f.agent}: ${f.riskLevel} — flags: [${f.flags.join(", ") || "none"}] — ${f.summary}`
    ).join("\n");

    const userMsg = `Round-1 findings:\n${findingsSummary}\n\nCompany: ${ctx.caseInput.company.companyName}\nSector: ${ctx.caseInput.company.natureOfBusiness}\nBeneficiary: ${ctx.caseInput.beneficiary.beneficiaryName}\nBank: ${ctx.caseInput.beneficiary.bankName}\nDocuments: ${ctx.extractedFields.length > 0 ? ctx.extractedFields.length + " fields" : "none"}\n\nAs Prosecutor, what hidden fraud patterns or compound risks do you see?`;

    const llmResult = await ctx.llm.complete(model, SYSTEM_PROMPT, userMsg, 180);
    if (llmResult) {
      reasoning.push(`[LLM ${llmResult.model} ${llmResult.durationMs}ms] ${llmResult.content}`);
    }
    // ───────────────────────────────────────────────────────────────────────────

    const summary = flags.length > 0
      ? `Prosecutor identified ${flags.length} compound risk pattern(s): ${flags.filter((f) => f.startsWith("PATTERN_") || f === "DIRECTORY_MATCH" || f === "DOC_FORGERY_SIGNAL").join(", ")}.`
      : "Prosecutor: no hidden risk patterns detected beyond Round-1 findings.";

    const finding: AgentFinding = {
      agent: this.name,
      summary,
      confidence,
      riskLevel,
      evidenceRefs: round1.map((f) => `agent:${f.agent}`),
      flags,
      reasoning,
      round: ctx.round,
    };

    ctx.sharedMemory.publish(finding);
    return finding;
  },
};
