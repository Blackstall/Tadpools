// PHASE 5+7 — Build recommended actions from swarm state + policy signals
import type { SwarmState } from "../types";

export interface RecommendedAction {
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
}

export function buildRecommendedActions(
  state: SwarmState,
  casePayload: Record<string, unknown> | null
): RecommendedAction[] {
  const actions: RecommendedAction[] = [];
  const { decision, findings } = state;

  if (!decision) return actions;

  // Status-based actions
  if (decision.status === "reject" || decision.status === "escalate") {
    actions.push({
      title: "Hold Onboarding",
      description: "Immediately suspend processing until compliance review is complete.",
      priority: "high",
    });
  }

  if (decision.status === "escalate") {
    actions.push({
      title: "Contact Bank Fraud Unit",
      description: "Escalate to the bank's fraud prevention team with case evidence.",
      priority: "high",
    });
  }

  if (decision.status === "manual_review" || decision.status === "escalate") {
    actions.push({
      title: "Verify via Official Registry",
      description: "Cross-check company registration with the official business registry.",
      priority: "medium",
    });
  }

  // Flag-based actions
  const allFlags = findings.flatMap((f) => f.flags);
  const hasDocFraud  = allFlags.some((fl) => fl.includes("DOC_") || fl.includes("TAMPER") || fl.includes("FORGED"));
  const hasExistence = allFlags.some((fl) => fl.includes("EXISTENCE") || fl.includes("NOT_FOUND"));
  const hasNameMismatch = allFlags.some((fl) => fl.includes("NAME") || fl.includes("MISMATCH"));

  if (hasDocFraud) {
    actions.push({
      title: "Request Original Documents",
      description: "Document authenticity flags detected. Request certified originals.",
      priority: "high",
    });
  }

  if (hasExistence) {
    actions.push({
      title: "External Company Lookup",
      description: "Existence verification failed. Perform manual external registry lookup.",
      priority: "medium",
    });
  }

  if (hasNameMismatch) {
    actions.push({
      title: "Beneficiary Identity Verification",
      description: "Name mismatch detected. Request government-issued ID from beneficiary.",
      priority: "medium",
    });
  }

  // Low-risk suggestion
  if (decision.status === "approve" && actions.length === 0) {
    actions.push({
      title: "Proceed with Onboarding",
      description: "All checks passed. Standard onboarding procedures may proceed.",
      priority: "low",
    });
  }

  // Deduplicate by title, cap at 4
  const seen = new Set<string>();
  return actions.filter((a) => {
    if (seen.has(a.title)) return false;
    seen.add(a.title);
    return true;
  }).slice(0, 4);
}
