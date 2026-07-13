import { Router } from "express";
import { validate as isUUID } from "uuid";
import { db } from "../db/pool.js";

const router = Router();

// ── GET /api/cases/:caseId/audit ─────────────────────────────────────────────
// Raw event stream (already on cases route — this adds the richer endpoints)

// ── GET /api/cases/:caseId/audit/replay ──────────────────────────────────────
// Full structured timeline with agent-by-agent reconstruction.
router.get("/cases/:caseId/audit/replay", async (req, res, next) => {
  try {
    const { caseId } = req.params;
    if (!isUUID(caseId)) {
      res.status(400).json({ message: "Invalid case ID format." });
      return;
    }

    // Load raw audit events
    const { rows: events } = await db.query<{
      id: number;
      event_type: string;
      payload: Record<string, unknown>;
      created_at: string;
    }>(
      `SELECT id, event_type, payload, created_at
       FROM audit_logs WHERE case_id = $1 ORDER BY id`,
      [caseId]
    );

    if (events.length === 0) {
      res.status(404).json({ message: "No audit trail found for this case." });
      return;
    }

    // Load case + decision metadata
    const { rows: caseRows } = await db.query(
      `SELECT company_name, reg_number, nature_of_biz, status, created_at
       FROM cases WHERE id = $1`,
      [caseId]
    );
    const { rows: decisionRows } = await db.query(
      `SELECT status, score, reasons FROM decisions WHERE case_id = $1`,
      [caseId]
    );
    const { rows: signalRows } = await db.query(
      `SELECT signal_code, triggered_by, detail, created_at
       FROM risk_signals WHERE case_id = $1 ORDER BY created_at`,
      [caseId]
    );

    // Build structured timeline
    const PHASE_MAP: Record<string, string> = {
      "case.created":          "intake",
      "file.uploaded":         "upload",
      "extraction.doc.complete": "extraction",
      "extraction.complete":   "extraction",
      "extraction.skipped":    "extraction",
      "swarm.started":         "swarm.init",
      "agent.finding":         "swarm.analysis",
      "swarm.round1.complete": "swarm.round1",
      "swarm.round2.complete": "swarm.round2",
      "swarm.round3.complete": "swarm.round3",
      "policy.decision":       "policy",
      "case.decided":          "decision",
      "file.cleanup":          "cleanup",
      "case.cleanup":          "cleanup",
    };

    const startedAt = new Date(events[0].created_at).getTime();
    const endedAt = new Date(events[events.length - 1].created_at).getTime();

    const timeline = events.map((e) => ({
      seq: e.id,
      phase: PHASE_MAP[e.event_type] ?? "system",
      event: e.event_type,
      timestamp: e.created_at,
      elapsedMs: new Date(e.created_at).getTime() - startedAt,
      data: e.payload,
    }));

    // Group agent findings by round for summary
    const agentEvents = events
      .filter((e) => e.event_type === "agent.finding")
      .map((e) => e.payload as {
        agent: string; round: number; riskLevel: string;
        confidence: number; flags: string[]; summary: string; reasoning: string[];
      });

    const rounds: Record<number, typeof agentEvents> = {};
    for (const a of agentEvents) {
      const r = a.round ?? 0;
      if (!rounds[r]) rounds[r] = [];
      rounds[r].push(a);
    }

    res.json({
      caseId,
      case: caseRows[0] ?? null,
      decision: decisionRows[0] ?? null,
      riskSignals: signalRows,
      timeline,
      agentRounds: rounds,
      summary: {
        totalEvents: events.length,
        totalAgentFindings: agentEvents.length,
        durationMs: endedAt - startedAt,
        startedAt: events[0].created_at,
        completedAt: events[events.length - 1].created_at,
        finalStatus: decisionRows[0]?.status ?? "unknown",
        finalScore: decisionRows[0]?.score ?? null,
        triggeredSignals: signalRows.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ── GET /api/cases/:caseId/audit/export ──────────────────────────────────────
// Compliance-grade JSON export — complete record suitable for archiving.
router.get("/cases/:caseId/audit/export", async (req, res, next) => {
  try {
    const { caseId } = req.params;
    if (!isUUID(caseId)) {
      res.status(400).json({ message: "Invalid case ID format." });
      return;
    }

    const [caseRes, auditRes, findingsRes, signalsRes, decisionRes, fieldsRes] = await Promise.all([
      db.query(`SELECT * FROM cases WHERE id = $1`, [caseId]),
      db.query(`SELECT * FROM audit_logs WHERE case_id = $1 ORDER BY id`, [caseId]),
      db.query(`SELECT * FROM agent_findings WHERE case_id = $1 ORDER BY round, created_at`, [caseId]),
      db.query(`SELECT * FROM risk_signals WHERE case_id = $1 ORDER BY created_at`, [caseId]),
      db.query(`SELECT * FROM decisions WHERE case_id = $1`, [caseId]),
      db.query(`SELECT doc_id, field_name, value FROM extracted_fields WHERE case_id = $1 ORDER BY doc_id, field_name`, [caseId]),
    ]);

    if (caseRes.rows.length === 0) {
      res.status(404).json({ message: "Case not found." });
      return;
    }

    const exportPayload = {
      exportedAt: new Date().toISOString(),
      exportVersion: "1.0",
      caseId,
      case: caseRes.rows[0],
      decision: decisionRes.rows[0] ?? null,
      agentFindings: findingsRes.rows.map((f) => ({
        agent: f.agent_name,
        round: f.round,
        summary: f.summary,
        riskLevel: f.risk_level,
        confidence: Number(f.confidence),
        flags: f.flags,
        reasoning: f.reasoning,
        evidenceRefs: f.evidence,
        recordedAt: f.created_at,
      })),
      riskSignals: signalsRes.rows,
      extractedFields: fieldsRes.rows,
      auditTrail: auditRes.rows.map((e) => ({
        seq: e.id,
        eventType: e.event_type,
        payload: e.payload,
        recordedAt: e.created_at,
      })),
    };

    res.setHeader("Content-Disposition", `attachment; filename="audit-${caseId}.json"`);
    res.setHeader("Content-Type", "application/json");
    res.json(exportPayload);
  } catch (error) {
    next(error);
  }
});

export default router;
