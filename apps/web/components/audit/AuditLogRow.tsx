"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Badge from "../ui/Badge";
import type { AuditLog, ActorType } from "@tadpools/shared/index";

interface Props {
  log: AuditLog;
}

const ACTOR_VARIANT: Record<ActorType, "info" | "default" | "escalated"> = {
  system:  "default",
  agent:   "info",
  analyst: "escalated",
  admin:   "escalated",
};

function timeStr(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

export default function AuditLogRow({ log }: Props) {
  const [expanded, setExpanded] = useState(false);
  const router = useRouter();

  const hasPayload = (log.inputSummary && Object.keys(log.inputSummary).length > 0)
    || (log.outputSummary && Object.keys(log.outputSummary).length > 0)
    || (log.metadata && Object.keys(log.metadata).length > 0);

  return (
    <>
      <div className="audit-log-row">
        <span className="audit-log-time">{timeStr(log.createdAt)}</span>
        <Badge label={log.actorType} variant={ACTOR_VARIANT[log.actorType] ?? "default"} />
        <span className="audit-log-module">{log.module ?? "—"}</span>
        <span className="audit-log-action">{log.action}</span>
        <span className="audit-log-case">
          {log.caseId
            ? (
              <button
                className="audit-case-link"
                onClick={() => router.push(`/?caseId=${log.caseId}`)}
              >
                {log.caseId.slice(0, 8)}…
              </button>
            )
            : "—"
          }
        </span>
        <button
          className="audit-expand-btn"
          onClick={() => setExpanded(e => !e)}
          disabled={!hasPayload}
          title={hasPayload ? "Expand payload" : "No payload"}
        >
          {expanded ? "▲" : "▼"}
        </button>
      </div>
      {expanded && hasPayload && (
        <div className="audit-log-payload">
          {log.inputSummary && Object.keys(log.inputSummary).length > 0 && (
            <div>
              <span style={{ color: "var(--muted)", fontSize: 10, marginRight: 6 }}>IN</span>
              {JSON.stringify(log.inputSummary, null, 2)}
            </div>
          )}
          {log.outputSummary && Object.keys(log.outputSummary).length > 0 && (
            <div style={{ marginTop: 6 }}>
              <span style={{ color: "var(--muted)", fontSize: 10, marginRight: 6 }}>OUT</span>
              {JSON.stringify(log.outputSummary, null, 2)}
            </div>
          )}
          {log.metadata && Object.keys(log.metadata).length > 0 && (
            <div style={{ marginTop: 6 }}>
              <span style={{ color: "var(--muted)", fontSize: 10, marginRight: 6 }}>META</span>
              {JSON.stringify(log.metadata, null, 2)}
            </div>
          )}
        </div>
      )}
    </>
  );
}
