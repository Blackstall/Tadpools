interface ScoreBarProps {
  score: number;
}

function getScoreColor(score: number): string {
  if (score >= 90) return "var(--high)";
  if (score >= 40) return "var(--medium)";
  return "var(--low)";
}

function getScoreBg(score: number): string {
  if (score >= 90) return "var(--risk-high-bg)";
  if (score >= 40) return "var(--risk-med-bg)";
  return "var(--risk-low-bg)";
}

export default function ScoreBar({ score }: ScoreBarProps) {
  const fillPercent = Math.min((score / 200) * 100, 100);
  const color = getScoreColor(score);
  const trackBg = getScoreBg(score);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <div
        style={{
          flex: 1,
          height: "8px",
          borderRadius: "4px",
          background: trackBg,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            right: `${100 - fillPercent}%`,
            background: color,
            borderRadius: "4px",
            transition: "right 0.4s ease",
          }}
        />
      </div>
      <span
        style={{
          fontSize: "12px",
          fontWeight: 700,
          color,
          minWidth: "32px",
          textAlign: "right",
          letterSpacing: "0.02em",
        }}
      >
        {score}
      </span>
    </div>
  );
}
