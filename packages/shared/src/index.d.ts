export type DecisionStatus = "approve" | "manual_review" | "escalate" | "reject";
export type RiskLevel = "low" | "medium" | "high";
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
    type: "invoice" | "agreement" | "payment_voucher" | "spa" | "tenancy" | "other";
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
