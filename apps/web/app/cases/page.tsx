"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";

interface CaseRow {
  id:              string;
  status:          string;
  companyName:     string;
  beneficiaryName: string;
  bankName:        string;
  createdAt:       string;
  score?:          number | null;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function fmtRelative(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const min  = Math.floor(diff / 60000);
    if (min < 1)   return "just now";
    if (min < 60)  return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr  < 24)  return `${hr}h ago`;
    return fmtDate(iso);
  } catch {
    return iso;
  }
}

const STATUS_META: Record<string, { label: string; color: string; cls: string }> = {
  processing: { label: "Processing",    color: "#14B8A6", cls: "case-status--processing" },
  pending:    { label: "Pending",       color: "#14B8A6", cls: "case-status--processing" },
  decided:    { label: "Decided",       color: "#22C55E", cls: "case-status--decided"    },
  flagged:    { label: "Flagged",       color: "#F97316", cls: "case-status--flagged"    },
  error:      { label: "Error",         color: "#EF4444", cls: "case-status--error"      },
  rejected:   { label: "Rejected",      color: "#EF4444", cls: "case-status--error"      },
};

function scoreColor(score: number): string {
  if (score >= 150) return "#EF4444";
  if (score >= 90)  return "#F97316";
  if (score >= 40)  return "#F59E0B";
  return "#22C55E";
}

function CaseCard({ row }: { row: CaseRow }) {
  const meta = STATUS_META[row.status] ?? { label: row.status, color: "#B0BEC5", cls: "" };

  return (
    <Link href={`/?caseId=${row.id}`} className="case-card">
      {/* Score badge */}
      <div className="case-card-top">
        <div className="case-card-name">{row.companyName || "Unknown Company"}</div>
        {row.score != null && (
          <div className="case-card-score" style={{ color: scoreColor(row.score) }}>
            {Math.round(row.score)}
          </div>
        )}
      </div>

      {/* Beneficiary → bank */}
      {row.beneficiaryName && (
        <div className="case-card-beneficiary">
          <span className="case-card-bene-label">To</span>
          <span className="case-card-bene-name">{row.beneficiaryName}</span>
          {row.bankName && <span className="case-card-bank">{row.bankName}</span>}
        </div>
      )}

      {/* Status + ID */}
      <div className="case-card-meta">
        <span className="case-card-id">{row.id.slice(0, 8).toUpperCase()}</span>
        <span className={`case-status-badge ${meta.cls}`}>{meta.label}</span>
      </div>

      <div className="case-card-time">{fmtRelative(row.createdAt)}</div>
    </Link>
  );
}

type FilterKey = "all" | "processing" | "decided" | "flagged" | "error";

export default function CasesPage() {
  const [cases,   setCases]   = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [search,  setSearch]  = useState("");
  const [filter,  setFilter]  = useState<FilterKey>("all");

  useEffect(() => {
    fetch("http://localhost:4000/api/cases")
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { cases: CaseRow[] }) => {
        setCases(data.cases ?? []);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load");
        setLoading(false);
      });
  }, []);

  const metrics = useMemo(() => ({
    processing:    cases.filter(c => c.status === "processing" || c.status === "pending").length,
    decided:       cases.filter(c => c.status === "decided").length,
    flagged:       cases.filter(c => c.status === "flagged" || c.status === "error").length,
    manualReview:  cases.filter(c => c.status === "manual_review").length,
  }), [cases]);

  const filtered = useMemo(() => {
    let list = cases;
    if (filter !== "all") {
      if (filter === "flagged") {
        list = list.filter(c => c.status === "flagged" || c.status === "error");
      } else if (filter === "processing") {
        list = list.filter(c => c.status === "processing" || c.status === "pending");
      } else {
        list = list.filter(c => c.status === filter);
      }
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(c =>
        c.companyName?.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.bankName?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [cases, filter, search]);

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: "all",        label: "All" },
    { key: "processing", label: "Processing" },
    { key: "decided",    label: "Decided" },
    { key: "flagged",    label: "Flagged / Error" },
  ];

  return (
    <div className="cases-page">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="top-nav">
        <div className="top-nav-brand">
          <div className="brand-dot" />
          <span className="brand-name">Tadpools</span>
        </div>
        <nav className="top-nav-links">
          <span className="top-nav-link top-nav-link--active">Queue</span>
          <Link href="/" className="top-nav-link">Active Case</Link>
          <Link href="/" className="top-nav-link">History</Link>
        </nav>
        <div className="top-nav-actions">
          <Link href="/" className="btn-ghost" style={{ fontSize: 11 }}>+ New Case</Link>
        </div>
      </header>

      <div className="cases-content">

        {/* ── Metrics row ──────────────────────────────────────────────────── */}
        <div className="cases-metrics">
          <div className="metric-tile">
            <div className="metric-value metric-value--accent">{metrics.processing}</div>
            <div className="metric-label">Processing</div>
          </div>
          <div className="metric-tile">
            <div className="metric-value metric-value--green">{metrics.decided}</div>
            <div className="metric-label">Decided</div>
          </div>
          <div className="metric-tile">
            <div className="metric-value metric-value--orange">{metrics.flagged}</div>
            <div className="metric-label">Flagged</div>
          </div>
          {metrics.manualReview > 0 && (
            <div className="metric-tile">
              <div className="metric-value metric-value--yellow">{metrics.manualReview}</div>
              <div className="metric-label">Manual Review</div>
            </div>
          )}
          <div className="metric-tile">
            <div className="metric-value">{cases.length}</div>
            <div className="metric-label">Total Cases</div>
          </div>
        </div>

        {/* ── Controls ─────────────────────────────────────────────────────── */}
        <div className="cases-controls">
          <input
            className="cases-search"
            type="search"
            placeholder="Search by company, case ID, or bank…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="cases-filters">
            {FILTERS.map(f => (
              <button
                key={f.key}
                className={`cases-filter-btn${filter === f.key ? " cases-filter-btn--active" : ""}`}
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Results ──────────────────────────────────────────────────────── */}
        {loading && <div className="cases-loading">Loading cases…</div>}

        {error && (
          <div className="error-banner" style={{ margin: "0 24px" }}>
            Failed to load cases: {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="cases-empty" style={{ paddingTop: 40, fontSize: 13 }}>
            {search || filter !== "all" ? "No cases match your search or filter." : "No cases yet. Submit a new investigation to get started."}
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="cases-grid">
            {filtered.map(c => <CaseCard key={c.id} row={c} />)}
          </div>
        )}
      </div>
    </div>
  );
}
