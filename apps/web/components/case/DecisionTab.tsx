"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import type { SwarmState } from "../../lib/types";
import { buildRecommendedActions } from "../../lib/workbench/recommendedActions";

const API = "http://localhost:4000";

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

const DECISION_DESCRIPTIONS: Record<string, string> = {
  approve:       "Low risk — standard onboarding procedures may proceed.",
  manual_review: "Moderate risk detected — a human reviewer should assess before proceeding.",
  escalate:      "Elevated risk — compliance team review required before any action.",
  reject:        "High risk or hard policy rule triggered — do not proceed with onboarding.",
};

type ActionKey = "approve" | "reject" | "escalate" | "request-documents";

const ACTION_CONFIG: Record<ActionKey, { label: string; color: string; confirmText: string }> = {
  approve:           { label: "Approve",          color: "var(--low)",    confirmText: "Confirm case approval" },
  reject:            { label: "Reject",           color: "var(--high)",   confirmText: "Confirm case rejection" },
  escalate:          { label: "Escalate",         color: "var(--medium)", confirmText: "Escalate to senior analyst" },
  "request-documents": { label: "Request Docs",  color: "#3B82F6",       confirmText: "Request additional documents" },
};

interface Props {
  state:       SwarmState;
  casePayload: Record<string, unknown> | null;
}

export function DecisionTab({ state, casePayload }: Props) {
  const dec      = state.decision;
  const actions  = buildRecommendedActions(state, casePayload);
  const bankName = (casePayload?.beneficiary as Record<string, string> | undefined)?.bankName;

  // ── Bank escalation contact ────────────────────────────────────────────────
  const [contact,        setContact]        = useState<{ label: string; number: string } | null>(null);
  const [contactLoading, setContactLoading] = useState(false);
  const [contactFetched, setContactFetched] = useState(false);

  const fetchContact = async () => {
    if (contactFetched || !bankName) return;
    setContactLoading(true);
    try {
      const r = await fetch(`${API}/api/bank-contacts?bank=${encodeURIComponent(bankName)}`);
      const d = await r.json() as { contacts?: { contact_label: string; contact_number: string }[] };
      if (d.contacts?.[0]) {
        setContact({ label: d.contacts[0].contact_label, number: d.contacts[0].contact_number });
      }
    } catch { /* silent */ }
    setContactFetched(true);
    setContactLoading(false);
  };

  // ── Analyst action buttons (Phase 11) ─────────────────────────────────────
  const [modalAction,  setModalAction]  = useState<ActionKey | null>(null);
  const [actionNote,   setActionNote]   = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [actionResult, setActionResult] = useState<{ action: string; success: boolean } | null>(null);
  const [toast,        setToast]        = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const openModal  = (action: ActionKey) => { setModalAction(action); setActionNote(""); };
  const closeModal = () => { setModalAction(null); setActionNote(""); };

  const submitAction = async () => {
    if (!state.caseId || !modalAction) return;
    setSubmitting(true);
    try {
      const r = await fetch(`${API}/api/cases/${state.caseId}/actions/${modalAction}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ note: actionNote || undefined }),
      });
      if (!r.ok) {
        const err = await r.json() as { message?: string };
        throw new Error(err.message ?? "Action failed");
      }
      setActionResult({ action: modalAction, success: true });
      showToast(`${ACTION_CONFIG[modalAction].label} recorded and logged ✓`);
      closeModal();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Action failed");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExportJSON = () => {
    const blob = new Blob(
      [JSON.stringify({ caseId: state.caseId, decision: dec, findings: state.findings }, null, 2)],
      { type: "application/json" }
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `case-${(state.caseId ?? "unknown").slice(0, 8)}-audit.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ── Awaiting decision state ────────────────────────────────────────────────
  if (!dec) {
    return (
      <div className="decision-tab">
        <div className="decision-awaiting">
          <div className="intel-waiting">
            {state.phase === "processing"
              ? <><span className="intel-spinner" /><span>Agents deliberating…</span></>
              : <span>Submit a case to receive a decision.</span>}
          </div>
          {state.phase === "processing" && (
            <p className="bubble-summary" style={{ marginTop: 8, maxWidth: 400 }}>
              The policy engine will evaluate all agent findings once the swarm completes its analysis.
            </p>
          )}
        </div>
      </div>
    );
  }

  const c     = DECISION_COLORS[dec.status] ?? "#14B8A6";
  const label = DECISION_LABELS[dec.status] ?? dec.status;
  const desc  = DECISION_DESCRIPTIONS[dec.status] ?? "";

  const round2  = state.findings.filter(f => f.round === 2);
  const round3  = state.findings.filter(f => f.round === 3);
  const avgConf = state.findings.length > 0
    ? Math.round(state.findings.reduce((s, f) => s + f.confidence, 0) / state.findings.length * 100)
    : 0;

  const actionAlreadyTaken = !!actionResult;

  return (
    <div className="decision-tab">

      {/* Toast notification */}
      {toast && (
        <div className="decision-toast">
          {toast}
        </div>
      )}

      {/* Hero decision card */}
      <div className="decision-hero" style={{ borderColor: c + "40", background: c + "08" }}>
        <div className="decision-hero-score" style={{ color: c }}>{Math.round(dec.score)}</div>
        <div className="decision-hero-text">
          <div className="decision-hero-label" style={{ color: c }}>{label}</div>
          <div className="decision-hero-desc">{desc}</div>
          {actionResult && (
            <div className="decision-override-badge">
              Analyst action: {ACTION_CONFIG[actionResult.action as ActionKey]?.label}
            </div>
          )}
        </div>
      </div>

      {/* Confidence */}
      <div className="decision-section">
        <div className="card-section-label">Overall Confidence</div>
        <div className="bubble-conf" style={{ marginTop: 8 }}>
          <div className="conf-bar" style={{ flex: 1 }}>
            <div className="conf-fill" style={{ width: `${avgConf}%`, background: c }} />
          </div>
          <span className="conf-pct">{avgConf}%</span>
        </div>
      </div>

      {/* Triggered rules */}
      {dec.triggeredRules.length > 0 && (
        <div className="decision-section">
          <div className="card-section-label">Triggered Policy Rules</div>
          <div className="rule-tags" style={{ marginTop: 8 }}>
            {dec.triggeredRules.map(r => (
              <span key={r} className="rule-tag">{r}</span>
            ))}
          </div>
        </div>
      )}

      {/* Challenge & Synthesis — Rounds 2+3 */}
      {(round2.length > 0 || round3.length > 0) && (
        <div className="decision-section">
          <div className="card-section-label">Challenge &amp; Synthesis</div>
          <p className="bubble-summary" style={{ marginTop: 6, marginBottom: 10, lineHeight: 1.6 }}>
            Before finalising, the system runs a challenge phase. The <strong>Skeptic</strong> reduces
            false positives; the <strong>Prosecutor</strong> surfaces missed risk; the <strong>Chair</strong> synthesises
            the final recommendation.
          </p>
          {[...round2, ...round3].map(f => {
            const roleColor = f.agent.includes("Skeptic")    ? "#8B5CF6"
                            : f.agent.includes("Prosecutor") ? "#F97316"
                            : "#22C55E";
            const riskColor = f.riskLevel === "high" ? "var(--high)"
                            : f.riskLevel === "medium" ? "var(--medium)"
                            : "var(--low)";
            return (
              <div key={f.agent} className="challenge-row" style={{ borderLeftColor: roleColor }}>
                <div className="challenge-row-header">
                  <span className="challenge-agent" style={{ color: roleColor }}>
                    {f.agent.replace("Agent", "")}
                    {f.agent.includes("Chair") && <span style={{ fontWeight: 400, color: "var(--muted)", marginLeft: 4 }}>— Final Synthesis</span>}
                  </span>
                  <span className="finding-risk" style={{ color: riskColor }}>{f.riskLevel}</span>
                </div>
                <p className="bubble-summary">{f.summary}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Recommended actions */}
      {actions.length > 0 && (
        <div className="decision-section">
          <div className="card-section-label">Recommended Actions</div>
          {actions.map((a, i) => (
            <div key={i} className={`action-card action-card--${a.priority}`} style={{ marginTop: i > 0 ? 6 : 8 }}>
              <div className="action-card-title">{a.title}</div>
              <div className="action-card-desc">{a.description}</div>
              <span className={`action-priority-badge action-priority--${a.priority}`}>
                {a.priority.toUpperCase()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Bank escalation */}
      {dec.score >= 90 && bankName && (
        <div className="decision-section">
          <div className="card-section-label">Bank Escalation</div>
          <p className="bubble-summary" style={{ marginTop: 4 }}>{bankName}</p>
          {!contactFetched && (
            <button
              className="btn-ghost"
              onClick={fetchContact}
              disabled={contactLoading}
              style={{ marginTop: 8, fontSize: 11 }}
            >
              {contactLoading ? "Loading…" : "Get Fraud Contact"}
            </button>
          )}
          {contact && (
            <div className="bank-contact-block" style={{ marginTop: 8 }}>
              <div className="bank-contact-label">{contact.label}</div>
              <div className="bank-contact-number">{contact.number}</div>
            </div>
          )}
          {contactFetched && !contact && (
            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>No contact found.</div>
          )}
        </div>
      )}

      {/* ── Analyst Action Buttons (Phase 11) ────────────────────────────── */}
      <div className="decision-section">
        <div className="card-section-label">Analyst Actions</div>
        {actionAlreadyTaken ? (
          <div className="override-success">
            ✓ {ACTION_CONFIG[actionResult!.action as ActionKey]?.label} recorded and added to audit trail
          </div>
        ) : (
          <div className="analyst-actions-grid">
            {(Object.entries(ACTION_CONFIG) as [ActionKey, typeof ACTION_CONFIG[ActionKey]][]).map(([key, cfg]) => (
              <button
                key={key}
                className="analyst-action-btn"
                style={{ borderColor: cfg.color + "55", color: cfg.color }}
                onClick={() => openModal(key)}
                disabled={!state.caseId}
              >
                <span
                  className="analyst-action-dot"
                  style={{ background: cfg.color }}
                />
                {cfg.label}
              </button>
            ))}
          </div>
        )}
        <p className="analyst-actions-note">
          Actions are logged to the audit trail and update the case timeline.
        </p>
      </div>

      {/* Export */}
      <div className="decision-section">
        <div className="card-section-label">Export</div>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="export-btn" onClick={handleExportJSON}>
            <Download size={12} /> JSON Audit
          </button>
          {state.caseId && (
            <a
              className="export-btn"
              href={`${API}/api/cases/${state.caseId}/audit/export`}
              target="_blank"
              rel="noreferrer"
            >
              Full Audit Export
            </a>
          )}
        </div>
      </div>

      {/* ── Confirmation Modal ───────────────────────────────────────────── */}
      {modalAction && (
        <div className="analyst-modal-overlay" onClick={closeModal}>
          <div className="analyst-modal" onClick={e => e.stopPropagation()}>
            <div
              className="analyst-modal-header"
              style={{ borderColor: ACTION_CONFIG[modalAction].color + "44" }}
            >
              <span
                className="analyst-modal-title"
                style={{ color: ACTION_CONFIG[modalAction].color }}
              >
                {ACTION_CONFIG[modalAction].confirmText}
              </span>
              <button className="drawer-close" onClick={closeModal}>✕</button>
            </div>
            <div className="analyst-modal-body">
              <label className="analyst-modal-label">
                Note <span style={{ color: "var(--muted)", fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea
                className="override-comment"
                placeholder={`Reason for ${ACTION_CONFIG[modalAction].label.toLowerCase()}…`}
                value={actionNote}
                onChange={e => setActionNote(e.target.value)}
                rows={3}
                autoFocus
              />
            </div>
            <div className="analyst-modal-footer">
              <button className="btn-ghost" onClick={closeModal} disabled={submitting}>
                Cancel
              </button>
              <button
                className="analyst-confirm-btn"
                style={{ background: ACTION_CONFIG[modalAction].color }}
                onClick={submitAction}
                disabled={submitting}
              >
                {submitting ? "Submitting…" : `Confirm ${ACTION_CONFIG[modalAction].label}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
