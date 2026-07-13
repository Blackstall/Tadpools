// ── Primitive enums (mirrors DB enums) ───────────────────────────────────────

export type CaseStatus =
  | 'draft' | 'submitted' | 'processing' | 'needs_review'
  | 'escalated' | 'approved' | 'rejected' | 'closed';

export type DecisionType =
  | 'approve' | 'reject' | 'escalate' | 'hold' | 'request_documents' | 'monitor';

export type EntityType =
  | 'company' | 'beneficiary' | 'bank_account' | 'bank' | 'person' | 'document' | 'case';

export type ModuleType =
  | 'intake' | 'extraction' | 'authenticity' | 'entity_verification'
  | 'relationship_matching' | 'historical_intelligence' | 'challenge_phase' | 'decision';

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export type SignalDirection = 'risk_increasing' | 'risk_reducing' | 'unresolved';

export type ActorType = 'system' | 'agent' | 'analyst' | 'admin';

export type RuleType = 'hard_block' | 'warning' | 'informational' | 'scoring';

// ── Existing v1 types (kept for backwards compatibility) ─────────────────────

export type DecisionStatus = 'approve' | 'manual_review' | 'escalate' | 'reject';
export type RiskLevel = 'low' | 'medium' | 'high';
export type AgentState = 'idle' | 'analyzing' | 'alert' | 'suspicious' | 'debate' | 'consensus' | 'done';
export type DocStatus = 'uploading' | 'uploaded' | 'extracting' | 'hashed' | 'deleted' | 'ready';

export interface CompanyInput {
  companyName: string;
  registrationNumber: string;
  registrationDate: string;
  natureOfBusiness: string;
}

export interface BeneficiaryInput {
  beneficiaryName: string;
  accountNumber: string;
  bankName: string;
  natureOfBusiness?: string;
}

export interface UploadedDocument {
  id: string;
  type: 'invoice' | 'agreement' | 'payment_voucher' | 'spa' | 'tenancy' | 'other';
  filename: string;
  storageKey?: string;
}

export interface CaseInput {
  company: CompanyInput;
  beneficiary: BeneficiaryInput;
  documents: UploadedDocument[];
  consentAccepted: boolean;
}

export interface AgentFinding {
  agent: string;
  summary: string;
  confidence: number;
  riskLevel: RiskLevel;
  evidenceRefs: string[];
  flags: string[];
  reasoning: string[];
  round: number;
}

export interface DecisionResult {
  status: DecisionStatus;
  score: number;
  reasons: string[];
  findings: AgentFinding[];
}

// ── v2 Entity types ───────────────────────────────────────────────────────────

export interface Entity {
  id: string;
  entityType: EntityType;
  canonicalName: string;
  normalizedName?: string;
  registrationNumber?: string;
  countryCode?: string;
  riskScore?: number;
  firstSeenAt?: string;
  lastSeenAt?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface EntityRelationship {
  id: string;
  fromEntityId: string;
  toEntityId: string;
  relationshipType: string;
  confidence?: number;
  source?: string;
  evidence: Record<string, unknown>;
}

// ── v2 Signal types ───────────────────────────────────────────────────────────

export interface Signal {
  id: string;
  caseId: string;
  documentId?: string;
  entityId?: string;
  policyRuleId?: string;
  module: ModuleType;
  signalCode?: string;
  signalName: string;
  description?: string;
  severity: Severity;
  direction: SignalDirection;
  confidence?: number;
  contributionScore: number;
  evidence: Record<string, unknown>;
  generatedBy: ActorType;
  createdAt: string;
}

// ── v2 Decision types ─────────────────────────────────────────────────────────

export interface Decision {
  id: string;
  caseId: string;
  decisionType: DecisionType;
  finalScore?: number;
  confidence?: number;
  decisionNarrative?: string;
  recommendation?: string;
  triggeredRuleIds: string[];
  riskSummary: Record<string, unknown>;
  computedBy: ActorType;
  createdAt: string;
  updatedAt: string;
}

// ── v2 Timeline + actions ─────────────────────────────────────────────────────

export interface TimelineEvent {
  id: string;
  caseId: string;
  eventType: string;
  module?: ModuleType;
  actorType: ActorType;
  actorUserId?: string;
  title: string;
  description?: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface AnalystAction {
  id: string;
  caseId: string;
  actionType: DecisionType;
  note?: string;
  performedByUserId?: string;
  createdAt: string;
}

// ── v2 Case types ─────────────────────────────────────────────────────────────

export interface Case {
  id: string;
  caseReference: string;
  status: CaseStatus;
  priority: number;
  companyEntity?: Entity;
  beneficiaryEntity?: Entity;
  bankEntity?: Entity;
  intakePayload: Record<string, unknown>;
  currentModule: ModuleType;
  submittedAt?: string;
  decidedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CaseListItem {
  id: string;
  caseReference?: string;
  status: string;
  priority?: number;
  companyName: string;
  beneficiaryName?: string;
  bankName?: string;
  score?: number;
  createdAt: string;
}

// ── v2 Audit ──────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  caseId?: string;
  entityId?: string;
  documentId?: string;
  actorType: ActorType;
  actorUserId?: string;
  module?: ModuleType;
  action: string;
  inputSummary?: Record<string, unknown>;
  outputSummary?: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
}

// ── v2 Policy ─────────────────────────────────────────────────────────────────

export interface PolicyRule {
  id: string;
  policyVersionId?: string;
  ruleCode: string;
  ruleName: string;
  ruleType: RuleType;
  module: ModuleType;
  severity: Severity;
  description?: string;
  scoringWeight?: number;
  isActive: boolean;
}

// ── v2 Dashboard ──────────────────────────────────────────────────────────────

export interface DashboardStats {
  total: number;
  approved: number;
  rejected: number;
  escalated: number;
  pending: number;
  avgScore: number;
  highRiskCount: number;
}
