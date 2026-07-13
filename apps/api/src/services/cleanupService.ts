/**
 * Cleanup Service — Phase 3, Step 12
 *
 * After all processing is complete:
 * - Delete any remaining raw temp files from MinIO (should already be gone after extraction)
 * - Verify only structured data remains
 * - Store file hash references in audit log (already done at upload time)
 * - Mark case as "archived"
 *
 * This is idempotent — safe to call multiple times.
 */

import { minio, TEMP_BUCKET } from "../storage/minioClient.js";
import { db } from "../db/pool.js";
import { insertAuditLog } from "../db/caseRepository.js";

export interface CleanupResult {
  caseId: string;
  tempFilesDeleted: number;
  rawFilesAlreadyClean: boolean;
  structuredDataRetained: {
    extractedFields: number;
    agentFindings: number;
    auditEvents: number;
    riskSignals: number;
    decision: boolean;
  };
  fileHashesInAudit: string[];
  caseStatus: string;
}

export async function cleanupCase(caseId: string): Promise<CleanupResult> {
  // 1. Scan MinIO for any remaining temp files for this case
  const prefix = `temp/${caseId}/`;
  const remainingObjects: string[] = [];

  await new Promise<void>((resolve, reject) => {
    const stream = minio.listObjects(TEMP_BUCKET, prefix, true);
    stream.on("data", (obj) => { if (obj.name) remainingObjects.push(obj.name); });
    stream.on("end", resolve);
    stream.on("error", reject);
  });

  // 2. Delete any remaining temp files
  if (remainingObjects.length > 0) {
    await Promise.all(remainingObjects.map((key) => minio.removeObject(TEMP_BUCKET, key)));
    await insertAuditLog(caseId, "cleanup.temp_files_deleted", {
      deletedCount: remainingObjects.length,
      keys: remainingObjects,
    });
  }

  // 3. Count structured data that is retained
  const [fieldsRes, findingsRes, auditRes, signalsRes, decisionRes] = await Promise.all([
    db.query(`SELECT COUNT(*) FROM extracted_fields WHERE case_id = $1`, [caseId]),
    db.query(`SELECT COUNT(*) FROM agent_findings  WHERE case_id = $1`, [caseId]),
    db.query(`SELECT COUNT(*) FROM audit_logs       WHERE case_id = $1`, [caseId]),
    db.query(`SELECT COUNT(*) FROM risk_signals     WHERE case_id = $1`, [caseId]),
    db.query(`SELECT id FROM decisions              WHERE case_id = $1`, [caseId]),
  ]);

  // 4. Retrieve file hashes stored at upload time (from audit logs)
  const { rows: hashRows } = await db.query<{ payload: { sha256?: string } }>(
    `SELECT payload FROM audit_logs
     WHERE case_id = $1 AND event_type = 'file.uploaded'`,
    [caseId]
  );
  const fileHashes = hashRows
    .map((r) => r.payload?.sha256)
    .filter((h): h is string => Boolean(h));

  // 5. Mark case as archived
  await db.query(
    `UPDATE cases SET status = 'archived', updated_at = NOW() WHERE id = $1`,
    [caseId]
  );

  await insertAuditLog(caseId, "case.cleanup", {
    tempFilesDeleted: remainingObjects.length,
    rawFilesAlreadyClean: remainingObjects.length === 0,
    fileHashesRetained: fileHashes,
    structuredDataRetained: {
      extractedFields: Number(fieldsRes.rows[0].count),
      agentFindings:   Number(findingsRes.rows[0].count),
      auditEvents:     Number(auditRes.rows[0].count),
      riskSignals:     Number(signalsRes.rows[0].count),
      decision:        decisionRes.rows.length > 0,
    },
    archivedAt: new Date().toISOString(),
  });

  return {
    caseId,
    tempFilesDeleted: remainingObjects.length,
    rawFilesAlreadyClean: remainingObjects.length === 0,
    structuredDataRetained: {
      extractedFields: Number(fieldsRes.rows[0].count),
      agentFindings:   Number(findingsRes.rows[0].count),
      auditEvents:     Number(auditRes.rows[0].count),
      riskSignals:     Number(signalsRes.rows[0].count),
      decision:        decisionRes.rows.length > 0,
    },
    fileHashesInAudit: fileHashes,
    caseStatus: "archived",
  };
}
