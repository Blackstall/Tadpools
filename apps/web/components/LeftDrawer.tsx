"use client";

import { X, FileText, Building2, User, Hash } from "lucide-react";
import type { SwarmState } from "../lib/types";
import { AGENT_DEFS, PROGRESS_STEPS, STATE_COLORS } from "../lib/types";
import { CaseTimeline } from "./CaseTimeline";

const LEGEND_ROWS = [
  { color: "#B0BEC5", label: "Idle" },
  { color: "#00B569", label: "Analyzing" },
  { color: "#F59E0B", label: "Alert" },
  { color: "#EF4444", label: "High risk" },
  { color: "#9333EA", label: "Debating" },
];

function companyInitials(name: string): string {
  return name.split(" ").slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase();
}

function getActiveStepIndex(state: SwarmState): number {
  const { phase, findings } = state;
  if (phase === "idle")       return 0;
  if (phase === "uploading")  return 1;
  if (phase === "extracting") return 2;
  if (phase === "done" || phase === "error") return 5;
  if (findings.some((f) => f.round === 3)) return 5;
  if (findings.some((f) => f.round === 2)) return 4;
  return 3;
}

interface Props {
  open:         boolean;
  onClose:      () => void;
  swarmState:   SwarmState;
  casePayload:  Record<string, unknown> | null;
}

export function LeftDrawer({ open, onClose, swarmState, casePayload }: Props) {
  const company     = casePayload?.company     as Record<string, string> | undefined;
  const beneficiary = casePayload?.beneficiary as Record<string, string> | undefined;
  const activeStep  = getActiveStepIndex(swarmState);

  const completedAgents = Object.values(swarmState.agentStates).filter(
    (s) => s === "consensus" || s === "alert" || s === "suspicious" || s === "done"
  ).length;

  return (
    <aside className={`left-drawer${open ? " open" : ""}`}>
      {/* Header */}
      <div className="drawer-header">
        <span className="drawer-title">Case Context</span>
        <button className="drawer-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <div className="drawer-body">

        {/* ── Progress stepper ─────────────────────────────────────────────── */}
        <div className="drawer-section">
          <div className="drawer-section-label">Progress</div>
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
          <div className="drawer-section">
            <div className="drawer-section-label">Agent Progress</div>
            <div className="case-info-block">
              <div className="info-value" style={{ color: "var(--accent)" }}>
                {completedAgents} / {AGENT_DEFS.length}
              </div>
              <div className="info-sub">agents completed</div>
            </div>
            <div className="agent-pills" style={{ marginTop: 8 }}>
              {AGENT_DEFS.map((def) => {
                const st    = swarmState.agentStates[def.id] ?? "idle";
                const color = STATE_COLORS[st];
                return (
                  <div key={def.id} className="agent-pill" style={{ borderColor: color + "55", color }}>
                    <div className="agent-pip" style={{ background: color }} />
                    {def.shortLabel}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Company Profile ──────────────────────────────────────────────── */}
        {company && (
          <div className="drawer-section">
            <div className="drawer-section-label">Case</div>
            <div className="profile-card">
              <div className="profile-avatar">
                {companyInitials(company.companyName || "?")}
              </div>
              <div>
                <div className="profile-name">{company.companyName}</div>
                <div className="profile-reg">{company.registrationNumber}</div>
              </div>
            </div>

            <div className="case-info-block" style={{ marginTop: 10 }}>
              <div className="info-label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <Building2 size={11} />
                Company
              </div>
              <div className="info-sub">{company.registrationDate} · {company.natureOfBusiness}</div>
            </div>

            {beneficiary && (
              <div className="case-info-block" style={{ marginTop: 8 }}>
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
              <div className="case-info-block" style={{ marginTop: 8 }}>
                <div className="info-label">Case ID</div>
                <div className="mono muted">{swarmState.caseId.slice(0, 8).toUpperCase()}…</div>
              </div>
            )}
          </div>
        )}

        {/* ── Documents with hash ──────────────────────────────────────────── */}
        {swarmState.docs.length > 0 && (
          <div className="drawer-section">
            <div className="drawer-section-label">Documents</div>
            <div className="doc-stack">
              {swarmState.docs.map((doc) => (
                <div key={doc.id} className="doc-stack-item" style={{ flexDirection: "column", alignItems: "flex-start", gap: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, width: "100%" }}>
                    <FileText size={13} className="doc-stack-icon" />
                    <span className="doc-stack-name">{doc.filename}</span>
                    <span className={`status-pill status-pill--${doc.status}`}>{doc.status}</span>
                  </div>
                  {doc.sha256 && (
                    <div className="doc-hash-row">
                      <Hash size={10} style={{ color: "var(--muted)", flexShrink: 0 }} />
                      <span className="doc-hash-val">{doc.sha256.slice(0, 16)}…</span>
                    </div>
                  )}
                  {doc.fieldsExtracted !== undefined && doc.fieldsExtracted > 0 && (
                    <div className="doc-fields" style={{ marginTop: 0 }}>
                      {doc.fieldsExtracted} field{doc.fieldsExtracted !== 1 ? "s" : ""} extracted
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Timeline ─────────────────────────────────────────────────────── */}
        {swarmState.timeline.length > 0 && (
          <div className="drawer-section">
            <div className="drawer-section-label">Timeline</div>
            <CaseTimeline events={swarmState.timeline} />
          </div>
        )}

        {/* ── Agent state legend ───────────────────────────────────────────── */}
        <div className="drawer-section">
          <div className="drawer-section-label">Agent States</div>
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
    </aside>
  );
}
