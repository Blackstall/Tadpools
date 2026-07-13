"use client";

import { useState, useRef, useCallback } from "react";
import type { DocType } from "../lib/types";
import { DOC_TYPE_OPTIONS } from "../lib/types";

interface FileEntry {
  id: string;
  file: File;
  docType: DocType;
}

interface Props {
  onSubmit: (payload: unknown, files: { file: File; docType: DocType }[]) => Promise<void>;
}

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

function fmtSize(bytes: number): string {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1_048_576)  return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

export function IntakeForm({ onSubmit }: Props) {
  const [loading,   setLoading]   = useState(false);
  const [files,     setFiles]     = useState<FileEntry[]>([]);
  const [dragOver,  setDragOver]  = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: FileList | null) => {
    if (!incoming) return;
    const entries: FileEntry[] = [];
    for (const f of Array.from(incoming)) {
      if (ALLOWED_TYPES.includes(f.type) && f.size <= 20 * 1024 * 1024) {
        entries.push({
          id:      crypto.randomUUID(),
          file:    f,
          docType: "other",
        });
      }
    }
    setFiles((prev) => [...prev, ...entries]);
  }, []);

  const removeFile = (id: string) =>
    setFiles((prev) => prev.filter((f) => f.id !== id));

  const setDocType = (id: string, docType: DocType) =>
    setFiles((prev) => prev.map((f) => f.id === id ? { ...f, docType } : f));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    const payload = {
      company: {
        companyName:        fd.get("companyName")?.toString()        ?? "",
        registrationNumber: fd.get("registrationNumber")?.toString() ?? "",
        registrationDate:   fd.get("registrationDate")?.toString()   ?? "",
        natureOfBusiness:   fd.get("natureOfBusiness")?.toString()   ?? "",
      },
      beneficiary: {
        beneficiaryName:  fd.get("beneficiaryName")?.toString()  ?? "",
        accountNumber:    fd.get("accountNumber")?.toString()    ?? "",
        bankName:         fd.get("bankName")?.toString()         ?? "",
        natureOfBusiness: fd.get("beneficiaryNature")?.toString() || undefined,
      },
      documents: files.map((f) => ({
        id:       f.id,
        type:     f.docType,
        filename: f.file.name,
      })),
      consentAccepted: true,
    };

    setLoading(true);
    try {
      await onSubmit(payload, files.map((f) => ({ file: f.file, docType: f.docType })));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="intake-form">
      {/* ── Company ───────────────────────────────────────────────────────── */}
      <div className="intake-section">
        <div className="intake-section-label">Company</div>
        <div className="intake-grid">
          <input
            className="input"
            name="companyName"
            placeholder="Company name *"
            required
            disabled={loading}
          />
          <input
            className="input"
            name="registrationNumber"
            placeholder="Registration number *"
            required
            disabled={loading}
          />
          <input
            className="input"
            name="registrationDate"
            type="date"
            required
            disabled={loading}
          />
          <input
            className="input"
            name="natureOfBusiness"
            placeholder="Nature of business *"
            required
            disabled={loading}
          />
        </div>
      </div>

      {/* ── Beneficiary ───────────────────────────────────────────────────── */}
      <div className="intake-section">
        <div className="intake-section-label">Beneficiary</div>
        <div className="intake-grid">
          <input
            className="input"
            name="beneficiaryName"
            placeholder="Beneficiary name *"
            required
            disabled={loading}
          />
          <input
            className="input"
            name="accountNumber"
            placeholder="Bank account number *"
            required
            disabled={loading}
          />
          <input
            className="input"
            name="bankName"
            placeholder="Bank name *"
            required
            disabled={loading}
          />
          <input
            className="input"
            name="beneficiaryNature"
            placeholder="Beneficiary sector (optional)"
            disabled={loading}
          />
        </div>
      </div>

      {/* ── Documents ─────────────────────────────────────────────────────── */}
      <div className="intake-section">
        <div className="intake-section-label">Supporting Documents</div>

        <div
          className={`drop-zone${dragOver ? " drop-zone--active" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            addFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            style={{ display: "none" }}
            onChange={(e) => addFiles(e.target.files)}
          />
          <span className="drop-icon">↑</span>
          <span className="drop-text">Drop files here or <u>browse</u></span>
          <span className="drop-sub">PDF · JPG · PNG · WEBP — max 20 MB each</span>
        </div>

        {files.length > 0 && (
          <div className="file-list">
            {files.map((f) => (
              <div key={f.id} className="file-entry">
                <div className="file-info">
                  <span className="file-name">{f.file.name}</span>
                  <span className="file-size">{fmtSize(f.file.size)}</span>
                </div>
                <select
                  className="input file-type-select"
                  value={f.docType}
                  onChange={(e) => setDocType(f.id, e.target.value as DocType)}
                >
                  {DOC_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="file-remove"
                  onClick={() => removeFile(f.id)}
                  title="Remove file"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="privacy-notice">
          Documents are processed temporarily for verification. Original files are deleted
          after extraction. Only a secure file fingerprint and structured verification data
          are retained.
        </div>
      </div>

      <button className="submit-btn" type="submit" disabled={loading}>
        {loading ? "Activating swarm…" : "Run Tadpools →"}
      </button>
    </form>
  );
}
