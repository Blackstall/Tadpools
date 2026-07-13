import { insertAuditLog, getAuditLogs } from "../db/caseRepository.js";

export async function logAudit(
  caseId: string,
  type: string,
  payload: Record<string, unknown>
): Promise<void> {
  await insertAuditLog(caseId, type, payload);
}

export async function listAudit(caseId: string) {
  return getAuditLogs(caseId);
}
