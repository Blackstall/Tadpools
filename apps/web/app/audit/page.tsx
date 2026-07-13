"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import AuditLogRow from "../../components/audit/AuditLogRow";
import EmptyState from "../../components/ui/EmptyState";
import type { AuditLog } from "@tadpools/shared/index";

const API = "http://localhost:4000";

const ACTOR_TYPES = ["", "system", "agent", "analyst", "admin"];
const MODULE_TYPES = [
  "", "intake", "extraction", "authenticity", "entity_verification",
  "relationship_matching", "historical_intelligence", "challenge_phase", "decision",
];
const ACTOR_LABELS: Record<string, string> = {
  "": "All Actors", system: "System", agent: "Agent", analyst: "Analyst", admin: "Admin",
};
const MODULE_LABELS: Record<string, string> = {
  "": "All Modules", intake: "Intake", extraction: "Extraction",
  authenticity: "Authenticity", entity_verification: "Entity Verification",
  relationship_matching: "Relationship", historical_intelligence: "Historical Intel",
  challenge_phase: "Challenge Phase", decision: "Decision",
};

interface DecisionChain {
  caseId: string;
  caseRef: string | null;
  status: string;
  score: number | null;
  decision: {
    decisionType: string | null;
    finalScore: number | null;
    confidence: number | null;
    decisionNarrative: string | null;
    recommendation: string | null;
    computedBy: string;
    createdAt: string;
  } | null;
  signalCount: number;
  riskIncreaseTotal: number;
  riskReduceTotal: number;
  analystActions: { actionType: string; note: string | null; createdAt: string }[];
}

export default function AuditPage() {
  const router = useRouter();

  // ── Filters ──────────────────────────────────────────────────────────────
  const [actorType,  setActorType]  = useState("");
  const [moduleType, setModuleType] = useState("");
  const [caseIdFilter, setCaseId]   = useState("");
  const [logs,    setLogs]    = useState<AuditLog[]>([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [offset,  setOffset]  = useState(0);
  const LIMIT = 50;

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fetchLogs = useCallback(async (
    actor: string, mod: string, cId: string, off: number
  ) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT), offset: String(off) });
      if (actor) params.set("actorType", actor);
      if (mod)   params.set("module", mod);
      if (cId)   params.set("caseId", cId);
      const r = await fetch(`${API}/api/audit?${params}`);
      if (!r.ok) throw new Error("Failed to load audit logs");
      const d = await r.json() as { logs: AuditLog[]; total: number };
      setLogs(d.logs ?? []);
      setTotal(d.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setOffset(0);
      void fetchLogs(actorType, moduleType, caseIdFilter, 0);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [actorType, moduleType, caseIdFilter, fetchLogs]);

  // Refresh on offset change (pagination)
  useEffect(() => {
    void fetchLogs(actorType, moduleType, caseIdFilter, offset);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset]);

  // ── Decision Reconstruction ───────────────────────────────────────────────
  const [reconCaseId, setReconCaseId] = useState("");
  const [chain, setChain] = useState<DecisionChain | null>(null);
  const [chainLoading, setChainLoading] = useState(false);
  const [chainError, setChainError] = useState<string | null>(null);

  const loadChain = useCallback(async (cId: string) => {
    if (!cId.trim()) return;
    setChainLoading(true);
    setChainError(null);
    try {
      const [caseRes, summaryRes, actionsRes] = await Promise.all([
        fetch(`${API}/api/cases/${cId}`),
        fetch(`${API}/api/cases/${cId}/signals/summary`),
        fetch(`${API}/api/cases/${cId}/timeline`),
      ]);
      if (!caseRes.ok) throw new Error("Case not found");
      const caseData = await caseRes.json() as {
        id: string; case_reference: string; status: string; score: number | null;
        decision?: {
          decision_type: string; final_score: number; confidence: number;
          decision_narrative: string; recommendation: string; computed_by: string; created_at: string;
        };
      };
      const summaryData = summaryRes.ok
        ? await summaryRes.json() as { signalCount: number; riskIncreaseTotal: number; riskReduceTotal: number }
        : { signalCount: 0, riskIncreaseTotal: 0, riskReduceTotal: 0 };
      const timelineData = actionsRes.ok
        ? await actionsRes.json() as { events: { event_type: string; title: string; description: string | null; created_at: string }[] }
        : { events: [] };

      const analystActions = (timelineData.events ?? [])
        .filter((e) => e.event_type === "analyst_action")
        .map((e) => ({ actionType: e.title, note: e.description, createdAt: e.created_at }));

      setChain({
        caseId: caseData.id,
        caseRef: caseData.case_reference,
        status: caseData.status,
        score: caseData.score,
        decision: caseData.decision ? {
          decisionType:      caseData.decision.decision_type,
          finalScore:        caseData.decision.final_score,
          confidence:        caseData.decision.confidence,
          decisionNarrative: caseData.decision.decision_narrative,
          recommendation:    caseData.decision.recommendation,
          computedBy:        caseData.decision.computed_by,
          createdAt:         caseData.decision.created_at,
        } : null,
        signalCount:       summaryData.signalCount,
        riskIncreaseTotal: summaryData.riskIncreaseTotal,
        riskReduceTotal:   summaryData.riskReduceTotal,
        analystActions,
      });
    } catch (e) {
      setChainError(e instanceof Error ? e.message : "Failed to load");
      setChain(null);
    } finally {
      setChainLoading(false);
    }
  }, []);

  return (
    <div className="audit-page">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="audit-page-header">
        <div>
          <h1 className="audit-page-title">Audit &amp; Governance</h1>
          <p className="audit-page-subtitle">Full traceability of all system, agent and analyst activity</p>
        </div>
        <div className="audit-version-badges">
          <span className="audit-version-badge">Policy v1.0</span>
          <span className="audit-version-badge">Model Engine v2</span>
        </div>
      </div>

      {/* ── Main two-column layout ─────────────────────────────────────────── */}
      <div className="audit-layout">

        {/* ── Left: Audit log stream ──────────────────────────────────────── */}
        <div className="audit-log-panel">

          {/* Filters */}
          <div className="audit-filters">
            <input
              className="audit-filter-input"
              placeholder="Filter by Case ID…"
              value={caseIdFilter}
              onChange={e => setCaseId(e.target.value)}
            />
            <select
              className="audit-filter-select"
              value={actorType}
              onChange={e => setActorType(e.target.value)}
            >
              {ACTOR_TYPES.map(t => (
                <option key={t} value={t}>{ACTOR_LABELS[t]}</option>
              ))}
            </select>
            <select
              className="audit-filter-select"
              value={moduleType}
              onChange={e => setModuleType(e.target.value)}
            >
              {MODULE_TYPES.map(t => (
                <option key={t} value={t}>{MODULE_LABELS[t]}</option>
              ))}
            </select>
            {total > 0 && (
              <span className="audit-total-count">{total} entries</span>
            )}
          </div>

          {/* Column headers */}
          <div className="audit-log-header">
            <span>Timestamp</span>
            <span>Actor</span>
            <span>Module</span>
            <span>Action</span>
            <span>Case</span>
            <span />
          </div>

          {/* Log rows */}
          <div className="audit-log-stream">
            {loading && (
              <div className="page-loading" style={{ height: 80 }}>
                <span className="intel-spinner" />
              </div>
            )}
            {error && <div className="page-error">{error}</div>}
            {!loading && !error && logs.length === 0 && (
              <EmptyState message="No audit entries match filters" />
            )}
            {logs.map(log => (
              <AuditLogRow key={log.id} log={log} />
            ))}
          </div>

          {/* Pagination */}
          {total > LIMIT && (
            <div className="audit-pagination">
              <button
                className="btn-ghost"
                disabled={offset === 0}
                onClick={() => setOffset(o => Math.max(0, o - LIMIT))}
              >
                ← Prev
              </button>
              <span className="audit-pagination-info">
                {offset + 1}–{Math.min(offset + LIMIT, total)} of {total}
              </span>
              <button
                className="btn-ghost"
                disabled={offset + LIMIT >= total}
                onClick={() => setOffset(o => o + LIMIT)}
              >
                Next →
              </button>
            </div>
          )}
        </div>

        {/* ── Right: Decision reconstruction ─────────────────────────────── */}
        <div className="audit-recon-panel">
          <div className="audit-recon-header">
            <span className="audit-section-label">Decision Reconstruction</span>
            <div className="audit-recon-search">
              <input
                className="audit-filter-input"
                placeholder="Enter case ID…"
                value={reconCaseId}
                onChange={e => setReconCaseId(e.target.value)}
              />
              <button
                className="submit-btn"
                style={{ padding: "7px 14px", fontSize: 12, marginTop: 0 }}
                onClick={() => loadChain(reconCaseId)}
                disabled={chainLoading || !reconCaseId.trim()}
              >
                {chainLoading ? "Loading…" : "Load"}
              </button>
            </div>
          </div>

          {chainError && <div className="page-error" style={{ margin: "12px 0" }}>{chainError}</div>}

          {chain && (
            <div className="audit-chain">
              {/* Case header */}
              <div className="audit-chain-case">
                <span className="audit-chain-ref">{chain.caseRef ?? chain.caseId.slice(0, 8)}</span>
                <span className={`audit-chain-status audit-chain-status--${chain.status}`}>
                  {chain.status.replace("_", " ").toUpperCase()}
                </span>
                <button
                  className="btn-ghost"
                  style={{ fontSize: 10 }}
                  onClick={() => router.push(`/?caseId=${chain.caseId}`)}
                >
                  Open →
                </button>
              </div>

              {/* Signal summary */}
              <div className="audit-chain-section">
                <div className="audit-chain-section-label">Signal Analysis</div>
                <div className="audit-chain-row">
                  <span className="audit-chain-key">Total signals</span>
                  <span className="audit-chain-val">{chain.signalCount}</span>
                </div>
                <div className="audit-chain-row">
                  <span className="audit-chain-key">Risk-increasing score</span>
                  <span className="audit-chain-val" style={{ color: "var(--high)" }}>
                    +{chain.riskIncreaseTotal.toFixed(1)}
                  </span>
                </div>
                <div className="audit-chain-row">
                  <span className="audit-chain-key">Risk-reducing score</span>
                  <span className="audit-chain-val" style={{ color: "var(--low)" }}>
                    −{chain.riskReduceTotal.toFixed(1)}
                  </span>
                </div>
                <div className="audit-chain-row">
                  <span className="audit-chain-key">Net contribution</span>
                  <span className="audit-chain-val" style={{ fontWeight: 700 }}>
                    {(chain.riskIncreaseTotal - chain.riskReduceTotal).toFixed(1)}
                  </span>
                </div>
              </div>

              {/* Decision */}
              {chain.decision && (
                <div className="audit-chain-section">
                  <div className="audit-chain-section-label">Final Decision</div>
                  <div className="audit-chain-row">
                    <span className="audit-chain-key">Decision type</span>
                    <span className="audit-chain-val" style={{ fontWeight: 700, textTransform: "capitalize" }}>
                      {chain.decision.decisionType ?? "—"}
                    </span>
                  </div>
                  <div className="audit-chain-row">
                    <span className="audit-chain-key">Final score</span>
                    <span className="audit-chain-val">{chain.decision.finalScore ?? "—"}</span>
                  </div>
                  <div className="audit-chain-row">
                    <span className="audit-chain-key">Confidence</span>
                    <span className="audit-chain-val">
                      {chain.decision.confidence != null
                        ? `${Math.round(chain.decision.confidence * 100)}%`
                        : "—"}
                    </span>
                  </div>
                  <div className="audit-chain-row">
                    <span className="audit-chain-key">Computed by</span>
                    <span className="audit-chain-val">{chain.decision.computedBy}</span>
                  </div>
                  {chain.decision.decisionNarrative && (
                    <div className="audit-chain-narrative">
                      {chain.decision.decisionNarrative}
                    </div>
                  )}
                  {chain.decision.recommendation && (
                    <div className="audit-chain-recommendation">
                      💡 {chain.decision.recommendation}
                    </div>
                  )}
                </div>
              )}

              {/* Analyst actions */}
              {chain.analystActions.length > 0 && (
                <div className="audit-chain-section">
                  <div className="audit-chain-section-label">Analyst Actions</div>
                  {chain.analystActions.map((a, i) => (
                    <div key={i} className="audit-chain-action-row">
                      <span className="audit-chain-action-type">{a.actionType}</span>
                      {a.note && <span className="audit-chain-action-note">{a.note}</span>}
                      <span className="audit-chain-action-time">
                        {new Date(a.createdAt).toLocaleString(undefined, {
                          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {!chain.decision && chain.analystActions.length === 0 && (
                <EmptyState message="No decision or analyst actions found for this case" />
              )}
            </div>
          )}

          {!chain && !chainLoading && !chainError && (
            <div className="audit-recon-empty">
              <span style={{ fontSize: 28, opacity: 0.25 }}>🔍</span>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                Enter a case ID to reconstruct its decision chain
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
