// Maps agent findings to investigation report steps — PHASE 5
import type { AgentFinding } from "../types";

export const INVESTIGATION_STEPS = [
  { id: "01_intake",          label: "01 Intake",               icon: "📋" },
  { id: "02_doc_extraction",  label: "02 Document Extraction",  icon: "🗂️" },
  { id: "03_authenticity",    label: "03 Authenticity Check",   icon: "🔍" },
  { id: "04_company",         label: "04 Company Verification", icon: "🏢" },
  { id: "05_beneficiary",     label: "05 Beneficiary & Bank",   icon: "🏦" },
  { id: "06_decision",        label: "06 Decision",             icon: "⚖️" },
] as const;

export type StepId = typeof INVESTIGATION_STEPS[number]["id"];

export type StepStatus = "pending" | "running" | "done" | "flagged";

export interface StepData {
  stepId: StepId;
  label: string;
  icon: string;
  status: StepStatus;
  summary: string;
  findings: AgentFinding[];
}

const AGENT_TO_STEP: Record<string, StepId> = {
  DocumentAuthenticityAgent:   "03_authenticity",
  RegistrationAgeAgent:        "04_company",
  NatureOfBusinessAgent:       "04_company",
  ExistenceVerificationAgent:  "04_company",
  HistoricalSuspicionAgent:    "04_company",
  NameMatchingAgent:           "05_beneficiary",
  BeneficiaryConsistencyAgent: "05_beneficiary",
  SkepticAgent:                "06_decision",
  ProsecutorAgent:             "06_decision",
  ChairAgent:                  "06_decision",
};

export function mapFindingsToSteps(
  findings: AgentFinding[],
  phase: string,
  docsCount: number
): StepData[] {
  const byStep = new Map<StepId, AgentFinding[]>();
  for (const step of INVESTIGATION_STEPS) byStep.set(step.id, []);

  for (const f of findings) {
    const stepId = AGENT_TO_STEP[f.agent];
    if (stepId) byStep.get(stepId)!.push(f);
  }

  return INVESTIGATION_STEPS.map((step) => {
    const stepFindings = byStep.get(step.id) ?? [];
    let status: StepStatus = "pending";
    let summary = "";

    if (step.id === "01_intake") {
      status = phase !== "idle" ? "done" : "pending";
      summary = phase !== "idle" ? "Case submitted and queued." : "Awaiting intake.";
    } else if (step.id === "02_doc_extraction") {
      if (phase === "done" || phase === "processing" || phase === "extracting") {
        status = docsCount > 0 ? "done" : "running";
        summary = docsCount > 0 ? `${docsCount} document(s) extracted.` : "Extracting fields…";
      }
    } else {
      if (stepFindings.length > 0) {
        const hasHigh   = stepFindings.some((f) => f.riskLevel === "high");
        const hasMedium = stepFindings.some((f) => f.riskLevel === "medium");
        status  = hasHigh ? "flagged" : hasMedium ? "flagged" : "done";
        summary = stepFindings[0].summary;
      } else if (phase === "processing") {
        status  = "running";
        summary = "Agents investigating…";
      } else if (phase === "done") {
        status  = "done";
        summary = "No issues found.";
      }
    }

    return { stepId: step.id, label: step.label, icon: step.icon, status, summary, findings: stepFindings };
  });
}
