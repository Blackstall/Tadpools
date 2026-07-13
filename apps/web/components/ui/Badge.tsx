import type { CSSProperties } from "react";

type BadgeVariant =
  | "approved"
  | "rejected"
  | "escalated"
  | "needs_review"
  | "processing"
  | "pending"
  | "high"
  | "medium"
  | "low"
  | "info"
  | "critical"
  | "default";

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, CSSProperties> = {
  approved:     { background: "var(--risk-low-bg)",  color: "var(--low)" },
  low:          { background: "var(--risk-low-bg)",  color: "var(--low)" },
  rejected:     { background: "var(--risk-high-bg)", color: "var(--high)" },
  high:         { background: "var(--risk-high-bg)", color: "var(--high)" },
  critical:     { background: "var(--risk-high-bg)", color: "var(--high)" },
  escalated:    { background: "var(--risk-high-bg)", color: "var(--high)" },
  needs_review: { background: "var(--risk-med-bg)",  color: "var(--medium)" },
  medium:       { background: "var(--risk-med-bg)",  color: "var(--medium)" },
  processing:   { background: "var(--meta-bg)",      color: "var(--debate)" },
  pending:      { background: "var(--meta-bg)",      color: "var(--debate)" },
  info:         { background: "rgba(20,184,166,0.10)", color: "var(--accent)" },
  default:      { background: "rgba(90,122,120,0.12)", color: "var(--muted)" },
};

export default function Badge({ label, variant = "default" }: BadgeProps) {
  const styles = variantStyles[variant];

  return (
    <span
      style={{
        ...styles,
        display: "inline-flex",
        alignItems: "center",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.04em",
        padding: "2px 8px",
        borderRadius: "10px",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}
