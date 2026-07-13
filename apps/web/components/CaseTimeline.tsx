"use client";

import type { TimelineEvent } from "../lib/types";

interface Props {
  events: TimelineEvent[];
}

const SEV_COLOR: Record<string, string> = {
  info:   "#B0BEC5",
  low:    "#10B981",
  medium: "#F59E0B",
  high:   "#EF4444",
};

const SEV_BG: Record<string, string> = {
  info:   "rgba(176,190,197,0.12)",
  low:    "rgba(16,185,129,0.08)",
  medium: "rgba(245,158,11,0.08)",
  high:   "rgba(239,68,68,0.08)",
};

export function CaseTimeline({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="timeline-empty">
        No events yet
      </div>
    );
  }

  return (
    <div className="timeline-list">
      {events.map((ev) => {
        const color = SEV_COLOR[ev.severity] ?? "#B0BEC5";
        const bg    = SEV_BG[ev.severity]    ?? "transparent";
        return (
          <div key={ev.id} className="timeline-entry" style={{ borderLeftColor: color, background: bg }}>
            <span className="timeline-time">[{ev.time}]</span>
            <span className="timeline-msg">{ev.message}</span>
          </div>
        );
      })}
    </div>
  );
}
