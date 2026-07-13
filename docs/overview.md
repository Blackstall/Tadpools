# Tadpools — Project Overview

> Swim through the noise. Surface the risk.

Tadpools is a swarm-based KYC (Know Your Customer) onboarding intelligence system. Ten AI agents collaborate across three rounds to analyse a company onboarding case and produce an explainable risk decision, visualised in real time as animated biological tadpoles swimming through a bioluminescent aquatic pool.

---

## Table of Contents

1. [Repository Layout](#1-repository-layout)
2. [Infrastructure](#2-infrastructure)
3. [Database Schema](#3-database-schema)
4. [Shared Package](#4-shared-package)
5. [Agents Package](#5-agents-package)
6. [API Application](#6-api-application)
7. [Web Application](#7-web-application)
8. [Design System](#8-design-system)
9. [Swarm Execution Flow](#9-swarm-execution-flow)
10. [Policy Engine](#10-policy-engine)
11. [Audit & Compliance](#11-audit--compliance)
12. [LLM Layer](#12-llm-layer)
13. [API Reference](#13-api-reference)
14. [Decision Outcomes](#14-decision-outcomes)
15. [Environment Variables](#15-environment-variables)
16. [Build & Start](#16-build--start)

---

## 1. Repository Layout

```
tadpools/
├── apps/
│   ├── api/                  — Express REST API (port 4000)
│   └── web/                  — Next.js frontend (port 3000)
├── packages/
│   ├── shared/               — Shared TypeScript types (CaseInput, AgentFinding, …)
│   └── agents/               — All 10 swarm agents + LLM client + shared memory
├── infra/
│   └── docker-compose.yml    — PostgreSQL + MinIO containers
├── docs/                     — Project documentation
├── .env                      — Root-level env overrides (optional)
├── package.json              — npm workspaces root
└── tsconfig.base.json        — Shared compiler settings
```

Build order matters: `shared` → `agents` → `api` → `web`.

---

## 2. Infrastructure

Defined in `infra/docker-compose.yml`. Two services:

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `postgres` | postgres:16 | `5433` (host) → 5432 (container) | Primary relational database |
| `minio` | minio/minio:latest | `9000` API, `9001` Console | Temporary S3-compatible document storage |

Port 5433 is used to avoid conflict with any locally installed PostgreSQL instance.

MinIO credentials (dev): `minio` / `minio123`. Bucket `tadpools-temp` is auto-created on API startup.

LLM inference is handled by **Ollama** running locally at `http://localhost:11434` (not containerised). The active model is `qwen2.5:7b`.

---

## 3. Database Schema

Tables are created automatically by `apps/api/src/db/migrate.ts` on server startup. All tables cascade-delete when the parent `cases` row is removed.

### `cases`
The root record for each onboarding submission.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | Case identifier |
| `company_name` | TEXT | |
| `reg_number` | TEXT | Company registration number |
| `reg_date` | TEXT | Registration date string |
| `nature_of_biz` | TEXT | Stated business activity |
| `beneficiary_name` | TEXT | Payee name |
| `account_number` | TEXT | Payee bank account |
| `bank_name` | TEXT | Payee bank |
| `ben_nature_biz` | TEXT | Beneficiary's stated business (optional) |
| `consent_accepted` | BOOLEAN | Must be true to submit |
| `status` | TEXT | `pending` → `processing` → `done` |
| `created_at` / `updated_at` | TIMESTAMPTZ | |

### `extracted_fields`
Structured fields parsed from uploaded documents by the extraction pipeline.

| Column | Notes |
|--------|-------|
| `case_id` | FK → cases |
| `doc_id` | Which uploaded document the field came from |
| `field_name` | e.g. `invoice_amount`, `payee_name` |
| `value` | Extracted text value |

### `agent_findings`
One row per agent per case, one row per round.

| Column | Notes |
|--------|-------|
| `agent_name` | e.g. `NameMatchingAgent` |
| `summary` | Human-readable one-line finding |
| `confidence` | 0–1 |
| `risk_level` | `low` / `medium` / `high` |
| `evidence` | JSONB — referenced field keys / doc IDs |
| `flags` | JSONB — machine-readable risk signal codes |
| `reasoning` | JSONB — step-by-step explanation |
| `round` | 1 / 2 / 3 |

### `risk_signals`
Triggered policy rules, written by the Policy Engine.

| Column | Notes |
|--------|-------|
| `signal_code` | e.g. `RULE_FORGERY` |
| `triggered_by` | `PolicyEngine` |
| `detail` | Human description of the rule |

### `decisions`
One row per case (unique constraint on `case_id`).

| Column | Notes |
|--------|-------|
| `status` | `approve` / `manual_review` / `escalate` / `reject` |
| `score` | Numeric risk score (0–999) |
| `reasons` | JSONB array of rule + agent summaries |

### `audit_logs`
Append-only event log. Every swarm event, agent finding, and decision is written here.

| Column | Notes |
|--------|-------|
| `event_type` | e.g. `swarm.started`, `agent.finding`, `policy.decision` |
| `payload` | JSONB — full event data |

Indexed on `case_id` across all five tables.

---

## 4. Shared Package

`packages/shared/src/index.ts` — compiled to `packages/shared/dist/`.

Exports the canonical TypeScript types used across every workspace:

| Type | Description |
|------|-------------|
| `CompanyInput` | Company name, reg number, reg date, nature of business |
| `BeneficiaryInput` | Beneficiary name, account number, bank name |
| `UploadedDocument` | Document ID, type, filename, MinIO storage key |
| `CaseInput` | Full intake payload (company + beneficiary + documents + consent) |
| `AgentFinding` | Agent name, summary, confidence, riskLevel, flags, reasoning, round |
| `DecisionResult` | status, score, reasons, findings array |
| `DecisionStatus` | `"approve" \| "manual_review" \| "escalate" \| "reject"` |
| `RiskLevel` | `"low" \| "medium" \| "high"` |

---

## 5. Agents Package

`packages/agents/src/` — compiled to `packages/agents/dist/`.

### Structure

```
packages/agents/src/
├── index.ts                    — Public exports + AgentContext + SwarmAgent interface
├── sharedMemory.ts             — In-memory store for inter-agent communication
├── llm/
│   ├── client.ts               — Ollama HTTP client with fallback
│   └── modelRouter.ts          — Maps agent tier → model name
└── agents/
    ├── core/                   — Round 1 fact-checkers (7 agents)
    │   ├── natureOfBusiness.ts
    │   ├── registrationAge.ts
    │   ├── documentAuthenticity.ts
    │   ├── existenceVerification.ts
    │   ├── nameMatching.ts
    │   ├── beneficiaryConsistency.ts
    │   └── historicalSuspicion.ts
    └── meta/                   — Round 2–3 reasoning agents (3 agents)
        ├── skeptic.ts
        ├── prosecutor.ts
        └── chair.ts
```

### `AgentContext`

Every agent receives this context object at runtime:

```typescript
interface AgentContext {
  caseId: string;
  caseInput: CaseInput;
  extractedFields: ExtractedFieldRecord[];  // from DB
  sharedMemory: SharedMemory;               // live swarm memory
  round: number;
  llm: LLMClient;
}
```

### `SwarmAgent` interface

```typescript
interface SwarmAgent {
  name: string;
  run(context: AgentContext): Promise<AgentFinding>;
}
```

Every agent **must** call `sharedMemory.publish(finding)` before returning, enabling later agents to read earlier findings.

### The 10 agents

| Agent | Round | Role |
|-------|-------|------|
| `NatureOfBusinessAgent` | 1 | Does the business type match the payment purpose? |
| `RegistrationAgeAgent` | 1 | Is the company too new to be trusted without documents? |
| `DocumentAuthenticityAgent` | 1 | Internal consistency of extracted document fields |
| `ExistenceVerificationAgent` | 1 | Credible signs of legitimate company existence |
| `NameMatchingAgent` | 1 | Company name vs beneficiary name mismatch detection |
| `BeneficiaryConsistencyAgent` | 1 | Bank account / bank name validation against docs |
| `HistoricalSuspicionAgent` | 1 | Cross-reference against known suspicious entity patterns |
| `SkepticAgent` | 2 | Challenge round 1 — reduce false positives |
| `ProsecutorAgent` | 2 | Challenge round 1 — surface missed fraud patterns |
| `ChairAgent` | 3 | Synthesise all findings into a final consensus recommendation |

### LLM Client

`llm/client.ts` calls Ollama's `/api/generate` endpoint. If Ollama is offline or the request times out, agents fall back to deterministic rule-based logic — the system never crashes due to LLM unavailability.

### Model Router

`llm/modelRouter.ts` maps agent tiers to models. Current configuration uses `qwen2.5:7b` for all tiers; target configuration routes heavier tiers to larger models as hardware allows.

---

## 6. API Application

`apps/api/src/` — run with `npx tsx apps/api/src/server.ts`.

### Entry point: `server.ts`

Mounts all route modules, runs DB migrations, ensures the MinIO bucket exists, then starts listening on port 4000.

### Routes

| File | Mounted at | Responsibility |
|------|-----------|----------------|
| `routes/cases.ts` | `/api/cases` | Create case, trigger swarm in background |
| `routes/upload.ts` | `/api/cases/:id/upload` | Multipart document upload → MinIO |
| `routes/extraction.ts` | `/api/cases/:id/extract` | Extract structured fields from uploaded docs |
| `routes/stream.ts` | `/api/cases/:id/stream` | Server-Sent Events — live swarm progress |
| `routes/auditRoutes.ts` | `/api/cases/:id/audit` | Replay timeline + full compliance export |
| `routes/cleanup.ts` | `/api/cases/:id/cleanup` | Delete temp files, archive case record |

### Services

| File | Responsibility |
|------|----------------|
| `services/swarmService.ts` | Orchestrates all three rounds, emits SSE events, persists findings |
| `services/policyEngine.ts` | Applies 10 hard rules, computes final score and status |
| `services/auditService.ts` | Writes to `audit_logs` table |
| `services/eventBus.ts` | In-process pub/sub for SSE delivery |
| `services/extractionService.ts` | Parses documents and writes to `extracted_fields` |
| `services/cleanupService.ts` | Removes MinIO objects, marks case archived |

### DB Layer

| File | Responsibility |
|------|----------------|
| `db/pool.ts` | Shared `pg` connection pool |
| `db/migrate.ts` | DDL run at startup (`CREATE TABLE IF NOT EXISTS`) |
| `db/caseRepository.ts` | SQL helpers — insert case, findings, decision; update status |

### Storage Layer

| File | Responsibility |
|------|----------------|
| `storage/minioClient.ts` | MinIO connection + `ensureBucket()` |
| `storage/uploadService.ts` | Streams multipart files to MinIO |

---

## 7. Web Application

`apps/web/` — Next.js 15 App Router, custom CSS (no Tailwind), port 3000.

### Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 15.2.2 | React framework, App Router, `next/font` |
| `react` / `react-dom` | 19.0.0 | UI runtime |
| `framer-motion` | ^11 | Page transitions and "Dive" animation |
| `lucide-react` | ^0.441 | Thin stroke icons (FileText, Building2, User, Hash, X, …) |

### App structure

```
apps/web/
├── app/
│   ├── layout.tsx                        — Root layout; loads Inter via next/font/google
│   ├── page.tsx                          — Workbench page: top bar + canvas + drawers + bottom dock
│   ├── globals.css                       — All design tokens (CSS variables) + every component class
│   └── cases/
│       └── page.tsx                      — Case queue page (Kanban columns: Processing / Decided / Flagged)
├── components/
│   ├── IntakeForm.tsx                    — Company + beneficiary form + drag-and-drop file upload
│   ├── TadpolePool.tsx                   — Canvas-based aquatic swarm animation (biological tadpoles)
│   ├── PoolCanvas.tsx                    — Legacy demo canvas (unused in main flow)
│   ├── CaseTimeline.tsx                  — Timeline event list (severity-coloured left-border rows)
│   ├── LeftDrawer.tsx                    — Sliding left panel: progress stepper, case profile, docs, timeline
│   ├── RightDrawer.tsx                   — Sliding right panel (reserved for agent detail / decision brief)
│   ├── CaseOverview.tsx                  — Legacy sidebar component (superseded by LeftDrawer)
│   ├── DecisionPanel.tsx                 — Legacy right panel (superseded by InvestigationReportPanel)
│   ├── agents/
│   │   └── ThoughtBubble.tsx             — ThoughtBubble (canvas overlay) + AgentThoughtPanel (click detail)
│   ├── history/
│   │   └── CaseHistoryDrawer.tsx         — Right-sliding history drawer: past cases, expandable detail
│   ├── report/
│   │   └── InvestigationReportPanel.tsx  — Structured 6-step investigation report + recommended actions
│   └── workbench/
│       └── GraphWorkbench.tsx            — Zoom/pan wrapper around TadpolePool with mode badge
├── lib/
│   ├── types.ts                          — All frontend types, AGENT_DEFS, EVIDENCE_NODES,
│   │                                       NODE_CONNECTIONS, STATE_COLORS, DOC_TYPE_OPTIONS, PROGRESS_STEPS
│   ├── useSwarmStream.ts                 — React hook: SSE consumer + case/upload/extract orchestration
│   ├── graph/
│   │   ├── types.ts                      — GraphNode, GraphEdge, InvestigationGraph type definitions
│   │   └── buildGraph.ts                 — Evidence graph builder (for future graph visualisation)
│   └── workbench/
│       ├── mapFindings.ts                — Maps agent findings → 6 investigation report steps
│       └── recommendedActions.ts         — Builds recommended action cards from decision + flag signals
```

### Workbench layout

The UI is a full-viewport **workbench** — not a three-column layout. The layout is:

```
┌──────────────────── top-bar ────────────────────────────────┐
│  Tadpools · KYC Workbench       Case · Stage · Status  Btns │
├─────────────────────────────────────────┬───────────────────┤
│                                         │ Investigation      │
│         GraphWorkbench                  │ Report Panel       │
│         (TadpolePool canvas)            │ (300 px fixed)     │
│         + zoom controls                 │                    │
│         + mode badge                    │                    │
│                                         │                    │
└─────────────────────────────────────────┴───────────────────┘
           ↕ (fixed bottom-center)
┌─── bottom-dock-wrap (intake-dock) ───────────────────────────┐
│   IntakeForm  ──OR──  CaseSummaryDock                        │
└──────────────────────────────────────────────────────────────┘
 [LeftDrawer slides over left edge]  [CaseHistoryDrawer slides over right edge]
```

| Zone | Component | Content |
|------|-----------|---------|
| Top bar | `<header class="top-bar">` | Brand dot + name + tag; Case ID, Stage, pulsing status dot; History / Queue / New case buttons |
| Canvas | `GraphWorkbench` → `TadpolePool` | Full-width aquatic pool canvas at 60fps |
| Right panel | `InvestigationReportPanel` | 6-step collapsible investigation report, recommended actions, bank escalation block |
| Left drawer | `LeftDrawer` | Progress stepper, agent progress pills, company/beneficiary profile, document stack with SHA-256, live timeline, agent state legend |
| History drawer | `CaseHistoryDrawer` | Past cases grouped by status; expandable detail with score, findings, documents |
| Bottom dock | `IntakeForm` / `CaseSummaryDock` | Animated glass dock; form collapses to 62 px summary bar on submit |
| Queue page | `/cases` | Three-column Kanban board (Processing / Decided / Flagged) |

### `useSwarmStream` hook

Central state machine for the frontend. Handles:
1. `submitCase` — POST `/api/cases`, returns `caseId`
2. `uploadAndExtract` — uploads each file, then POST `/api/cases/:id/extract`
3. Opens SSE connection to `/api/cases/:id/stream`
4. Translates incoming events into `SwarmState` updates (agent states, findings, decision, timeline, chat bubbles, docs)
5. `reset` — closes SSE, resets to idle

---

## 8. Design System

The current design is called **"OASIS Aquatic"** — a bio-digital intelligence aesthetic that immerses the investigator inside a living underwater environment. All surfaces are glass panels floating above an aquatic light-play canvas.

> Reference: `docs/good-design.md` contains the full design specification.

---

### 8.1 Color Palette

All tokens are defined as CSS custom properties in `apps/web/app/globals.css`.

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#EDF9F7` | Pale aqua mist — app background |
| `--panel` | `rgba(255,255,255,0.72)` | Glass white — panel surfaces |
| `--pool-bg` | `#CBF0ED` | Soft teal — pool canvas reference |
| `--border` | `rgba(20,184,166,0.14)` | Teal border — default |
| `--border-s` | `rgba(20,184,166,0.45)` | Teal border — strong |
| `--text` | `#0D2B28` | Deep forest green — primary text |
| `--muted` | `#5A7A78` | Muted teal grey — labels, captions |
| `--accent` | `#14B8A6` | Teal — primary action, CTA |
| `--high` | `#EF4444` | Risk Red — high risk |
| `--medium` | `#F59E0B` | Amber — medium risk |
| `--low` | `#22C55E` | Pond green — low risk / approve |
| `--debate` | `#8B5CF6` | Violet — meta-agent debate |
| `--risk-low-bg` | `#DCFCE7` | Mint wash — low risk backgrounds |
| `--risk-med-bg` | `#FFF3E0` | Soft amber — medium risk backgrounds |
| `--risk-high-bg` | `#FFEBEE` | Rose petal — high risk backgrounds |
| `--meta-bg` | `#EDE9FE` | Lavender — Round 2 meta context |

**Key design rule:** Unlike previous iterations, the **pool canvas is light**, not dark. It renders a linear gradient from `#DFF7F3` (pale aqua top) to `#9FD8D3` (deeper teal bottom). The bioluminescent metaphor is expressed through caustic light effects and glowing tadpole bodies, not a dark background.

---

### 8.2 Typography

| Property | Value |
|----------|-------|
| Font family | `Inter` (loaded via `next/font/google`) |
| Fallback | `Plus Jakarta Sans`, `system-ui` |
| Base size | `13px` |
| Label weight | `500` (Medium) |
| Heading / score weight | `800` (ExtraBold) |
| Monospace (IDs, flags, fields, hashes) | `Cascadia Code`, `Fira Code`, `Consolas` |

---

### 8.3 UI Geometry

| Token | Value | Applied to |
|-------|-------|-----------|
| `--r-xl` | `24px` | Main panels, pool panel |
| `--r-lg` | `16px` | Profile card, decision card, case cards |
| `--r-md` | `10px` | Inputs, doc items, file entries, badges |
| `--r-sm` | `6px` | Tags, pills, small chips |
| `--shadow` | `0 12px 40px rgba(18,52,59,0.10)` | All `.panel` elements |
| `--shadow-s` | `0 4px 12px rgba(18,52,59,0.08)` | Inline cards |

The **bottom intake dock** uses `backdrop-filter: blur(20px)` so the pool is partially visible beneath the form.

The **top bar** uses `backdrop-filter: blur(18px)` + `rgba(255,255,255,0.72)` for a frosted-glass effect.

**All drawers** use `backdrop-filter: blur(20px)` over `rgba(255,255,255,0.72)` — they float in front of the canvas rather than replacing it.

---

### 8.4 Agent State Colors (Canvas)

These are the teal-tuned aquatic colors defined in `apps/web/lib/types.ts` as `STATE_COLORS`.

| State | Color | Hex | Meaning |
|-------|-------|-----|---------|
| `idle` | Aqua | `#33D1C6` | Slow Brownian float near spawn position |
| `analyzing` | Teal | `#14B8A6` | Orbiting target evidence node |
| `alert` | Amber | `#F59E0B` | Medium risk signal detected |
| `suspicious` | Red | `#EF4444` | High risk flag raised |
| `debate` | Violet | `#8B5CF6` | Round 2 meta-agent challenge phase |
| `consensus` | Pond Green | `#22C55E` | All agents converged, decision reached |
| `done` | Pond Green | `#22C55E` | Case complete |

---

### 8.5 Pool Canvas — Tadpole & Animation Spec

The pool canvas is rendered at 60fps using the browser's native Canvas 2D API in `TadpolePool.tsx`. The canvas automatically resizes to fill its parent via `ResizeObserver`.

#### Canvas layers (drawn in order each frame)

1. **Background gradient** — linear `#DFF7F3 → #CBEFEB → #B8E7E1 → #9FD8D3`
2. **Caustic light effects** — 6 drifting radial glows (`rgba(255,255,255,0.13)`) that slowly oscillate, simulating underwater light refraction
3. **Plankton particles** — 45 tiny `rgba(20,184,166,alpha)` dots drifting in Brownian motion, wrapping at edges
4. **Ripples** — expanding rings (`rgba(51,209,198,alpha)`) spawned on sharp turns and target arrivals
5. **Evidence node connections** — curved dashed teal lines between related evidence nodes; brighter when agents are actively investigating them
6. **Round 2 debate links** — dashed violet lines (`rgba(139,92,246,alpha)`) from Skeptic/Prosecutor to all 7 core agents when Round 2 is active; opacity pulses with `sin(t * 0.003)`
7. **Evidence nodes** — glass circles (15 px radius, `rgba(255,255,255,0.72)` fill, teal stroke). Risk-colour-coded aura when findings are mapped. Short-label inside, full-label below
8. **Tadpoles** — biological organism shape: elliptical head + sinusoidal tail + eye + eye glint
9. **Chat bubbles** — white glass `roundRect` speech bubbles that rise and fade over 4.5 s
10. **Phase overlays** — idle hint text; done coloured wash + decision status label

#### Tadpole shape

Each agent is rendered as a **biological tadpole**, not an abstract node:

- **Head** — radial-gradient ellipse (`size × size * 0.85`). White core fades to the agent's state colour
- **Tail** — sinusoidal stroke behind the head: 5 segments with `sin(tailPhase + progress * 2) * sway` lateral offset. Fatter near the head, tapering to the tip. Opacity `0.42` idle, `0.62` active
- **Eye** — dark circle (`#0D2B28`) with a white glint highlight
- **Glow ring** — radial gradient halo (`color + "50" → color + "00"`) for non-idle states
- **Label** — 2-letter short ID rendered below the head in dark teal at `8px bold`

#### Trail system (removed)

Trails are **not** used in the current implementation. Position history is kept at 6 entries (`trail`) for internal physics reference only; no trail is drawn.

#### State-specific motion

| State | Motion behaviour |
|-------|-----------------|
| `idle` | Slow Brownian drift toward spawn position. `getThrust = 0.022`. |
| `analyzing` | Orbits the target evidence node in an ellipse (`±32 × 20 px`). `getThrust = 0.062`. |
| `alert` | Tight hover near evidence node (`±24 × 15 px`). `getThrust = 0.052`. |
| `suspicious` | Tight hover near evidence node; triggers risk gravity pulling nearby tadpoles. `getThrust = 0.072`. |
| `debate` | Meta/chair agents orbit the pool center (`cx, cy`) at `±42 × 26 px`. Vigorous heading oscillation. `getThrust = 0.082`. |
| `consensus` / `done` | All 10 nodes lock into hexagonal grid formation centered on the pool. Tiny `±3 px` oscillation. `getThrust = 0.016`. |

#### Hexagonal grid positions (consensus)

At consensus, agents converge to these offsets from pool center `(cx, cy)`:

| Index | Agent | Offset (dx, dy) |
|-------|-------|-----------------|
| 0 | NatureOfBusiness | (0, −58) |
| 1 | RegistrationAge | (+50, −29) |
| 2 | DocumentAuthenticity | (+50, +29) |
| 3 | ExistenceVerification | (0, +58) |
| 4 | NameMatching | (−50, +29) |
| 5 | BeneficiaryConsistency | (−50, −29) |
| 6 | HistoricalSuspicion | (0, 0) |
| 7 | Skeptic | (0, −116) |
| 8 | Prosecutor | (+100, 0) |
| 9 | Chair | (−100, 0) |

#### Risk gravity

When a `high`-risk tadpole is present, a weak gravitational force pulls all other tadpoles toward it within a 130 px radius, visually clustering the swarm around the flagged evidence.

#### Hit-testing and tooltips

Mouse position is mapped to canvas coordinates via `getBoundingClientRect` + scale factors. Any tadpole within 20 px radius is considered hit. On hover: a glass tooltip appears with agent name, state, summary (≤80 chars), and confidence %. On click: `onAgentClick(agentId)` is fired (propagated up to `page.tsx`).

#### Phase overlays

- **Idle**: instruction text at 93% height (`"Submit a case below to activate the swarm"`)
- **Done**: translucent coloured wash (`statusColor + "0e"`) over the whole canvas; bold decision status text at 93% height with a matching `shadowBlur: 28` glow

---

### 8.6 Evidence Node Map

Evidence nodes are static glass circles positioned by percentage coordinates, defined in `apps/web/lib/types.ts` as `EVIDENCE_NODES`.

| Node ID | Label | Position (x%, y%) | Connected to |
|---------|-------|-------------------|-------------|
| `company` | Company | 50%, 42% | registration, existence, nob, documents, beneficiary |
| `registration` | Reg. Date | 26%, 20% | company |
| `existence` | Existence | 74%, 20% | company |
| `documents` | Documents | 20%, 68% | company, beneficiary, nob |
| `nob` | Nature of Biz | 50%, 76% | company, documents |
| `beneficiary` | Beneficiary | 74%, 42% | company, documents, bank |
| `bank` | Bank / Acct | 76%, 68% | beneficiary |
| `center` | (hidden) | 50%, 44% | meta agents converge here |

Connection lines are curved dashed teal arcs (`quadraticCurveTo`). The `center` node is invisible — meta agents orbit it during debate.

---

### 8.7 Component Catalog

#### `GraphWorkbench` (`components/workbench/GraphWorkbench.tsx`)

Wraps `TadpolePool` with:
- **Zoom controls** — `+` / `%` / `−` buttons (range 0.5×–2.5×, step 0.15). Transform applied via CSS `scale()` on the canvas wrapper
- **Mode badge** — top-center pill showing current mode:
  - `MODE 1 — INTAKE` (grey, while `phase === "idle"`)
  - `MODE 2 — INVESTIGATION` (teal, while processing)
  - `MODE 3 — DECISION` (red, when `phase === "done"`)
- Three CSS classes (`graph-workbench--intake/investigation/decision`) for filter adjustments

#### `InvestigationReportPanel` (`components/report/InvestigationReportPanel.tsx`)

Fixed 300 px right panel. Contains:

| Sub-component | Description |
|---------------|-------------|
| Report header | "Investigation Report" label + final decision status (coloured) |
| 6 investigation steps | Collapsible rows mapped via `mapFindingsToSteps`. Each row: icon + label + finding count badge + chevron. Expanded: per-finding cards with agent name, risk, summary, flags, reasoning |
| Recommended actions | Action cards with `high/medium/low` priority borders + badges, built by `buildRecommendedActions` |
| Bank escalation block | Appears when `score ≥ 90` and a bank name is known. "Get Fraud Contact" button fetches `/api/bank-contacts` |

**Investigation steps** (`mapFindingsToSteps`):
1. `01 Intake` — done once case is submitted
2. `02 Document Extraction` — done once docs are uploaded
3. `03 Authenticity Check` — `DocumentAuthenticityAgent`
4. `04 Company Verification` — `RegistrationAge`, `NatureOfBusiness`, `ExistenceVerification`, `HistoricalSuspicion`
5. `05 Beneficiary & Bank` — `NameMatching`, `BeneficiaryConsistency`
6. `06 Decision` — `Skeptic`, `Prosecutor`, `Chair`

Step status: `pending → running → done / flagged`. Flagged = any `medium` or `high` risk findings.

#### `LeftDrawer` (`components/LeftDrawer.tsx`)

310 px panel that slides from the left edge. Opens automatically when a case starts. Contains:

| Section | Content |
|---------|---------|
| Progress | 6-step vertical stepper (Intake → Upload → Extraction → Swarm Review → Challenge → Decision) |
| Agent Progress | Agent progress pill grid (shown during `processing`): short label + pip with state color |
| Case | Company profile card (teal gradient avatar + initials), company meta, beneficiary meta, case ID |
| Documents | Per-doc row: filename, status pill, SHA-256 hash (truncated), extracted field count |
| Timeline | `CaseTimeline` component — severity-coloured event rows with elapsed-time stamps |
| Agent States | Legend: 5 color swatches for idle / analyzing / alert / high risk / debating |

#### `CaseHistoryDrawer` (`components/history/CaseHistoryDrawer.tsx`)

300 px panel that slides from the right edge, opened via the "History" top-bar button. Groups past cases into Processing / Decided / Flagged sections. Each item expands on click to load risk score, top 3 agent findings, and uploaded documents via `GET /api/cases/:id`.

#### `CaseTimeline` (`components/CaseTimeline.tsx`)

Renders `TimelineEvent[]` as a scrollable list. Each entry has a left border coloured by severity (`info` grey / `low` green / `medium` amber / `high` red) and a monospace elapsed-time stamp.

#### `ThoughtBubble` / `AgentThoughtPanel` (`components/agents/ThoughtBubble.tsx`)

- **`ThoughtBubble`** — absolute-positioned HTML overlay near a tadpole (used for in-canvas speech bubbles in HTML layer)
- **`AgentThoughtPanel`** — click-to-open glass panel showing agent intent, evidence list, interim opinion, and a confidence bar

#### Bottom dock — `IntakeForm` / `CaseSummaryDock`

The dock uses **Framer Motion `AnimatePresence`**:
- Form exits: `scale(0.95)` + `blur(4px)` + `opacity 0` over `280ms`
- Summary enters: `translateY(+6 → 0)` + `opacity 0 → 1` over `220ms`
- Dock `max-height` animates from `270px` (form open) to `62px` (summary bar) over `0.4s`

#### Cases queue page — `/cases`

Three-column Kanban grid at `apps/web/app/cases/page.tsx`. Polls `GET /api/cases`. Columns: **Processing**, **Decided**, **Flagged**. Each case card shows company name, case ID (mono), status badge, and links to the workbench.

---

### 8.8 Interaction Patterns

#### The Dive Transition
When the user submits the form, `AnimatePresence` with `mode="wait"` blurs and scales the `IntakeForm` out while the `CaseSummaryDock` fades in from below. The left drawer auto-opens to reveal the case context as the swarm begins.

#### Risk Heatmap
After a decision is received, the `app-root` background shifts temperature based on `decision.score`:

| Score | Background gradient |
|-------|-------------------|
| 0–39 | `#EDF9F7 → #DCFCE7` (cool mint) |
| 40–89 | `#EDF9F7 → #FFFBEC` (warm white) |
| 90–149 | `#EDF9F7 → #FFF3E0` (soft amber) |
| 150+ | `#EDF9F7 → #FDECEA` (soft rose) |

Transition is `1.2s ease`.

#### Pool Done Overlay
When phase is `done`, a translucent coloured fill (`statusColor + "0e"`) washes the entire pool, and the final decision status is rendered in bold at 93% pool height with a `shadowBlur: 28` glow.

#### Zoom / Pan
Zoom buttons in the top-right corner of the canvas wrapper scale the canvas between 0.5×–2.5× using CSS `transform: scale()` with a `0.25s ease` transition.

---

### 8.9 Design Principles

1. **Aquatic immersion, light surfaces** — The pool canvas is a bright teal aquatic environment; all surrounding panels are glass white floating above it. Unlike dark-pool designs, the investigator is inside the water, not looking down into it.
2. **Biological agents, not nodes** — Tadpoles are rendered as living organisms (head + sinusoidal tail + eye) to make the swarm feel alive. The "tadpole" metaphor is literal in the rendering.
3. **Color carries meaning** — Every risk level has a consistent color used across canvas tadpoles, evidence nodes, panel bubbles, pills, and badges. Never use a risk color for decoration.
4. **Motion explains reasoning** — Orbiting = investigating. Tight hovering = flagged. Hexagonal grid = consensus. Violet links = challenge relationship. Motion is semantically meaningful.
5. **Explainable decisions** — Every decision is traceable through the Investigation Report Panel: step status → expanded findings → flag codes → reasoning lines → recommended actions.
6. **Drawers, not sidebars** — Context and history slide in as overlays rather than occupying permanent space, maximising the canvas area for the swarm.

---

## 9. Swarm Execution Flow

```
POST /api/cases
  │
  ├─ Inserts case row, returns { caseId } immediately (non-blocking)
  │
  └─ Background: runSwarm(caseId, caseInput)
        │
        ├── loadExtractedFields()        ← reads extracted_fields from DB
        │
        ├── Round 1 — parallel (7 agents)
        │     NatureOfBusiness
        │     RegistrationAge
        │     DocumentAuthenticity
        │     ExistenceVerification
        │     NameMatching
        │     BeneficiaryConsistency
        │     HistoricalSuspicion
        │     → insertAgentFindings(round=1) + logAudit + emit SSE
        │
        ├── Round 2 — sequential (2 agents, reads Round 1 via sharedMemory)
        │     SkepticAgent    → challenges false positives
        │     ProsecutorAgent → challenges leniency
        │     → insertAgentFindings(round=2) + logAudit + emit SSE
        │
        ├── Round 3 — single synthesis agent
        │     ChairAgent      → reads all findings, produces consensus
        │     → insertAgentFindings(round=3) + logAudit + emit SSE
        │
        └── PolicyEngine.decide()
              → evaluates 10 hard rules against all agent flags
              → computes final score + status
              → inserts into decisions + risk_signals
              → emit SSE "decision"
```

Inter-agent communication happens through `SharedMemoryClass`. Each agent calls `sharedMemory.publish(finding)` after completing; later agents call `sharedMemory.snapshot()` to read all prior findings.

---

## 10. Policy Engine

`apps/api/src/services/policyEngine.ts`

Takes the full `AgentFinding[]` snapshot from shared memory and produces a `DecisionResult`.

### Scoring

- Each `high` risk finding: **+40 points**
- Each `medium` risk finding: **+20 points**
- Each `low` risk finding: **+5 points**

### Hard rules (applied on top of base score)

| Rule code | Triggered by flag | Score boost | Min status |
|-----------|-------------------|-------------|------------|
| `RULE_FORGERY` | `DOC_FORGERY_SIGNAL` | +100 | `reject` |
| `RULE_DIRECTORY_MATCH` | `DIRECTORY_MATCH` (and variants) | +60 | `escalate` |
| `RULE_ACCOUNT_MISMATCH` | `ACCOUNT_MISMATCH` | +50 | `manual_review` |
| `RULE_NO_DOCS` | `NO_DOCUMENTS_UPLOADED` | +30 | `manual_review` |
| `RULE_NEW_ENTITY_NO_DOCS` | `PATTERN_NEW_ENTITY_NO_DOCS` | +70 | `escalate` |
| `RULE_PROXY_ENTITY` | `PATTERN_PROXY_ENTITY` | +65 | `escalate` |
| `RULE_HIGH_RISK_SECTOR_NEW` | `PATTERN_NEW_HIGH_RISK_SECTOR` | +55 | `escalate` |
| `RULE_CUMULATIVE_MEDIUM` | `PATTERN_CUMULATIVE_MEDIUM_RISK` | +25 | `manual_review` |
| `RULE_CHAIR_REJECT` | `CHAIR_RECOMMENDS_REJECT` | +90 | `reject` |
| `RULE_CHAIR_ESCALATE` | `CHAIR_RECOMMENDS_ESCALATE` | +50 | `escalate` |

### Score-to-status floor

| Score | Status floor |
|-------|-------------|
| 0–39 | `approve` |
| 40–89 | `manual_review` |
| 90–149 | `escalate` |
| 150+ | `reject` |

The final status is the **maximum** of all triggered rule statuses and the score-based floor.

---

## 11. Audit & Compliance

Every significant event is written to `audit_logs` by `auditService.ts`.

Logged events include:
- `swarm.started` — agents list, extracted field count, timestamp
- `agent.finding` — full finding per agent per round
- `swarm.round1.complete` / `round2.complete` / `round3.complete`
- `policy.decision` — final status, score, triggered rules, total duration

### Audit endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/cases/:id/audit/replay` | Ordered timeline of all events for a case |
| `GET /api/cases/:id/audit/export` | Full JSON export for compliance archiving |

The audit log is append-only and never stores raw document contents or unmasked sensitive data.

---

## 12. LLM Layer

| Component | Location | Notes |
|-----------|----------|-------|
| LLM Client | `packages/agents/src/llm/client.ts` | Calls Ollama `/api/generate`, timeout-aware |
| Model Router | `packages/agents/src/llm/modelRouter.ts` | Maps agent tier → model via `TIER_SPECS` |
| Agent prompts | `packages/agents/src/index.ts` | `agentPrompts` constant — one prompt per agent |

Current model: `qwen2.5:7b` for all tiers.

Target model routing (when hardware supports):

| Round | Tier | Target model |
|-------|------|-------------|
| 1 (fact-checkers) | Tier 1 | `qwen2.5:7b` |
| 1 (analysis) | Tier 2 | `qwen2.5:14b` |
| 2 (meta agents) | Tier 2 | `qwen2.5:14b` |
| 3 (chair synthesis) | Tier 3 | `qwen2.5:32b` |

To upgrade a tier, edit `TIER_SPECS` in `modelRouter.ts`. All LLM calls fail gracefully — agents fall back to deterministic logic on timeout or connection failure.

---

## 13. API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness check |
| `POST` | `/api/cases` | Submit a new onboarding case |
| `GET` | `/api/cases` | List all cases (used by History drawer + Queue page) |
| `GET` | `/api/cases/:id` | Get single case with decision + documents |
| `POST` | `/api/cases/:id/upload` | Upload a document (PDF/JPG/PNG, max 20 MB) |
| `POST` | `/api/cases/:id/extract` | Run extraction on uploaded documents |
| `GET` | `/api/cases/:id/stream` | SSE stream — live swarm events |
| `GET` | `/api/cases/:id/audit/replay` | Timeline replay of all swarm events |
| `GET` | `/api/cases/:id/audit/export` | Full compliance export (JSON) |
| `POST` | `/api/cases/:id/cleanup` | Delete temp files, archive case |
| `GET` | `/api/cases/:id/cleanup/status` | Check cleanup status |
| `GET` | `/api/bank-contacts` | Look up fraud contact for a bank name |

### SSE event types (streamed to frontend)

| Event | When emitted |
|-------|-------------|
| `agent.started` | Agent begins processing |
| `agent.complete` | Agent returns a finding |
| `round.complete` | All agents in a round finish |
| `challenge.started` | Round 2 begins |
| `synthesis.started` | Round 3 begins |
| `decision` | Policy engine produces final result |

---

## 14. Decision Outcomes

| Status | Score range | Ring color | Meaning |
|--------|-------------|------------|---------|
| `approve` | 0–39 | `#22C55E` Pond Green | Low risk — safe to onboard |
| `manual_review` | 40–89 | `#F59E0B` Amber | Moderate — human review recommended |
| `escalate` | 90–149 | `#F97316` Orange | Elevated risk — compliance team review |
| `reject` | 150+ or hard rule | `#EF4444` Red | High risk or hard rule triggered |

---

## 15. Environment Variables

Create `.env` or `apps/api/.env` to override defaults:

```env
# PostgreSQL
PGHOST=localhost
PGPORT=5433
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=tadpools

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minio
MINIO_SECRET_KEY=minio123
MINIO_BUCKET=tadpools-temp

# Ollama
OLLAMA_URL=http://localhost:11434
LLM_TIMEOUT_MS=25000

# API
PORT=4000
```

---

## 16. Build & Start

```bash
# 1. Install all workspace dependencies
npm install

# 2. Build shared types and agents (required before API starts)
npm run build -w @tadpools/shared
npm run build -w @tadpools/agents

# 3. Start infrastructure
docker compose -f infra/docker-compose.yml up -d

# 4. Pull LLM model (first time only, ~4.7 GB)
ollama pull qwen2.5:7b

# 5. Start API (Terminal 1)
npx tsx apps/api/src/server.ts

# 6. Start frontend (Terminal 2)
npm run dev -w @tadpools/web
```

Open `http://localhost:3000`.

Full production build (all workspaces in dependency order):

```bash
npm run build
```
