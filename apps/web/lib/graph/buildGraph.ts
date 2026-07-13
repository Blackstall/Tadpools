import type { InvestigationGraph, GraphNode, GraphEdge } from "./types";
import type { AgentFinding } from "../types";

interface BuildGraphInput {
  caseId: string;
  companyName?: string;
  beneficiaryName?: string;
  bankName?: string;
  docs?: { id: string; filename: string; docType: string }[];
  findings: AgentFinding[];
}

export function buildGraph(input: BuildGraphInput): InvestigationGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // ── Core entity nodes ──────────────────────────────────────────────────────
  nodes.push({ id: "company", type: "company", label: input.companyName ?? "Company", riskLevel: "none" });
  nodes.push({ id: "beneficiary", type: "beneficiary", label: input.beneficiaryName ?? "Beneficiary", riskLevel: "none" });
  nodes.push({ id: "bank", type: "bank", label: input.bankName ?? "Bank", riskLevel: "none" });

  edges.push({ from: "company",     to: "beneficiary", type: "belongs_to" });
  edges.push({ from: "beneficiary", to: "bank",        type: "belongs_to" });

  // ── Document nodes ─────────────────────────────────────────────────────────
  for (const doc of input.docs ?? []) {
    const docId = `doc_${doc.id}`;
    nodes.push({ id: docId, type: "document", label: doc.filename, riskLevel: "none" });
    edges.push({ from: docId, to: "company", type: "extracted_from" });
  }

  // ── Risk signal nodes from findings ───────────────────────────────────────
  const highRiskAgents = input.findings.filter((f) => f.riskLevel === "high" || f.riskLevel === "medium");

  for (const f of highRiskAgents) {
    for (const flag of f.flags.slice(0, 2)) {
      const riskId = `risk_${flag}`;
      if (!nodes.find((n) => n.id === riskId)) {
        nodes.push({ id: riskId, type: "risk", label: flag.replace(/_/g, " ").toLowerCase(), riskLevel: f.riskLevel });
      }
      const target = agentToTarget(f.agent);
      if (target) edges.push({ from: riskId, to: target, type: "flagged_by" });
    }
  }

  // ── Apply risk levels to entity nodes ─────────────────────────────────────
  const agentRisk: Record<string, "low" | "medium" | "high"> = {};
  for (const f of input.findings) agentRisk[f.agent] = f.riskLevel;

  applyRisk(nodes, "company",     ["ExistenceVerificationAgent", "HistoricalSuspicionAgent", "NatureOfBusinessAgent", "RegistrationAgeAgent"], agentRisk);
  applyRisk(nodes, "beneficiary", ["NameMatchingAgent", "BeneficiaryConsistencyAgent"], agentRisk);
  applyRisk(nodes, "bank",        ["BeneficiaryConsistencyAgent"], agentRisk);

  // ── Inconsistency edges ────────────────────────────────────────────────────
  const nameMismatch = input.findings.find((f) => f.agent === "NameMatchingAgent" && f.riskLevel !== "low");
  if (nameMismatch) {
    edges.push({ from: "company", to: "beneficiary", type: "inconsistent_with" });
  }

  const docAuth = input.findings.find((f) => f.agent === "DocumentAuthenticityAgent" && f.riskLevel !== "low");
  if (docAuth && input.docs && input.docs.length > 0) {
    const docId = `doc_${input.docs[0].id}`;
    edges.push({ from: docId, to: "company", type: "inconsistent_with" });
  }

  return { nodes, edges };
}

function agentToTarget(agent: string): string | null {
  const map: Record<string, string> = {
    ExistenceVerificationAgent:  "company",
    HistoricalSuspicionAgent:    "company",
    NatureOfBusinessAgent:       "company",
    RegistrationAgeAgent:        "company",
    NameMatchingAgent:           "beneficiary",
    BeneficiaryConsistencyAgent: "bank",
    DocumentAuthenticityAgent:   "company",
  };
  return map[agent] ?? null;
}

function applyRisk(
  nodes: GraphNode[],
  nodeId: string,
  agents: string[],
  agentRisk: Record<string, "low" | "medium" | "high">
) {
  const rank = { low: 1, medium: 2, high: 3 };
  let maxRisk: "low" | "medium" | "high" | "none" = "none";
  for (const a of agents) {
    const r = agentRisk[a];
    if (r && (maxRisk === "none" || rank[r] > rank[maxRisk as "low" | "medium" | "high"])) {
      maxRisk = r;
    }
  }
  const node = nodes.find((n) => n.id === nodeId);
  if (node) node.riskLevel = maxRisk;
}
