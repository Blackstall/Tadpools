/**
 * Model Router — maps each agent to an LLM model.
 *
 * Routing philosophy per spec:
 *   small / simple tasks  → 8B  (fast, cheap)
 *   medium analysis       → 14B (more context)
 *   deep reasoning        → 32B (full chain-of-thought)
 *   edge / anomaly cases  → DeepSeek R1
 *
 * Current hardware: GTX 1650 (4 GB VRAM).
 * Only 7–8B Q4 models fit in VRAM.
 * All agents route to qwen2.5:7b for now.
 * Update PREFERRED_MODELS when hardware improves.
 */

export type AgentTier = "small" | "medium" | "reasoning" | "edge";

interface ModelSpec {
  tier:      AgentTier;
  preferred: string;   // target model for this tier
  fallback:  string;   // what to use on current hardware
}

const TIER_SPECS: Record<AgentTier, Omit<ModelSpec, "tier">> = {
  //  Tier          | Preferred (future)    | Fallback (now)
  small:     { preferred: "qwen2.5:7b",   fallback: "qwen2.5:7b"  },
  medium:    { preferred: "qwen2.5:14b",  fallback: "qwen2.5:7b"  },
  reasoning: { preferred: "qwen2.5:32b",  fallback: "qwen2.5:7b"  },
  edge:      { preferred: "deepseek-r1",  fallback: "qwen2.5:7b"  },
};

/**
 * Each agent is assigned a tier based on cognitive demand:
 *   Round 1 — fact-checkers (low cognitive load) → small
 *   Round 2 — challenge agents (moderate)        → medium
 *   Round 3 — synthesis / chair (deep reasoning) → reasoning
 */
const AGENT_TIERS: Record<string, AgentTier> = {
  // Core analysis agents (Round 1)
  NatureOfBusinessAgent:       "small",
  RegistrationAgeAgent:        "small",
  NameMatchingAgent:           "small",
  BeneficiaryConsistencyAgent: "small",
  ExistenceVerificationAgent:  "medium",
  DocumentAuthenticityAgent:   "medium",
  HistoricalSuspicionAgent:    "medium",
  // Meta agents (Round 2)
  SkepticAgent:                "medium",
  ProsecutorAgent:             "medium",
  // Synthesis (Round 3)
  ChairAgent:                  "reasoning",
};

/**
 * Returns the actual model ID to call right now.
 * `useFallback` lets you test against preferred models when available.
 */
export function getModelForAgent(agentName: string, useFallback = true): string {
  const tier = AGENT_TIERS[agentName] ?? "small";
  const spec = TIER_SPECS[tier];
  return useFallback ? spec.fallback : spec.preferred;
}

export function getTierForAgent(agentName: string): AgentTier {
  return AGENT_TIERS[agentName] ?? "small";
}
