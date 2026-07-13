import { createHash } from "crypto";
import { minio, TEMP_BUCKET } from "./minioClient.js";
import { db } from "../db/pool.js";
import { insertAuditLog } from "../db/caseRepository.js";

export interface UploadResult {
  fileRef: string;   // storage key (object name in MinIO)
  sha256: string;    // hash for audit trail
  filename: string;
  sizeBytes: number;
  mimeType: string;
}

/**
 * Streams the file buffer into MinIO under a temp key and records
 * an audit event. Does NOT write to the DB files table — raw file
 * references are ephemeral and must be deleted after extraction.
 */
export async function uploadTemp(
  caseId: string,
  filename: string,
  mimeType: string,
  buffer: Buffer
): Promise<UploadResult> {
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  // key: temp/<caseId>/<sha256-prefix>-<filename>
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileRef = `temp/${caseId}/${sha256.slice(0, 8)}-${safeFilename}`;

  await minio.putObject(TEMP_BUCKET, fileRef, buffer, buffer.length, {
    "Content-Type": mimeType,
    "x-amz-meta-case-id": caseId,
    "x-amz-meta-sha256": sha256,
  });

  await insertAuditLog(caseId, "file.uploaded", {
    fileRef,
    filename,
    sizeBytes: buffer.length,
    sha256,
  });

  return { fileRef, sha256, filename, sizeBytes: buffer.length, mimeType };
}

/**
 * Deletes a single temp object. Called after extraction is complete.
 */
export async function deleteTempFile(fileRef: string): Promise<void> {
  await minio.removeObject(TEMP_BUCKET, fileRef);
}

/**
 * Deletes all temp objects for a case. Called at cleanup phase.
 */
export async function deleteTempFilesForCase(caseId: string): Promise<void> {
  const prefix = `temp/${caseId}/`;
  const objects: string[] = [];

  await new Promise<void>((resolve, reject) => {
    const stream = minio.listObjects(TEMP_BUCKET, prefix, true);
    stream.on("data", (obj) => { if (obj.name) objects.push(obj.name); });
    stream.on("end", resolve);
    stream.on("error", reject);
  });

  if (objects.length === 0) return;

  await Promise.all(objects.map((key) => minio.removeObject(TEMP_BUCKET, key)));
  await db.query(
    `INSERT INTO audit_logs (case_id, event_type, payload) VALUES ($1, $2, $3)`,
    [caseId, "file.cleanup", JSON.stringify({ deletedCount: objects.length })]
  );
}
