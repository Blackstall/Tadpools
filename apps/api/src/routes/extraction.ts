import { Router } from "express";
import { validate as isUUID } from "uuid";
import { getCaseById } from "../db/caseRepository.js";
import { extractCaseDocuments } from "../services/extractionService.js";
import { db } from "../db/pool.js";

const router = Router();

// POST /api/cases/:caseId/extract
// Triggers extraction on all uploaded temp files, stores fields, deletes raw files.
router.post("/cases/:caseId/extract", async (req, res, next) => {
  try {
    const { caseId } = req.params;

    if (!isUUID(caseId)) {
      res.status(400).json({ message: "Invalid case ID format." });
      return;
    }

    const caseRecord = await getCaseById(caseId);
    if (!caseRecord) {
      res.status(404).json({ message: "Case not found" });
      return;
    }

    const results = await extractCaseDocuments(caseId);

    res.json({
      caseId,
      documentsProcessed: results.length,
      results: results.map((r) => ({
        docId: r.docId,
        filename: r.filename,
        docType: r.docType,
        fieldsExtracted: r.fields.length,
        fields: r.fields,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/cases/:caseId/fields
// Returns all extracted fields for a case.
router.get("/cases/:caseId/fields", async (req, res, next) => {
  try {
    const { caseId } = req.params;

    if (!isUUID(caseId)) {
      res.status(400).json({ message: "Invalid case ID format." });
      return;
    }

    const { rows } = await db.query(
      `SELECT doc_id, field_name, value, created_at
       FROM extracted_fields
       WHERE case_id = $1
       ORDER BY created_at, doc_id, field_name`,
      [caseId]
    );

    res.json({ caseId, fieldCount: rows.length, fields: rows });
  } catch (error) {
    next(error);
  }
});

export default router;
