import type { AgentFinding } from "@tadpools/shared/index";
import type { AgentContext, SwarmAgent } from "../../index.js";
import { getModelForAgent } from "../../llm/modelRouter.js";

const SYSTEM_PROMPT = `You are SkepticAgent in a KYC compliance swarm.
Your role: identify false positives in Round-1 risk findings.
You protect legitimate businesses from over-flagging.
Respond in 2-3 sentences. Be direct, analytical, no preamble.
Focus on: whether flags are system limitations vs genuine red flags,
whether new-entity risk is offset by docs, whether mismatch could be a trading name.`;

/**
 * SkepticAgent — Round 2 meta-agent.
 *
 * Reads all Round 1 findings and challenges those that may represent
 * false positives. Aims to reduce noise and protect legitimate businesses.
 */
export const skepticAgent: SwarmAgent = {
  name: "SkepticAgent",

  async run(ctx: AgentContext): Promise<AgentFinding> {
    const round1 = ctx.sharedMemory.readRound(1);
    const reasoning: string[] = [];
    const flags: string[] = [];
    let overallRisk: AgentFinding["riskLevel"] = "low";
    let confidence = 0.78;

    reasoning.push(`Challenging ${round1.length} Round-1 findings for false positives...`);

    let challengeCount = 0;
    const challengeNotes: string[] = [];

    for (const finding of round1) {
      // Challenge NEW_ENTITY_HIGH_RISK alone if docs are present
      if (finding.flags.includes("NEW_ENTITY_HIGH_RISK") && ctx.extractedFields.length > 0) {
        challengeNotes.push(
          `${finding.agent}: NEW_ENTITY_HIGH_RISK weakened — entity provided ${ctx.extractedFields.length} extracted field(s) as supporting evidence.`
        );
        challengeCount++;
      }

      // Challenge EXTERNAL_CHECK_PENDING — it is a system limitation, not an entity fault
      if (finding.flags.includes("EXTERNAL_CHECK_PENDING")) {
        challengeNotes.push(
          `${finding.agent}: EXTERNAL_CHECK_PENDING is a system limitation, not evidence of wrongdoing.`
        );
        challengeCount++;
      }

      // Challenge HISTORICAL_CHECK_PARTIAL — partial check should not weigh heavily
      if (finding.flags.includes("HISTORICAL_CHECK_PARTIAL")) {
        challengeNotes.push(
          `${finding.agent}: HISTORICAL_CHECK_PARTIAL is incomplete — absence of a full match is not a red flag.`
        );
        challengeCount++;
      }

      // Challenge NAME_PARTIAL_MISMATCH when company uses trading name
      if (finding.flags.includes("NAME_PARTIAL_MISMATCH")) {
        const companyName = ctx.caseInput.company.companyName.toLowerCase();
        const benName = ctx.caseInput.beneficiary.beneficiaryName.toLowerCase();
        if (companyName.includes(benName.split(" ")[0]) || benName.includes(companyName.split(" ")[0])) {
          challengeNotes.push(
            `${finding.agent}: NAME_PARTIAL_MISMATCH — names share common root word, likely trading name variation.`
          );
          challengeCount++;
        }
      }
    }

    // Compute how many hard flags remain after skeptic challenges
    const hardFlags = round1.flatMap((f) => f.flags).filter((f) =>
      ["NAME_MISMATCH", "ACCOUNT_MISMATCH", "DOC_FORGERY_SIGNAL", "DIRECTORY_MATCH_NAME",
       "DIRECTORY_MATCH_REGNUM", "DIRECTORY_MATCH_ACCOUNT", "INVOICE_ISSUER_MISMATCH",
       "VOUCHER_ACCOUNT_MISMATCH"].includes(f)
    );

    if (hardFlags.length > 0) {
      overallRisk = "medium";
      reasoning.push(`Hard flags remain after skeptic review: ${hardFlags.join(", ")}`);
      reasoning.push("Skeptic cannot dismiss these — they require human judgement.");
    } else if (challengeCount > 0) {
      overallRisk = "low";
      flags.push("SKEPTIC_REDUCED_NOISE");
      reasoning.push(`Skeptic successfully challenged ${challengeCount} soft signal(s).`);
    } else {
      reasoning.push("No strong challenges found — original findings stand.");
    }

    challengeNotes.forEach((n) => reasoning.push(`  → ${n}`));

    const highCount = round1.filter((f) => f.riskLevel === "high").length;
    if (highCount > 2) {
      overallRisk = "high";
      reasoning.push(`${highCount} agents independently reported high risk — skeptic defers.`);
    }

    // ── LLM enrichment ─────────────────────────────────────────────────────────
    const model = getModelForAgent(this.name);
    const findingsSummary = round1.map(
      (f) => `${f.agent}: ${f.riskLevel} risk — flags: [${f.flags.join(", ") || "none"}] — ${f.summary}`
    ).join("\n");

    const userMsg = `Round-1 findings:\n${findingsSummary}\n\nCompany: ${ctx.caseInput.company.companyName}, sector: ${ctx.caseInput.company.natureOfBusiness}\nDocuments uploaded: ${ctx.extractedFields.length > 0 ? "yes" : "no"}\n\nAs Skeptic, which findings are likely false positives and why?`;

    const llmResult = await ctx.llm.complete(model, SYSTEM_PROMPT, userMsg, 180);
    if (llmResult) {
      reasoning.push(`[LLM ${llmResult.model} ${llmResult.durationMs}ms] ${llmResult.content}`);
    }
    // ───────────────────────────────────────────────────────────────────────────

    const summary = hardFlags.length > 0
      ? `Skeptic: ${hardFlags.length} hard flag(s) cannot be dismissed. ${challengeCount} soft signal(s) challenged.`
      : challengeCount > 0
        ? `Skeptic: reduced ${challengeCount} false-positive risk(s). No hard flags identified.`
        : "Skeptic: no challenges raised. Round-1 findings are well-founded.";

    const finding: AgentFinding = {
      agent: this.name,
      summary,
      confidence,
      riskLevel: overallRisk,
      evidenceRefs: round1.map((f) => `agent:${f.agent}`),
      flags,
      reasoning,
      round: ctx.round,
    };

    ctx.sharedMemory.publish(finding);
    return finding;
  },
};
