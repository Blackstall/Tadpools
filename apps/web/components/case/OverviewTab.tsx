"use client";

import { FileText, User } from "lucide-react";
import type { SwarmState } from "../../lib/types";
import { AGENT_DEFS, PROGRESS_STEPS, STATE_COLORS } from "../../lib/types";
import { mapFindingsToSteps } from "../../lib/workbench/mapFindings";
import { buildRecommendedActions } from "../../lib/workbench/recommendedActions";

const STAGE_NARRATIVES: Record<string, string> = {
  idle:       "Submit a case to begin the KYC investigation.",
  uploading:  "Uploading supporting documents to secure storage.",
  extracting: "Reading uploaded documents and extracting structured fields.",
  processing: "The swarm of 10 specialised agents is reviewing evidence and company signals.",
  done:       "Investigation complete. All agents have reached consensus.",
  error:      "An error occurred during processing. Review the Timeline tab for details.",
};

const DECISION_COLORS: Record<string, string> = {
  approve:       "#22C55E",
  manual_review: "#F59E0B",
  escalate:      "#F97316",
  reject:        "#EF4444",
};

const DECISION_LABELS: Record<string, string> = {
  approve:       "Approved",
  manual_review: "Review Needed",
  escalate:      "Escalate",
  reject:        "Rejected",
};

function getActiveStepIndex(state: SwarmState): number {
  if (state.phase === "idle")       return 0;
  if (state.phase === "uploading")  return 1;
  if (state.phase === "extracting") return 2;
  if (state.phase === "done" || state.phase === "error") return 5;
  if (state.findings.some(f => f.round === 3)) return 5;
  if (state.findings.some(f => f.round === 2)) return 4;
  return 3;
}

interface Props {
  state:       SwarmState;
  casePayload: Record<string, unknown> | null;
}

export function OverviewTab({ state, casePayload }: Props) {
  const company     = casePayload?.company     as Record<string, string> | undefined;
  const beneficiary = casePayload?.beneficiary as Record<string, string> | undefined;
  const activeStep  = getActiveStepIndex(state);
  const isDone      = state.phase === "done" || state.phase === "error";
  const isPulsing   = ["uploading", "extracting", "processing"].includes(state.phase);
  const steps       = mapFindingsToSteps(state.findings, state.phase, state.docs.length);
  const actions     = buildRecommendedActions(state, casePayload);
  const topFindings = state.findings.filter(f => f.riskLevel !== "low").slice(0, 4);
  const dec         = state.decision;
  const decColor    = dec ? (DECISION_COLORS[dec.status] ?? "#14B8A6") : null;
  const initials    = company?.companyName
    ? company.companyName.split(" ").slice(0, 2).map(w => w[0] ?? "").join("").toUpperCase()
    : "?";

  return (
    <div className="overview-tab">

      {/* ── Main column ──────────────────────────────────────────────────── */}
      <div className="overview-main">

        {/* Stage narrative banner */}
        <div className="stage-narrative">
          <div className={`stage-dot${isPulsing ? " stage-dot--pulse" : ""}`} />
          <p className="stage-narrative-text">{STAGE_NARRATIVES[state.phase]}</p>
        </div>

        {/* Case profile */}
        {company && (
          <div className="overview-card">
            <div className="card-section-label">Case Profile</div>
            <div className="overview-profile-row">
              <div className="profile-avatar">{initials}</div>
              <div className="overview-profile-info">
                <div className="profile-name">{company.companyName}</div>
                <div className="overview-profile-meta">
                  {[company.registrationNumber, company.registrationDate].filter(Boolean).join(" · ")}
                </div>
                {company.natureOfBusiness && (
                  <div className="overview-profile-meta" style={{ marginTop: 2 }}>
                    {company.natureOfBusiness}
                  </div>
                )}
              </div>
            </div>
            {beneficiary && (
              <div className="overview-beneficiary-row">
                <User size={12} color="var(--muted)" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <div className="bene-name">{beneficiary.beneficiaryName}</div>
                  <div className="bene-sub">
                    {beneficiary.bankName} · ****{beneficiary.accountNumber?.slice(-4)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress tracker */}
        <div className="overview-card">
          <div className="card-section-label">Investigation Progress</div>
          <div className="progress-track">
            {PROGRESS_STEPS.map((step, i) => {
              const done   = i < activeStep;
              const active = i === activeStep;
              return (
                <div key={step.id} className={`track-step${done ? " track-step--done" : active ? " track-step--active" : ""}`}>
                  <div className="track-node">
                    <div className="track-dot" />
                    {i < PROGRESS_STEPS.length - 1 && (
                      <div className={`track-line${done ? " track-line--done" : ""}`} />
                    )}
                  </div>
                  <span className="track-label">{step.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Notable findings */}
        {topFindings.length > 0 && (
          <div className="overview-card">
            <div className="card-section-label">Notable Findings</div>
            <div className="findings-list">
              {topFindings.map(f => {
                const c = f.riskLevel === "high" ? "var(--high)"
                        : f.riskLevel === "medium" ? "var(--medium)"
                        : "var(--low)";
                return (
                  <div key={f.agent} className="finding-row" style={{ borderLeftColor: c }}>
                    <div className="finding-row-top">
                      <span className="finding-agent">{f.agent.replace("Agent", "")}</span>
                      <span className="finding-risk" style={{ color: c }}>{f.riskLevel}</span>
                      <span className="finding-conf">{Math.round(f.confidence * 100)}%</span>
                    </div>
                    <div className="finding-summary">{f.summary}</div>
                    {f.flags.length > 0 && (
                      <div className="risk-signals" style={{ marginTop: 4 }}>
                        {f.flags.slice(0, 2).map(fl => (
                          <span key={fl} className={`risk-sig risk-sig--${f.riskLevel}`}>{fl}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Agent activity */}
        {state.phase === "processing" && (
          <div className="overview-card">
            <div className="card-section-label">
              Agent Activity
              <span className="section-label-count">
                {Object.values(state.agentStates).filter(s => s !== "idle").length} / {AGENT_DEFS.length} active
              </span>
            </div>
            <div className="agent-pills" style={{ marginTop: 6 }}>
              {AGENT_DEFS.map(def => {
                const st = state.agentStates[def.id] ?? "idle";
                const c  = STATE_COLORS[st];
                return (
                  <div key={def.id} className="agent-pill" style={{ borderColor: c + "55", color: c }}>
                    <div className="agent-pip" style={{ background: c }} />
                    {def.shortLabel}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Decision summary */}
        {isDone && dec && decColor && (
          <div className="overview-card overview-decision-card" style={{ borderColor: decColor + "40", background: decColor + "08" }}>
            <div className="card-section-label">Decision</div>
            <div className="overview-decision-row">
              <div className="overview-score" style={{ color: decColor }}>{Math.round(dec.score)}</div>
              <div className="overview-decision-info">
                <div className="overview-decision-status" style={{ color: decColor }}>
                  {DECISION_LABELS[dec.status] ?? dec.status}
                </div>
                <div className="overview-decision-sub">Risk score · out of 999</div>
              </div>
            </div>
            {dec.triggeredRules.length > 0 && (
              <div className="rule-tags" style={{ marginTop: 8 }}>
                {dec.triggeredRules.slice(0, 5).map(r => (
                  <span key={r} className="rule-tag">{r}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Side column ──────────────────────────────────────────────────── */}
      <div className="overview-side">

        {/* Investigation checks summary */}
        <div className="side-card">
          <div className="card-section-label">Investigation Checks</div>
          {steps.map(step => {
            const c = step.status === "flagged" ? "var(--high)"
                    : step.status === "done"    ? "var(--low)"
                    : step.status === "running" ? "var(--accent)"
                    : "var(--muted)";
            return (
              <div key={step.stepId} className="check-row">
                <span className="check-icon" style={{ color: c }}>
                  {step.status === "flagged" ? "⚑"
                   : step.status === "done"   ? "✓"
                   : step.status === "running" ? "◌"
                   : "○"}
                </span>
                <div className="check-info">
                  <span className="check-label" style={{ color: step.status === "pending" ? "var(--muted)" : "var(--text)" }}>
                    {step.label}
                  </span>
                  {step.summary && step.status !== "pending" && (
                    <span className="check-summary">
                      {step.summary.slice(0, 55)}{step.summary.length > 55 ? "…" : ""}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Documents */}
        {state.docs.length > 0 && (
          <div className="side-card">
            <div className="card-section-label">Documents ({state.docs.length})</div>
            <div className="doc-stack">
              {state.docs.map(doc => (
                <div key={doc.id} className="doc-stack-item" style={{ flexDirection: "column", alignItems: "flex-start", gap: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, width: "100%" }}>
                    <FileText size={12} color="var(--muted)" />
                    <span className="doc-stack-name">{doc.filename}</span>
                    <span className={`status-pill status-pill--${doc.status}`}>{doc.status}</span>
                  </div>
                  {doc.fieldsExtracted !== undefined && doc.fieldsExtracted > 0 && (
                    <div className="doc-fields">{doc.fieldsExtracted} field{doc.fieldsExtracted !== 1 ? "s" : ""} extracted</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommended actions */}
        {actions.length > 0 && (
          <div className="side-card">
            <div className="card-section-label">Recommended Actions</div>
            {actions.map((a, i) => (
              <div key={i} className={`action-card action-card--${a.priority}`} style={{ marginTop: i > 0 ? 6 : 0 }}>
                <div className="action-card-title">{a.title}</div>
                <div className="action-card-desc">{a.description}</div>
                <span className={`action-priority-badge action-priority--${a.priority}`}>
                  {a.priority.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
