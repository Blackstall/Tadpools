import { EventEmitter } from "node:events";

/**
 * Central in-process event bus for swarm activity.
 * The SSE route subscribes per-case; the swarm service emits here.
 */
export const swarmBus = new EventEmitter();
swarmBus.setMaxListeners(500);

export interface SwarmEvent {
  type:
    | "agent.started"
    | "agent.complete"
    | "round.complete"
    | "challenge.started"
    | "synthesis.started"
    | "decision"
    | "error"
    | "done";
  caseId: string;
  agent?: string;
  round?: number;
  riskLevel?: string;
  confidence?: number;
  flags?: string[];
  summary?: string;
  reasoning?: string[];
  highRisk?: number;
  mediumRisk?: number;
  status?: string;
  score?: number;
  triggeredRules?: string[];
  message?: string;
}

export function emitSwarm(event: SwarmEvent): void {
  swarmBus.emit(`case:${event.caseId}`, event);
}
