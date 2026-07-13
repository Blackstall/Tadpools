import { Router } from "express";
import multer from "multer";
import { validate as isUUID } from "uuid";
import { getCaseById } from "../db/caseRepository.js";
import { uploadTemp } from "../storage/uploadService.js";

const router = Router();

// Store upload in memory only — never written to disk
const memUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB cap per file
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// POST /api/cases/:caseId/upload
router.post(
  "/cases/:caseId/upload",
  memUpload.single("file"),
  async (req, res, next) => {
    try {
      const caseId = req.params["caseId"] as string;

      if (!isUUID(caseId)) {
        res.status(400).json({ message: "Invalid case ID format." });
        return;
      }

      const caseRecord = await getCaseById(caseId);
      if (!caseRecord) {
        res.status(404).json({ message: "Case not found" });
        return;
      }

      if (!req.file) {
        res.status(400).json({ message: "No file attached. Send multipart/form-data with field 'file'." });
        return;
      }

      const result = await uploadTemp(
        caseId,
        req.file.originalname,
        req.file.mimetype,
        req.file.buffer
      );

      res.status(201).json({
        caseId,
        fileRef: result.fileRef,
        filename: result.filename,
        sizeBytes: result.sizeBytes,
        mimeType: result.mimeType,
        sha256: result.sha256,
        note: "File stored temporarily. It will be deleted after extraction.",
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
