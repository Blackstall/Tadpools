import Card from "./Card";

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
  sublabel?: string;
}

const trendConfig = {
  up:      { symbol: "↑", color: "var(--low)" },
  down:    { symbol: "↓", color: "var(--high)" },
  neutral: { symbol: "→", color: "var(--muted)" },
};

export default function StatCard({ label, value, trend, sublabel }: StatCardProps) {
  const trendInfo = trend ? trendConfig[trend] : null;

  return (
    <Card style={{ padding: "1.25rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {label}
        </span>
        <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
          <span
            style={{
              fontSize: "28px",
              fontWeight: 800,
              color: "var(--text)",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
            }}
          >
            {value}
          </span>
          {trendInfo && (
            <span
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: trendInfo.color,
              }}
            >
              {trendInfo.symbol}
            </span>
          )}
        </div>
        {sublabel && (
          <span
            style={{
              fontSize: "11px",
              color: "var(--muted)",
              lineHeight: 1.4,
            }}
          >
            {sublabel}
          </span>
        )}
      </div>
    </Card>
  );
}
