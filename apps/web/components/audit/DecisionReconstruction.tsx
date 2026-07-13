"use client";

import { useEffect, useState } from "react";
import ScoreBar from "../ui/ScoreBar";
import EmptyState from "../ui/EmptyState";

const API = "http://localhost:4000";

interface RiskSignal {
  signal_code: string;
  triggered_by: string;
  detail: string;
  created_at: string;
}

interface AgentFinding {
  agent: string;
  round: number;
  riskLevel: string;
  confidence: number;
  flags: string[];
  summary: string;
}

interface ReplayData {
  caseId: string;
  case: {
    company_name: string;
    reg_number: string;
    status: string;
    created_at: string;
  } | null;
  decision: {
    status: string;
    score: number;
    reasons: string[];
  } | null;
  riskSignals: RiskSignal[];
  agentRounds: Record<string, AgentFinding[]>;
  summary: {
    finalStatus: string;
    finalScore: number | null;
    durationMs: number;
    triggeredSignals: number;
    totalAgentFindings: number;
  };
}

interface Props {
  initialCaseId?: string;
}

const RISK_COLOR: Record<string, string> = {
  high:   "var(--high)",
  medium: "var(--medium)",
  low:    "var(--low)",
};

export default function DecisionReconstruction({ initialCaseId }: Props) {
  const [input,   setInput]   = useState(initialCaseId ?? "");
  const [data,    setData]    = useState<ReplayData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function load(id: string) {
    if (!id.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API}/api/cases/${id.trim()}/audit/replay`);
      if (!r.ok) throw new Error(`${r.status} — ${await r.text()}`);
      setData(await r.json() as ReplayData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  // Auto-load when mounted with an initial case ID (parent changes key to trigger remount)
  useEffect(() => {
    if (initialCaseId) load(initialCaseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="audit-recon-panel">
      <div className="audit-recon-header">
        <span className="audit-section-label">Decision Reconstruction</span>
        <div className="audit-recon-search">
          <input
            className="audit-filter-input"
            style={{ flex: 1 }}
            placeholder="Paste case ID…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && load(input)}
          />
          <button
            onClick={() => load(input)}
            style={{
              padding: "6px 12px",
              fontSize: 11,
              fontWeight: 600,
              background: "var(--accent)",
              color: "#000",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Load
          </button>
        </div>
      </div>

      <div className="audit-chain">
        {loading && (
          <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 12 }}>
            Loading…
          </div>
        )}
        {error && (
          <div style={{ padding: 16, color: "var(--high)", fontSize: 12 }}>{error}</div>
        )}
        {!data && !loading && !error && (
          <EmptyState message="Enter a case ID to reconstruct its decision chain" />
        )}

        {data && (
          <>
            {/* Case header */}
            <div className="audit-chain-case">
              <div style={{ flex: 1 }}>
                <div className="audit-chain-ref">
                  {data.case?.company_name ?? data.caseId.slice(0, 8)}
                </div>
                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                  {data.summary.durationMs}ms · {data.summary.totalAgentFindings} agent findings · {data.summary.triggeredSignals} signals
                </div>
              </div>
              <span className={`audit-chain-status audit-chain-status--${data.summary.finalStatus}`}>
                {data.summary.finalStatus}
              </span>
            </div>

            {/* Final score */}
            {data.summary.finalScore != null && (
              <div className="audit-chain-section">
                <div className="audit-chain-section-label">Final Score</div>
                <ScoreBar score={data.summary.finalScore} />
                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
                  {data.summary.finalScore} / 200
                </div>
              </div>
            )}

            {/* Decision reasons */}
            {(data.decision?.reasons?.length ?? 0) > 0 && (
              <div className="audit-chain-section">
                <div className="audit-chain-section-label">
                  Decision Reasons ({data.decision!.reasons.length})
                </div>
                {data.decision!.reasons.map((reason, i) => (
                  <div key={i} className="audit-chain-row">
                    <span style={{ fontSize: 11 }}>· {reason}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Risk signals */}
            {data.riskSignals.length > 0 && (
              <div className="audit-chain-section">
                <div className="audit-chain-section-label">
                  Risk Signals ({data.riskSignals.length})
                </div>
                {data.riskSignals.map((s, i) => (
                  <div key={i} className="audit-chain-row">
                    <span style={{ fontSize: 11, fontWeight: 600 }}>{s.signal_code}</span>
                    <span style={{ fontSize: 10, color: "var(--muted)" }}>{s.triggered_by}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Agent rounds */}
            {Object.entries(data.agentRounds)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([round, agents]) => (
                <div key={round} className="audit-chain-section">
                  <div className="audit-chain-section-label">
                    Round {round} — {agents.length} agent{agents.length !== 1 ? "s" : ""}
                  </div>
                  {agents.map((a, i) => (
                    <div key={i} className="audit-chain-row">
                      <span style={{ fontSize: 11 }}>{a.agent}</span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: RISK_COLOR[a.riskLevel] ?? "var(--text)",
                        }}
                      >
                        {a.riskLevel}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
          </>
        )}
      </div>
    </div>
  );
}
