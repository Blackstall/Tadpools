export interface AuditEvent {
  caseId: string;
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}
