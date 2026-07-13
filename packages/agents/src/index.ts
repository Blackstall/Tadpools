import type { AgentFinding, CaseInput } from "@tadpools/shared/index";
import type { SharedMemory } from "./sharedMemory.js";
import type { LLMClient } from "./llm/client.js";

export type { SharedMemory } from "./sharedMemory.js";
export { SharedMemory as SharedMemoryClass } from "./sharedMemory.js";
export { LLMClient } from "./llm/client.js";
export { getModelForAgent, getTierForAgent } from "./llm/modelRouter.js";

// ── Extracted field record (loaded from DB before swarm runs) ─────────────────
export interface ExtractedFieldRecord {
  docId: string;
  fieldName: string;
  value: string;
}

// ── Agent context passed to every agent on every run ─────────────────────────
export interface AgentContext {
  caseId: string;
  caseInput: CaseInput;
  extractedFields: ExtractedFieldRecord[];   // structured fields from extraction pipeline
  sharedMemory: SharedMemory;               // live swarm memory — read & write
  round: number;                            // current swarm round
  llm: LLMClient;                           // LLM client for reasoning enrichment (Phase 5)
}

// ── Base interface all agents implement ──────────────────────────────────────
export interface SwarmAgent {
  name: string;
  /**
   * Analyse the case, optionally read sharedMemory for peer findings,
   * return a structured finding, then publish to sharedMemory.
   *
   * Contract:
   * - MUST call sharedMemory.publish(finding) before returning
   * - MUST set finding.round = context.round
   * - MUST populate reasoning[] for explainability
   */
  run(context: AgentContext): Promise<AgentFinding>;
}

// ── Prompts used when wiring real LLMs (Phase 5) ─────────────────────────────
export const agentPrompts = {
  natureOfBusiness: `You are NatureOfBusinessAgent. Determine if the company's stated business activity
aligns with the type and purpose of payment being made. Flag any sector mismatch.
Return: summary, confidence (0-1), riskLevel, flags[], reasoning[].`,

  registrationAge: `You are RegistrationAgeAgent. Assess the registration date risk.
Younger companies require stronger supporting evidence.
Return: summary, confidence, riskLevel, flags[], reasoning[].`,

  documentAuthenticity: `You are DocumentAuthenticityAgent. Review extracted document fields for
internal consistency, issuer-beneficiary alignment, and possible forgery indicators.
Return: summary, confidence, riskLevel, flags[], reasoning[].`,

  existenceVerification: `You are ExistenceVerificationAgent. Verify that the company shows credible
signs of legitimate existence (registry format, name validity, known address signals).
Return: summary, confidence, riskLevel, flags[], reasoning[].`,

  nameMatching: `You are NameMatchingAgent. Compare the company name against the beneficiary name.
Flag significant mismatches that may indicate a shell or proxy structure.
Return: summary, confidence, riskLevel, flags[], reasoning[].`,

  beneficiaryConsistency: `You are BeneficiaryConsistencyAgent. Validate the beneficiary bank account
number and bank name. Cross-check against extracted payment fields if available.
Return: summary, confidence, riskLevel, flags[], reasoning[].`,

  historicalSuspicion: `You are HistoricalSuspicionAgent. Cross-reference the entity against known
suspicious registrations and patterns. Flag any directory matches.
Return: summary, confidence, riskLevel, flags[], reasoning[].`,

  skeptic: `You are SkepticAgent. Challenge findings that may represent false positives.
Look for benign explanations for flagged signals. Reduce noise.
Return: summary, confidence, riskLevel, flags[], reasoning[].`,

  prosecutor: `You are ProsecutorAgent. Challenge findings that may be too lenient.
Surface hidden fraud patterns. Identify combinations of risk signals missed individually.
Return: summary, confidence, riskLevel, flags[], reasoning[].`,

  chair: `You are ChairAgent. Synthesize all agent findings into a final consensus.
Resolve conflicts between Skeptic and Prosecutor. Produce a decision recommendation.
Return: summary, confidence, riskLevel, flags[], reasoning[].`,
} as const;
