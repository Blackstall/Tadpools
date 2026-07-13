"use client";

// PHASE 1+2 — GraphWorkbench: canvas host + zoom/pan controls
import { useRef, useState, useCallback } from "react";
import { TadpolePool } from "../TadpolePool";
import type { SwarmState } from "../../lib/types";

interface Props {
  swarmState: SwarmState;
  onAgentClick?: (agentId: string) => void;
}

export function GraphWorkbench({ swarmState, onAgentClick }: Props) {
  const [zoom, setZoom]   = useState(1);
  const wrapRef           = useRef<HTMLDivElement>(null);

  const handleZoomIn  = useCallback(() => setZoom((z) => Math.min(z + 0.15, 2.5)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.15, 0.5)), []);
  const handleReset   = useCallback(() => setZoom(1), []);

  // Determine visual mode from phase
  const mode: "intake" | "investigation" | "decision" =
    swarmState.phase === "idle"                                        ? "intake" :
    swarmState.phase === "done" || swarmState.phase === "error"        ? "decision" :
    "investigation";

  return (
    <div className={`graph-workbench graph-workbench--${mode}`} ref={wrapRef}>
      {/* ── Zoom controls ── */}
      <div className="graph-zoom-controls">
        <button className="graph-zoom-btn" onClick={handleZoomIn}  title="Zoom in">+</button>
        <button className="graph-zoom-btn" onClick={handleReset}   title="Reset zoom">{Math.round(zoom * 100)}%</button>
        <button className="graph-zoom-btn" onClick={handleZoomOut} title="Zoom out">−</button>
      </div>

      {/* ── Mode badge ── */}
      <div className={`graph-mode-badge graph-mode-badge--${mode}`}>
        {mode === "intake"        ? "MODE 1 — INTAKE"        :
         mode === "investigation" ? "MODE 2 — INVESTIGATION" :
                                    "MODE 3 — DECISION"}
      </div>

      {/* ── Canvas (scaled) ── */}
      <div
        className="graph-canvas-wrap"
        style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
      >
        <TadpolePool swarmState={swarmState} onAgentClick={onAgentClick} />
      </div>
    </div>
  );
}
