"use client";

import { FileText, Building2, User, CheckCircle2 } from "lucide-react";
import type { SwarmState } from "../lib/types";
import { PROGRESS_STEPS } from "../lib/types";

interface Props {
  swarmState:  SwarmState;
  casePayload: Record<string, unknown> | null;
}

function getActiveStepIndex(state: SwarmState): number {
  const { phase, findings } = state;
  if (phase === "idle")       return 0;
  if (phase === "uploading")  return 1;
  if (phase === "extracting") return 2;
  if (phase === "done")       return 5;
  if (phase === "error")      return 5;
  if (findings.some((f) => f.round === 3)) return 5;
  if (findings.some((f) => f.round === 2)) return 4;
  return 3;
}

const LEGEND_ROWS = [
  { color: "#B0BEC5", label: "Idle / standby" },
  { color: "#00B569", label: "Analyzing" },
  { color: "#F59E0B", label: "Alert" },
  { color: "#EF4444", label: "High risk" },
  { color: "#9333EA", label: "Debating" },
  { color: "#00B569", label: "Consensus" },
];

function companyInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase();
}

export function CaseOverview({ swarmState, casePayload }: Props) {
  const activeStep  = getActiveStepIndex(swarmState);
  const company     = casePayload?.company     as Record<string, string> | undefined;
  const beneficiary = casePayload?.beneficiary as Record<string, string> | undefined;

  const completedAgents = Object.values(swarmState.agentStates).filter(
    (s) => s === "consensus" || s === "alert" || s === "suspicious" || s === "done"
  ).length;

  return (
    <section className="panel left-sidebar">
      {/* Brand */}
      <div className="sidebar-brand">
        <h1>Tadpools</h1>
        <p>Swim through the noise.<br />Surface the risk.</p>
      </div>

      <div className="sidebar-body">

        {/* ── Progress stepper ─────────────────────────────────────────────── */}
        <div>
          <div className="sidebar-section-label">Progress</div>
          <div className="progress-stepper">
            {PROGRESS_STEPS.map((step, i) => {
              const isDone   = i < activeStep;
              const isActive = i === activeStep;
              const cls = isDone ? "step-item--done" : isActive ? "step-item--active" : "";
              return (
                <div key={step.id} className={`step-item ${cls}`}>
                  <div className="step-dot" />
                  {i < PROGRESS_STEPS.length - 1 && (
                    <div className={`step-connector ${isDone ? "step-connector--done" : ""}`} />
                  )}
                  <div className="step-content">
                    <span className="step-label">{step.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Agent progress ───────────────────────────────────────────────── */}
        {swarmState.phase === "processing" && (
          <div>
            <div className="sidebar-section-label">Agent Progress</div>
            <div className="case-info-block">
              <div className="info-value" style={{ color: "var(--accent)" }}>
                {completedAgents} / 10
              </div>
              <div className="info-sub">agents completed</div>
            </div>
          </div>
        )}

        {/* ── Company Profile Card ─────────────────────────────────────────── */}
        {company && (
          <div>
            <div className="sidebar-section-label">Case</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="profile-card">
                <div className="profile-avatar">
                  {companyInitials(company.companyName || "?")}
                </div>
                <div>
                  <div className="profile-name">{company.companyName}</div>
                  <div className="profile-reg">{company.registrationNumber}</div>
                </div>
              </div>

              <div className="case-info-block">
                <div className="info-label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Building2 size={11} />
                  Company
                </div>
                <div className="info-sub">{company.registrationDate} · {company.natureOfBusiness}</div>
              </div>

              {beneficiary && (
                <div className="case-info-block">
                  <div className="info-label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <User size={11} />
                    Beneficiary
                  </div>
                  <div className="info-value">{beneficiary.beneficiaryName}</div>
                  <div className="info-sub">
                    {beneficiary.bankName} · ****{beneficiary.accountNumber?.slice(-4)}
                  </div>
                </div>
              )}

              {swarmState.caseId && (
                <div className="case-info-block">
                  <div className="info-label">Case ID</div>
                  <div className="mono muted">{swarmState.caseId.slice(0, 8).toUpperCase()}…</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Document stack with status pills ────────────────────────────── */}
        {swarmState.docs.length > 0 && (
          <div>
            <div className="sidebar-section-label">Documents</div>
            <div className="doc-stack">
              {swarmState.docs.map((doc) => (
                <div key={doc.id} className="doc-stack-item">
                  <FileText size={13} className="doc-stack-icon" />
                  <span className="doc-stack-name">{doc.filename}</span>
                  <span className={`status-pill status-pill--${doc.status}`}>
                    {doc.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Extraction feed ──────────────────────────────────────────────── */}
        {swarmState.docs.some((d) => (d.fieldsExtracted ?? 0) > 0) && (
          <div>
            <div className="sidebar-section-label">Extraction</div>
            <div className="extract-feed">
              {swarmState.docs
                .filter((d) => (d.fieldsExtracted ?? 0) > 0)
                .map((d) => (
                  <div key={d.id} className="extract-entry">
                    <span className="field-key">[{d.docType.replace("_", " ")}]</span>
                    {" → "}
                    {d.fieldsExtracted} field{d.fieldsExtracted !== 1 ? "s" : ""} parsed
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ── Decision reached ─────────────────────────────────────────────── */}
        {swarmState.decision && (
          <div>
            <div className="sidebar-section-label">Decision</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <CheckCircle2
                size={15}
                color={
                  swarmState.decision.status === "approve"  ? "#10B981" :
                  swarmState.decision.status === "reject"   ? "#EF4444" : "#F59E0B"
                }
              />
              <span className="info-value" style={{
                color:
                  swarmState.decision.status === "approve"  ? "#10B981" :
                  swarmState.decision.status === "reject"   ? "#EF4444" : "#F59E0B"
              }}>
                {swarmState.decision.status.replace("_", " ").toUpperCase()}
              </span>
            </div>
          </div>
        )}

        {/* ── Agent state legend ───────────────────────────────────────────── */}
        <div>
          <div className="sidebar-section-label">Agent States</div>
          <div className="legend-list">
            {LEGEND_ROWS.map(({ color, label }) => (
              <div key={label} className="legend-row">
                <div className="legend-swatch" style={{ background: color, boxShadow: `0 0 4px ${color}88` }} />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
