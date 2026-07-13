"use client";

import { useState } from "react";
import type { SwarmState, AgentFinding } from "../../lib/types";

const API = "http://localhost:4000";

type OfficerAction = "approve" | "escalate" | "reject";

const ACTION_CONFIG: Record<OfficerAction, { label: string; color: string }> = {
  approve:  { label: "Approve",  color: "#22C55E" },
  escalate: { label: "Escalate", color: "#F97316" },
  reject:   { label: "Reject",   color: "#EF4444" },
};

const STATUS_TO_OFFICER_ACTION: Record<string, OfficerAction> = {
  approve:       "approve",
  manual_review: "escalate",
  escalate:      "escalate",
  reject:        "reject",
};

const STATUS_LABELS: Record<string, string> = {
  approve:       "Approve",
  manual_review: "Escalate",
  escalate:      "Escalate",
  reject:        "Reject",
};

const RISK_COLORS: Record<string, string> = {
  high:   "#EF4444",
  medium: "#F59E0B",
  low:    "#22C55E",
};

interface Props {
  state: SwarmState;
}

export function RightDecisionPanel({ state }: Props) {
  const [expandedAgents,        setExpandedAgents]        = useState<Set<string>>(new Set());
  const [selectedAction,        setSelectedAction]        = useState<OfficerAction | null>(null);
  const [justification,         setJustification]         = useState("");
  const [submitting,            setSubmitting]            = useState(false);
  const [submitted,             setSubmitted]             = useState<{ action: OfficerAction } | null>(null);
  const [proceedDespiteConflict,setProceedDespiteConflict]= useState(false);
  const [toast,                 setToast]                 = useState<string | null>(null);

  const dec = state.decision;

  const avgConf = state.findings.length > 0
    ? state.findings.reduce((s, f) => s + f.confidence, 0) / state.findings.length
    : 0;
  const avgConfPct = Math.round(avgConf * 100);

  const riskScore  = dec ? Math.round(dec.score) : 0;
  const riskLevel  = dec ? (riskScore >= 90 ? "High Risk" : riskScore >= 50 ? "Medium Risk" : "Low Risk") : null;
  const riskColor  = dec ? (riskScore >= 90 ? "#EF4444" : riskScore >= 50 ? "#F59E0B" : "#22C55E") : "#14B8A6";

  // Conflict: officer's choice ≠ AI's recommended action
  const aiAction = dec ? STATUS_TO_OFFICER_ACTION[dec.status] : null;
  const isConflict = selectedAction !== null && aiAction !== null && selectedAction !== aiAction;

  const canSubmit =
    selectedAction !== null &&
    justification.trim().length > 0 &&
    (!isConflict || proceedDespiteConflict) &&
    !!state.caseId;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleSelect = (action: OfficerAction) => {
    setSelectedAction(action);
    setProceedDespiteConflict(false);
  };

  const handleSubmit = async () => {
    if (!canSubmit || !selectedAction) return;
    setSubmitting(true);
    try {
      const r = await fetch(`${API}/api/cases/${state.caseId}/actions/${selectedAction}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ note: justification }),
      });
      if (!r.ok) {
        const err = await r.json() as { message?: string };
        throw new Error(err.message ?? "Action failed");
      }
      setSubmitted({ action: selectedAction });
      showToast(`Decision logged: ${ACTION_CONFIG[selectedAction].label} ✓`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAgent = (id: string) =>
    setExpandedAgents(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Key signals: top flags ranked by risk
  const keySignals = state.findings
    .flatMap(f => f.flags.map(flag => ({ flag, riskLevel: f.riskLevel })))
    .sort((a, b) => {
      const rank: Record<string, number> = { high: 3, medium: 2, low: 1 };
      return (rank[b.riskLevel] ?? 0) - (rank[a.riskLevel] ?? 0);
    })
    .slice(0, 8);

  return (
    <div className="ws-right-panel">

      {toast && <div className="ws-right-toast">{toast}</div>}

      {/* ── SECTION 1: AI RECOMMENDATION ──────────────────────────────── */}
      <div className="ws-right-section ws-right-section--hero">
        <div className="ws-right-section-label">AI Recommendation</div>

        {!dec ? (
          <div className="ws-right-waiting">
            {state.phase === "processing"
              ? <><span className="ws-right-spinner" /><span>Agents analysing…</span></>
              : <span className="ws-muted">Submit a case to receive a recommendation.</span>
            }
          </div>
        ) : (
          <>
            <div className="ws-right-score-row">
              <div className="ws-right-score" style={{ color: riskColor }}>{riskScore}</div>
              <div className="ws-right-score-meta">
                <div
                  className="ws-right-risk-badge"
                  style={{ color: riskColor, borderColor: riskColor + "44", background: riskColor + "11" }}
                >
                  {riskLevel}
                </div>
                <div className="ws-right-ai-rec">
                  AI recommends: <strong>{STATUS_LABELS[dec.status] ?? dec.status}</strong>
                </div>
              </div>
            </div>

            {/* Confidence bar */}
            <div className="ws-right-conf-row">
              <div className="ws-right-conf-track">
                <div
                  className="ws-right-conf-fill"
                  style={{
                    width: `${avgConfPct}%`,
                    background: avgConfPct >= 85 ? "#22C55E" : avgConfPct >= 60 ? "#F59E0B" : "#EF4444",
                  }}
                />
              </div>
              <span className="ws-right-conf-pct">{avgConfPct}%</span>
              <span className={`ws-right-conf-label ws-right-conf-label--${avgConfPct >= 85 ? "strong" : avgConfPct >= 60 ? "review" : "low"}`}>
                {avgConfPct >= 85 ? "Strong" : avgConfPct >= 60 ? "Needs review" : "Low confidence"}
              </span>
            </div>

            {avgConfPct < 60 && (
              <div className="ws-right-conf-warning">
                ⚠️ Low confidence — manual verification required before deciding.
              </div>
            )}
          </>
        )}
      </div>

      {/* ── SECTION 2: KEY SIGNALS ─────────────────────────────────────── */}
      {keySignals.length > 0 && (
        <div className="ws-right-section">
          <div className="ws-right-section-label">Key Signals</div>
          <ul className="ws-right-signals">
            {keySignals.map((s, i) => (
              <li key={i} className="ws-right-signal-item">
                <span
                  className="ws-right-signal-dot"
                  style={{ background: RISK_COLORS[s.riskLevel] ?? "#14B8A6" }}
                />
                <span className="ws-right-signal-text">{s.flag}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── SECTION 3: AGENT BREAKDOWN ─────────────────────────────────── */}
      {state.findings.length > 0 && (
        <div className="ws-right-section">
          <div className="ws-right-section-label">Agent Breakdown</div>
          <div className="ws-right-agents">
            {state.findings.map((f: AgentFinding) => {
              const isOpen = expandedAgents.has(f.agent);
              const col    = RISK_COLORS[f.riskLevel] ?? "#14B8A6";
              return (
                <div key={f.agent} className="ws-right-agent-card">
                  <button className="ws-right-agent-header" onClick={() => toggleAgent(f.agent)}>
                    <span className="ws-right-agent-dot" style={{ background: col }} />
                    <span className="ws-right-agent-name">
                      {f.agent.replace("Agent", "")}
                      {f.round > 1 && <span className="ws-right-agent-round">R{f.round}</span>}
                    </span>
                    <span className="ws-right-agent-conf">{Math.round(f.confidence * 100)}%</span>
                    <span className="ws-right-agent-risk" style={{ color: col }}>{f.riskLevel}</span>
                    <span className="ws-right-agent-chevron">{isOpen ? "▾" : "▸"}</span>
                  </button>
                  {isOpen && (
                    <div className="ws-right-agent-body">
                      <p className="ws-right-agent-summary">{f.summary}</p>
                      {f.reasoning.length > 0 && (
                        <ul className="ws-right-agent-reasoning">
                          {f.reasoning.slice(0, 3).map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      )}
                      {f.flags.length > 0 && (
                        <div className="ws-right-agent-flags">
                          {f.flags.map((flag, i) => (
                            <span key={i} className="ws-right-flag-tag">{flag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── SECTION 4: OFFICER DECISION (MANDATORY) ────────────────────── */}
      <div className="ws-right-section ws-right-section--decision">
        <div className="ws-right-section-label">
          Officer Decision
          <span className="ws-right-mandatory-tag">MANDATORY</span>
        </div>

        {submitted ? (
          <div className="ws-right-submitted">
            <div
              className="ws-right-submitted-badge"
              style={{ color: ACTION_CONFIG[submitted.action].color }}
            >
              ✓ {ACTION_CONFIG[submitted.action].label} recorded and logged
            </div>
            <div className="ws-right-submitted-meta">Decision added to audit trail.</div>
          </div>
        ) : (
          <>
            {/* Action buttons */}
            <div className="ws-right-action-btns">
              {(Object.entries(ACTION_CONFIG) as [OfficerAction, typeof ACTION_CONFIG[OfficerAction]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  className={`ws-right-action-btn${selectedAction === key ? " ws-right-action-btn--active" : ""}`}
                  style={{
                    borderColor: cfg.color + "55",
                    color:       selectedAction === key ? "#fff" : cfg.color,
                    background:  selectedAction === key ? cfg.color : "transparent",
                  }}
                  onClick={() => handleSelect(key)}
                  disabled={!dec || submitting}
                >
                  {cfg.label}
                </button>
              ))}
            </div>

            {/* ── SECTION 5: CONFLICT ALERT (conditional) ───────────────── */}
            {isConflict && !proceedDespiteConflict && (
              <div className="ws-right-conflict">
                <div className="ws-right-conflict-icon">⚠️</div>
                <div className="ws-right-conflict-body">
                  <div className="ws-right-conflict-title">Decision differs from AI recommendation</div>
                  <div className="ws-right-conflict-desc">
                    AI recommends <strong>{dec ? STATUS_LABELS[dec.status] : "—"}</strong>, you selected{" "}
                    <strong>{selectedAction ? ACTION_CONFIG[selectedAction].label : "—"}</strong>.
                    Proceed?
                  </div>
                  <button
                    className="ws-right-conflict-proceed"
                    onClick={() => setProceedDespiteConflict(true)}
                  >
                    Yes, proceed with my decision
                  </button>
                </div>
              </div>
            )}

            {/* Justification */}
            <div className="ws-right-just-group">
              <label className="ws-right-just-label">
                Justification <span className="ws-right-just-required">*</span>
              </label>
              <textarea
                className="ws-right-just-textarea"
                placeholder="Provide your reasoning… (required before submitting)"
                value={justification}
                onChange={e => setJustification(e.target.value)}
                rows={3}
                disabled={!selectedAction || submitting}
              />
              {selectedAction && !justification.trim() && (
                <div className="ws-right-just-hint">Justification is required.</div>
              )}
            </div>

            <button
              className="ws-right-submit-btn"
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
            >
              {submitting
                ? "Submitting…"
                : `Confirm ${selectedAction ? ACTION_CONFIG[selectedAction].label : "Decision"}`}
            </button>
          </>
        )}
      </div>

      {/* ── SECTION 6: AUDIT TRAIL ─────────────────────────────────────── */}
      {state.timeline.length > 0 && (
        <div className="ws-right-section">
          <div className="ws-right-section-label">Audit Trail</div>
          <div className="ws-right-audit">
            {[...state.timeline].reverse().slice(0, 8).map(evt => (
              <div key={evt.id} className="ws-right-audit-item">
                <div
                  className="ws-right-audit-dot"
                  style={{
                    background: evt.severity === "high"   ? "#EF4444"
                              : evt.severity === "medium" ? "#F59E0B"
                              : evt.severity === "low"    ? "#22C55E"
                              : "#14B8A6",
                  }}
                />
                <div className="ws-right-audit-body">
                  <div className="ws-right-audit-msg">{evt.message}</div>
                  <div className="ws-right-audit-time">+{evt.elapsed}s</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
