import { Router } from "express";
import { z } from "zod";
import { db } from "../db/pool.js";
import {
  insertAnalystAction,
  insertTimelineEvent,
  insertAuditLogV2,
} from "../db/caseRepository.js";

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const actionBodySchema = z.object({
  note: z.string().optional(),
});

type ActionConfig = {
  status: string;
  actionType: string;
  title: string;
  auditAction: string;
};

const ACTION_MAP: Record<string, ActionConfig> = {
  approve: {
    status: "approved",
    actionType: "approve",
    title: "Case Approved",
    auditAction: "case_approved",
  },
  reject: {
    status: "rejected",
    actionType: "reject",
    title: "Case Rejected",
    auditAction: "case_rejected",
  },
  escalate: {
    status: "escalated",
    actionType: "escalate",
    title: "Case Escalated",
    auditAction: "case_escalated",
  },
  "request-documents": {
    status: "needs_review",
    actionType: "request_documents",
    title: "Documents Requested",
    auditAction: "case_documents_requested",
  },
};

async function handleAction(
  caseId: string,
  config: ActionConfig,
  note: string | undefined
): Promise<void> {
  await db.query(
    `UPDATE cases SET status = $1, decided_at = NOW(), updated_at = NOW() WHERE id = $2`,
    [config.status, caseId]
  );

  await insertAnalystAction({
    caseId,
    actionType: config.actionType,
    note,
  });

  await insertTimelineEvent({
    caseId,
    eventType: "analyst_action",
    actorType: "analyst",
    title: config.title,
    description: note,
  });

  await insertAuditLogV2({
    caseId,
    actorType: "analyst",
    action: config.auditAction,
  });
}

function makeActionHandler(actionKey: string) {
  return async (req: import("express").Request, res: import("express").Response): Promise<void> => {
    try {
      const caseId = String(req.params.caseId);
      if (!UUID_RE.test(caseId)) {
        res.status(400).json({ message: "Invalid case ID format" });
        return;
      }

      const { note } = actionBodySchema.parse(req.body ?? {});
      const config = ACTION_MAP[actionKey];

      await handleAction(caseId, config, note);

      res.json({ success: true, status: config.status });
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
        return;
      }
      res.status(500).json({ message: err instanceof Error ? err.message : "Internal error" });
    }
  };
}

// POST /api/cases/:caseId/actions/approve
router.post("/cases/:caseId/actions/approve", makeActionHandler("approve"));

// POST /api/cases/:caseId/actions/reject
router.post("/cases/:caseId/actions/reject", makeActionHandler("reject"));

// POST /api/cases/:caseId/actions/escalate
router.post("/cases/:caseId/actions/escalate", makeActionHandler("escalate"));

// POST /api/cases/:caseId/actions/request-documents
router.post("/cases/:caseId/actions/request-documents", makeActionHandler("request-documents"));

export { router as actionRoutes };
