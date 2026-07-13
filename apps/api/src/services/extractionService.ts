/**
 * Extraction Pipeline (Phase 1 — mock implementation)
 *
 * Reads each temp file for a case from MinIO, runs a document-type-aware
 * mock extractor to produce structured fields, persists them to
 * extracted_fields, then deletes the raw file (no permanent storage).
 *
 * Real OCR / LLM extraction is wired in Phase 5 (Model Integration).
 */

import { minio, TEMP_BUCKET } from "../storage/minioClient.js";
import { deleteTempFilesForCase } from "../storage/uploadService.js";
import { db } from "../db/pool.js";
import { insertAuditLog } from "../db/caseRepository.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExtractedField {
  fieldName: string;
  value: string;
  source: "mock" | "ocr" | "llm";
}

export interface ExtractionResult {
  docId: string;
  filename: string;
  docType: string;
  fields: ExtractedField[];
}

// ─── Per-type mock extractors ─────────────────────────────────────────────────

type DocType = "invoice" | "agreement" | "payment_voucher" | "spa" | "tenancy" | "other";

function detectDocType(filename: string, mimeType: string): DocType {
  const lower = filename.toLowerCase();
  if (lower.includes("invoice")) return "invoice";
  if (lower.includes("agreement") || lower.includes("agmt")) return "agreement";
  if (lower.includes("voucher") || lower.includes("payment")) return "payment_voucher";
  if (lower.includes("spa") || lower.includes("sale")) return "spa";
  if (lower.includes("tenancy") || lower.includes("lease")) return "tenancy";
  return "other";
}

function mockExtract(docType: DocType, filename: string): ExtractedField[] {
  const base: ExtractedField[] = [
    { fieldName: "document_type", value: docType, source: "mock" },
    { fieldName: "original_filename", value: filename, source: "mock" },
    { fieldName: "extraction_mode", value: "mock", source: "mock" },
  ];

  switch (docType) {
    case "invoice":
      return [
        ...base,
        { fieldName: "invoice_number", value: "INV-MOCK-0001", source: "mock" },
        { fieldName: "invoice_date", value: new Date().toISOString().slice(0, 10), source: "mock" },
        { fieldName: "issuer_name", value: "[EXTRACTED_FROM_DOC]", source: "mock" },
        { fieldName: "buyer_name", value: "[EXTRACTED_FROM_DOC]", source: "mock" },
        { fieldName: "total_amount", value: "[EXTRACTED_FROM_DOC]", source: "mock" },
        { fieldName: "currency", value: "MYR", source: "mock" },
        { fieldName: "goods_description", value: "[EXTRACTED_FROM_DOC]", source: "mock" },
        { fieldName: "bank_account", value: "[EXTRACTED_FROM_DOC]", source: "mock" },
      ];

    case "agreement":
      return [
        ...base,
        { fieldName: "agreement_date", value: "[EXTRACTED_FROM_DOC]", source: "mock" },
        { fieldName: "party_a", value: "[EXTRACTED_FROM_DOC]", source: "mock" },
        { fieldName: "party_b", value: "[EXTRACTED_FROM_DOC]", source: "mock" },
        { fieldName: "agreement_value", value: "[EXTRACTED_FROM_DOC]", source: "mock" },
        { fieldName: "payment_terms", value: "[EXTRACTED_FROM_DOC]", source: "mock" },
        { fieldName: "governing_law", value: "[EXTRACTED_FROM_DOC]", source: "mock" },
      ];

    case "payment_voucher":
      return [
        ...base,
        { fieldName: "voucher_number", value: "PV-MOCK-0001", source: "mock" },
        { fieldName: "payment_date", value: new Date().toISOString().slice(0, 10), source: "mock" },
        { fieldName: "payee_name", value: "[EXTRACTED_FROM_DOC]", source: "mock" },
        { fieldName: "payee_bank", value: "[EXTRACTED_FROM_DOC]", source: "mock" },
        { fieldName: "payee_account", value: "[EXTRACTED_FROM_DOC]", source: "mock" },
        { fieldName: "amount", value: "[EXTRACTED_FROM_DOC]", source: "mock" },
        { fieldName: "purpose", value: "[EXTRACTED_FROM_DOC]", source: "mock" },
        { fieldName: "authorised_by", value: "[EXTRACTED_FROM_DOC]", source: "mock" },
      ];

    case "spa":
      return [
        ...base,
        { fieldName: "spa_date", value: "[EXTRACTED_FROM_DOC]", source: "mock" },
        { fieldName: "vendor_name", value: "[EXTRACTED_FROM_DOC]", source: "mock" },
        { fieldName: "purchaser_name", value: "[EXTRACTED_FROM_DOC]", source: "mock" },
        { fieldName: "property_address", value: "[EXTRACTED_FROM_DOC]", source: "mock" },
        { fieldName: "sale_price", value: "[EXTRACTED_FROM_DOC]", source: "mock" },
        { fieldName: "completion_date", value: "[EXTRACTED_FROM_DOC]", source: "mock" },
      ];

    case "tenancy":
      return [
        ...base,
        { fieldName: "tenancy_start", value: "[EXTRACTED_FROM_DOC]", source: "mock" },
        { fieldName: "tenancy_end", value: "[EXTRACTED_FROM_DOC]", source: "mock" },
        { fieldName: "landlord_name", value: "[EXTRACTED_FROM_DOC]", source: "mock" },
        { fieldName: "tenant_name", value: "[EXTRACTED_FROM_DOC]", source: "mock" },
        { fieldName: "monthly_rent", value: "[EXTRACTED_FROM_DOC]", source: "mock" },
        { fieldName: "property_address", value: "[EXTRACTED_FROM_DOC]", source: "mock" },
      ];

    default:
      return [
        ...base,
        { fieldName: "content_summary", value: "Document type unrecognized — manual review required.", source: "mock" },
      ];
  }
}

// ─── DB persistence ───────────────────────────────────────────────────────────

async function persistFields(
  caseId: string,
  docId: string,
  fields: ExtractedField[]
): Promise<void> {
  if (fields.length === 0) return;

  const params: unknown[] = [];
  const valueClauses = fields.map((f, i) => {
    const base = i * 4;
    params.push(caseId, docId, f.fieldName, f.value);
    return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
  });

  await db.query(
    `INSERT INTO extracted_fields (case_id, doc_id, field_name, value)
     VALUES ${valueClauses.join(", ")}`,
    params
  );
}

// ─── Main extraction runner ───────────────────────────────────────────────────

/**
 * Lists all temp objects for a case, extracts fields from each,
 * persists to DB, then deletes the raw files.
 */
export async function extractCaseDocuments(caseId: string): Promise<ExtractionResult[]> {
  const prefix = `temp/${caseId}/`;
  const objects: { name: string; size: number }[] = [];

  // List all temp objects for this case
  await new Promise<void>((resolve, reject) => {
    const stream = minio.listObjects(TEMP_BUCKET, prefix, true);
    stream.on("data", (obj) => {
      if (obj.name) objects.push({ name: obj.name, size: obj.size ?? 0 });
    });
    stream.on("end", resolve);
    stream.on("error", reject);
  });

  if (objects.length === 0) {
    await insertAuditLog(caseId, "extraction.skipped", { reason: "no_temp_files" });
    return [];
  }

  const results: ExtractionResult[] = [];

  for (const obj of objects) {
    // Derive filename from object key: temp/<caseId>/<sha8>-<filename>
    const keyParts = obj.name.split("/");
    const rawFilename = keyParts[keyParts.length - 1];
    // strip the sha8- prefix
    const filename = rawFilename.replace(/^[0-9a-f]{8}-/, "");

    // Get object metadata to determine MIME type
    const stat = await minio.statObject(TEMP_BUCKET, obj.name);
    const mimeType = (stat.metaData?.["content-type"] as string) ?? "application/octet-stream";

    const docType = detectDocType(filename, mimeType);
    const docId = obj.name; // use the full object key as the doc identifier

    const fields = mockExtract(docType, filename);
    await persistFields(caseId, docId, fields);

    results.push({ docId, filename, docType, fields });

    await insertAuditLog(caseId, "extraction.doc.complete", {
      docId,
      filename,
      docType,
      fieldCount: fields.length,
      mode: "mock",
    });
  }

  // Delete all raw temp files — only structured data is kept
  await deleteTempFilesForCase(caseId);
  await insertAuditLog(caseId, "extraction.complete", {
    docCount: results.length,
    totalFields: results.reduce((s, r) => s + r.fields.length, 0),
  });

  return results;
}
