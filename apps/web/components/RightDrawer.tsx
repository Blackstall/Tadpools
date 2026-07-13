"use client";

import { useState } from "react";
import { X, Download, RotateCcw } from "lucide-react";
import type { SwarmState, RightDrawerMode } from "../lib/types";
import { AGENT_DEFS } from "../lib/types";

// ── Decision display config ──────────────────────────────────────────────────
const DECISION_CFG: Record<string, { label: string; color: string; bg: string }> = {
  approve:       { label: "APPROVED",      color: "#10B981", bg: "#E8F5E9" },
  manual_review: { label: "MANUAL REVIEW", color: "#F59E0B", bg: "#FFF3E0" },
  escalate:      { label: "ESCALATE",      color: "#F97316", bg: "#FFF3E0" },
  reject:        { label: "REJECTED",      color: "#EF4444", bg: "#FFEBEE" },
};

const RECOMMENDATIONS: Record<string, string[]> = {
  approve:       ["Proceed with onboarding"],
  manual_review: ["Flag for manual review", "Request additional documents"],
  escalate:      ["Escalate to compliance team", "Suspend processing pending review"],
  reject:        ["Reject onboarding application", "Escalate to compliance"],
};

const RISK_COLORS: Record<string, string> = {
  high:   "#EF4444",
  medium: "#F59E0B",
  low:    "#10B981",
};

const RISK_BG: Record<string, string> = {
  high:   "#FFEBEE",
  medium: "#FFF3E0",
  low:    "#E8F5E9",
};

interface Props {
  open:         boolean;
  onClose:      () => void;
  mode:         RightDrawerMode;
  swarmState:   SwarmState;
  onModeChange: (mode: RightDrawerMode) => void;
}

// ── Ring Chart ───────────────────────────────────────────────────────────────
function RingChart({ score, status }: { score: number; status: string }) {
  const cfg   = DECISION_CFG[status];
  const color = cfg?.color ?? "#6B7280";
  const r     = 50;
  const circ  = 2 * Math.PI * r;
  const pct   = Math.min(1, score / 200);
  const dash  = circ * pct;
  const gap   = circ - dash;

  return (
    <div className="ring-chart-section">
      <div className="ring-chart">
        <svg width="128" height="128" viewBox="0 0 128 128">
          <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="9" />
          <circle
            cx="64" cy="64" r={r} fill="none"
            stroke={color} strokeWidth="9" strokeLinecap="round"
            strokeDasharray={`${dash} ${gap}`}
            transform="rotate(-90 64 64)"
            style={{ transition: "stroke-dasharray 0.7s ease" }}
          />
        </svg>
        <div className="ring-center">
          <span className="ring-num" style={{ color }}>{Math.round(score)}</span>
          <span className="ring-lbl">risk score</span>
        </div>
      </div>
      {cfg && (
        <div className="ring-status-badge" style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.color + "40" }}>
          {cfg.label}
        </div>
      )}
    </div>
  );
}

// ── Decision Brief (default mode) ────────────────────────────────────────────
function DecisionBrief({ swarmState, onModeChange }: { swarmState: SwarmState; onModeChange: (m: RightDrawerMode) => void }) {
  const { decision, findings, phase } = swarmState;
  const [overrideStatus, setOverrideStatus] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [overriding, setOverriding] = useState(false);

  if (!decision) {
    return (
      <div className="intel-section">
        <div className="intel-waiting">
          {phase === "processing" ? (
            <><span className="intel-spinner" /><span>Swarm deliberating…</span></>
          ) : (
            <span>Submit a case to begin analysis</span>
          )}
        </div>
      </div>
    );
  }

  const cfg = DECISION_CFG[decision.status];
  const avgConf = findings.length > 0
    ? Math.round(findings.reduce((s, f) => s + f.confidence, 0) / findings.length * 100)
    : 0;

  // Unique high-risk flags as top reasons
  const topReasons = Array.from(new Set(
    findings
      .filter((f) => f.riskLevel === "high" || f.riskLevel === "medium")
      .flatMap((f) => f.flags)
      .filter((fl) => fl.startsWith("RULE_") || fl.startsWith("DOC_") || fl.startsWith("PATTERN_"))
  )).slice(0, 5);

  const recs = RECOMMENDATIONS[decision.status] ?? [];

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify({ caseId: swarmState.caseId, decision, findings }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `case-${(swarmState.caseId ?? "unknown").slice(0, 8)}-audit.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleOverride = async (status: string) => {
    if (!swarmState.caseId) return;
    setOverriding(true);
    try {
      await fetch(`http://localhost:4000/api/cases/${swarmState.caseId}/override`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status, comment }),
      });
      setOverrideStatus(status);
    } finally {
      setOverriding(false);
    }
  };

  return (
    <>
      <RingChart score={decision.score} status={overrideStatus ?? decision.status} />

      {/* Confidence */}
      <div className="intel-section">
        <div className="intel-section-label">Confidence</div>
        <div className="bubble-conf" style={{ marginTop: 6 }}>
          <div className="conf-bar" style={{ flex: 1 }}>
            <div className="conf-fill" style={{ width: `${avgConf}%`, background: cfg?.color ?? "#00B569" }} />
          </div>
          <span className="conf-pct">{avgConf}%</span>
        </div>
      </div>

      {/* Top reasons */}
      {topReasons.length > 0 && (
        <div className="intel-section">
          <div className="intel-section-label">Top Reasons</div>
          <div className="decision-reasons" style={{ marginTop: 6 }}>
            {topReasons.map((r) => (
              <div key={r} className="decision-reason">{r.replace(/^(RULE_|DOC_|PATTERN_)/, "").replace(/_/g, " ")}</div>
            ))}
          </div>
        </div>
      )}

      {/* Triggered rules */}
      {decision.triggeredRules.length > 0 && (
        <div className="intel-section">
          <div className="intel-section-label">Triggered Rules</div>
          <div className="rule-tags" style={{ marginTop: 6 }}>
            {decision.triggeredRules.map((r) => (
              <span key={r} className="rule-tag">{r.replace(/^\[/, "").replace(/\].*$/, "")}</span>
            ))}
          </div>
        </div>
      )}

      {/* Recommendation */}
      {recs.length > 0 && (
        <div className="intel-section">
          <div className="intel-section-label">Recommendation</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
            {recs.map((r) => (
              <div key={r} className="decision-reason">→ {r}</div>
            ))}
          </div>
        </div>
      )}

      {/* Agent findings — click to open agent detail */}
      {findings.length > 0 && (
        <div className="intel-section">
          <div className="intel-section-label" style={{ marginBottom: 8 }}>Agent Analysis</div>
          {findings.slice(0, 5).map((f) => {
            const color = RISK_COLORS[f.riskLevel] ?? "#6B7280";
            const bg    = RISK_BG[f.riskLevel]     ?? "rgba(0,0,0,0.02)";
            const conf  = Math.round(f.confidence * 100);
            return (
              <div
                key={f.agent}
                className="finding-bubble"
                style={{ borderLeftColor: color, background: bg, cursor: "pointer" }}
                onClick={() => onModeChange({ type: "agent_detail", agentId: f.agent })}
              >
                <div className="bubble-header">
                  <span className="bubble-agent">{f.agent.replace("Agent", "")}</span>
                  <span style={{ fontSize: 10, color: "var(--muted)" }}>Round {f.round}</span>
                </div>
                <p className="bubble-summary">{f.summary}</p>
                <div className="bubble-conf">
                  <span className="conf-label">Confidence</span>
                  <div className="conf-bar">
                    <div className="conf-fill" style={{ width: `${conf}%`, background: color }} />
                  </div>
                  <span className="conf-pct">{conf}%</span>
                </div>
              </div>
            );
          })}
          {findings.length > 5 && (
            <div style={{ fontSize: 10, color: "var(--muted)", textAlign: "center", padding: "4px 0" }}>
              +{findings.length - 5} more — click agents in pool to view
            </div>
          )}
        </div>
      )}

      {/* Override panel */}
      <div className="intel-section">
        <div className="intel-section-label">Override Decision</div>
        {overrideStatus ? (
          <div style={{ marginTop: 8, padding: "8px 10px", background: "rgba(0,181,105,0.07)", borderRadius: 8, border: "1px solid rgba(0,181,105,0.2)", fontSize: 12, color: "var(--accent)" }}>
            Overridden → {overrideStatus.toUpperCase().replace("_", " ")}
          </div>
        ) : (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="override-btn override-btn--approve" disabled={overriding} onClick={() => handleOverride("approve")}>Approve</button>
              <button className="override-btn override-btn--reject"  disabled={overriding} onClick={() => handleOverride("reject")}>Reject</button>
              <button className="override-btn override-btn--escalate" disabled={overriding} onClick={() => handleOverride("escalate")}>Escalate</button>
            </div>
            <textarea
              className="override-comment"
              placeholder="Add comment…"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
            />
          </div>
        )}
      </div>

      {/* Export */}
      <div className="intel-section" style={{ display: "flex", gap: 8 }}>
        <button className="export-btn" onClick={handleExportJSON}>
          <Download size={12} /> JSON Audit
        </button>
      </div>
    </>
  );
}

// ── Agent Detail Mode ─────────────────────────────────────────────────────────
function AgentDetail({ agentId, swarmState, onBack }: { agentId: string; swarmState: SwarmState; onBack: () => void }) {
  const def     = AGENT_DEFS.find((d) => d.id === agentId);
  const finding = swarmState.findings.find((f) => f.agent === agentId);

  if (!finding) {
    return (
      <div className="intel-section">
        <button className="drawer-back-btn" onClick={onBack}>← Back</button>
        <div className="intel-waiting" style={{ marginTop: 12 }}>
          <span className="intel-spinner" />
          <span>{def?.label ?? agentId} is still analyzing…</span>
        </div>
      </div>
    );
  }

  const color   = RISK_COLORS[finding.riskLevel] ?? "#6B7280";
  const bg      = RISK_BG[finding.riskLevel]     ?? "rgba(0,0,0,0.02)";
  const confPct = Math.round(finding.confidence * 100);

  return (
    <>
      <div className="intel-section">
        <button className="drawer-back-btn" onClick={onBack}>← Decision Brief</button>
        <div className="agent-detail-header" style={{ marginTop: 12 }}>
          <div className="agent-detail-name">{def?.label ?? agentId.replace("Agent", "")}</div>
          <div className="agent-detail-meta">
            <span className={`risk-sig risk-sig--${finding.riskLevel}`}>{finding.riskLevel}</span>
            <span style={{ fontSize: 10, color: "var(--muted)" }}>Round {finding.round}</span>
          </div>
        </div>
      </div>

      <div className="intel-section">
        <div className="intel-section-label">Summary</div>
        <p className="bubble-summary" style={{ marginTop: 6 }}>{finding.summary}</p>
        <div className="bubble-conf" style={{ marginTop: 8 }}>
          <span className="conf-label">Confidence</span>
          <div className="conf-bar"><div className="conf-fill" style={{ width: `${confPct}%`, background: color }} /></div>
          <span className="conf-pct">{confPct}%</span>
        </div>
      </div>

      {finding.flags.length > 0 && (
        <div className="intel-section">
          <div className="intel-section-label">Evidence Flags</div>
          <div className="risk-signals" style={{ marginTop: 6 }}>
            {finding.flags.map((fl) => (
              <span key={fl} className={`risk-sig risk-sig--${finding.riskLevel}`}>{fl}</span>
            ))}
          </div>
        </div>
      )}

      {finding.reasoning.length > 0 && (
        <div className="intel-section">
          <div className="intel-section-label">Reasoning</div>
          <div className="decision-reasons" style={{ marginTop: 6 }}>
            {finding.reasoning.map((r, i) => (
              <div key={i} className="decision-reason">{r}</div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ── Relationship Mode ─────────────────────────────────────────────────────────
function AgentRelationship({ source, target, swarmState, onBack }: {
  source: string; target: string; swarmState: SwarmState; onBack: () => void;
}) {
  const srcDef     = AGENT_DEFS.find((d) => d.id === source);
  const tgtDef     = AGENT_DEFS.find((d) => d.id === target);
  const srcFinding = swarmState.findings.find((f) => f.agent === source);
  const tgtFinding = swarmState.findings.find((f) => f.agent === target);

  return (
    <>
      <div className="intel-section">
        <button className="drawer-back-btn" onClick={onBack}>← Back</button>
        <div style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: "#9333EA" }}>Agent Debate</div>
      </div>
      {[
        { label: srcDef?.label ?? source, finding: srcFinding },
        { label: tgtDef?.label ?? target, finding: tgtFinding },
      ].map(({ label, finding }) => (
        <div key={label} className="intel-section">
          <div className="intel-section-label">{label}</div>
          {finding ? (
            <>
              <p className="bubble-summary" style={{ marginTop: 6 }}>{finding.summary}</p>
              <div className="risk-signals" style={{ marginTop: 6 }}>
                {finding.flags.slice(0, 3).map((fl) => (
                  <span key={fl} className={`risk-sig risk-sig--${finding.riskLevel}`}>{fl}</span>
                ))}
              </div>
            </>
          ) : (
            <div className="intel-waiting"><span className="intel-spinner" /><span>Analyzing…</span></div>
          )}
        </div>
      ))}
    </>
  );
}

// ── Root component ────────────────────────────────────────────────────────────
export function RightDrawer({ open, onClose, mode, swarmState, onModeChange }: Props) {
  const title = mode.type === "agent_detail"
    ? (AGENT_DEFS.find((d) => d.id === mode.agentId)?.label ?? "Agent")
    : mode.type === "agent_relationship"
    ? "Agent Debate"
    : "Intelligence";

  return (
    <aside className={`right-drawer${open ? " open" : ""}`}>
      <div className="drawer-header">
        <span className="drawer-title">{title}</span>
        <button className="drawer-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
      </div>

      <div className="drawer-body">
        {mode.type === "decision_brief" && (
          <DecisionBrief swarmState={swarmState} onModeChange={onModeChange} />
        )}
        {mode.type === "agent_detail" && (
          <AgentDetail
            agentId={mode.agentId}
            swarmState={swarmState}
            onBack={() => onModeChange({ type: "decision_brief" })}
          />
        )}
        {mode.type === "agent_relationship" && (
          <AgentRelationship
            source={mode.source}
            target={mode.target}
            swarmState={swarmState}
            onBack={() => onModeChange({ type: "decision_brief" })}
          />
        )}
      </div>
    </aside>
  );
}
