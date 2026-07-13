"use client";

// PHASE 1+5 — Investigation Report Panel: step-based explainable report
import { useState } from "react";
import type { SwarmState } from "../../lib/types";
import { mapFindingsToSteps, type StepData, type StepStatus } from "../../lib/workbench/mapFindings";
import { buildRecommendedActions } from "../../lib/workbench/recommendedActions";

interface Props {
  swarmState: SwarmState;
  casePayload: Record<string, unknown> | null;
}

const STATUS_ICON: Record<StepStatus, string> = {
  pending: "○",
  running: "◌",
  done:    "✓",
  flagged: "⚑",
};

const STATUS_COLOR: Record<StepStatus, string> = {
  pending: "var(--muted)",
  running: "var(--accent)",
  done:    "var(--low)",
  flagged: "var(--high)",
};

const RISK_COLORS: Record<string, string> = {
  high:   "#EF4444",
  medium: "#F59E0B",
  low:    "#22C55E",
};

function StepRow({ step }: { step: StepData }) {
  const [expanded, setExpanded] = useState(false);
  const color = STATUS_COLOR[step.status];
  const icon  = STATUS_ICON[step.status];
  const isRunning = step.status === "running";

  return (
    <div className={`report-step report-step--${step.status}`}>
      <button
        className="report-step-header"
        onClick={() => setExpanded((v) => !v)}
        disabled={step.findings.length === 0 && step.status === "pending"}
      >
        <span className="report-step-icon" style={{ color, animation: isRunning ? "spin 1s linear infinite" : undefined }}>
          {isRunning ? <span className="intel-spinner" style={{ width: 12, height: 12 }} /> : icon}
        </span>
        <span className="report-step-label">{step.label}</span>
        {step.findings.length > 0 && (
          <span className="report-step-badge">{step.findings.length}</span>
        )}
        {step.findings.length > 0 && (
          <span className="report-step-chevron">{expanded ? "▲" : "▼"}</span>
        )}
      </button>

      {step.summary && (
        <div className="report-step-summary">{step.summary}</div>
      )}

      {expanded && step.findings.length > 0 && (
        <div className="report-step-findings">
          {step.findings.map((f) => {
            const fc = RISK_COLORS[f.riskLevel] ?? "var(--muted)";
            return (
              <div key={f.agent} className="report-finding" style={{ borderLeftColor: fc }}>
                <div className="report-finding-header">
                  <span className="report-finding-agent">{f.agent.replace("Agent", "")}</span>
                  <span className="report-finding-risk" style={{ color: fc }}>{f.riskLevel}</span>
                </div>
                <p className="report-finding-summary">{f.summary}</p>
                {f.flags.length > 0 && (
                  <div className="risk-signals" style={{ marginTop: 4 }}>
                    {f.flags.slice(0, 3).map((fl) => (
                      <span key={fl} className={`risk-sig risk-sig--${f.riskLevel}`}>{fl}</span>
                    ))}
                  </div>
                )}
                {f.reasoning.length > 0 && (
                  <div className="decision-reasons" style={{ marginTop: 4 }}>
                    {f.reasoning.slice(0, 2).map((r, i) => (
                      <div key={i} className="decision-reason">{r}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function InvestigationReportPanel({ swarmState, casePayload }: Props) {
  const { findings, phase, docs, decision } = swarmState;
  const steps = mapFindingsToSteps(findings, phase, docs.length);
  const actions = buildRecommendedActions(swarmState, casePayload);

  const isDone = phase === "done" || phase === "error";
  const bankName = (casePayload?.beneficiary as Record<string, string> | undefined)?.bankName;

  return (
    <aside className="investigation-report-panel">
      {/* ── Header ── */}
      <div className="report-panel-header">
        <span className="report-panel-title">Investigation Report</span>
        {isDone && decision && (
          <span
            className="report-panel-status"
            style={{
              color: decision.status === "approve" ? "var(--low)" :
                     decision.status === "reject"  ? "var(--high)" :
                     "var(--medium)",
            }}
          >
            {decision.status.replace("_", " ").toUpperCase()}
          </span>
        )}
      </div>

      {/* ── Steps ── */}
      <div className="report-steps">
        {steps.map((step) => (
          <StepRow key={step.stepId} step={step} />
        ))}
      </div>

      {/* ── Recommended Actions ── */}
      {actions.length > 0 && (
        <div className="report-actions">
          <div className="report-actions-header">Recommended Actions</div>
          {actions.map((action, i) => (
            <div key={i} className={`action-card action-card--${action.priority}`}>
              <div className="action-card-title">{action.title}</div>
              <div className="action-card-desc">{action.description}</div>
              <span className={`action-priority-badge action-priority--${action.priority}`}>
                {action.priority.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Bank Contact (if high risk + bank name) ── */}
      {isDone && decision && decision.score >= 90 && bankName && (
        <BankContactBlock bankName={bankName} />
      )}
    </aside>
  );
}

// ── Bank Contact Block ────────────────────────────────────────────────────────
function BankContactBlock({ bankName }: { bankName: string }) {
  const [contact, setContact]   = useState<{ label: string; number: string } | null>(null);
  const [loading, setLoading]   = useState(false);
  const [fetched, setFetched]   = useState(false);

  const fetch_ = () => {
    if (fetched) return;
    setLoading(true);
    fetch(`http://localhost:4000/api/bank-contacts?bank=${encodeURIComponent(bankName)}`)
      .then((r) => r.json())
      .then((d: { contacts?: { contact_label: string; contact_number: string }[] }) => {
        if (d.contacts && d.contacts.length > 0) {
          setContact({ label: d.contacts[0].contact_label, number: d.contacts[0].contact_number });
        }
        setFetched(true);
        setLoading(false);
      })
      .catch(() => { setFetched(true); setLoading(false); });
  };

  return (
    <div className="report-bank-escalation">
      <div className="report-actions-header">Bank Escalation</div>
      <p className="bubble-summary" style={{ marginTop: 4 }}>{bankName}</p>
      {!fetched && (
        <button className="btn-ghost" style={{ marginTop: 6, fontSize: 11 }} onClick={fetch_} disabled={loading}>
          {loading ? "Loading…" : "Get Fraud Contact"}
        </button>
      )}
      {contact && (
        <div className="bank-contact-block">
          <div className="bank-contact-label">{contact.label}</div>
          <div className="bank-contact-number">{contact.number}</div>
        </div>
      )}
      {fetched && !contact && (
        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>No contact found.</div>
      )}
    </div>
  );
}
