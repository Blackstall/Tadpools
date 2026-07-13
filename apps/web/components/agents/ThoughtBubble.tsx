"use client";

// PHASE 4 — Thought bubble overlay for agent detail panel
// Rendered as HTML overlay near a tadpole position

interface ThoughtBubbleProps {
  text: string;
  confidence: number;
  status: "moving" | "investigating" | "challenging" | "concluding";
  x: number;
  y: number;
  alpha?: number;
}

const STATUS_COLORS: Record<string, string> = {
  moving:       "#14B8A6",
  investigating: "#F59E0B",
  challenging:  "#8B5CF6",
  concluding:   "#22C55E",
};

export function ThoughtBubble({ text, confidence, status, x, y, alpha = 1 }: ThoughtBubbleProps) {
  const color = STATUS_COLORS[status] ?? "#14B8A6";
  return (
    <div
      className="thought-bubble"
      style={{
        position: "absolute",
        left: x - 60,
        top: y - 72,
        opacity: alpha,
        pointerEvents: "none",
        zIndex: 30,
        transition: "opacity 0.4s ease",
      }}
    >
      <div
        className="thought-bubble-inner"
        style={{ borderColor: color }}
      >
        <div className="thought-bubble-text">{text}</div>
        <div className="thought-bubble-conf" style={{ color }}>
          Confidence: {Math.round(confidence * 100)}%
        </div>
      </div>
      <div className="thought-bubble-tail" style={{ borderTopColor: color }} />
    </div>
  );
}

// ── Agent Detail Panel — shown on click ────────────────────────────────────────
interface AgentThoughtPanelProps {
  agentName: string;
  intent: string;
  evidence: string[];
  opinion?: string;
  confidence: number;
  status: string;
  onClose: () => void;
}

export function AgentThoughtPanel({
  agentName,
  intent,
  evidence,
  opinion,
  confidence,
  status,
  onClose,
}: AgentThoughtPanelProps) {
  const color = STATUS_COLORS[status] ?? "#14B8A6";
  const confPct = Math.round(confidence * 100);

  return (
    <div className="agent-thought-panel panel">
      <div className="agent-thought-header">
        <div className="agent-thought-name" style={{ color }}>
          {agentName.replace("Agent", "")}
        </div>
        <button className="drawer-close" onClick={onClose} style={{ marginLeft: "auto" }}>✕</button>
      </div>

      <div className="agent-thought-section">
        <div className="intel-section-label">Intent</div>
        <p className="bubble-summary">{intent}</p>
      </div>

      {evidence.length > 0 && (
        <div className="agent-thought-section">
          <div className="intel-section-label">Evidence</div>
          <div className="decision-reasons">
            {evidence.slice(0, 4).map((e, i) => (
              <div key={i} className="decision-reason">{e}</div>
            ))}
          </div>
        </div>
      )}

      {opinion && (
        <div className="agent-thought-section">
          <div className="intel-section-label">Interim Opinion</div>
          <p className="bubble-summary">{opinion}</p>
        </div>
      )}

      <div className="agent-thought-section">
        <div className="intel-section-label">Confidence</div>
        <div className="bubble-conf" style={{ marginTop: 6 }}>
          <div className="conf-bar" style={{ flex: 1 }}>
            <div className="conf-fill" style={{ width: `${confPct}%`, background: color }} />
          </div>
          <span className="conf-pct">{confPct}%</span>
        </div>
      </div>
    </div>
  );
}
