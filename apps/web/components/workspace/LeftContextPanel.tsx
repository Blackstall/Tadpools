"use client";

import { useState } from "react";
import type { SwarmState } from "../../lib/types";

interface Props {
  state: SwarmState;
  casePayload: Record<string, unknown> | null;
  onReset: () => void;
  onHistoryOpen: () => void;
}

const OBSERVATION_OPTIONS = [
  "Caller was evasive",
  "Urgency pressure",
  "Unusual payment method",
  "Third-party request",
  "Cannot verify identity",
  "Inconsistent information",
];

const PHASE_LABELS: Record<string, string> = {
  uploading:  "Uploading documents…",
  extracting: "Extracting fields…",
  processing: "Swarm analysing…",
  done:       "Analysis complete",
  error:      "Error",
};

export function LeftContextPanel({ state, casePayload, onReset, onHistoryOpen }: Props) {
  const [contextOpen,   setContextOpen]   = useState(false);
  const [officerNotes,  setOfficerNotes]  = useState("");
  const [callSummary,   setCallSummary]   = useState("");
  const [observations,  setObservations]  = useState<string[]>([]);

  const company     = casePayload?.company     as Record<string, string> | undefined;
  const beneficiary = casePayload?.beneficiary as Record<string, string> | undefined;

  const toggleObs = (obs: string) =>
    setObservations(prev => prev.includes(obs) ? prev.filter(o => o !== obs) : [...prev, obs]);

  const isDone = state.phase === "done" || state.phase === "error";

  return (
    <div className="ws-left-panel">

      {/* ── Brand ─────────────────────────────────────────────────────── */}
      <div className="ws-left-brand">
        <div className="brand-dot" />
        <span className="ws-left-brand-name">Tadpools</span>
        <span className="ws-left-brand-ver">v2</span>
      </div>

      {/* ── Case Identity ─────────────────────────────────────────────── */}
      {company && (
        <div className="ws-left-section">
          <div className="ws-left-section-label">Company</div>
          <div className="ws-left-entity-card">
            <div className="ws-left-avatar">
              {(company.companyName ?? "?").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="ws-left-entity-name">{company.companyName}</div>
              <div className="ws-left-entity-sub">{company.registrationNumber}</div>
              {company.natureOfBusiness && (
                <div className="ws-left-entity-sub" style={{ marginTop: 2 }}>
                  {company.natureOfBusiness}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {beneficiary && (
        <div className="ws-left-section">
          <div className="ws-left-section-label">Beneficiary</div>
          <div className="ws-left-kv">
            <div className="ws-left-kv-row">
              <span className="ws-left-kv-key">Name</span>
              <span className="ws-left-kv-val">{beneficiary.beneficiaryName}</span>
            </div>
            <div className="ws-left-kv-row">
              <span className="ws-left-kv-key">Bank</span>
              <span className="ws-left-kv-val">{beneficiary.bankName}</span>
            </div>
            <div className="ws-left-kv-row">
              <span className="ws-left-kv-key">Account</span>
              <span className="ws-left-kv-val mono">{beneficiary.accountNumber}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Processing Status ─────────────────────────────────────────── */}
      <div className="ws-left-section">
        <div className="ws-left-section-label">Status</div>
        <div className={`ws-left-status ws-left-status--${state.phase}`}>
          {state.phase === "processing" && <span className="ws-left-spinner" />}
          {PHASE_LABELS[state.phase] ?? state.phase}
        </div>
        {state.caseId && (
          <div className="ws-left-caseid">
            Case <span className="mono">{state.caseId.slice(0, 8)}</span>
          </div>
        )}
      </div>

      {/* ── Documents ─────────────────────────────────────────────────── */}
      {state.docs.length > 0 && (
        <div className="ws-left-section">
          <div className="ws-left-section-label">Documents</div>
          <div className="ws-left-doc-list">
            {state.docs.map(doc => (
              <div key={doc.id} className="ws-left-doc-item">
                <span className="ws-left-doc-icon">📄</span>
                <span className="ws-left-doc-name">{doc.filename}</span>
                <span className={`ws-left-doc-status ws-left-doc-status--${doc.status}`}>
                  {doc.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Officer Context (collapsible) ─────────────────────────────── */}
      <div className="ws-left-section">
        <button className="ws-left-collapse-btn" onClick={() => setContextOpen(v => !v)}>
          <span>Officer Context</span>
          <span className="ws-left-collapse-icon">{contextOpen ? "▾" : "▸"}</span>
        </button>

        {contextOpen && (
          <div className="ws-left-context-body">
            <div className="ws-left-input-group">
              <label className="ws-left-input-label">Officer Notes</label>
              <textarea
                className="ws-left-textarea"
                placeholder="Free-form observations or notes…"
                value={officerNotes}
                onChange={e => setOfficerNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="ws-left-input-group">
              <label className="ws-left-input-label">Call Summary</label>
              <textarea
                className="ws-left-textarea"
                placeholder="Brief summary of any calls…"
                value={callSummary}
                onChange={e => setCallSummary(e.target.value)}
                rows={2}
              />
            </div>

            <div className="ws-left-input-group">
              <label className="ws-left-input-label">Observations</label>
              <div className="ws-left-obs-list">
                {OBSERVATION_OPTIONS.map(obs => (
                  <label key={obs} className="ws-left-obs-item">
                    <input
                      type="checkbox"
                      checked={observations.includes(obs)}
                      onChange={() => toggleObs(obs)}
                    />
                    <span>{obs}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer actions ────────────────────────────────────────────── */}
      <div className="ws-left-footer">
        <button className="ws-left-footer-btn" onClick={onHistoryOpen}>History</button>
        {isDone && (
          <button className="ws-left-footer-btn ws-left-footer-btn--primary" onClick={onReset}>
            + New Case
          </button>
        )}
      </div>
    </div>
  );
}
