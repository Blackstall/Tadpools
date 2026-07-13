import { Router } from "express";
import { z } from "zod";
import { db } from "../db/pool.js";
import { insertTimelineEvent } from "../db/caseRepository.js";

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/cases/:caseId/timeline — ordered timeline events (ASC by created_at)
router.get("/cases/:caseId/timeline", async (req, res) => {
  try {
    const { caseId } = req.params;
    if (!UUID_RE.test(caseId)) {
      res.status(400).json({ message: "Invalid case ID format" });
      return;
    }

    const { rows } = await db.query(
      `SELECT id, case_id, event_type, module, actor_type, title, description, payload, created_at
       FROM timeline_events
       WHERE case_id = $1
       ORDER BY created_at ASC`,
      [caseId]
    );

    const events = rows.map((r) => ({
      id: r.id as string,
      caseId: r.case_id as string,
      eventType: r.event_type as string,
      module: r.module as string | null,
      actorType: r.actor_type as string,
      title: r.title as string,
      description: r.description as string | null,
      payload: r.payload,
      createdAt: r.created_at as string,
    }));

    res.json({ caseId, events });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Internal error" });
  }
});

const noteSchema = z.object({
  note: z.string().min(1),
});

// POST /api/cases/:caseId/timeline — insert analyst note event
router.post("/cases/:caseId/timeline", async (req, res) => {
  try {
    const { caseId } = req.params;
    if (!UUID_RE.test(caseId)) {
      res.status(400).json({ message: "Invalid case ID format" });
      return;
    }

    const { note } = noteSchema.parse(req.body);

    await insertTimelineEvent({
      caseId,
      eventType: "note_added",
      actorType: "analyst",
      title: "Analyst Note",
      description: note,
    });

    res.status(201).json({ success: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ message: err.errors[0].message });
      return;
    }
    res.status(500).json({ message: err instanceof Error ? err.message : "Internal error" });
  }
});

export { router as timelineRoutes };
