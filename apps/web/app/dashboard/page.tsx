"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import StatCard from "../../components/ui/StatCard";
import Badge from "../../components/ui/Badge";
import ScoreBar from "../../components/ui/ScoreBar";
import EmptyState from "../../components/ui/EmptyState";

const API = "http://localhost:4000";

interface Stats {
  total: number;
  approved: number;
  rejected: number;
  escalated: number;
  pending: number;
  avgScore: number;
  highRiskCount: number;
}

interface RecentCase {
  id: string;
  status: string;
  companyName: string;
  score: number | null;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const STATUS_COLORS: Record<string, string> = {
  approved:    "var(--low)",
  rejected:    "var(--high)",
  escalated:   "var(--high)",
  needs_review:"var(--medium)",
  processing:  "var(--accent)",
  pending:     "var(--muted)",
};

export default function DashboardPage() {
  const router = useRouter();
  const [stats,  setStats]  = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentCase[]>([]);
  const [error,  setError]  = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [sr, rr] = await Promise.all([
        fetch(`${API}/api/dashboard/stats`),
        fetch(`${API}/api/dashboard/recent`),
      ]);
      if (!sr.ok || !rr.ok) throw new Error("Failed to load dashboard data");
      const [sd, rd] = await Promise.all([sr.json(), rr.json()]) as [Stats, { cases: RecentCase[] }];
      setStats(sd);
      setRecent(rd.cases ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }, []);

  useEffect(() => {
    void fetchData();
    const id = setInterval(fetchData, 30000);
    return () => clearInterval(id);
  }, [fetchData]);

  if (error) return <div className="dashboard-page"><div className="page-error">{error}</div></div>;
  if (!stats) return <div className="dashboard-page"><div className="page-loading"><span className="intel-spinner" />Loading dashboard…</div></div>;

  const total = stats.total || 1;
  const DIST = [
    { label: "Approved",    count: stats.approved,    color: "var(--low)",    pct: (stats.approved / total) * 100 },
    { label: "Rejected",    count: stats.rejected,    color: "var(--high)",   pct: (stats.rejected / total) * 100 },
    { label: "Escalated",   count: stats.escalated,   color: "var(--high)",   pct: (stats.escalated / total) * 100 },
    { label: "Pending",     count: stats.pending,     color: "var(--medium)", pct: (stats.pending / total) * 100 },
  ];

  const actionQueue = recent.filter(c => c.status === "needs_review" || c.status === "escalated");

  return (
    <div className="dashboard-page">

      {/* KPI row */}
      <div className="dashboard-kpi-row">
        <StatCard label="Total Cases"  value={stats.total}         />
        <StatCard label="Approved"     value={stats.approved}      trend="up"   />
        <StatCard label="Rejected"     value={stats.rejected}      trend="down" />
        <StatCard label="Escalated"    value={stats.escalated}     trend="down" />
        <StatCard label="Pending"      value={stats.pending}       />
        <StatCard label="Avg Score"    value={stats.avgScore}      />
        <StatCard label="High Risk"    value={stats.highRiskCount} />
      </div>

      {/* Main grid */}
      <div className="dashboard-grid">

        {/* Left — distribution + action queue */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Risk distribution */}
          <div className="dashboard-section">
            <div className="dashboard-section-title">Case Distribution</div>
            {DIST.map(d => (
              <div key={d.label} className="dist-bar-row">
                <span className="dist-bar-label">{d.label}</span>
                <div className="dist-bar-track">
                  <div className="dist-bar-fill" style={{ width: `${d.pct}%`, background: d.color }} />
                </div>
                <span className="dist-bar-count">{d.count}</span>
              </div>
            ))}
          </div>

          {/* Action queue */}
          <div className="dashboard-section">
            <div className="dashboard-section-title">Requires Attention</div>
            {actionQueue.length === 0
              ? <EmptyState message="No cases awaiting action" />
              : actionQueue.map(c => (
                <div key={c.id} className="action-queue-row">
                  <span className="action-queue-name">{c.companyName || "—"}</span>
                  <Badge label={c.status} variant={c.status as "escalated" | "needs_review"} />
                  {c.score != null && <ScoreBar score={c.score} />}
                  <button className="action-queue-btn" onClick={() => router.push(`/?caseId=${c.id}`)}>
                    View
                  </button>
                </div>
              ))
            }
          </div>
        </div>

        {/* Right — live feed */}
        <div className="dashboard-section" style={{ height: "fit-content" }}>
          <div className="dashboard-section-title">Live Feed</div>
          {recent.length === 0
            ? <EmptyState message="No cases yet" />
            : recent.map(c => (
              <div
                key={c.id}
                className="recent-case-row"
                onClick={() => router.push(`/?caseId=${c.id}`)}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="recent-case-name" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.companyName || "—"}
                  </div>
                  <div className="recent-case-time">{timeAgo(c.createdAt)}</div>
                </div>
                <Badge label={c.status} variant={c.status as "approved" | "rejected" | "escalated" | "processing" | "pending"} />
                {c.score != null && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: STATUS_COLORS[c.status] ?? "var(--muted)", minWidth: 28, textAlign: "right" }}>
                    {c.score}
                  </span>
                )}
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}
