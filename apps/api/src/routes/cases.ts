import { Router } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { validate as isUUID } from "uuid";
import {
  insertCase, getCaseById,
  insertDecision, getDecisionByCaseId,
  updateCaseStatus, listCases,
} from "../db/caseRepository.js";
import { runSwarm }        from "../services/swarmService.js";
import { logAudit }        from "../services/auditService.js";
import { listAudit }       from "../services/auditService.js";
import { emitSwarm }       from "../services/eventBus.js";
import { db }              from "../db/pool.js";

const router = Router();

const caseSchema = z.object({
  company: z.object({
    companyName: z.string().min(1),
    registrationNumber: z.string().min(1),
    registrationDate: z.string().min(1),
    natureOfBusiness: z.string().min(1),
  }),
  beneficiary: z.object({
    beneficiaryName: z.string().min(1),
    accountNumber: z.string().min(1),
    bankName: z.string().min(1),
    natureOfBusiness: z.string().optional(),
  }),
  documents: z.array(z.object({
    id: z.string(),
    type: z.enum(["invoice", "agreement", "payment_voucher", "spa", "tenancy", "other"]),
    filename: z.string(),
    storageKey: z.string().optional(),
  })),
  consentAccepted: z.literal(true),
});

// GET /api/cases — list all cases
router.get("/cases", async (_req, res, next) => {
  try {
    const cases = await listCases();
    res.json({ cases });
  } catch (error) {
    next(error);
  }
});

// POST /api/cases — intake case, start swarm async, return caseId immediately
router.post("/cases", async (req, res, next) => {
  try {
    const payload = caseSchema.parse(req.body);
    const caseId  = uuidv4();

    await insertCase(caseId, payload);
    await logAudit(caseId, "case.created", { companyName: payload.company.companyName });
    await updateCaseStatus(caseId, "processing");

    // Return immediately — UI connects to SSE stream for live updates
    res.status(201).json({ caseId, status: "processing" });

    // Run swarm in background
    runSwarm(caseId, payload)
      .then(async (decision) => {
        await insertDecision(caseId, decision);
        await updateCaseStatus(caseId, "decided");
        await logAudit(caseId, "case.decided", { status: decision.status, score: decision.score });
        emitSwarm({ type: "done", caseId, status: decision.status, score: decision.score });
      })
      .catch(async (err: unknown) => {
        const msg = err instanceof Error ? err.message : "Unknown swarm error";
        console.error(`[swarm] case ${caseId} failed:`, msg);
        await logAudit(caseId, "swarm.error", { error: msg }).catch(() => {});
        await updateCaseStatus(caseId, "error").catch(() => {});
        emitSwarm({ type: "error", caseId, message: msg });
      });
  } catch (error) {
    next(error);
  }
});

// GET /api/cases/:caseId — fetch case + decision (null while processing)
router.get("/cases/:caseId", async (req, res, next) => {
  try {
    const { caseId } = req.params;
    if (!isUUID(caseId)) { res.status(400).json({ message: "Invalid case ID." }); return; }

    const { rows } = await db.query(
      `SELECT status FROM cases WHERE id = $1`, [caseId]
    );
    if (rows.length === 0) { res.status(404).json({ message: "Case not found" }); return; }

    const [caseInput, decision] = await Promise.all([
      getCaseById(caseId),
      getDecisionByCaseId(caseId),
    ]);

    res.json({ caseId, status: rows[0].status, caseInput, decision });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/cases/:caseId/override — override decision
router.patch("/cases/:caseId/override", async (req, res, next) => {
  try {
    const { caseId } = req.params;
    if (!isUUID(caseId)) { res.status(400).json({ message: "Invalid case ID." }); return; }

    const { status, comment } = req.body as { status?: string; comment?: string };
    const valid = ["approve", "reject", "escalate", "manual_review"];
    if (!status || !valid.includes(status)) {
      res.status(400).json({ message: "Invalid status. Must be one of: " + valid.join(", ") }); return;
    }

    await db.query(`UPDATE decisions SET status = $1 WHERE case_id = $2`, [status, caseId]);
    await logAudit(caseId, "decision.override", { status, comment: comment ?? "" });
    res.json({ success: true, caseId, status });
  } catch (error) {
    next(error);
  }
});

// GET /api/cases/:caseId/audit — raw event stream
router.get("/cases/:caseId/audit", async (req, res, next) => {
  try {
    const { caseId } = req.params;
    if (!isUUID(caseId)) { res.status(400).json({ message: "Invalid case ID." }); return; }
    const audit = await listAudit(caseId);
    res.json({ caseId, audit });
  } catch (error) {
    next(error);
  }
});

// ── PHASE 6: New workbench routes ─────────────────────────────────────────────

// GET /api/cases/:caseId/graph — graph nodes + edges from findings
router.get("/cases/:caseId/graph", async (req, res, next) => {
  try {
    const { caseId } = req.params;
    if (!isUUID(caseId)) { res.status(400).json({ message: "Invalid case ID." }); return; }

    const [caseRow, decision] = await Promise.all([
      getCaseById(caseId),
      getDecisionByCaseId(caseId),
    ]);
    if (!caseRow) { res.status(404).json({ message: "Case not found" }); return; }

    const { rows: docRows } = await db.query(
      `SELECT DISTINCT doc_id, field_name FROM extracted_fields WHERE case_id = $1 LIMIT 30`, [caseId]
    );

    const findings = decision?.findings ?? [];
    const nodes: Record<string, unknown>[] = [
      { id: "company",     type: "company",     label: caseRow.company.companyName,           riskLevel: riskForAgents(findings, ["ExistenceVerificationAgent","HistoricalSuspicionAgent","NatureOfBusinessAgent","RegistrationAgeAgent"]) },
      { id: "beneficiary", type: "beneficiary", label: caseRow.beneficiary.beneficiaryName,   riskLevel: riskForAgents(findings, ["NameMatchingAgent","BeneficiaryConsistencyAgent"]) },
      { id: "bank",        type: "bank",        label: caseRow.beneficiary.bankName,           riskLevel: riskForAgents(findings, ["BeneficiaryConsistencyAgent"]) },
    ];

    const docIds = [...new Set(docRows.map((r: { doc_id: string }) => r.doc_id))];
    for (const docId of docIds.slice(0, 5)) {
      nodes.push({ id: `doc_${docId}`, type: "document", label: `Doc ${(docId as string).slice(0, 6)}`, riskLevel: riskForAgents(findings, ["DocumentAuthenticityAgent"]) });
    }

    const edges: Record<string, unknown>[] = [
      { from: "company",     to: "beneficiary", type: "belongs_to" },
      { from: "beneficiary", to: "bank",        type: "belongs_to" },
      ...docIds.slice(0, 5).map((docId) => ({ from: `doc_${docId}`, to: "company", type: "extracted_from" })),
    ];

    const nameMismatch = findings.find((f) => f.agent === "NameMatchingAgent" && f.riskLevel !== "low");
    if (nameMismatch) edges.push({ from: "company", to: "beneficiary", type: "inconsistent_with" });

    res.json({ caseId, nodes, edges });
  } catch (error) {
    next(error);
  }
});

// GET /api/cases/:caseId/report — structured step-based report
router.get("/cases/:caseId/report", async (req, res, next) => {
  try {
    const { caseId } = req.params;
    if (!isUUID(caseId)) { res.status(400).json({ message: "Invalid case ID." }); return; }

    const { rows: caseRows } = await db.query(`SELECT * FROM cases WHERE id = $1`, [caseId]);
    if (caseRows.length === 0) { res.status(404).json({ message: "Case not found" }); return; }

    const decision = await getDecisionByCaseId(caseId);
    const { rows: actionRows } = await db.query(
      `SELECT * FROM recommended_actions WHERE case_id = $1 ORDER BY priority DESC`, [caseId]
    );

    const AGENT_TO_STEP: Record<string, string> = {
      DocumentAuthenticityAgent:   "03_authenticity",
      RegistrationAgeAgent:        "04_company",
      NatureOfBusinessAgent:       "04_company",
      ExistenceVerificationAgent:  "04_company",
      HistoricalSuspicionAgent:    "04_company",
      NameMatchingAgent:           "05_beneficiary",
      BeneficiaryConsistencyAgent: "05_beneficiary",
      SkepticAgent:                "06_decision",
      ProsecutorAgent:             "06_decision",
      ChairAgent:                  "06_decision",
    };

    const byStep: Record<string, unknown[]> = {};
    for (const f of decision?.findings ?? []) {
      const step = AGENT_TO_STEP[f.agent] ?? "04_company";
      if (!byStep[step]) byStep[step] = [];
      byStep[step].push(f);
    }

    res.json({
      caseId,
      status: caseRows[0].status,
      decision: decision ? { status: decision.status, score: decision.score } : null,
      steps: byStep,
      actions: actionRows,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/cases/:caseId/history — audit trail for a single case
router.get("/cases/:caseId/history", async (req, res, next) => {
  try {
    const { caseId } = req.params;
    if (!isUUID(caseId)) { res.status(400).json({ message: "Invalid case ID." }); return; }
    const audit = await listAudit(caseId);
    res.json({ caseId, history: audit });
  } catch (error) {
    next(error);
  }
});

// GET /api/bank-contacts?bank=<name> — fetch escalation contacts for a bank
router.get("/bank-contacts", async (req, res, next) => {
  try {
    const bank = req.query["bank"] as string | undefined;
    if (!bank) { res.status(400).json({ message: "bank query param required" }); return; }

    const { rows } = await db.query(
      `SELECT bank_name, contact_label, contact_number, verified_at
       FROM bank_escalation_contacts
       WHERE LOWER(bank_name) LIKE LOWER($1)
       ORDER BY verified_at DESC NULLS LAST
       LIMIT 5`,
      [`%${bank}%`]
    );
    res.json({ bank, contacts: rows });
  } catch (error) {
    next(error);
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function riskForAgents(
  findings: { agent: string; riskLevel: string }[],
  agents: string[]
): string {
  const rank: Record<string, number> = { low: 1, medium: 2, high: 3 };
  let max = "none";
  for (const f of findings) {
    if (agents.includes(f.agent)) {
      if (max === "none" || (rank[f.riskLevel] ?? 0) > (rank[max] ?? 0)) max = f.riskLevel;
    }
  }
  return max;
}

export default router;
