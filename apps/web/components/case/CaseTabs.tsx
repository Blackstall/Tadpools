"use client";

export type TabId = "overview" | "investigation" | "evidence" | "timeline" | "decision";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview",      label: "Overview" },
  { id: "investigation", label: "Investigation" },
  { id: "evidence",      label: "Evidence" },
  { id: "timeline",      label: "Timeline" },
  { id: "decision",      label: "Decision" },
];

interface Props {
  active:       TabId;
  onChange:     (id: TabId) => void;
  findingCount: number;
  hasDecision:  boolean;
}

export function CaseTabs({ active, onChange, findingCount, hasDecision }: Props) {
  return (
    <div className="case-tabs-bar">
      {TABS.map(tab => (
        <button
          key={tab.id}
          className={`case-tab${active === tab.id ? " case-tab--active" : ""}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.id === "investigation" && findingCount > 0 && (
            <span className="tab-badge">{findingCount}</span>
          )}
          {tab.id === "decision" && hasDecision && (
            <span className="tab-ready-dot" />
          )}
        </button>
      ))}
    </div>
  );
}
