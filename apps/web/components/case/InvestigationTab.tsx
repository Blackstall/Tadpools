"use client";

import { useState } from "react";
import type { SwarmState } from "../../lib/types";
import { mapFindingsToSteps, type StepData, type StepStatus } from "../../lib/workbench/mapFindings";
import { GraphWorkbench } from "../workbench/GraphWorkbench";

const STEP_NARRATIVES: Record<string, string> = {
  "01_intake":         "Waiting for case details and supporting documents.",
  "02_doc_extraction": "Reading uploaded documents and extracting structured fields.",
  "03_authenticity":   "Checking internal consistency and forgery signals in uploaded documents.",
  "04_company":        "Assessing company age, legitimacy, business nature, and suspicious patterns.",
  "05_beneficiary":    "Comparing beneficiary and bank details against documents and company identity.",
  "06_decision":       "Synthesising agent findings into a final risk recommendation.",
};

const STATUS_COLOR: Record<StepStatus, string> = {
  pending: "var(--muted)",
  running: "var(--accent)",
  done:    "var(--low)",
  flagged: "var(--high)",
};

const STATUS_ICON: Record<StepStatus, string> = {
  pending: "○",
  running: "◌",
  done:    "✓",
  flagged: "⚑",
};

const RISK_COLORS: Record<string, string> = {
  high:   "#EF4444",
  medium: "#F59E0B",
  low:    "#22C55E",
};

function StepCard({ step }: { step: StepData }) {
  const [expanded, setExpanded] = useState(false);
  const c         = STATUS_COLOR[step.status];
  const icon      = STATUS_ICON[step.status];
  const narrative = STEP_NARRATIVES[step.stepId];
  const canExpand = step.findings.length > 0;

  return (
    <div className={`investigation-step investigation-step--${step.status}`}>
      <button
        className="inv-step-header"
        onClick={() => canExpand && setExpanded(v => !v)}
        style={{ cursor: canExpand ? "pointer" : "default" }}
      >
        <span className="inv-step-icon" style={{ color: c }}>
          {step.status === "running"
            ? <span className="intel-spinner" style={{ width: 12, height: 12 }} />
            : icon}
        </span>
        <div className="inv-step-body">
          <span className="inv-step-label">{step.label}</span>
          {narrative && <span className="inv-step-narrative">{narrative}</span>}
        </div>
        {canExpand && <span className="tab-badge">{step.findings.length}</span>}
        {canExpand && <span className="inv-step-chevron">{expanded ? "▲" : "▼"}</span>}
      </button>

      {expanded && canExpand && (
        <div className="inv-step-findings">
          {step.findings.map(f => {
            const fc = RISK_COLORS[f.riskLevel] ?? "var(--muted)";
            return (
              <div key={f.agent} className="finding-detail" style={{ borderLeftColor: fc }}>
                <div className="finding-detail-header">
                  <span className="finding-agent">{f.agent.replace("Agent", "")}</span>
                  <span className="finding-risk" style={{ color: fc }}>{f.riskLevel}</span>
                  <span className="finding-conf">{Math.round(f.confidence * 100)}% confidence</span>
                </div>
                <p className="bubble-summary">{f.summary}</p>
                {f.flags.length > 0 && (
                  <div className="risk-signals" style={{ marginTop: 5 }}>
                    {f.flags.slice(0, 3).map(fl => (
                      <span key={fl} className={`risk-sig risk-sig--${f.riskLevel}`}>{fl}</span>
                    ))}
                  </div>
                )}
                {f.reasoning.length > 0 && (
                  <div className="decision-reasons" style={{ marginTop: 5 }}>
                    {f.reasoning.slice(0, 2).map((r, i) => (
                      <div key={i} className="decision-reason">{r}</div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface Props {
  state: SwarmState;
}

export function InvestigationTab({ state }: Props) {
  const [showCanvas, setShowCanvas] = useState(true);
  const steps = mapFindingsToSteps(state.findings, state.phase, state.docs.length);

  return (
    <div className="investigation-tab">

      {/* Findings list */}
      <div className="investigation-main">
        <div className="investigation-section-header">
          <span className="card-section-label" style={{ padding: 0 }}>Findings by Investigation Step</span>
          <span className="section-label-count">
            {state.findings.length} finding{state.findings.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="investigation-steps-list">
          {steps.map(step => (
            <StepCard key={step.stepId} step={step} />
          ))}
        </div>
      </div>

      {/* Canvas panel — sticky, collapses */}
      <div className={`investigation-canvas-col${showCanvas ? " investigation-canvas-col--open" : ""}`}>
        <div className="canvas-col-header">
          <span className="card-section-label" style={{ padding: 0, fontSize: 10 }}>Swarm Activity</span>
          <button
            className="btn-ghost"
            onClick={() => setShowCanvas(v => !v)}
            style={{ fontSize: 10, padding: "2px 8px" }}
          >
            {showCanvas ? "Hide" : "Show"}
          </button>
        </div>
        {showCanvas && (
          <div className="canvas-col-body">
            <GraphWorkbench swarmState={state} />
          </div>
        )}
      </div>
    </div>
  );
}
