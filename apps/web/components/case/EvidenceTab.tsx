"use client";

import { useEffect, useState } from "react";
import { FileText, Hash } from "lucide-react";
import type { SwarmState } from "../../lib/types";
import ModuleAccordion from "../evidence/ModuleAccordion";
import EmptyState from "../ui/EmptyState";
import type { Signal } from "@tadpools/shared/index";

const API = "http://localhost:4000";

interface Props {
  state:       SwarmState;
  casePayload: Record<string, unknown> | null;
}

interface GroupedSignals {
  [module: string]: Signal[];
}

export function EvidenceTab({ state, casePayload }: Props) {
  const company     = casePayload?.company     as Record<string, string> | undefined;
  const beneficiary = casePayload?.beneficiary as Record<string, string> | undefined;

  const [grouped,  setGrouped]  = useState<GroupedSignals>({});
  const [sigError, setSigError] = useState<string | null>(null);

  useEffect(() => {
    if (!state.caseId) return;
    fetch(`${API}/api/cases/${state.caseId}/signals`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error("Failed to load signals")))
      .then((d: { signals: GroupedSignals }) => setGrouped(d.signals ?? {}))
      .catch((e: unknown) => setSigError(e instanceof Error ? e.message : "Unknown error"));
  }, [state.caseId]);

  const modules = Object.keys(grouped);
  const totalSignals = modules.reduce((n, m) => n + grouped[m].length, 0);

  // Fallback legacy signals from swarm findings
  const legacySignals = state.findings.flatMap(f =>
    f.flags.map(fl => ({ flag: fl, agent: f.agent, riskLevel: f.riskLevel }))
  );
  const uniqueLegacy = Array.from(new Map(legacySignals.map(s => [s.flag, s])).values());

  return (
    <div className="evidence-tab">

      {/* Documents */}
      <div className="evidence-card">
        <div className="card-section-label">
          Uploaded Documents
          {state.docs.length > 0 && <span className="section-label-count">{state.docs.length}</span>}
        </div>
        {state.docs.length === 0 ? (
          <div className="cases-empty">No documents uploaded.</div>
        ) : state.docs.map(doc => (
          <div key={doc.id} className="evidence-doc">
            <div className="evidence-doc-header">
              <FileText size={13} color="var(--muted)" />
              <span className="evidence-doc-name">{doc.filename}</span>
              <span className="evidence-doc-type">{doc.docType}</span>
              <span className={`status-pill status-pill--${doc.status}`}>{doc.status}</span>
            </div>
            <div className="evidence-doc-meta">
              {doc.sha256 && (
                <div className="doc-hash-row">
                  <Hash size={10} color="var(--muted)" />
                  <span className="doc-hash-val">{doc.sha256}</span>
                </div>
              )}
              <div style={{ display: "flex", gap: 12, marginTop: 3 }}>
                {doc.fieldsExtracted !== undefined && doc.fieldsExtracted > 0 && (
                  <span className="doc-fields">
                    {doc.fieldsExtracted} field{doc.fieldsExtracted !== 1 ? "s" : ""} extracted
                  </span>
                )}
                {doc.sizeBytes > 0 && (
                  <span style={{ fontSize: 10, color: "var(--muted)" }}>
                    {(doc.sizeBytes / 1024).toFixed(1)} KB
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* v2 Signals grouped by module */}
      {sigError ? (
        <div className="evidence-card">
          <div className="card-section-label">Signals</div>
          <div className="page-error">{sigError}</div>
        </div>
      ) : modules.length > 0 ? (
        <div className="evidence-card">
          <div className="card-section-label">
            Signals by Module
            <span className="section-label-count">{totalSignals}</span>
          </div>
          {modules.map(mod => (
            <ModuleAccordion key={mod} module={mod} signals={grouped[mod]} />
          ))}
        </div>
      ) : uniqueLegacy.length > 0 ? (
        /* Fallback: legacy swarm signals */
        <div className="evidence-card">
          <div className="card-section-label">
            Risk Signals
            <span className="section-label-count">{uniqueLegacy.length}</span>
          </div>
          <div className="evidence-signals">
            {uniqueLegacy.map((s, i) => (
              <div key={i} className="evidence-signal-row">
                <span className={`risk-sig risk-sig--${s.riskLevel}`}>{s.flag}</span>
                <span className="evidence-signal-source">{s.agent.replace("Agent", "")}</span>
              </div>
            ))}
          </div>
        </div>
      ) : state.caseId ? (
        <div className="evidence-card">
          <div className="card-section-label">Signals</div>
          <EmptyState message="No signals recorded yet" />
        </div>
      ) : null}

      {/* Company details */}
      {company && (
        <div className="evidence-card">
          <div className="card-section-label">Company Details</div>
          <table className="evidence-table">
            <tbody>
              {([
                ["Company Name",  company.companyName],
                ["Reg. Number",   company.registrationNumber],
                ["Reg. Date",     company.registrationDate],
                ["Nature of Biz", company.natureOfBusiness],
              ] as [string, string][]).filter(([, v]) => v).map(([k, v]) => (
                <tr key={k}>
                  <td className="evidence-key">{k}</td>
                  <td className="evidence-val">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Beneficiary details */}
      {beneficiary && (
        <div className="evidence-card">
          <div className="card-section-label">Beneficiary Details</div>
          <table className="evidence-table">
            <tbody>
              {([
                ["Name",    beneficiary.beneficiaryName],
                ["Bank",    beneficiary.bankName],
                ["Account", beneficiary.accountNumber
                  ? `****${beneficiary.accountNumber.slice(-4)}`
                  : ""],
              ] as [string, string][]).filter(([, v]) => v).map(([k, v]) => (
                <tr key={k}>
                  <td className="evidence-key">{k}</td>
                  <td className="evidence-val">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
