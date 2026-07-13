"use client";

// PHASE 1 — Case History Drawer: past cases with documents + findings summary
import { useEffect, useState, useCallback } from "react";
import { X, ChevronDown, ChevronRight, Clock, AlertTriangle, CheckCircle } from "lucide-react";

interface CaseHistoryRow {
  id:          string;
  status:      string;
  companyName: string;
  createdAt:   string;
  score?:      number;
  flags?:      string[];
  documents?:  { id: string; filename: string; docType: string }[];
  summary?:    string;
}

interface Props {
  open:    boolean;
  onClose: () => void;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch { return iso; }
}

function StatusIcon({ status }: { status: string }) {
  if (status === "decided")   return <CheckCircle size={12} style={{ color: "var(--low)" }} />;
  if (status === "error")     return <AlertTriangle size={12} style={{ color: "var(--high)" }} />;
  return <Clock size={12} style={{ color: "var(--accent)" }} />;
}

function CaseHistoryItem({ row }: { row: CaseHistoryRow }) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<{ score?: number; findings?: { agent: string; riskLevel: string; summary: string }[]; documents?: { id: string; filename: string; docType: string }[] } | null>(null);
  const [loading, setLoading] = useState(false);

  const loadDetail = useCallback(async () => {
    if (detail || loading) return;
    setLoading(true);
    try {
      const r = await fetch(`http://localhost:4000/api/cases/${row.id}`);
      const d = await r.json() as {
        decision?: { score: number; findings: { agent: string; riskLevel: string; summary: string }[] };
        caseInput?: { documents?: { id: string; filename: string; docType: string }[] };
      };
      setDetail({
        score:     d.decision?.score,
        findings:  d.decision?.findings?.slice(0, 3),
        documents: d.caseInput?.documents ?? [],
      });
    } catch { /* silent */ }
    setLoading(false);
  }, [row.id, detail, loading]);

  const toggle = () => {
    if (!expanded) loadDetail();
    setExpanded((v) => !v);
  };

  const statusClass =
    row.status === "decided"    ? "case-status--decided"    :
    row.status === "processing" ? "case-status--processing" :
    "case-status--error";

  return (
    <div className="history-item">
      <button className="history-item-header" onClick={toggle}>
        <StatusIcon status={row.status} />
        <div className="history-item-name">{row.companyName}</div>
        <span className={`case-status-badge ${statusClass}`} style={{ marginLeft: "auto", fontSize: 8 }}>
          {row.status}
        </span>
        {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
      </button>

      <div className="history-item-meta">
        <span className="case-card-id">{row.id.slice(0, 8).toUpperCase()}</span>
        <span style={{ color: "var(--muted)", fontSize: 10 }}>{fmtDate(row.createdAt)}</span>
      </div>

      {expanded && (
        <div className="history-item-detail">
          {loading && <div className="intel-waiting"><span className="intel-spinner" /><span>Loading…</span></div>}

          {detail && (
            <>
              {detail.score !== undefined && (
                <div className="history-detail-row">
                  <span className="intel-section-label">Risk Score</span>
                  <span style={{ fontWeight: 700, color: detail.score >= 90 ? "var(--high)" : detail.score >= 50 ? "var(--medium)" : "var(--low)" }}>
                    {Math.round(detail.score)}
                  </span>
                </div>
              )}

              {detail.findings && detail.findings.length > 0 && (
                <div className="history-detail-findings">
                  {detail.findings.map((f) => (
                    <div key={f.agent} className={`history-finding risk-sig--${f.riskLevel}`}
                      style={{ borderLeft: `2px solid ${f.riskLevel === "high" ? "var(--high)" : f.riskLevel === "medium" ? "var(--medium)" : "var(--low)"}`, paddingLeft: 6, marginTop: 3 }}>
                      <div style={{ fontSize: 10, fontWeight: 700 }}>{f.agent.replace("Agent", "")}</div>
                      <div style={{ fontSize: 10, color: "var(--muted)" }}>{f.summary.slice(0, 60)}…</div>
                    </div>
                  ))}
                </div>
              )}

              {detail.documents && detail.documents.length > 0 && (
                <div className="history-detail-docs">
                  <div className="intel-section-label" style={{ marginTop: 6 }}>Documents</div>
                  {detail.documents.map((doc) => (
                    <div key={doc.id} style={{ fontSize: 10, color: "var(--muted)", padding: "2px 0" }}>
                      📄 {doc.filename} <span style={{ opacity: 0.6 }}>({doc.docType})</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <a
            href={`/?caseId=${row.id}`}
            className="btn-ghost"
            style={{ display: "block", textAlign: "center", marginTop: 8, fontSize: 10 }}
          >
            Open Case →
          </a>
        </div>
      )}
    </div>
  );
}

export function CaseHistoryDrawer({ open, onClose }: Props) {
  const [cases,   setCases]   = useState<CaseHistoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("http://localhost:4000/api/cases")
      .then((r) => r.json())
      .then((d: { cases: CaseHistoryRow[] }) => {
        setCases(d.cases);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed");
        setLoading(false);
      });
  }, [open]);

  const decided    = cases.filter((c) => c.status === "decided");
  const processing = cases.filter((c) => c.status === "processing" || c.status === "pending");
  const flagged    = cases.filter((c) => c.status === "error" || c.status === "flagged");

  return (
    <aside className={`case-history-drawer${open ? " open" : ""}`}>
      <div className="drawer-header">
        <span className="drawer-title">Case History</span>
        <button className="drawer-close" onClick={onClose} aria-label="Close"><X size={16} /></button>
      </div>

      <div className="drawer-body">
        {loading && <div className="intel-waiting" style={{ padding: "16px" }}><span className="intel-spinner" /><span>Loading history…</span></div>}
        {error   && <div className="error-banner" style={{ margin: 12 }}>Error: {error}</div>}

        {!loading && !error && cases.length === 0 && (
          <div className="cases-empty" style={{ padding: 16 }}>No cases yet.</div>
        )}

        {processing.length > 0 && (
          <div className="drawer-section">
            <div className="drawer-section-label">Processing ({processing.length})</div>
            {processing.map((c) => <CaseHistoryItem key={c.id} row={c} />)}
          </div>
        )}

        {decided.length > 0 && (
          <div className="drawer-section">
            <div className="drawer-section-label">Decided ({decided.length})</div>
            {decided.map((c) => <CaseHistoryItem key={c.id} row={c} />)}
          </div>
        )}

        {flagged.length > 0 && (
          <div className="drawer-section">
            <div className="drawer-section-label">Flagged ({flagged.length})</div>
            {flagged.map((c) => <CaseHistoryItem key={c.id} row={c} />)}
          </div>
        )}
      </div>
    </aside>
  );
}
