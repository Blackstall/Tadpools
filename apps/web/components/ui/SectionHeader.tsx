import type { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  description?: string;
  icon?: ReactNode;
}

export default function SectionHeader({ title, description, icon }: SectionHeaderProps) {
  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {icon && (
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent)",
              flexShrink: 0,
            }}
          >
            {icon}
          </span>
        )}
        <h2
          style={{
            fontSize: "16px",
            fontWeight: 700,
            color: "var(--text)",
            letterSpacing: "0.01em",
            margin: 0,
          }}
        >
          {title}
        </h2>
      </div>
      {description && (
        <p
          style={{
            fontSize: "12px",
            color: "var(--muted)",
            marginTop: "4px",
            marginLeft: icon ? "28px" : "0",
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      )}
    </div>
  );
}
