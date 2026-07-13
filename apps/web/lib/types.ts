export type AgentState =
  | "idle"
  | "analyzing"
  | "alert"
  | "suspicious"
  | "debate"
  | "consensus"
  | "done";

export type DocStatus =
  | "uploading"
  | "uploaded"
  | "extracting"
  | "hashed"
  | "deleted"
  | "ready";

export type DecisionStatus = "approve" | "manual_review" | "escalate" | "reject";
export type RiskLevel = "low" | "medium" | "high";

export interface TadpoleAgent {
  id: string;
  label: string;
  shortLabel: string;
  targetNodeId: string;
  initX: number;
  initY: number;
  round: 1 | 2 | 3;
}

export interface AgentFinding {
  agent: string;
  round: number;
  riskLevel: RiskLevel;
  confidence: number;
  flags: string[];
  summary: string;
  reasoning: string[];
}

export interface DocRecord {
  id: string;
  filename: string;
  docType: string;
  sizeBytes: number;
  status: DocStatus;
  sha256?: string;
  fieldsExtracted?: number;
}

export interface SwarmEvent {
  type: string;
  caseId: string;
  agent?: string;
  round?: number;
  riskLevel?: string;
  confidence?: number;
  flags?: string[];
  summary?: string;
  reasoning?: string[];
  highRisk?: number;
  mediumRisk?: number;
  status?: string;
  score?: number;
  triggeredRules?: string[];
  message?: string;
}

export interface SwarmState {
  caseId: string | null;
  phase: "idle" | "uploading" | "extracting" | "processing" | "done" | "error";
  agentStates: Record<string, AgentState>;
  findings: AgentFinding[];
  decision: {
    status: DecisionStatus;
    score: number;
    triggeredRules: string[];
  } | null;
  chatBubbles: ChatBubble[];
  docs: DocRecord[];
  error: string | null;
  timeline: TimelineEvent[];
  startedAt: number | null;
}

export interface ChatBubble {
  id: string;
  agent: string;
  text: string;
  riskLevel: RiskLevel | "neutral";
  createdAt: number;
}

export type TimelineSeverity = "info" | "low" | "medium" | "high";

export interface TimelineEvent {
  id: string;
  time: string;
  elapsed: number;
  type: string;
  message: string;
  severity: TimelineSeverity;
}

export type RightDrawerMode =
  | { type: "decision_brief" }
  | { type: "agent_detail"; agentId: string }
  | { type: "agent_relationship"; source: string; target: string };

// ── Agent definitions ─────────────────────────────────────────────────────────
export const AGENT_DEFS: TadpoleAgent[] = [
  { id: "NatureOfBusinessAgent",       label: "Nature of Biz",    shortLabel: "NB", targetNodeId: "nob",          initX: 0.50, initY: 0.82, round: 1 },
  { id: "RegistrationAgeAgent",        label: "Reg. Age",         shortLabel: "RA", targetNodeId: "registration", initX: 0.18, initY: 0.15, round: 1 },
  { id: "DocumentAuthenticityAgent",   label: "Doc. Auth",        shortLabel: "DA", targetNodeId: "documents",    initX: 0.14, initY: 0.62, round: 1 },
  { id: "ExistenceVerificationAgent",  label: "Existence",        shortLabel: "EV", targetNodeId: "existence",    initX: 0.82, initY: 0.15, round: 1 },
  { id: "NameMatchingAgent",           label: "Name Match",       shortLabel: "NM", targetNodeId: "beneficiary",  initX: 0.86, initY: 0.40, round: 1 },
  { id: "BeneficiaryConsistencyAgent", label: "Ben. Consistency", shortLabel: "BC", targetNodeId: "bank",         initX: 0.84, initY: 0.68, round: 1 },
  { id: "HistoricalSuspicionAgent",    label: "History",          shortLabel: "HS", targetNodeId: "company",      initX: 0.50, initY: 0.08, round: 1 },
  { id: "SkepticAgent",                label: "Skeptic",          shortLabel: "SK", targetNodeId: "center",       initX: 0.30, initY: 0.44, round: 2 },
  { id: "ProsecutorAgent",             label: "Prosecutor",       shortLabel: "PR", targetNodeId: "center",       initX: 0.68, initY: 0.44, round: 2 },
  { id: "ChairAgent",                  label: "Chair",            shortLabel: "CH", targetNodeId: "center",       initX: 0.50, initY: 0.44, round: 3 },
];

// ── Evidence node map: structured investigation layout ─────────────────────────
export const EVIDENCE_NODES = [
  { id: "company",      label: "Company",       shortLabel: "Co",    x: 0.50, y: 0.42 }, // center
  { id: "registration", label: "Reg. Date",     shortLabel: "Reg",   x: 0.26, y: 0.20 }, // upper left
  { id: "existence",    label: "Existence",     shortLabel: "Exist", x: 0.74, y: 0.20 }, // upper right
  { id: "documents",    label: "Documents",     shortLabel: "Docs",  x: 0.20, y: 0.68 }, // lower left
  { id: "nob",          label: "Nature of Biz", shortLabel: "NOB",   x: 0.50, y: 0.76 }, // lower center
  { id: "beneficiary",  label: "Beneficiary",   shortLabel: "Ben",   x: 0.74, y: 0.42 }, // right center
  { id: "bank",         label: "Bank / Acct",   shortLabel: "Bank",  x: 0.76, y: 0.68 }, // lower right
  { id: "center",       label: "",              shortLabel: "",      x: 0.50, y: 0.44 }, // meta agents converge here
];

// ── Connection lines between nodes ────────────────────────────────────────────
export const NODE_CONNECTIONS: [string, string][] = [
  ["company", "registration"],
  ["company", "existence"],
  ["company", "nob"],
  ["company", "documents"],
  ["company", "beneficiary"],
  ["beneficiary", "bank"],
  ["documents", "beneficiary"],
  ["documents", "nob"],
];

export const STATE_COLORS: Record<AgentState, string> = {
  idle:       "#33D1C6",  // Aqua idle
  analyzing:  "#14B8A6",  // Teal active
  alert:      "#F59E0B",  // Amber
  suspicious: "#EF4444",  // Red
  debate:     "#8B5CF6",  // Violet
  consensus:  "#22C55E",  // Pond green
  done:       "#22C55E",  // Pond green
};

export const RISK_TO_STATE: Record<RiskLevel, AgentState> = {
  low:    "consensus",
  medium: "alert",
  high:   "suspicious",
};

export const DOC_TYPE_OPTIONS = [
  { value: "invoice",         label: "Invoice" },
  { value: "agreement",       label: "Agreement" },
  { value: "payment_voucher", label: "Payment Voucher" },
  { value: "spa",             label: "Sale & Purchase Agreement" },
  { value: "tenancy",         label: "Tenancy Agreement" },
  { value: "other",           label: "Other" },
] as const;

export type DocType = typeof DOC_TYPE_OPTIONS[number]["value"];

export const PROGRESS_STEPS = [
  { id: "intake",    label: "Intake" },
  { id: "upload",    label: "Upload" },
  { id: "extract",   label: "Extraction" },
  { id: "swarm",     label: "Swarm Review" },
  { id: "challenge", label: "Challenge" },
  { id: "decision",  label: "Decision" },
] as const;
