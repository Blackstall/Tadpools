"use client";

import { useState } from "react";
import type { SwarmState } from "../../lib/types";
import { CaseTimeline } from "../CaseTimeline";

type Filter = "all" | "high" | "medium" | "info";

interface Props {
  state: SwarmState;
}

export function TimelineTab({ state }: Props) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = filter === "all"
    ? state.timeline
    : state.timeline.filter(ev => ev.severity === filter);

  const counts = {
    all:    state.timeline.length,
    high:   state.timeline.filter(e => e.severity === "high").length,
    medium: state.timeline.filter(e => e.severity === "medium").length,
    info:   state.timeline.filter(e => e.severity === "info").length,
  };

  return (
    <div className="timeline-tab">
      <div className="timeline-tab-header">
        <span className="card-section-label" style={{ padding: 0 }}>
          Case Timeline
          <span className="section-label-count">{state.timeline.length} events</span>
        </span>
        <div className="timeline-filters">
          {(["all", "high", "medium", "info"] as Filter[]).map(f => (
            <button
              key={f}
              className={`timeline-filter-btn${filter === f ? " timeline-filter-btn--active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              {counts[f] > 0 && f !== "all" && (
                <span style={{ marginLeft: 4, opacity: 0.7 }}>({counts[f]})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {state.timeline.length === 0 ? (
        <div className="cases-empty" style={{ paddingTop: 24 }}>
          No events recorded yet.
        </div>
      ) : filtered.length === 0 ? (
        <div className="cases-empty" style={{ paddingTop: 16 }}>
          No events matching this filter.
        </div>
      ) : (
        <div className="timeline-tab-body">
          <CaseTimeline events={filtered} />
        </div>
      )}
    </div>
  );
}
