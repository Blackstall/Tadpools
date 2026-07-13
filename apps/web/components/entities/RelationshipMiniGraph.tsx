"use client";

import { useMemo } from "react";
import type { Entity, EntityRelationship } from "@tadpools/shared/index";

interface Props {
  entity: Entity;
  relationships: (EntityRelationship & { otherEntity: Entity })[];
}

const TYPE_COLOR: Record<string, string> = {
  company:      "var(--accent)",
  beneficiary:  "var(--medium)",
  bank:         "var(--low)",
  bank_account: "var(--low)",
  person:       "var(--muted)",
  document:     "var(--muted)",
};

const W = 320;
const H = 220;
const CX = W / 2;
const CY = H / 2;
const R_ORBIT = 80;
const NODE_R = 20;

function truncate(s: string, max = 12) {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

export default function RelationshipMiniGraph({ entity, relationships }: Props) {
  const nodes = useMemo(() => {
    const others = relationships.map((rel, i) => {
      const angle = (2 * Math.PI * i) / Math.max(relationships.length, 1) - Math.PI / 2;
      return {
        id: rel.otherEntity.id,
        label: truncate(rel.otherEntity.canonicalName),
        type: rel.otherEntity.entityType,
        relType: rel.relationshipType,
        x: CX + R_ORBIT * Math.cos(angle),
        y: CY + R_ORBIT * Math.sin(angle),
      };
    });
    return others;
  }, [relationships]);

  if (relationships.length === 0) return null;

  return (
    <div className="entity-section">
      <div className="entity-section-title">Relationship Graph</div>
      <svg
        width={W}
        height={H}
        style={{ display: "block", margin: "0 auto", overflow: "visible" }}
        viewBox={`0 0 ${W} ${H}`}
      >
        {/* Edges */}
        {nodes.map(n => (
          <line
            key={n.id}
            x1={CX} y1={CY}
            x2={n.x} y2={n.y}
            stroke="var(--border)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        ))}

        {/* Satellite nodes */}
        {nodes.map(n => (
          <g key={n.id}>
            <circle
              cx={n.x}
              cy={n.y}
              r={NODE_R}
              fill="var(--panel)"
              stroke={TYPE_COLOR[n.type] ?? "var(--muted)"}
              strokeWidth={2}
            />
            <text
              x={n.x}
              y={n.y + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={7}
              fill="var(--text)"
            >
              {n.label}
            </text>
            <text
              x={n.x}
              y={n.y + NODE_R + 10}
              textAnchor="middle"
              fontSize={7}
              fill="var(--muted)"
            >
              {n.relType}
            </text>
          </g>
        ))}

        {/* Center node */}
        <circle
          cx={CX} cy={CY}
          r={NODE_R + 4}
          fill="var(--accent)"
          opacity={0.15}
        />
        <circle
          cx={CX} cy={CY}
          r={NODE_R}
          fill="var(--panel)"
          stroke="var(--accent)"
          strokeWidth={2.5}
        />
        <text
          x={CX}
          y={CY + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={7}
          fill="var(--text)"
          fontWeight="600"
        >
          {truncate(entity.canonicalName)}
        </text>
      </svg>
    </div>
  );
}
