import type { AgentFinding } from "@tadpools/shared/index";

export interface MemoryEvent {
  agent: string;
  round: number;
  timestamp: number;
}

/**
 * SharedMemory — in-memory, per-swarm-run store.
 *
 * Agents publish their findings here as they complete.
 * Other agents can read all published findings at any time,
 * enabling emergent interaction within a round.
 *
 * Phase 5 upgrade: replace with DB-backed store.
 */
export class SharedMemory {
  private findings = new Map<string, AgentFinding>();
  private timeline: MemoryEvent[] = [];

  /** Called by an agent after it computes its finding. */
  publish(finding: AgentFinding): void {
    this.findings.set(finding.agent, finding);
    this.timeline.push({
      agent: finding.agent,
      round: finding.round,
      timestamp: Date.now(),
    });
  }

  /** Read all published findings, optionally excluding the caller's own. */
  readAll(excludeAgent?: string): AgentFinding[] {
    const all = [...this.findings.values()];
    return excludeAgent ? all.filter((f) => f.agent !== excludeAgent) : all;
  }

  /** Read findings from a specific round. */
  readRound(round: number): AgentFinding[] {
    return [...this.findings.values()].filter((f) => f.round === round);
  }

  /** Get a specific agent's finding, if published. */
  get(agentName: string): AgentFinding | undefined {
    return this.findings.get(agentName);
  }

  /** Full snapshot ordered by publish time. */
  snapshot(): AgentFinding[] {
    return this.timeline.map((e) => this.findings.get(e.agent)!).filter(Boolean);
  }

  /** Aggregate all unique flags across all findings. */
  allFlags(): string[] {
    return [...new Set([...this.findings.values()].flatMap((f) => f.flags))];
  }

  /** Count how many agents flagged a given risk level. */
  countByRisk(level: "low" | "medium" | "high"): number {
    return [...this.findings.values()].filter((f) => f.riskLevel === level).length;
  }

  getTimeline(): MemoryEvent[] {
    return [...this.timeline];
  }
}
