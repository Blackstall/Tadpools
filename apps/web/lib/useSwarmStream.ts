"use client";

import { useState, useRef, useCallback } from "react";
import type {
  SwarmState, SwarmEvent, AgentFinding, AgentState, ChatBubble,
  RiskLevel, DocRecord, DocType, TimelineEvent, TimelineSeverity,
} from "./types";
import { RISK_TO_STATE, AGENT_DEFS } from "./types";
import { v4 as uuid } from "uuid";

const API = "http://localhost:4000";

const INITIAL_STATE: SwarmState = {
  caseId:      null,
  phase:       "idle",
  agentStates: {},
  findings:    [],
  decision:    null,
  chatBubbles: [],
  docs:        [],
  error:       null,
  timeline:    [],
  startedAt:   null,
};

function fmtElapsed(ms: number): string {
  const secs = Math.floor(ms / 1000);
  const mins = Math.floor(secs / 60);
  return `${String(mins).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
}

function agentShortLabel(agentId: string): string {
  return AGENT_DEFS.find((d) => d.id === agentId)?.shortLabel ?? agentId.replace("Agent", "");
}

export function useSwarmStream() {
  const [state, setState] = useState<SwarmState>(INITIAL_STATE);
  const esRef        = useRef<EventSource | null>(null);
  const startedAtRef = useRef<number | null>(null);

  // ── Timeline helper ───────────────────────────────────────────────────────
  const addTimeline = useCallback((type: string, message: string, severity: TimelineSeverity) => {
    const elapsed = startedAtRef.current !== null ? Date.now() - startedAtRef.current : 0;
    const event: TimelineEvent = { id: uuid(), time: fmtElapsed(elapsed), elapsed, type, message, severity };
    setState((prev) => ({ ...prev, timeline: [...prev.timeline, event] }));
  }, []);

  // ── Chat bubble helper ────────────────────────────────────────────────────
  const addBubble = useCallback((
    agent: string, text: string, riskLevel: RiskLevel | "neutral"
  ) => {
    const bubble: ChatBubble = {
      id: uuid(),
      agent,
      text: text.length > 80 ? text.slice(0, 77) + "…" : text,
      riskLevel,
      createdAt: Date.now(),
    };
    setState((prev) => ({
      ...prev,
      chatBubbles: [...prev.chatBubbles.slice(-11), bubble],
    }));
    setTimeout(() => {
      setState((prev) => ({
        ...prev,
        chatBubbles: prev.chatBubbles.filter((b) => b.id !== bubble.id),
      }));
    }, 4500);
  }, []);

  // ── SSE event handler ─────────────────────────────────────────────────────
  const handleEvent = useCallback((event: SwarmEvent) => {
    setState((prev) => {
      const next = { ...prev };

      switch (event.type) {
        case "agent.started":
          if (event.agent) {
            next.agentStates = { ...prev.agentStates, [event.agent]: "analyzing" };
          }
          break;

        case "agent.complete":
          if (event.agent && event.riskLevel) {
            const baseState = RISK_TO_STATE[event.riskLevel as RiskLevel] ?? "done";
            const finalState = event.round === 2 ? "debate" : baseState;
            next.agentStates = { ...prev.agentStates, [event.agent]: finalState };

            const finding: AgentFinding = {
              agent:      event.agent,
              round:      event.round ?? 1,
              riskLevel:  event.riskLevel as RiskLevel,
              confidence: event.confidence ?? 0,
              flags:      event.flags ?? [],
              summary:    event.summary ?? "",
              reasoning:  event.reasoning ?? [],
            };
            next.findings = [...prev.findings, finding];
          }
          break;

        case "synthesis.started":
          if (event.agent) {
            next.agentStates = { ...prev.agentStates, [event.agent]: "analyzing" };
          }
          break;

        case "decision":
          next.decision = {
            status:         (event.status ?? "manual_review") as NonNullable<SwarmState["decision"]>["status"],
            score:          event.score ?? 0,
            triggeredRules: event.triggeredRules ?? [],
          };
          break;

        case "done":
          next.phase = "done";
          next.agentStates = { ...prev.agentStates, ChairAgent: "consensus" };
          break;

        case "error":
          next.phase = "error";
          next.error = event.message ?? "Swarm error";
          break;
      }

      return next;
    });

    // Timeline side-effects
    switch (event.type) {
      case "agent.started":
        if (event.agent) {
          addTimeline("agent.started", `${agentShortLabel(event.agent)} analyzing…`, "info");
        }
        break;
      case "agent.complete":
        if (event.agent) {
          const sev: TimelineSeverity = (event.riskLevel as TimelineSeverity) ?? "info";
          const short = agentShortLabel(event.agent);
          const snippet = event.summary ? (event.summary.length > 60 ? event.summary.slice(0, 57) + "…" : event.summary) : "complete";
          addTimeline("agent.complete", `${short}: ${snippet}`, sev);
        }
        break;
      case "synthesis.started":
        addTimeline("synthesis", "Synthesizing final decision…", "info");
        break;
      case "decision": {
        const decStatus = event.status ?? "manual_review";
        const decSev: TimelineSeverity = decStatus === "reject" ? "high" : decStatus === "approve" ? "low" : "medium";
        addTimeline("decision", `Decision: ${decStatus.toUpperCase().replace("_", " ")} — score ${event.score ?? 0}`, decSev);
        break;
      }
      case "done":
        addTimeline("complete", "Case analysis complete", "info");
        break;
      case "error":
        addTimeline("error", `Error: ${event.message ?? "Swarm error"}`, "high");
        break;
    }

    if (event.type === "agent.complete" && event.agent && event.summary) {
      addBubble(event.agent, event.summary, (event.riskLevel as RiskLevel) ?? "neutral");
    }
  }, [addBubble, addTimeline]);

  // ── Submit case + open SSE stream ─────────────────────────────────────────
  const submitCase = useCallback(async (payload: unknown): Promise<string | null> => {
    const now = Date.now();
    startedAtRef.current = now;
    setState({ ...INITIAL_STATE, phase: "processing", startedAt: now });
    esRef.current?.close();

    try {
      const res = await fetch(`${API}/api/cases`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Request failed");

      const caseId: string = data.caseId;
      setState((prev) => ({ ...prev, caseId }));

      const es = new EventSource(`${API}/api/cases/${caseId}/stream`);
      esRef.current = es;

      es.onmessage = (e) => {
        try {
          const event: SwarmEvent = JSON.parse(e.data);
          handleEvent(event);
        } catch { /* ignore malformed */ }
      };

      es.onerror = () => {
        setState((prev) =>
          prev.phase === "processing"
            ? { ...prev, phase: "error", error: "Stream disconnected" }
            : prev
        );
        es.close();
      };

      return caseId;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        phase: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      }));
      return null;
    }
  }, [handleEvent]);

  // ── Upload files + trigger extraction ─────────────────────────────────────
  const uploadAndExtract = useCallback(async (
    caseId: string,
    files: { file: File; docType: DocType }[]
  ): Promise<void> => {
    if (files.length === 0) return;

    const docRecords: DocRecord[] = files.map((f) => ({
      id:        uuid(),
      filename:  f.file.name,
      docType:   f.docType,
      sizeBytes: f.file.size,
      status:    "uploading",
    }));

    setState((prev) => ({
      ...prev,
      phase: "uploading",
      docs:  docRecords,
    }));
    addTimeline("upload", `Uploading ${files.length} document${files.length !== 1 ? "s" : ""}…`, "info");

    // Upload each file individually
    for (let i = 0; i < files.length; i++) {
      const fd = new FormData();
      fd.append("file", files[i].file);
      try {
        const res = await fetch(`${API}/api/cases/${caseId}/upload`, {
          method: "POST",
          body:   fd,
        });
        if (res.ok) {
          const data = await res.json();
          setState((prev) => ({
            ...prev,
            docs: prev.docs.map((d, idx) =>
              idx === i ? { ...d, status: "uploaded", sha256: data.sha256 } : d
            ),
          }));
        }
      } catch { /* continue */ }
    }

    // Trigger extraction
    setState((prev) => ({
      ...prev,
      phase: "extracting",
      docs:  prev.docs.map((d) => ({ ...d, status: "extracting" })),
    }));
    addTimeline("extract", "Extracting document fields…", "info");

    try {
      const res = await fetch(`${API}/api/cases/${caseId}/extract`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        addTimeline("swarm", "Swarm intelligence activated", "info");
        setState((prev) => ({
          ...prev,
          phase: prev.phase === "done" || prev.phase === "error" ? prev.phase : "processing",
          docs:  prev.docs.map((d, i) => ({
            ...d,
            status:          "ready",
            fieldsExtracted: (data.results?.[i]?.fieldsExtracted as number | undefined) ?? 0,
          })),
        }));
      } else {
        setState((prev) => ({
          ...prev,
          phase: prev.phase === "done" || prev.phase === "error" ? prev.phase : "processing",
        }));
      }
    } catch {
      setState((prev) => ({
        ...prev,
        phase: prev.phase === "done" || prev.phase === "error" ? prev.phase : "processing",
      }));
    }
  }, [addTimeline]);

  // ── Load existing case from API ───────────────────────────────────────────
  const loadCase = useCallback(async (caseId: string): Promise<Record<string, unknown> | null> => {
    esRef.current?.close();
    setState({ ...INITIAL_STATE, caseId, phase: "processing" });

    try {
      const res  = await fetch(`${API}/api/cases/${caseId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json() as {
        caseId:     string;
        status:     string;
        caseInput:  Record<string, unknown> | null;
        decision:   { status: string; score: number; reasons: string[]; findings: AgentFinding[] } | null;
      };

      const phase: SwarmState["phase"] =
        data.status === "decided"                               ? "done"       :
        data.status === "error"                                 ? "error"      :
        data.status === "processing" || data.status === "pending" ? "processing" : "idle";

      const findings = data.decision?.findings ?? [];
      const agentStates: Record<string, AgentState> = {};
      for (const f of findings) {
        agentStates[f.agent] = RISK_TO_STATE[f.riskLevel as RiskLevel] ?? "done";
      }

      const decision: SwarmState["decision"] = data.decision
        ? {
            status:         data.decision.status as NonNullable<SwarmState["decision"]>["status"],
            score:          data.decision.score,
            triggeredRules: data.decision.reasons ?? [],
          }
        : null;

      setState({ ...INITIAL_STATE, caseId, phase, findings, decision, agentStates });

      // Reconnect to live stream if still processing
      if (phase === "processing") {
        startedAtRef.current = Date.now();
        const es = new EventSource(`${API}/api/cases/${caseId}/stream`);
        esRef.current = es;
        es.onmessage = (e) => {
          try { handleEvent(JSON.parse(e.data) as SwarmEvent); } catch { /* ignore */ }
        };
        es.onerror = () => {
          setState((prev) =>
            prev.phase === "processing"
              ? { ...prev, phase: "error", error: "Stream disconnected" }
              : prev
          );
          es.close();
        };
      }

      return data.caseInput;
    } catch (err) {
      setState({ ...INITIAL_STATE, caseId, phase: "error", error: err instanceof Error ? err.message : "Failed to load case" });
      return null;
    }
  }, [handleEvent]);

  const reset = useCallback(() => {
    esRef.current?.close();
    setState(INITIAL_STATE);
  }, []);

  return { state, submitCase, uploadAndExtract, loadCase, reset };
}
