import { Router } from "express";
import { db } from "../db/pool.js";

const router = Router();

// GET /api/audit — global audit log (filterable)
router.get("/audit", async (req, res) => {
  try {
    const limit  = Math.min(Number(req.query.limit  ?? 50), 200);
    const offset = Number(req.query.offset ?? 0);
    const actorType = typeof req.query.actorType === "string" ? req.query.actorType : undefined;
    const module    = typeof req.query.module    === "string" ? req.query.module    : undefined;
    const caseId    = typeof req.query.caseId    === "string" ? req.query.caseId    : undefined;

    const conditions: string[] = [];
    const params: unknown[]    = [];

    if (actorType) { params.push(actorType); conditions.push(`actor_type = $${params.length}`); }
    if (module)    { params.push(module);    conditions.push(`module = $${params.length}`); }
    if (caseId)    { params.push(caseId);    conditions.push(`case_id = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit, offset);

    const { rows } = await db.query(
      `SELECT id, case_id, entity_id, document_id, actor_type, actor_user_id,
              module, action, input_summary, output_summary, metadata, created_at
       FROM audit_logs
       ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    const { rows: countRows } = await db.query(
      `SELECT COUNT(*) AS total FROM audit_logs ${where}`,
      params.slice(0, -2)
    );

    const logs = rows.map((r) => ({
      id:            r.id           as string,
      caseId:        r.case_id      as string | null,
      entityId:      r.entity_id    as string | null,
      documentId:    r.document_id  as string | null,
      actorType:     r.actor_type   as string,
      actorUserId:   r.actor_user_id as string | null,
      module:        r.module       as string | null,
      action:        r.action       as string,
      inputSummary:  r.input_summary,
      outputSummary: r.output_summary,
      metadata:      r.metadata,
      createdAt:     r.created_at   as string,
    }));

    res.json({ logs, total: Number(countRows[0].total), limit, offset });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Internal error" });
  }
});

export { router as auditV2Routes };
