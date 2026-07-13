"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import type { AgentState, SwarmState } from "../lib/types";
import { AGENT_DEFS, EVIDENCE_NODES, NODE_CONNECTIONS, STATE_COLORS } from "../lib/types";

interface Props {
  swarmState:    SwarmState;
  onAgentClick?: (agentId: string) => void;
}

// ── Physics object per tadpole ────────────────────────────────────────────────
interface TadpolePhysics {
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  targetHeading: number;
  tailPhase: number;
  size: number;
  state: AgentState;
  targetX: number;
  targetY: number;
  orbitAngle: number;
  orbitOffset: number;
  trail: { x: number; y: number }[];
}

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  alpha: number; r: number;
}

interface Ripple {
  x: number; y: number;
  radius: number; alpha: number;
}

const BUBBLE_LIFETIME = 4500;

const HEX_POSITIONS = [
  { dx:   0, dy: -58 },
  { dx:  50, dy: -29 },
  { dx:  50, dy:  29 },
  { dx:   0, dy:  58 },
  { dx: -50, dy:  29 },
  { dx: -50, dy: -29 },
  { dx:   0, dy:   0 },
  { dx:   0, dy: -116 },
  { dx: 100, dy:   0 },
  { dx: -100, dy:  0 },
];

// State-based thrust from the spec
function getThrust(state: AgentState): number {
  switch (state) {
    case "idle":       return 0.022;
    case "analyzing":  return 0.062;
    case "alert":      return 0.052;
    case "suspicious": return 0.072;
    case "debate":     return 0.082;
    case "consensus":  return 0.016;
    case "done":       return 0.016;
  }
}

// Risk color mapping for the light aquatic theme
const NODE_RISK_COLORS: Record<string, string> = {
  high:   "#EF4444",
  medium: "#F59E0B",
  low:    "#22C55E",
  none:   "#14B8A6",
};

export function TadpolePool({ swarmState, onAgentClick }: Props) {
  const canvasRef       = useRef<HTMLCanvasElement>(null);
  const physicsRef      = useRef<Map<string, TadpolePhysics>>(new Map());
  const particlesRef    = useRef<Particle[]>([]);
  const ripplesRef      = useRef<Ripple[]>([]);
  const frameRef        = useRef<number>(0);
  const stateRef        = useRef(swarmState);
  const onClickRef      = useRef(onAgentClick);
  const [hoveredAgent, setHoveredAgent]   = useState<string | null>(null);
  const [tooltipPos,   setTooltipPos]     = useState<{ x: number; y: number } | null>(null);
  const hoveredAgentRef = useRef<string | null>(null);
  stateRef.current   = swarmState;
  onClickRef.current = onAgentClick;

  const initPhysics = useCallback((w: number, h: number) => {
    // Spawn plankton particles
    if (particlesRef.current.length === 0) {
      for (let i = 0; i < 45; i++) {
        particlesRef.current.push({
          x:     Math.random() * w,
          y:     Math.random() * h,
          vx:    (Math.random() - 0.5) * 0.28,
          vy:    (Math.random() - 0.5) * 0.14,
          alpha: 0.04 + Math.random() * 0.07,
          r:     0.8 + Math.random() * 2.2,
        });
      }
    }

    for (const def of AGENT_DEFS) {
      if (!physicsRef.current.has(def.id)) {
        const angle = Math.random() * Math.PI * 2;
        physicsRef.current.set(def.id, {
          x:             def.initX * w,
          y:             def.initY * h,
          vx:            Math.cos(angle) * 0.4,
          vy:            Math.sin(angle) * 0.4,
          heading:       angle,
          targetHeading: angle,
          tailPhase:     Math.random() * Math.PI * 2,
          size:          6 + Math.random() * 2.5,
          state:         "idle",
          targetX:       def.initX * w,
          targetY:       def.initY * h,
          orbitAngle:    Math.random() * Math.PI * 2,
          orbitOffset:   Math.random() * Math.PI * 2,
          trail:         [],
        });
      }
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width  = parent.clientWidth;
      canvas.height = parent.clientHeight;
      initPhysics(canvas.width, canvas.height);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement!);

    const getNodeRiskMap = (s: SwarmState): Map<string, string> => {
      const rank: Record<string, number> = { low: 1, medium: 2, high: 3 };
      const map = new Map<string, string>();
      for (const def of AGENT_DEFS) {
        const f = s.findings.find((f) => f.agent === def.id);
        if (!f) continue;
        const curr = map.get(def.targetNodeId);
        if (!curr || rank[f.riskLevel] > rank[curr]) map.set(def.targetNodeId, f.riskLevel);
      }
      return map;
    };

    const getActiveNodes = (s: SwarmState): Set<string> => {
      const active = new Set<string>();
      for (const def of AGENT_DEFS) {
        if (s.agentStates[def.id] === "analyzing") active.add(def.targetNodeId);
      }
      return active;
    };

    const draw = () => {
      const W = canvas.width;
      const H = canvas.height;
      const s = stateRef.current;
      const T = Date.now();
      const nodeMap     = new Map(EVIDENCE_NODES.map((n) => [n.id, n]));
      const nodeRiskMap = getNodeRiskMap(s);
      const activeNodes = getActiveNodes(s);
      const cx = W * 0.50;
      const cy = H * 0.44;

      ctx.clearRect(0, 0, W, H);

      // ── 1. BACKGROUND: light aquatic gradient ─────────────────────────────
      const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
      bgGrad.addColorStop(0,   "#DFF7F3");
      bgGrad.addColorStop(0.4, "#CBEFEB");
      bgGrad.addColorStop(0.7, "#B8E7E1");
      bgGrad.addColorStop(1,   "#9FD8D3");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // ── 2. CAUSTIC LIGHT EFFECTS (drifting soft radials) ──────────────────
      const CAUSTICS = [
        { bx: 0.22, by: 0.28, r: 0.24, ph: 0.00, spd: 0.00014 },
        { bx: 0.70, by: 0.50, r: 0.18, ph: 2.10, spd: 0.00017 },
        { bx: 0.50, by: 0.72, r: 0.28, ph: 1.30, spd: 0.00012 },
        { bx: 0.14, by: 0.62, r: 0.15, ph: 0.70, spd: 0.00020 },
        { bx: 0.80, by: 0.22, r: 0.19, ph: 3.50, spd: 0.00015 },
        { bx: 0.42, by: 0.18, r: 0.13, ph: 4.80, spd: 0.00018 },
      ];
      for (const c of CAUSTICS) {
        const kx = c.bx * W + Math.cos(T * c.spd + c.ph) * W * 0.04;
        const ky = c.by * H + Math.sin(T * c.spd * 1.2 + c.ph) * H * 0.03;
        const kr = c.r * W;
        const g  = ctx.createRadialGradient(kx, ky, 0, kx, ky, kr);
        g.addColorStop(0,   "rgba(255,255,255,0.13)");
        g.addColorStop(0.5, "rgba(255,255,255,0.05)");
        g.addColorStop(1,   "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(kx, ky, kr, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── 3. PARTICLES (slow plankton drift) ────────────────────────────────
      for (const p of particlesRef.current) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x += W;
        if (p.x > W) p.x -= W;
        if (p.y < 0) p.y += H;
        if (p.y > H) p.y -= H;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(20,184,166,${p.alpha})`;
        ctx.fill();
      }

      // ── 4. RIPPLES (update + draw) ─────────────────────────────────────────
      ripplesRef.current = ripplesRef.current.filter((r) => r.alpha > 0.012);
      for (const r of ripplesRef.current) {
        r.radius += 0.9;
        r.alpha  *= 0.96;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(51,209,198,${r.alpha})`;
        ctx.lineWidth   = 1;
        ctx.stroke();
      }

      // ── 5. EVIDENCE NODE CONNECTIONS (teal dashed) ────────────────────────
      for (const [aId, bId] of NODE_CONNECTIONS) {
        const a = nodeMap.get(aId);
        const b = nodeMap.get(bId);
        if (!a || !b || a.id === "center" || b.id === "center") continue;
        const ax = a.x * W, ay = a.y * H;
        const bx = b.x * W, by = b.y * H;
        const isActive = activeNodes.has(aId) || activeNodes.has(bId);
        const alpha = isActive ? 0.38 : 0.16;
        const mx = (ax + bx) / 2;
        const my = (ay + by) / 2;
        const off = (bx - ax) * 0.08;

        ctx.save();
        ctx.strokeStyle = `rgba(20,184,166,${alpha})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 6]);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.quadraticCurveTo(mx + off, my - Math.abs(off) * 0.35, bx, by);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      // ── 6. ROUND 2 DEBATE LINKS ───────────────────────────────────────────
      const r2Active =
        s.agentStates["SkepticAgent"]    === "debate"    ||
        s.agentStates["SkepticAgent"]    === "analyzing" ||
        s.agentStates["ProsecutorAgent"] === "debate"    ||
        s.agentStates["ProsecutorAgent"] === "analyzing";

      if (r2Active) {
        const metas = AGENT_DEFS.filter((d) => d.round === 2);
        const cores = AGENT_DEFS.filter((d) => d.round === 1);
        const pa    = 0.12 + 0.08 * Math.sin(T * 0.003);

        for (const m of metas) {
          const mp = physicsRef.current.get(m.id);
          if (!mp) continue;
          for (const c of cores) {
            const cp = physicsRef.current.get(c.id);
            if (!cp) continue;
            ctx.save();
            ctx.strokeStyle = `rgba(139,92,246,${pa})`;
            ctx.lineWidth = 0.8;
            ctx.setLineDash([2, 7]);
            ctx.beginPath();
            ctx.moveTo(mp.x, mp.y);
            ctx.lineTo(cp.x, cp.y);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
          }
        }
      }

      // ── 7. EVIDENCE NODES (glass circles) ────────────────────────────────
      for (const node of EVIDENCE_NODES) {
        if (node.id === "center" || !node.shortLabel) continue;
        const nx = node.x * W;
        const ny = node.y * H;
        const risk     = nodeRiskMap.get(node.id) ?? "none";
        const isActive = activeNodes.has(node.id);
        const pulse    = Math.sin(T * 0.0022 + nx * 0.01);
        const nColor   = NODE_RISK_COLORS[risk] ?? "#14B8A6";

        // Outer aura
        const auraR = isActive ? 34 : 26;
        const auraA = (isActive ? 0.22 : 0.10) + 0.06 * pulse;
        const aura  = ctx.createRadialGradient(nx, ny, 0, nx, ny, auraR);
        aura.addColorStop(0, nColor + Math.round(auraA * 255).toString(16).padStart(2, "0"));
        aura.addColorStop(1, nColor + "00");
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(nx, ny, auraR, 0, Math.PI * 2);
        ctx.fill();

        // Glass body
        ctx.save();
        ctx.beginPath();
        ctx.arc(nx, ny, 15, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.shadowColor = nColor;
        ctx.shadowBlur = isActive ? 10 : 4;
        ctx.fill();
        ctx.strokeStyle = nColor;
        ctx.globalAlpha = risk === "none" ? 0.4 : 0.75;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1;

        // Labels
        ctx.fillStyle = risk === "none" ? "#1A3C40" : nColor;
        ctx.font = "bold 9px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(node.shortLabel, nx, ny);
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = "rgba(13,43,40,0.5)";
        ctx.font = "9px Arial";
        ctx.fillText(node.label, nx, ny + 22);
      }

      // ── 8. TADPOLES ──────────────────────────────────────────────────────
      for (let di = 0; di < AGENT_DEFS.length; di++) {
        const def = AGENT_DEFS[di];
        const p   = physicsRef.current.get(def.id);
        if (!p) continue;

        p.state = s.agentStates[def.id] ?? "idle";
        const tNode = EVIDENCE_NODES.find((n) => n.id === def.targetNodeId);

        // ── Target position ──────────────────────────────────────────────
        let tX = p.targetX, tY = p.targetY;

        if (p.state === "idle") {
          tX = def.initX * W;
          tY = def.initY * H;
        } else if (p.state === "analyzing" && tNode) {
          p.orbitAngle += 0.022;
          tX = tNode.x * W + Math.cos(p.orbitAngle + p.orbitOffset) * 32;
          tY = tNode.y * H + Math.sin(p.orbitAngle + p.orbitOffset) * 20;
        } else if ((p.state === "debate" || p.state === "alert" || p.state === "suspicious") && (def.round === 2 || def.round === 3)) {
          p.orbitAngle += 0.018;
          tX = cx + Math.cos(p.orbitAngle + p.orbitOffset) * 42;
          tY = cy + Math.sin(p.orbitAngle + p.orbitOffset) * 26;
        } else if ((p.state === "alert" || p.state === "suspicious") && tNode) {
          p.orbitAngle += 0.010;
          tX = tNode.x * W + Math.cos(p.orbitAngle + p.orbitOffset) * 24;
          tY = tNode.y * H + Math.sin(p.orbitAngle + p.orbitOffset) * 15;
        } else if (p.state === "consensus" || p.state === "done") {
          const hex = HEX_POSITIONS[di] ?? { dx: 0, dy: 0 };
          p.orbitAngle += 0.006;
          tX = cx + hex.dx + Math.cos(p.orbitAngle + p.orbitOffset) * 3;
          tY = cy + hex.dy + Math.sin(p.orbitAngle + p.orbitOffset) * 3;
        } else if (tNode) {
          tX = tNode.x * W;
          tY = tNode.y * H;
        }
        p.targetX = tX;
        p.targetY = tY;

        // ── Heading system ───────────────────────────────────────────────
        const tdx   = p.targetX - p.x;
        const tdy   = p.targetY - p.y;
        const tdist = Math.sqrt(tdx * tdx + tdy * tdy);

        if (p.state === "idle") {
          // Spec §5.4: idle wander
          p.targetHeading += (Math.random() - 0.5) * 0.05;
        } else if (tdist > 5) {
          // Spec §5.5: target seeking
          p.targetHeading = Math.atan2(tdy, tdx);
        }

        // Spec §5.6: hover near target
        if (tdist < 22 && p.state !== "idle") {
          p.targetHeading += Math.sin(T * 0.002) * 0.3;
        }

        // Debate: vigorous oscillation
        if (p.state === "debate") {
          p.targetHeading += (Math.random() - 0.5) * 0.45;
        }

        // Spec §5.1: heading interpolation
        const diff = ((p.targetHeading - p.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        p.heading += diff * 0.08;

        // Sharp turn → ripple
        if (Math.abs(diff) > 0.55 && Math.random() < 0.025) {
          ripplesRef.current.push({ x: p.x, y: p.y, radius: 0, alpha: 0.22 });
        }

        // Reach target → ripple
        if (tdist < 18 && tdist > 14 && Math.random() < 0.04) {
          ripplesRef.current.push({ x: p.x, y: p.y, radius: 0, alpha: 0.15 });
        }

        // Spec §5.2–5.3: thrust + drag
        const thrust = getThrust(p.state);
        p.vx += Math.cos(p.heading) * thrust;
        p.vy += Math.sin(p.heading) * thrust;
        p.vx *= 0.92;
        p.vy *= 0.92;
        p.x  += p.vx;
        p.y  += p.vy;

        // Risk gravity (from previous spec)
        const finding = s.findings.find((f) => f.agent === def.id);
        if (finding && finding.riskLevel === "high") {
          for (const od of AGENT_DEFS) {
            if (od.id === def.id) continue;
            const op = physicsRef.current.get(od.id);
            if (!op) continue;
            const gdx = p.x - op.x, gdy = p.y - op.y;
            const gd  = Math.sqrt(gdx * gdx + gdy * gdy);
            if (gd > 5 && gd < 130) {
              const force = 0.00014 * (1 - gd / 130);
              op.vx += (gdx / gd) * force * gd;
              op.vy += (gdy / gd) * force * gd;
            }
          }
        }

        // Spec §6.3: tail phase advances with speed
        p.tailPhase += 0.2 + Math.abs(p.vx + p.vy) * 0.3;

        // Short positional trail
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 6) p.trail.shift();

        const color    = STATE_COLORS[p.state] ?? "#33D1C6";
        const isHovered = hoveredAgentRef.current === def.id;

        // ── Draw tadpole ─────────────────────────────────────────────────
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.heading);

        // Spec §6.2: sinusoidal tail (drawn behind head)
        const tailLen = p.size * 3.2;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        for (let i = 1; i <= 5; i++) {
          const progress = i / 5;
          const sway = Math.sin(p.tailPhase + progress * 2) * (7.5 * (1 - progress));
          ctx.lineTo(-progress * tailLen, sway);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth   = Math.max(1.4, p.size * 0.38);
        ctx.globalAlpha = p.state === "idle" ? 0.42 : 0.62;
        ctx.lineCap     = "round";
        ctx.shadowColor = color;
        ctx.shadowBlur  = p.state === "idle" ? 2 : 5;
        ctx.stroke();
        ctx.restore();

        // Head glow ring for active states
        if (p.state !== "idle" || isHovered) {
          const gr = p.size + 9;
          const hg = ctx.createRadialGradient(0, 0, 0, 0, 0, gr);
          hg.addColorStop(0, color + "50");
          hg.addColorStop(1, color + "00");
          ctx.globalAlpha = isHovered ? 0.85 : 0.42;
          ctx.fillStyle   = hg;
          ctx.beginPath();
          ctx.arc(0, 0, gr, 0, Math.PI * 2);
          ctx.fill();
        }

        // Spec §6.1: head — ellipse with radial gradient
        const headGrad = ctx.createRadialGradient(
          -p.size * 0.28, -p.size * 0.28, 0,
          0, 0, p.size
        );
        headGrad.addColorStop(0,   "rgba(255,255,255,0.96)");
        headGrad.addColorStop(0.4, color);
        headGrad.addColorStop(1,   color + "aa");
        ctx.globalAlpha = p.state === "idle" ? 0.72 : 1;
        ctx.fillStyle   = headGrad;
        ctx.shadowColor = color;
        ctx.shadowBlur  = isHovered ? 16 : (p.state === "idle" ? 3 : 9);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.85, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Eye (adds organic life)
        ctx.globalAlpha = p.state === "idle" ? 0.55 : 0.92;
        ctx.fillStyle   = "#0D2B28";
        ctx.beginPath();
        ctx.arc(p.size * 0.30, -p.size * 0.27, p.size * 0.19, 0, Math.PI * 2);
        ctx.fill();
        // Eye glint
        ctx.fillStyle = "rgba(255,255,255,0.82)";
        ctx.beginPath();
        ctx.arc(p.size * 0.35, -p.size * 0.33, p.size * 0.08, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
        ctx.globalAlpha = 1;

        // Agent label (below)
        ctx.fillStyle    = "rgba(13,43,40,0.72)";
        ctx.font         = "bold 8px Arial";
        ctx.textAlign    = "center";
        ctx.textBaseline = "top";
        ctx.fillText(def.shortLabel, p.x, p.y + p.size + 5);
        ctx.textBaseline = "alphabetic";
      }

      // ── 9. CHAT BUBBLES (light glass) ────────────────────────────────────
      for (const bubble of s.chatBubbles) {
        const def = AGENT_DEFS.find((d) => d.id === bubble.agent);
        const p   = physicsRef.current.get(bubble.agent);
        if (!def || !p) continue;

        const age     = Date.now() - bubble.createdAt;
        const alpha   = Math.max(0, 1 - age / BUBBLE_LIFETIME);
        const riseY   = (age / BUBBLE_LIFETIME) * 28;
        const bx = p.x - 60, by = p.y - 54 - riseY;
        const bw = 132,      bh = 34;

        const bColor =
          bubble.riskLevel === "high"   ? "#EF4444" :
          bubble.riskLevel === "medium" ? "#F59E0B" :
          bubble.riskLevel === "low"    ? "#22C55E" : "#14B8A6";

        ctx.globalAlpha = alpha;
        ctx.fillStyle   = "rgba(255,255,255,0.92)";
        ctx.strokeStyle = bColor;
        ctx.lineWidth   = 1.4;
        ctx.shadowColor = "rgba(18,52,59,0.12)";
        ctx.shadowBlur  = 8;
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 8);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.fillStyle    = "#0D2B28";
        ctx.font         = "10px Arial";
        ctx.textAlign    = "left";
        ctx.textBaseline = "top";

        const words = bubble.text.split(" ");
        let line = "", lineY = by + 7;
        const maxW = bw - 12;
        for (const word of words) {
          const test = line + word + " ";
          if (ctx.measureText(test).width > maxW && line) {
            ctx.fillText(line.trim(), bx + 6, lineY);
            line = word + " "; lineY += 12;
            if (lineY > by + bh - 6) break;
          } else { line = test; }
        }
        ctx.fillText(line.trim(), bx + 6, lineY);
        ctx.textBaseline = "alphabetic";
        ctx.globalAlpha  = 1;
      }

      // ── 10. PHASE OVERLAYS ────────────────────────────────────────────────
      if (s.phase === "idle") {
        ctx.fillStyle = "rgba(20,184,166,0.40)";
        ctx.font      = "12px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Submit a case below to activate the swarm", W / 2, H * 0.93);
      }

      if (s.phase === "done" && s.decision) {
        const colMap: Record<string, string> = {
          approve:       "#22C55E",
          manual_review: "#F59E0B",
          escalate:      "#F97316",
          reject:        "#EF4444",
        };
        const col = colMap[s.decision.status] ?? "#14B8A6";
        ctx.fillStyle = col + "0e";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle   = col;
        ctx.font        = "bold 20px Arial";
        ctx.textAlign   = "center";
        ctx.shadowColor = col;
        ctx.shadowBlur  = 28;
        ctx.fillText(s.decision.status.toUpperCase().replace("_", " "), W / 2, H * 0.93);
        ctx.shadowBlur  = 0;
      }

      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frameRef.current);
      ro.disconnect();
    };
  }, [initPhysics]);

  // ── Hit-test (click / hover) ──────────────────────────────────────────────
  const hitTest = useCallback((clientX: number, clientY: number): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect  = canvas.getBoundingClientRect();
    const sx    = canvas.width  / rect.width;
    const sy    = canvas.height / rect.height;
    const cpx   = (clientX - rect.left) * sx;
    const cpy   = (clientY - rect.top)  * sy;
    for (const def of AGENT_DEFS) {
      const p = physicsRef.current.get(def.id);
      if (!p) continue;
      const dx = p.x - cpx, dy = p.y - cpy;
      if (dx * dx + dy * dy <= 20 * 20) return def.id;
    }
    return null;
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const id = hitTest(e.clientX, e.clientY);
    if (id) onClickRef.current?.(id);
  }, [hitTest]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
    const id = hitTest(e.clientX, e.clientY);
    if (id !== hoveredAgentRef.current) {
      hoveredAgentRef.current = id;
      setHoveredAgent(id);
    }
  }, [hitTest]);

  const handleMouseLeave = useCallback(() => {
    hoveredAgentRef.current = null;
    setHoveredAgent(null);
    setTooltipPos(null);
  }, []);

  const tooltipInfo = hoveredAgent ? (() => {
    const def     = AGENT_DEFS.find((d) => d.id === hoveredAgent);
    const finding = swarmState.findings.find((f) => f.agent === hoveredAgent);
    const st      = swarmState.agentStates[hoveredAgent] ?? "idle";
    if (!def) return null;
    return { label: def.label, state: st, finding };
  })() : null;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <canvas
        ref={canvasRef}
        style={{ display: "block", width: "100%", height: "100%", cursor: hoveredAgent ? "pointer" : "default" }}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
      {tooltipInfo && tooltipPos && (
        <div
          className="pool-tooltip"
          style={{ position: "fixed", left: tooltipPos.x + 14, top: tooltipPos.y - 10, pointerEvents: "none" }}
        >
          <div className="pool-tooltip-name">{tooltipInfo.label}</div>
          <div className="pool-tooltip-state">{tooltipInfo.state}</div>
          {tooltipInfo.finding && (
            <>
              <div className="pool-tooltip-summary">
                {tooltipInfo.finding.summary.slice(0, 80)}
                {tooltipInfo.finding.summary.length > 80 ? "…" : ""}
              </div>
              <div className="pool-tooltip-conf">
                Confidence: {Math.round(tooltipInfo.finding.confidence * 100)}%
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
