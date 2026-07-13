import { db } from "./pool.js";
import type { CaseInput } from "@tadpools/shared/index";
import type { AgentFinding, DecisionResult } from "@tadpools/shared/index";

// ── Case ─────────────────────────────────────────────────────────────────────

export async function insertCase(id: string, input: CaseInput): Promise<void> {
  await db.query(
    `INSERT INTO cases
       (id, company_name, reg_number, reg_date, nature_of_biz,
        beneficiary_name, account_number, bank_name, ben_nature_biz, consent_accepted)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      id,
      input.company.companyName,
      input.company.registrationNumber,
      input.company.registrationDate,
      input.company.natureOfBusiness,
      input.beneficiary.beneficiaryName,
      input.beneficiary.accountNumber,
      input.beneficiary.bankName,
      input.beneficiary.natureOfBusiness ?? null,
      input.consentAccepted,
    ]
  );
}

export async function getCaseById(id: string): Promise<CaseInput | null> {
  const { rows } = await db.query(`SELECT * FROM cases WHERE id = $1`, [id]);
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    company: {
      companyName: r.company_name,
      registrationNumber: r.reg_number,
      registrationDate: r.reg_date,
      natureOfBusiness: r.nature_of_biz,
    },
    beneficiary: {
      beneficiaryName: r.beneficiary_name,
      accountNumber: r.account_number,
      bankName: r.bank_name,
      natureOfBusiness: r.ben_nature_biz ?? undefined,
    },
    documents: [],          // documents are transient; populated separately
    consentAccepted: r.consent_accepted,
  };
}

export async function listCases(): Promise<{
  id:               string;
  status:           string;
  companyName:      string;
  beneficiaryName:  string;
  bankName:         string;
  score:            number | null;
  createdAt:        string;
}[]> {
  const { rows } = await db.query(
    `SELECT c.id, c.status, c.company_name, c.beneficiary_name, c.bank_name, c.created_at,
            d.score
     FROM cases c
     LEFT JOIN decisions d ON d.case_id = c.id
     ORDER BY c.created_at DESC LIMIT 100`
  );
  return rows.map((r) => ({
    id:              r.id              as string,
    status:          r.status          as string,
    companyName:     r.company_name    as string,
    beneficiaryName: r.beneficiary_name as string,
    bankName:        r.bank_name       as string,
    score:           r.score != null   ? Number(r.score) : null,
    createdAt:       r.created_at      as string,
  }));
}

export async function updateCaseStatus(id: string, status: string): Promise<void> {
  await db.query(
    `UPDATE cases SET status = $1, updated_at = NOW() WHERE id = $2`,
    [status, id]
  );
}

// ── Decision ──────────────────────────────────────────────────────────────────

export async function insertDecision(caseId: string, result: DecisionResult): Promise<void> {
  await db.query(
    `INSERT INTO decisions (case_id, status, score, reasons)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (case_id) DO UPDATE
       SET status = EXCLUDED.status, score = EXCLUDED.score, reasons = EXCLUDED.reasons`,
    [caseId, result.status, result.score, JSON.stringify(result.reasons)]
  );
}

export async function getDecisionByCaseId(caseId: string): Promise<DecisionResult | null> {
  const { rows: dRows } = await db.query(
    `SELECT * FROM decisions WHERE case_id = $1`,
    [caseId]
  );
  if (dRows.length === 0) return null;
  const d = dRows[0];

  const { rows: fRows } = await db.query(
    `SELECT * FROM agent_findings WHERE case_id = $1 ORDER BY created_at`,
    [caseId]
  );
  const findings: AgentFinding[] = fRows.map((f) => ({
    agent: f.agent_name,
    summary: f.summary,
    confidence: Number(f.confidence),
    riskLevel: f.risk_level,
    evidenceRefs: f.evidence as string[],
    flags: f.flags as string[],
    reasoning: (f.reasoning as string[]) ?? [],
    round: Number(f.round),
  }));

  return {
    status: d.status,
    score: Number(d.score),
    reasons: d.reasons as string[],
    findings,
  };
}

// ── Agent findings ────────────────────────────────────────────────────────────

export async function insertAgentFindings(
  caseId: string,
  findings: AgentFinding[],
  round = 1
): Promise<void> {
  if (findings.length === 0) return;

  // 9 columns per row
  const valuesClause = findings
    .map((_, i) => {
      const b = i * 9;
      return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9})`;
    })
    .join(", ");

  const params = findings.flatMap((f) => [
    caseId,
    f.agent,
    f.summary,
    f.confidence,
    f.riskLevel,
    JSON.stringify(f.evidenceRefs),
    JSON.stringify(f.flags),
    round,
    JSON.stringify(f.reasoning ?? []),
  ]);

  await db.query(
    `INSERT INTO agent_findings
       (case_id, agent_name, summary, confidence, risk_level, evidence, flags, round, reasoning)
     VALUES ${valuesClause}`,
    params
  );
}

// ── Audit log ─────────────────────────────────────────────────────────────────

export async function insertAuditLog(
  caseId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  await db.query(
    `INSERT INTO audit_logs (case_id, event_type, payload) VALUES ($1, $2, $3)`,
    [caseId, eventType, JSON.stringify(payload)]
  );
}

export async function getAuditLogs(
  caseId: string
): Promise<{ id: number; eventType: string; payload: unknown; createdAt: string }[]> {
  const { rows } = await db.query(
    `SELECT id, event_type, payload, created_at FROM audit_logs WHERE case_id = $1 ORDER BY id`,
    [caseId]
  );
  return rows.map((r) => ({
    id: Number(r.id),
    eventType: r.event_type,
    payload: r.payload,
    createdAt: r.created_at,
  }));
}

// ── v2: Signals ───────────────────────────────────────────────────────────────

export async function insertSignal(signal: {
  caseId: string;
  module: string;
  signalName: string;
  description?: string;
  severity: string;
  direction: string;
  contributionScore: number;
  evidence?: Record<string, unknown>;
  generatedBy?: string;
}): Promise<void> {
  await db.query(
    `INSERT INTO signals
       (case_id, module, signal_name, description, severity, direction,
        contribution_score, evidence, generated_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      signal.caseId,
      signal.module,
      signal.signalName,
      signal.description ?? null,
      signal.severity,
      signal.direction,
      signal.contributionScore,
      JSON.stringify(signal.evidence ?? {}),
      signal.generatedBy ?? "system",
    ]
  );
}

// ── v2: Timeline events ───────────────────────────────────────────────────────

export async function insertTimelineEvent(event: {
  caseId: string;
  eventType: string;
  module?: string;
  actorType?: string;
  title: string;
  description?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await db.query(
    `INSERT INTO timeline_events
       (case_id, event_type, module, actor_type, title, description, payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      event.caseId,
      event.eventType,
      event.module ?? null,
      event.actorType ?? "system",
      event.title,
      event.description ?? null,
      JSON.stringify(event.payload ?? {}),
    ]
  );
}

export async function getTimelineEvents(
  caseId: string
): Promise<Array<{ id: string; eventType: string; actorType: string; title: string; description?: string; payload: unknown; createdAt: string }>> {
  const { rows } = await db.query(
    `SELECT id, event_type, actor_type, title, description, payload, created_at
     FROM timeline_events WHERE case_id = $1 ORDER BY created_at ASC`,
    [caseId]
  );
  return rows.map((r) => ({
    id: r.id as string,
    eventType: r.event_type as string,
    actorType: r.actor_type as string,
    title: r.title as string,
    description: r.description as string | undefined,
    payload: r.payload,
    createdAt: r.created_at as string,
  }));
}

// ── v2: Analyst actions ───────────────────────────────────────────────────────

export async function insertAnalystAction(action: {
  caseId: string;
  actionType: string;
  note?: string;
  performedByUserId?: string;
}): Promise<void> {
  await db.query(
    `INSERT INTO analyst_actions (case_id, action_type, note, performed_by_user_id)
     VALUES ($1,$2,$3,$4)`,
    [
      action.caseId,
      action.actionType,
      action.note ?? null,
      action.performedByUserId ?? null,
    ]
  );
}

// ── v2: Structured audit log ──────────────────────────────────────────────────

export async function insertAuditLogV2(entry: {
  caseId?: string;
  entityId?: string;
  documentId?: string;
  actorType: string;
  module?: string;
  action: string;
  inputSummary?: Record<string, unknown>;
  outputSummary?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.query(
    `INSERT INTO audit_logs
       (case_id, entity_id, document_id, actor_type, module, action,
        input_summary, output_summary, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      entry.caseId ?? null,
      entry.entityId ?? null,
      entry.documentId ?? null,
      entry.actorType,
      entry.module ?? null,
      entry.action,
      entry.inputSummary ? JSON.stringify(entry.inputSummary) : null,
      entry.outputSummary ? JSON.stringify(entry.outputSummary) : null,
      JSON.stringify(entry.metadata ?? {}),
    ]
  );
}
