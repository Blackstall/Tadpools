import type { CaseInput, AgentFinding, DecisionResult } from "@tadpools/shared/index";
import { SharedMemoryClass, LLMClient } from "@tadpools/agents/index";
import type { AgentContext, SwarmAgent } from "@tadpools/agents/index";

import { natureOfBusinessAgent }       from "@tadpools/agents/agents/core/natureOfBusiness";
import { registrationAgeAgent }        from "@tadpools/agents/agents/core/registrationAge";
import { documentAuthenticityAgent }   from "@tadpools/agents/agents/core/documentAuthenticity";
import { existenceVerificationAgent }  from "@tadpools/agents/agents/core/existenceVerification";
import { nameMatchingAgent }           from "@tadpools/agents/agents/core/nameMatching";
import { beneficiaryConsistencyAgent } from "@tadpools/agents/agents/core/beneficiaryConsistency";
import { historicalSuspicionAgent }    from "@tadpools/agents/agents/core/historicalSuspicion";
import { skepticAgent }                from "@tadpools/agents/agents/meta/skeptic";
import { prosecutorAgent }             from "@tadpools/agents/agents/meta/prosecutor";
import { chairAgent }                  from "@tadpools/agents/agents/meta/chair";

import { decide }                from "./policyEngine.js";
import { logAudit }              from "./auditService.js";
import { insertAgentFindings }   from "../db/caseRepository.js";
import { insertDecision, updateCaseStatus } from "../db/caseRepository.js";
import { emitSwarm }             from "./eventBus.js";
import { db }                    from "../db/pool.js";

const CORE_AGENTS: SwarmAgent[] = [
  natureOfBusinessAgent, registrationAgeAgent, documentAuthenticityAgent,
  existenceVerificationAgent, nameMatchingAgent, beneficiaryConsistencyAgent,
  historicalSuspicionAgent,
];

async function loadExtractedFields(caseId: string) {
  const { rows } = await db.query(
    `SELECT doc_id as "docId", field_name as "fieldName", value
     FROM extracted_fields WHERE case_id = $1`,
    [caseId]
  );
  return rows as { docId: string; fieldName: string; value: string }[];
}

async function logAgentFindings(caseId: string, findings: AgentFinding[]) {
  for (const f of findings) {
    await logAudit(caseId, "agent.finding", {
      agent: f.agent, round: f.round, riskLevel: f.riskLevel,
      confidence: f.confidence, flags: f.flags, summary: f.summary,
      reasoning: f.reasoning, evidenceRefs: f.evidenceRefs,
    });
  }
}

/** Run a single agent, emit started/complete SSE events, publish to shared memory. */
async function runAgent(
  caseId: string,
  agent: SwarmAgent,
  ctx: AgentContext
): Promise<AgentFinding> {
  emitSwarm({ type: "agent.started", caseId, agent: agent.name, round: ctx.round });
  const finding = await agent.run(ctx);
  emitSwarm({
    type: "agent.complete", caseId,
    agent: finding.agent, round: finding.round,
    riskLevel: finding.riskLevel, confidence: finding.confidence,
    flags: finding.flags, summary: finding.summary, reasoning: finding.reasoning,
  });
  return finding;
}

export async function runSwarm(caseId: string, caseInput: CaseInput): Promise<DecisionResult> {
  const t0 = Date.now();
  const sharedMemory = new SharedMemoryClass();
  const extractedFields = await loadExtractedFields(caseId);
  const llm = new LLMClient(
    process.env.OLLAMA_URL ?? "http://localhost:11434",
    Number(process.env.LLM_TIMEOUT_MS ?? 25_000)
  );

  await logAudit(caseId, "swarm.started", {
    coreAgents: CORE_AGENTS.map((a) => a.name),
    extractedFieldCount: extractedFields.length,
    startedAt: new Date(t0).toISOString(),
  });

  // ── Round 1 ───────────────────────────────────────────────────────────────
  const r1ctx: AgentContext = { caseId, caseInput, extractedFields, sharedMemory, round: 1, llm };
  const round1 = await Promise.all(CORE_AGENTS.map((a) => runAgent(caseId, a, r1ctx)));

  await insertAgentFindings(caseId, round1, 1);
  await logAgentFindings(caseId, round1);
  emitSwarm({
    type: "round.complete", caseId, round: 1,
    highRisk: round1.filter((f) => f.riskLevel === "high").length,
    mediumRisk: round1.filter((f) => f.riskLevel === "medium").length,
    flags: [...new Set(round1.flatMap((f) => f.flags))],
  });
  await logAudit(caseId, "swarm.round1.complete", {
    durationMs: Date.now() - t0,
    agentCount: round1.length,
    highRisk: round1.filter((f) => f.riskLevel === "high").length,
    flags: [...new Set(round1.flatMap((f) => f.flags))],
  });

  // ── Round 2 — Challenge ───────────────────────────────────────────────────
  emitSwarm({ type: "challenge.started", caseId, round: 2 });
  const r2ctx: AgentContext = { caseId, caseInput, extractedFields, sharedMemory, round: 2, llm };
  const skeptic    = await runAgent(caseId, skepticAgent,    r2ctx);
  const prosecutor = await runAgent(caseId, prosecutorAgent, r2ctx);

  await insertAgentFindings(caseId, [skeptic, prosecutor], 2);
  await logAgentFindings(caseId, [skeptic, prosecutor]);
  emitSwarm({
    type: "round.complete", caseId, round: 2,
    flags: [...new Set([...skeptic.flags, ...prosecutor.flags])],
  });
  await logAudit(caseId, "swarm.round2.complete", {
    durationMs: Date.now() - t0,
    skepticRisk: skeptic.riskLevel, prosecutorFlags: prosecutor.flags,
  });

  // ── Round 3 — Synthesis ───────────────────────────────────────────────────
  emitSwarm({ type: "synthesis.started", caseId, round: 3 });
  const r3ctx: AgentContext = { caseId, caseInput, extractedFields, sharedMemory, round: 3, llm };
  const chair = await runAgent(caseId, chairAgent, r3ctx);

  await insertAgentFindings(caseId, [chair], 3);
  await logAgentFindings(caseId, [chair]);
  emitSwarm({
    type: "round.complete", caseId, round: 3,
    flags: chair.flags, summary: chair.summary,
  });
  await logAudit(caseId, "swarm.round3.complete", {
    durationMs: Date.now() - t0,
    chairRisk: chair.riskLevel, chairFlags: chair.flags, chairSummary: chair.summary,
  });

  // ── Policy ────────────────────────────────────────────────────────────────
  const allFindings = sharedMemory.snapshot();
  const result = await decide(caseId, allFindings);

  const triggeredRules = result.reasons.filter((r) => r.startsWith("[RULE_"));
  emitSwarm({
    type: "decision", caseId,
    status: result.status, score: result.score, triggeredRules,
  });
  await logAudit(caseId, "policy.decision", {
    status: result.status, score: result.score,
    triggeredRules, totalDurationMs: Date.now() - t0,
  });

  return result;
}
