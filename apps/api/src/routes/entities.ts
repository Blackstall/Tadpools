import { Router } from "express";
import { z } from "zod";
import {
  listEntities,
  getEntityWithRelationships,
  upsertEntity,
  listCasesForEntity,
} from "../db/entityRepository.js";

const router = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/entities — search entities (q, type, page query params)
router.get("/entities", async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    const page = req.query.page !== undefined ? Number(req.query.page) : 1;

    const result = await listEntities({ q, type, page });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Internal error" });
  }
});

// GET /api/entities/:id — entity detail with relationships
router.get("/entities/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_RE.test(id)) {
      res.status(400).json({ message: "Invalid entity ID format" });
      return;
    }
    const result = await getEntityWithRelationships(id);
    if (result.entity === null) {
      res.status(404).json({ message: "Entity not found" });
      return;
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Internal error" });
  }
});

const upsertEntitySchema = z.object({
  entityType: z.string().min(1),
  canonicalName: z.string().min(1),
  registrationNumber: z.string().optional(),
  countryCode: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// POST /api/entities — create/upsert entity
router.post("/entities", async (req, res) => {
  try {
    const payload = upsertEntitySchema.parse(req.body);
    const entity = await upsertEntity(payload);
    res.status(201).json(entity);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ message: err.errors[0].message });
      return;
    }
    res.status(500).json({ message: err instanceof Error ? err.message : "Internal error" });
  }
});

// GET /api/entities/:id/cases — linked cases for entity
router.get("/entities/:id/cases", async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_RE.test(id)) {
      res.status(400).json({ message: "Invalid entity ID format" });
      return;
    }
    const cases = await listCasesForEntity(id);
    res.json({ cases });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Internal error" });
  }
});

export { router as entityRoutes };
