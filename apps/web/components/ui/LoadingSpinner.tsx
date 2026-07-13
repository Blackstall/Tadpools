interface LoadingSpinnerProps {
  size?: number;
}

export default function LoadingSpinner({ size = 24 }: LoadingSpinnerProps) {
  return (
    <>
      <style>{`
        @keyframes tadpools-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <span
        role="status"
        aria-label="Loading"
        style={{
          display: "inline-block",
          width: size,
          height: size,
          borderRadius: "50%",
          border: `${Math.max(2, Math.round(size / 10))}px solid rgba(20, 184, 166, 0.2)`,
          borderTopColor: "var(--accent)",
          animation: "tadpools-spin 0.75s linear infinite",
          flexShrink: 0,
        }}
      />
    </>
  );
}
