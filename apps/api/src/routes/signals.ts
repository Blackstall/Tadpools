import { Router } from "express";
import { db } from "../db/pool.js";

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/cases/:caseId/signals — all signals for a case, grouped by module
router.get("/cases/:caseId/signals", async (req, res) => {
  try {
    const { caseId } = req.params;
    if (!UUID_RE.test(caseId)) {
      res.status(400).json({ message: "Invalid case ID format" });
      return;
    }

    const { rows } = await db.query(
      `SELECT id, case_id, module, signal_name, description, severity, direction,
              contribution_score, evidence, generated_by, created_at
       FROM signals
       WHERE case_id = $1
       ORDER BY module, created_at ASC`,
      [caseId]
    );

    // Group by module
    const grouped: Record<string, unknown[]> = {};
    for (const r of rows) {
      const mod = r.module as string;
      if (!grouped[mod]) grouped[mod] = [];
      grouped[mod].push({
        id: r.id as string,
        caseId: r.case_id as string,
        module: mod,
        signalName: r.signal_name as string,
        description: r.description as string | null,
        severity: r.severity as string,
        direction: r.direction as string,
        contributionScore: Number(r.contribution_score),
        evidence: r.evidence,
        generatedBy: r.generated_by as string,
        createdAt: r.created_at as string,
      });
    }

    res.json({ caseId, signals: grouped });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Internal error" });
  }
});

// GET /api/cases/:caseId/signals/summary — net score breakdown by module
router.get("/cases/:caseId/signals/summary", async (req, res) => {
  try {
    const { caseId } = req.params;
    if (!UUID_RE.test(caseId)) {
      res.status(400).json({ message: "Invalid case ID format" });
      return;
    }

    const { rows } = await db.query(
      `SELECT module,
              direction,
              SUM(contribution_score) AS total_score,
              COUNT(*) AS signal_count
       FROM signals
       WHERE case_id = $1
       GROUP BY module, direction
       ORDER BY module, direction`,
      [caseId]
    );

    // Build summary: module -> { positive, negative, net }
    const summary: Record<string, { positive: number; negative: number; net: number; signalCount: number }> = {};
    for (const r of rows) {
      const mod = r.module as string;
      const direction = r.direction as string;
      const score = Number(r.total_score);
      const count = Number(r.signal_count);

      if (!summary[mod]) {
        summary[mod] = { positive: 0, negative: 0, net: 0, signalCount: 0 };
      }
      summary[mod].signalCount += count;
      if (direction === "positive") {
        summary[mod].positive += score;
      } else if (direction === "negative") {
        summary[mod].negative += score;
      }
      summary[mod].net = summary[mod].positive - summary[mod].negative;
    }

    res.json({ caseId, summary });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Internal error" });
  }
});

export { router as signalRoutes };
