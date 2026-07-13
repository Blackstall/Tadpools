"use client";

import type { SwarmState, AgentFinding, DocRecord } from "../lib/types";
import { AGENT_DEFS, STATE_COLORS } from "../lib/types";

interface Props {
  swarmState: SwarmState;
}

// ── Decision config ────────────────────────────────────────────────────────────
const DECISION_CFG: Record<string, { label: string; color: string; bg: string }> = {
  approve:       { label: "APPROVED",      color: "#10B981", bg: "#E8F5E9"  },
  manual_review: { label: "MANUAL REVIEW", color: "#F59E0B", bg: "#FFF3E0"  },
  escalate:      { label: "ESCALATE",      color: "#F97316", bg: "#FFF3E0"  },
  reject:        { label: "REJECTED",      color: "#EF4444", bg: "#FFEBEE"  },
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

function extractRiskSignals(findings: AgentFinding[]) {
  const signals: { flag: string; risk: string }[] = [];
  const seen = new Set<string>();
  for (const f of findings) {
    for (const flag of f.flags) {
      if (!seen.has(flag)) {
        seen.add(flag);
        signals.push({ flag, risk: f.riskLevel });
      }
    }
  }
  return signals.sort((a, b) => {
    const rank: Record<string, number> = { high: 3, medium: 2, low: 1 };
    return (rank[b.risk] ?? 0) - (rank[a.risk] ?? 0);
  });
}

const LC_STEPS = ["Uploaded", "Extracting", "Hashed", "Deleted", "Ready"];

function docLifecycleIndex(status: DocRecord["status"]): number {
  switch (status) {
    case "uploading":  return 0;
    case "uploaded":   return 1;
    case "extracting": return 2;
    case "hashed":     return 3;
    case "deleted":    return 3;
    case "ready":      return 4;
    default:           return 0;
  }
}

// ── Ring Chart SVG ─────────────────────────────────────────────────────────────
function RingChart({ score, status }: { score: number; status: string }) {
  const cfg   = DECISION_CFG[status];
  const color = cfg?.color ?? "#6B7280";
  const r     = 50;
  const circ  = 2 * Math.PI * r;
  // Visual fill: scale so 200 = 100%, cap at 1
  const pct   = Math.min(1, score / 200);
  const dash  = circ * pct;
  const gap   = circ - dash;

  return (
    <div className="ring-chart-section">
      <div className="ring-chart">
        <svg width="128" height="128" viewBox="0 0 128 128">
          {/* Track */}
          <circle
            cx="64" cy="64" r={r}
            fill="none"
            stroke="rgba(0,0,0,0.07)"
            strokeWidth="9"
          />
          {/* Progress arc */}
          <circle
            cx="64" cy="64" r={r}
            fill="none"
            stroke={color}
            strokeWidth="9"
            strokeLinecap="round"
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
        <div
          className="ring-status-badge"
          style={{ color: cfg.color, background: cfg.bg, borderColor: cfg.color + "40" }}
        >
          {cfg.label}
        </div>
      )}
    </div>
  );
}

export function DecisionPanel({ swarmState }: Props) {
  const { findings, decision, agentStates, chatBubbles, docs, phase } = swarmState;

  const round1  = findings.filter((f) => f.round === 1);
  const round2  = findings.filter((f) => f.round === 2);
  const round3  = findings.filter((f) => f.round === 3);
  const signals = extractRiskSignals(findings);
  const isActive = ["uploading", "extracting", "processing"].includes(phase);

  return (
    <section className="panel right-panel">
      <div className="right-panel-header">
        <span className="right-panel-title">Intelligence</span>
        {isActive && (
          <span className="intel-waiting" style={{ padding: 0 }}>
            <span className="intel-spinner" />
          </span>
        )}
      </div>

      <div className="right-panel-body">

        {/* ── 1. Ring Chart + Decision ─────────────────────────────────────── */}
        {decision ? (
          <>
            <RingChart score={decision.score} status={decision.status} />
            {decision.triggeredRules.length > 0 && (
              <div className="intel-section">
                <div className="intel-section-header">
                  <span className="intel-section-label">Triggered Rules</span>
                  <span className="intel-count">{decision.triggeredRules.length}</span>
                </div>
                <div className="rule-tags">
                  {decision.triggeredRules.map((r) => (
                    <span key={r} className="rule-tag">
                      {r.replace(/^\[/, "").replace(/\].*$/, "")}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : phase === "processing" ? (
          <div className="intel-section">
            <div className="intel-section-label">Decision</div>
            <div className="intel-waiting">
              <span className="intel-spinner" />
              <span>Swarm deliberating…</span>
            </div>
          </div>
        ) : phase === "idle" ? (
          <div className="intel-section">
            <div className="intel-waiting">
              <span>Submit a case to begin analysis</span>
            </div>
          </div>
        ) : null}

        {/* ── 2. Documents ─────────────────────────────────────────────────── */}
        {docs.length > 0 && (
          <div className="intel-section">
            <div className="intel-section-header">
              <span className="intel-section-label">Documents</span>
              <span className="intel-count">{docs.length}</span>
            </div>
            {docs.map((doc) => {
              const lcIdx = docLifecycleIndex(doc.status);
              return (
                <div key={doc.id} className="doc-item">
                  <div className="doc-header">
                    <span className="doc-name">{doc.filename}</span>
                    <span className="doc-type-tag">{doc.docType.replace("_", " ")}</span>
                  </div>
                  <div className="doc-lifecycle">
                    {LC_STEPS.map((step, i) => {
                      const isDone   = i < lcIdx;
                      const isActiveStep = i === lcIdx;
                      return (
                        <span key={step}>
                          <span className={`lc-step${isDone ? " lc-step--done" : isActiveStep ? " lc-step--active" : ""}`}>
                            {step}
                          </span>
                          {i < LC_STEPS.length - 1 && <span className="lc-arrow"> → </span>}
                        </span>
                      );
                    })}
                  </div>
                  {doc.fieldsExtracted !== undefined && doc.fieldsExtracted > 0 && (
                    <div className="doc-fields">{doc.fieldsExtracted} field{doc.fieldsExtracted !== 1 ? "s" : ""} extracted</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── 3. Risk Signals ──────────────────────────────────────────────── */}
        {signals.length > 0 && (
          <div className="intel-section">
            <div className="intel-section-header">
              <span className="intel-section-label">Risk Signals</span>
              <span className="intel-count">{signals.length}</span>
            </div>
            <div className="risk-signals">
              {signals.map(({ flag, risk }) => (
                <span key={flag} className={`risk-sig risk-sig--${risk}`}>{flag}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── 4. Live Agent Feed ───────────────────────────────────────────── */}
        {chatBubbles.length > 0 && (
          <div className="intel-section">
            <div className="intel-section-header">
              <span className="intel-section-label">Live Feed</span>
              <span className="intel-count">{chatBubbles.length}</span>
            </div>
            <div className="agent-feed">
              {[...chatBubbles].reverse().map((b) => {
                const color =
                  b.riskLevel === "high"   ? "#EF4444" :
                  b.riskLevel === "medium" ? "#F59E0B" :
                  b.riskLevel === "low"    ? "#10B981" : "#00B569";
                return (
                  <div key={b.id} className="feed-entry" style={{ borderLeftColor: color }}>
                    <span className="feed-agent" style={{ color }}>{b.agent.replace("Agent", "")}</span>
                    <span className="feed-text">{b.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 5. Agent findings as Message Bubbles ────────────────────────── */}
        {round1.length > 0 && (
          <div className="intel-section">
            <div className="round-label">Round 1 — Core Analysis</div>
            {round1.map((f) => <FindingBubble key={f.agent} finding={f} />)}
          </div>
        )}

        {round2.length > 0 && (
          <div className="intel-section">
            <div className="round-label">Round 2 — Challenge</div>
            {round2.map((f) => <FindingBubble key={f.agent} finding={f} />)}
          </div>
        )}

        {round3.length > 0 && (
          <div className="intel-section">
            <div className="round-label">Round 3 — Synthesis</div>
            {round3.map((f) => <FindingBubble key={f.agent} finding={f} />)}
          </div>
        )}

        {/* ── 6. Active agents grid (while processing) ─────────────────────── */}
        {phase === "processing" && (
          <div className="intel-section">
            <div className="intel-section-label" style={{ marginBottom: 8 }}>Active Agents</div>
            <div className="agent-pills">
              {AGENT_DEFS.map((def) => {
                const st    = agentStates[def.id] ?? "idle";
                const color = STATE_COLORS[st];
                return (
                  <div
                    key={def.id}
                    className="agent-pill"
                    style={{ borderColor: color + "55", color }}
                  >
                    <div className="agent-pip" style={{ background: color, boxShadow: `0 0 4px ${color}` }} />
                    {def.shortLabel}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Finding as Message Bubble ──────────────────────────────────────────────────
function FindingBubble({ finding }: { finding: AgentFinding }) {
  const color   = RISK_COLORS[finding.riskLevel] ?? "#6B7280";
  const bg      = RISK_BG[finding.riskLevel]     ?? "rgba(0,0,0,0.02)";
  const confPct = Math.round(finding.confidence * 100);
  const topFlag = finding.flags.find((f) =>
    f.startsWith("RULE_") || f.startsWith("DOC_") || f.startsWith("PATTERN_") || f.startsWith("DIRECTORY_")
  ) ?? finding.flags[0];

  return (
    <div className="finding-bubble" style={{ borderLeftColor: color, background: bg }}>
      <div className="bubble-header">
        <span className="bubble-agent">{finding.agent.replace("Agent", "")}</span>
        {finding.riskLevel === "high" && topFlag && (
          <span className="bubble-flag">{topFlag}</span>
        )}
      </div>
      <p className="bubble-summary">{finding.summary}</p>
      <div className="bubble-conf">
        <span className="conf-label">Confidence</span>
        <div className="conf-bar">
          <div className="conf-fill" style={{ width: `${confPct}%`, background: color }} />
        </div>
        <span className="conf-pct">{confPct}%</span>
      </div>
    </div>
  );
}
