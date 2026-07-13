// Graph node and edge type definitions — PHASE 2
export type GraphNodeType = "company" | "beneficiary" | "document" | "field" | "bank" | "risk";

export type GraphNode = {
  id: string;
  type: GraphNodeType;
  label: string;
  riskLevel?: "low" | "medium" | "high" | "none";
  x?: number;
  y?: number;
};

export type GraphEdgeType =
  | "extracted_from"
  | "belongs_to"
  | "matched_with"
  | "inconsistent_with"
  | "verified_by"
  | "flagged_by";

export type GraphEdge = {
  from: string;
  to: string;
  type: GraphEdgeType;
};

export type InvestigationGraph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};
