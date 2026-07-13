"use client";

import { useState } from "react";
import SignalRow from "./SignalRow";
import type { Signal } from "@tadpools/shared/index";

interface Props {
  module: string;
  signals: Signal[];
}

const MODULE_LABELS: Record<string, string> = {
  intake:                "Intake",
  extraction:            "Document Extraction",
  authenticity:          "Authenticity Check",
  entity_verification:   "Entity Verification",
  relationship_matching: "Relationship Matching",
  historical_intelligence: "Historical Intelligence",
  challenge_phase:       "Challenge Phase",
  decision:              "Decision",
};

export default function ModuleAccordion({ module, signals }: Props) {
  const [open, setOpen] = useState(true);

  const netScore = signals.reduce((sum, s) => {
    if (s.direction === "risk_increasing") return sum + s.contributionScore;
    if (s.direction === "risk_reducing")   return sum - s.contributionScore;
    return sum;
  }, 0);

  const netColor = netScore > 20 ? "var(--high)" : netScore > 0 ? "var(--medium)" : "var(--low)";
  const label = MODULE_LABELS[module] ?? module;

  return (
    <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", marginBottom: 10, overflow: "hidden" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 10, width: "100%",
          padding: "10px 14px", background: "none", border: "none", cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", flex: 1 }}>{label}</span>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>{signals.length} signal{signals.length !== 1 ? "s" : ""}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: netColor }}>
          {netScore >= 0 ? "+" : ""}{netScore} pts
        </span>
        <span style={{ fontSize: 14, color: "var(--muted)", transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
      </button>
      {open && (
        <div style={{ padding: "0 14px 10px" }}>
          {signals.map(s => <SignalRow key={s.id} signal={s} />)}
        </div>
      )}
    </div>
  );
}
