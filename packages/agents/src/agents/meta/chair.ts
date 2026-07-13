import type { AgentFinding } from "@tadpools/shared/index";
import type { AgentContext, SwarmAgent } from "../../index.js";
import { getModelForAgent } from "../../llm/modelRouter.js";

const SYSTEM_PROMPT = `You are ChairAgent in a KYC compliance swarm.
Your role: synthesise all agent findings into a final risk recommendation.
You resolve Skeptic vs Prosecutor conflicts and produce the definitive compliance verdict.
Respond in 3-4 sentences. Be authoritative. Reference the most material evidence.
State your recommended decision: approve / manual_review / escalate / reject.
Explain the single most important reason for your recommendation.`;

/**
 * ChairAgent — Round 3 synthesis agent.
 *
 * Reads all findings from all rounds, resolves conflicts between
 * Skeptic and Prosecutor, detects consensus, and produces the
 * structured summary the policy engine acts on.
 */
export const chairAgent: SwarmAgent = {
  name: "ChairAgent",

  async run(ctx: AgentContext): Promise<AgentFinding> {
    const allFindings = ctx.sharedMemory.snapshot();
    const round1 = allFindings.filter((f) => f.round === 1);
    const round2 = allFindings.filter((f) => f.round === 2);

    const reasoning: string[] = [];
    const flags: string[] = [];

    reasoning.push(`Synthesising ${allFindings.length} findings (R1: ${round1.length}, R2: ${round2.length})...`);

    // ── Conflict resolution ────────────────────────────────────────────────────
    const skeptic = ctx.sharedMemory.get("SkepticAgent");
    const prosecutor = ctx.sharedMemory.get("ProsecutorAgent");

    const skepticChallenged = skeptic?.flags.includes("SKEPTIC_REDUCED_NOISE") ?? false;
    const prosecutorEscalated = prosecutor
      ? prosecutor.flags.some((f) => f.startsWith("PATTERN_") || f === "DOC_FORGERY_SIGNAL")
      : false;

    if (skepticChallenged && prosecutorEscalated) {
      reasoning.push("Conflict: Skeptic reduced noise BUT Prosecutor found compound patterns — Prosecutor takes precedence.");
    } else if (skepticChallenged) {
      reasoning.push("Skeptic reduced soft signals — noise reduction acknowledged.");
    } else if (prosecutorEscalated) {
      reasoning.push("Prosecutor found compound patterns — elevating overall risk assessment.");
    } else {
      reasoning.push("No Skeptic/Prosecutor conflict — Round-1 findings stand as-is.");
    }

    // ── Flag aggregation ───────────────────────────────────────────────────────
    const allFlags = allFindings.flatMap((f) => f.flags);
    const uniqueFlags = [...new Set(allFlags)];

    const HARD_REJECT_FLAGS = ["DOC_FORGERY_SIGNAL", "DIRECTORY_MATCH"];
    const HARD_ESCALATE_FLAGS = [
      "ACCOUNT_MISMATCH", "VOUCHER_ACCOUNT_MISMATCH", "DIRECTORY_MATCH_NAME",
      "DIRECTORY_MATCH_REGNUM", "DIRECTORY_MATCH_ACCOUNT", "PATTERN_DOCUMENT_FRAUD_SIGNAL",
    ];

    const hasRejectFlag = HARD_REJECT_FLAGS.some((f) => uniqueFlags.includes(f));
    const hasEscalateFlag = HARD_ESCALATE_FLAGS.some((f) => uniqueFlags.includes(f));

    if (hasRejectFlag) {
      flags.push("CHAIR_RECOMMENDS_REJECT");
      reasoning.push(`Hard reject flag(s) detected: ${HARD_REJECT_FLAGS.filter((f) => uniqueFlags.includes(f)).join(", ")}`);
    } else if (hasEscalateFlag) {
      flags.push("CHAIR_RECOMMENDS_ESCALATE");
      reasoning.push(`Hard escalate flag(s) detected: ${HARD_ESCALATE_FLAGS.filter((f) => uniqueFlags.includes(f)).join(", ")}`);
    }

    // ── Risk level consensus ───────────────────────────────────────────────────
    const highCount = round1.filter((f) => f.riskLevel === "high").length;
    const mediumCount = round1.filter((f) => f.riskLevel === "medium").length;

    reasoning.push(`Round-1 risk distribution → high: ${highCount}, medium: ${mediumCount}, low: ${round1.filter((f) => f.riskLevel === "low").length}`);

    let consensusRisk: AgentFinding["riskLevel"];
    if (highCount >= 2 || hasRejectFlag || hasEscalateFlag) {
      consensusRisk = "high";
    } else if (highCount === 1 || mediumCount >= 3 || prosecutorEscalated) {
      consensusRisk = "medium";
    } else {
      consensusRisk = "low";
    }

    reasoning.push(`Consensus risk level: ${consensusRisk}`);

    const avgConfidence = round1.length > 0
      ? round1.reduce((s, f) => s + f.confidence, 0) / round1.length
      : 0.5;
    const confidence = Math.min(Math.round(avgConfidence * 100) / 100, 0.99);

    const totalUniqueFlags = uniqueFlags.filter(
      (f) => !["EXTERNAL_CHECK_PENDING", "HISTORICAL_CHECK_PARTIAL", "SKEPTIC_REDUCED_NOISE"].includes(f)
    );

    // ── LLM synthesis ──────────────────────────────────────────────────────────
    const model = getModelForAgent(this.name);
    const allSummaries = allFindings.map(
      (f) => `[R${f.round}] ${f.agent}: ${f.riskLevel} — ${f.summary}`
    ).join("\n");

    const userMsg = `All swarm findings:\n${allSummaries}\n\nCompany: ${ctx.caseInput.company.companyName} (${ctx.caseInput.company.natureOfBusiness})\nBeneficiary: ${ctx.caseInput.beneficiary.beneficiaryName} @ ${ctx.caseInput.beneficiary.bankName}\nCompany age: ${ctx.caseInput.company.registrationDate}\nDocuments: ${ctx.extractedFields.length > 0 ? ctx.extractedFields.length + " extracted fields" : "none uploaded"}\nActive flags: ${totalUniqueFlags.join(", ") || "none"}\nConsensus risk: ${consensusRisk}\n\nAs Chair, synthesise these findings and give your final compliance recommendation.`;

    const llmResult = await ctx.llm.complete(model, SYSTEM_PROMPT, userMsg, 250);
    if (llmResult) {
      reasoning.push(`[LLM ${llmResult.model} ${llmResult.durationMs}ms] ${llmResult.content}`);
    }
    // ───────────────────────────────────────────────────────────────────────────

    const summary = hasRejectFlag
      ? `Chair recommends REJECT — hard fraud signals detected: ${HARD_REJECT_FLAGS.filter((f) => uniqueFlags.includes(f)).join(", ")}.`
      : hasEscalateFlag
        ? `Chair recommends ESCALATE — critical discrepancies require human review: ${HARD_ESCALATE_FLAGS.filter((f) => uniqueFlags.includes(f)).join(", ")}.`
        : totalUniqueFlags.length === 0
          ? `Chair: consensus is CLEAN — no material risk signals detected across all agents.`
          : `Chair: consensus risk is ${consensusRisk} with ${totalUniqueFlags.length} active signal(s): ${totalUniqueFlags.slice(0, 4).join(", ")}${totalUniqueFlags.length > 4 ? "..." : ""}.`;

    const finding: AgentFinding = {
      agent: this.name,
      summary,
      confidence,
      riskLevel: consensusRisk,
      evidenceRefs: allFindings.map((f) => `agent:${f.agent}`),
      flags,
      reasoning,
      round: ctx.round,
    };

    ctx.sharedMemory.publish(finding);
    return finding;
  },
};
