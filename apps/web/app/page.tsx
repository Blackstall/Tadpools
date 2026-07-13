"use client";

import { Suspense, useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useSwarmStream }        from "../lib/useSwarmStream";
import { TadpolePool }           from "../components/TadpolePool";
import { IntakeForm }            from "../components/IntakeForm";
import { CaseHistoryDrawer }     from "../components/history/CaseHistoryDrawer";
import { LeftContextPanel }      from "../components/workspace/LeftContextPanel";
import { RightDecisionPanel }    from "../components/workspace/RightDecisionPanel";
import type { DocType }          from "../lib/types";

function heatBackground(score: number | undefined): string {
  if (!score) return "";
  if (score >= 150) return "linear-gradient(150deg, #EDF9F7 50%, #FDECEA)";
  if (score >= 90)  return "linear-gradient(150deg, #EDF9F7 50%, #FFF3E0)";
  if (score >= 40)  return "linear-gradient(150deg, #EDF9F7 55%, #FFFBEC)";
  return "linear-gradient(150deg, #EDF9F7 55%, #DCFCE7)";
}

export default function Page() {
  return (
    <Suspense fallback={null}>
      <WorkspaceContent />
    </Suspense>
  );
}

function WorkspaceContent() {
  const { state, submitCase, uploadAndExtract, loadCase, reset } = useSwarmStream();
  const [casePayload,  setCasePayload]  = useState<Record<string, unknown> | null>(null);
  const [historyOpen,  setHistoryOpen]  = useState(false);

  const searchParams = useSearchParams();

  useEffect(() => {
    const caseId = searchParams.get("caseId");
    if (!caseId) return;
    loadCase(caseId).then((payload) => {
      if (payload) setCasePayload(payload);
    });
    window.history.replaceState(null, "", "/");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = useCallback(async (
    payload: unknown,
    files: { file: File; docType: DocType }[]
  ) => {
    setCasePayload(payload as Record<string, unknown>);
    const caseId = await submitCase(payload);
    if (caseId) await uploadAndExtract(caseId, files);
  }, [submitCase, uploadAndExtract]);

  const handleReset = useCallback(() => {
    reset();
    setCasePayload(null);
  }, [reset]);

  const isIdle  = state.phase === "idle";
  const bgStyle = heatBackground(state.decision?.score);

  return (
    <div
      className="app-root"
      style={bgStyle ? { background: bgStyle, transition: "background 1.2s ease" } : undefined}
    >
      <AnimatePresence mode="wait">

        {/* ── INTAKE SCREEN (idle) ─────────────────────────────────────── */}
        {isIdle && (
          <motion.div
            key="intake"
            className="intake-screen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3 }}
          >
            <div className="intake-canvas-bg">
              <TadpolePool swarmState={state} />
            </div>
            <div className="intake-form-card panel">
              <div className="intake-form-header">
                <div className="brand-dot" style={{ width: 10, height: 10 }} />
                <span style={{ fontWeight: 600, fontSize: 14, color: "var(--text)" }}>
                  New KYC Investigation
                </span>
              </div>
              <IntakeForm onSubmit={handleSubmit} />
            </div>
          </motion.div>
        )}

        {/* ── 3-PANEL WORKSPACE (active) ───────────────────────────────── */}
        {!isIdle && (
          <motion.div
            key="workspace"
            className="ws-three-panel"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* LEFT: case context + officer inputs */}
            <LeftContextPanel
              state={state}
              casePayload={casePayload}
              onReset={handleReset}
              onHistoryOpen={() => setHistoryOpen(true)}
            />

            {/* CENTER: animated tadpole arena */}
            <div className="ws-center-panel">
              <TadpolePool swarmState={state} />
            </div>

            {/* RIGHT: AI recommendation + officer decision */}
            <RightDecisionPanel state={state} />
          </motion.div>
        )}

      </AnimatePresence>

      <CaseHistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}
