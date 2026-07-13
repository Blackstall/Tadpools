"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "../ui/Badge";
import ScoreBar from "../ui/ScoreBar";
import EmptyState from "../ui/EmptyState";
import type { Entity, EntityRelationship } from "@tadpools/shared/index";

const API = "http://localhost:4000";

interface LinkedCase {
  id: string;
  status: string;
  companyName: string;
  createdAt: string;
}

interface EntityWithRels {
  entity: Entity;
  relationships: (EntityRelationship & { otherEntity: Entity })[];
}

interface Props {
  entityId: string;
}

export default function EntityProfile({ entityId }: Props) {
  const router = useRouter();
  const [data,   setData]   = useState<EntityWithRels | null>(null);
  const [cases,  setCases]  = useState<LinkedCase[]>([]);
  const [error,  setError]  = useState<string | null>(null);

  useEffect(() => {
    setData(null);
    setError(null);
    Promise.all([
      fetch(`${API}/api/entities/${entityId}`).then(r => r.json()),
      fetch(`${API}/api/entities/${entityId}/cases`).then(r => r.json()),
    ])
      .then(([ed, cd]) => {
        setData(ed as EntityWithRels);
        setCases((cd as { cases: LinkedCase[] }).cases ?? []);
      })
      .catch(e => setError(e instanceof Error ? e.message : "Failed to load"));
  }, [entityId]);

  if (error) return <div className="page-error">{error}</div>;
  if (!data)  return <div className="page-loading"><span className="intel-spinner" />Loading…</div>;

  const { entity, relationships } = data;

  return (
    <div className="entities-profile">

      {/* Header */}
      <div className="entity-profile-header">
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div className="entity-profile-name">{entity.canonicalName}</div>
            <div className="entity-profile-meta">
              <span className="entity-profile-meta-item"><strong>Type:</strong> {entity.entityType}</span>
              {entity.registrationNumber && (
                <span className="entity-profile-meta-item"><strong>Reg:</strong> {entity.registrationNumber}</span>
              )}
              {entity.countryCode && (
                <span className="entity-profile-meta-item"><strong>Country:</strong> {entity.countryCode}</span>
              )}
              {entity.firstSeenAt && (
                <span className="entity-profile-meta-item">
                  <strong>First seen:</strong> {new Date(entity.firstSeenAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          <Badge label={entity.entityType} variant="info" />
        </div>
        {entity.riskScore != null && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 6 }}>Risk Score</div>
            <ScoreBar score={entity.riskScore} />
          </div>
        )}
      </div>

      {/* Linked cases */}
      <div className="entity-section">
        <div className="entity-section-title">Linked Cases ({cases.length})</div>
        {cases.length === 0
          ? <EmptyState message="No cases linked to this entity" />
          : cases.map(c => (
            <div key={c.id} className="entity-case-row">
              <span style={{ flex: 1 }}>{c.companyName || c.id.slice(0, 8)}</span>
              <Badge label={c.status} variant={c.status as "approved" | "rejected" | "escalated" | "processing" | "pending"} />
              <span style={{ fontSize: 10, color: "var(--muted)" }}>
                {new Date(c.createdAt).toLocaleDateString()}
              </span>
              <button
                onClick={() => router.push(`/?caseId=${c.id}`)}
                style={{ fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer" }}
              >
                View →
              </button>
            </div>
          ))
        }
      </div>

      {/* Relationships */}
      {relationships.length > 0 && (
        <div className="entity-section">
          <div className="entity-section-title">Relationships ({relationships.length})</div>
          {relationships.map(rel => (
            <div key={rel.id} className="entity-rel-row">
              <span style={{ flex: 1, fontSize: 12 }}>{rel.otherEntity.canonicalName}</span>
              <span className="entity-rel-type">{rel.relationshipType}</span>
              <Badge label={rel.otherEntity.entityType} variant="default" />
            </div>
          ))}
        </div>
      )}

      {/* Metadata */}
      {entity.metadata && Object.keys(entity.metadata).length > 0 && (
        <div className="entity-section">
          <div className="entity-section-title">Metadata</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {Object.entries(entity.metadata).map(([k, v]) => (
                <tr key={k}>
                  <td style={{ fontSize: 11, color: "var(--muted)", padding: "4px 0", width: 140 }}>{k}</td>
                  <td style={{ fontSize: 12, color: "var(--text)", padding: "4px 0" }}>{String(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
