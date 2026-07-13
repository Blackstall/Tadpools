import { Router } from "express";
import { db } from "../db/pool.js";

const router = Router();

// GET /api/policy/rules — list active policy_rules
router.get("/policy/rules", async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, rule_name, description, module, condition_expression, action,
              severity, is_active, version, created_at, updated_at
       FROM policy_rules
       WHERE is_active = true
       ORDER BY module, rule_name`
    );

    const rules = rows.map((r) => ({
      id: r.id as string,
      ruleName: r.rule_name as string,
      description: r.description as string | null,
      module: r.module as string,
      conditionExpression: r.condition_expression as string | null,
      action: r.action as string,
      severity: r.severity as string,
      isActive: r.is_active as boolean,
      version: r.version as string | null,
      createdAt: r.created_at as string,
      updatedAt: r.updated_at as string,
    }));

    res.json({ rules });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Internal error" });
  }
});

// GET /api/policy/versions — list policy_versions
router.get("/policy/versions", async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, version_label, description, is_current, published_at, created_at
       FROM policy_versions
       ORDER BY created_at DESC`
    );

    const versions = rows.map((r) => ({
      id: r.id as string,
      versionLabel: r.version_label as string,
      description: r.description as string | null,
      isCurrent: r.is_current as boolean,
      publishedAt: r.published_at as string | null,
      createdAt: r.created_at as string,
    }));

    res.json({ versions });
  } catch (err) {
    res.status(500).json({ message: err instanceof Error ? err.message : "Internal error" });
  }
});

export { router as policyRoutes };
