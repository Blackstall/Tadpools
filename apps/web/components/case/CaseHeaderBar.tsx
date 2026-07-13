"use client";

import type { SwarmState } from "../../lib/types";

const STAGE_TEXT: Record<string, string> = {
  idle:       "Waiting for intake",
  uploading:  "Uploading documents",
  extracting: "Extracting structured fields",
  processing: "Agents reviewing evidence",
  done:       "Consensus reached",
  error:      "Processing error",
};

const DECISION_COLORS: Record<string, string> = {
  approve:       "#22C55E",
  manual_review: "#F59E0B",
  escalate:      "#F97316",
  reject:        "#EF4444",
};

const DECISION_LABELS: Record<string, string> = {
  approve:       "Approved",
  manual_review: "Review Needed",
  escalate:      "Escalate",
  reject:        "Rejected",
};

interface Props {
  state:       SwarmState;
  casePayload: Record<string, unknown> | null;
}

export function CaseHeaderBar({ state, casePayload }: Props) {
  const company  = casePayload?.company as Record<string, string> | undefined;
  const initials = company?.companyName
    ? company.companyName.split(" ").slice(0, 2).map(w => w[0] ?? "").join("").toUpperCase()
    : "?";
  const isPulsing = ["uploading", "extracting", "processing"].includes(state.phase);
  const dec       = state.decision;
  const decColor  = dec ? (DECISION_COLORS[dec.status] ?? "#14B8A6") : null;
  const stageText = STAGE_TEXT[state.phase] ?? state.phase;

  return (
    <div className="case-header-bar">
      {/* Company identity */}
      <div className="case-hdr-left">
        <div className="case-hdr-avatar">{initials}</div>
        <div className="case-hdr-identity">
          <div className="case-hdr-name">{company?.companyName ?? "Untitled Case"}</div>
          <div className="case-hdr-sub">
            {[company?.registrationNumber, company?.natureOfBusiness]
              .filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>

      {/* Meta chips */}
      <div className="case-hdr-right">
        {state.caseId && (
          <div className="case-hdr-chip">
            <span className="chip-label">Case</span>
            <span className="chip-val mono">{state.caseId.slice(0, 8).toUpperCase()}</span>
          </div>
        )}

        <div className="case-hdr-chip">
          <span className="chip-label">Stage</span>
          <span className="chip-val">
            {isPulsing && (
              <span
                className="status-dot status-dot--pulse"
                style={{ background: "#14B8A6", width: 6, height: 6, display: "inline-block", marginRight: 5, verticalAlign: "middle" }}
              />
            )}
            {stageText}
          </span>
        </div>

        {dec && decColor ? (
          <div className="case-hdr-decision-badge" style={{ background: decColor + "15", borderColor: decColor + "40" }}>
            <span className="decision-badge-score" style={{ color: decColor }}>
              {Math.round(dec.score)}
            </span>
            <span className="decision-badge-label" style={{ color: decColor }}>
              {DECISION_LABELS[dec.status] ?? dec.status}
            </span>
          </div>
        ) : isPulsing ? (
          <div className="case-hdr-chip">
            <span className="intel-spinner" style={{ width: 12, height: 12 }} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
