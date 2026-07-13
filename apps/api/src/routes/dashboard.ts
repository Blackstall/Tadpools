import { Router } from "express";
import { db } from "../db/pool.js";

const router = Router();

// GET /api/dashboard/stats — aggregated KPIs
router.get("/dashboard/stats", async (_req, res) => {
  try {
    const { rows: statRows } = await db.query(
      `SELECT
         COUNT(*)                                                        AS total,
         COUNT(*) FILTER (WHERE status = 'approved')                    AS approved,
         COUNT(*) FILTER (WHERE status = 'rejected')                    AS rejected,
         COUNT(*) FILTER (WHERE status = 'escalated')                   AS escalated,
         COUNT(*) FILTER (WHERE status IN (
           'pending','processing','submitted','draft','needs_review'
         ))                                                             AS pending
       FROM cases`
    );

    const { rows: scoreRows } = await db.query(
      `SELECT
         COALESCE(AVG(score), 0)                          AS avg_score,
         COUNT(*) FILTER (WHERE score >= 90)              AS high_risk_count
       FROM decisions`
    );

    const s = statRows[0];
    const sc = scoreRows[0];

    res.json({
      total: Number(s.total),
      approved: Number(s.approved),
      rejected: Number(s.rejected),
      escalated: Number(s.escalated),
      pending: Number(s.pending),
      avgScore: Number(Number(sc.avg_score).toFixed(2)),
      highRiskCount: Number(sc.high_risk_count),
    });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Internal error" });
  }
});

// GET /api/dashboard/recent — last 10 cases with status + score
router.get("/dashboard/recent", async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT c.id, c.status, c.company_name, c.created_at, d.score
       FROM cases c
       LEFT JOIN decisions d ON d.case_id = c.id
       ORDER BY c.created_at DESC
       LIMIT 10`
    );

    const cases = rows.map((r) => ({
      id: r.id as string,
      status: r.status as string,
      companyName: r.company_name as string,
      score: r.score != null ? Number(r.score) : null,
      createdAt: r.created_at as string,
    }));

    res.json({ cases });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Internal error" });
  }
});

export { router as dashboardRoutes };
