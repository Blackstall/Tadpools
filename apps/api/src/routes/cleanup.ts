import { Router } from "express";
import { validate as isUUID } from "uuid";
import { getCaseById } from "../db/caseRepository.js";
import { cleanupCase } from "../services/cleanupService.js";
import { db } from "../db/pool.js";

const router = Router();

// POST /api/cases/:caseId/cleanup
// Idempotent — safe to call multiple times.
router.post("/cases/:caseId/cleanup", async (req, res, next) => {
  try {
    const { caseId } = req.params;

    if (!isUUID(caseId)) {
      res.status(400).json({ message: "Invalid case ID format." });
      return;
    }

    const caseRecord = await getCaseById(caseId);
    if (!caseRecord) {
      res.status(404).json({ message: "Case not found." });
      return;
    }

    // Verify case has been decided before allowing cleanup
    const { rows } = await db.query(
      `SELECT status FROM cases WHERE id = $1`,
      [caseId]
    );
    const currentStatus = rows[0]?.status;
    if (!["decided", "archived"].includes(currentStatus)) {
      res.status(409).json({
        message: `Cannot cleanup case in status "${currentStatus}". Case must be decided first.`,
        currentStatus,
      });
      return;
    }

    const result = await cleanupCase(caseId);

    res.json({
      message: "Case archived successfully.",
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/cases/:caseId/cleanup/status
// Check cleanup status without triggering it.
router.get("/cases/:caseId/cleanup/status", async (req, res, next) => {
  try {
    const { caseId } = req.params;

    if (!isUUID(caseId)) {
      res.status(400).json({ message: "Invalid case ID format." });
      return;
    }

    const { rows } = await db.query(
      `SELECT status, updated_at FROM cases WHERE id = $1`,
      [caseId]
    );
    if (rows.length === 0) {
      res.status(404).json({ message: "Case not found." });
      return;
    }

    // Check MinIO for any remaining temp files
    const { Client } = await import("minio");
    const { minio, TEMP_BUCKET } = await import("../storage/minioClient.js");
    const tempObjects: string[] = [];
    await new Promise<void>((resolve, reject) => {
      const stream = minio.listObjects(TEMP_BUCKET, `temp/${caseId}/`, true);
      stream.on("data", (obj) => { if (obj.name) tempObjects.push(obj.name); });
      stream.on("end", resolve);
      stream.on("error", reject);
    });

    res.json({
      caseId,
      caseStatus: rows[0].status,
      lastUpdated: rows[0].updated_at,
      tempFilesRemaining: tempObjects.length,
      isClean: tempObjects.length === 0 && rows[0].status === "archived",
    });
  } catch (error) {
    next(error);
  }
});

export default router;
