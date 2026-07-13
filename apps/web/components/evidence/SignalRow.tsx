import Badge from "../ui/Badge";
import type { Signal } from "@tadpools/shared/index";

interface Props {
  signal: Signal;
}

const DIRECTION_ICON: Record<string, string> = {
  risk_increasing: "↑",
  risk_reducing:   "↓",
  unresolved:      "◌",
};

const DIRECTION_COLOR: Record<string, string> = {
  risk_increasing: "var(--high)",
  risk_reducing:   "var(--low)",
  unresolved:      "var(--muted)",
};

export default function SignalRow({ signal }: Props) {
  const icon  = DIRECTION_ICON[signal.direction]  ?? "◌";
  const color = DIRECTION_COLOR[signal.direction] ?? "var(--muted)";

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
      <span style={{ fontSize: 14, color, fontWeight: 700, width: 16, flexShrink: 0, marginTop: 1 }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{signal.signalName}</span>
          <Badge label={signal.severity} variant={signal.severity as "high" | "medium" | "low" | "critical" | "info"} />
          <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: "auto" }}>
            +{signal.contributionScore} pts
          </span>
        </div>
        {signal.description && (
          <p style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.5, margin: 0 }}>{signal.description}</p>
        )}
      </div>
    </div>
  );
}
