interface EmptyStateProps {
  message: string;
  icon?: string;
}

export default function EmptyState({ message, icon }: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "3rem 1.5rem",
        gap: "12px",
        textAlign: "center",
      }}
    >
      {icon && (
        <span
          style={{
            fontSize: "36px",
            lineHeight: 1,
            opacity: 0.5,
          }}
        >
          {icon}
        </span>
      )}
      <p
        style={{
          fontSize: "13px",
          color: "var(--muted)",
          maxWidth: "280px",
          lineHeight: 1.5,
        }}
      >
        {message}
      </p>
    </div>
  );
}
