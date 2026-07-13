# Tadpools v2 — Build Plan

> Blueprint: `docs/good-design.md` (14-prompt sequence) + `docs/claude-ready.md` (PostgreSQL v2 schema)  
> Stack: Next.js 15 / React 19 / Tailwind · Express 4 · PostgreSQL 5433 · TypeScript throughout  
> Constraint: local-first, no cloud dependencies, portable to on-prem

---

## Phase 0 — Discovery Summary (COMPLETE)

**Current v1 state:**
- 8-table simplified schema (cases, extracted_fields, agent_findings, risk_signals, decisions, audit_logs, recommended_actions, bank_escalation_contacts)
- 9 API routes, all case-focused (no entity, signals, or policy-rule routes)
- 2 frontend pages (/ — intake+workspace, /cases — queue)
- OASIS aquatic theme established (CSS vars: --accent #14B8A6, --bg #EDF9F7, etc.)
- Packages: agents (10 agents), shared (minimal types)

**v2 additions required:**
- 25-table enterprise schema (entities, signals, policy_rules, timeline_events, analyst_actions, decision_overrides, etc.)
- Entity reuse logic (query before creating)
- 5 product areas: Command Center, Case Reasoning, Entity Intelligence, Evidence Explorer, Audit Panel
- Analyst action buttons wired to audit trail
- Persistent timeline events (currently SSE-only)

---

## Phase 1 — Database Schema Migration

**Goal:** Replace v1 simplified schema with full v2 schema from `docs/claude-ready.md`.

### What to do

1. **Read current `apps/api/src/db/migrate.ts`** — understand existing DDL (v1: 8 tables).
2. **Replace `migrate.ts`** with the full v2 schema from `docs/claude-ready.md`:
   - All enums (case_status_enum, decision_type_enum, entity_type_enum, etc.)
   - All 25+ tables with proper foreign keys and indexes
   - All triggers (set_updated_at)
   - All views (v_case_signal_summary, v_entity_case_counts)
   - Wrap in `IF NOT EXISTS` for idempotency so it can be re-run safely
3. **Update `apps/api/src/db/caseRepository.ts`** to use v2 schema:
   - `insertCase()` → write to new `cases` table columns (links to entity IDs via `company_entity_id`, `beneficiary_entity_id`, `bank_entity_id`)
   - `listCases()` → JOIN `decisions`, `entities` for display
   - `getCaseById()` → return full v2 case with entity links
   - Add `upsertEntity()` — look up by canonical_name + entity_type, create if not found
   - Add `insertSignal()`, `insertTimelineEvent()`, `insertAnalystAction()`
4. **Create `apps/api/src/db/entityRepository.ts`**:
   - `findEntityByName(name, type)` — case-insensitive lookup
   - `upsertEntity(payload)` — create or update
   - `listEntities(filter)` — paginated search
   - `getEntityWithRelationships(id)` — entity + linked entities + linked cases

### Documentation references
- Schema DDL: `docs/claude-ready.md` (entire file — use as-is)
- Old schema pattern: `apps/api/src/db/migrate.ts` (to understand what's being replaced)
- Repository pattern: `apps/api/src/db/caseRepository.ts` (existing pattern to follow)
- Pool config: `apps/api/src/db/pool.ts` (unchanged — `db` export used everywhere)

### Verification
```bash
# After migration runs:
psql -p 5433 -U postgres -d tadpools -c "\dt"
# Expect: app_users, cases, decisions, documents, entities, entity_aliases,
#         entity_relationships, extracted_fields, model_versions, policy_rules,
#         policy_versions, signals, timeline_events, analyst_actions, audit_logs,
#         decision_overrides, bank_escalation_contacts

psql -p 5433 -U postgres -d tadpools -c "\dv"
# Expect: v_case_signal_summary, v_entity_case_counts
```

### Anti-patterns
- Do NOT drop old tables — add `IF NOT EXISTS` and `ALTER TABLE ADD COLUMN IF NOT EXISTS` for live migration
- Do NOT hardcode entity UUIDs — always look up or generate via `gen_random_uuid()`

---

## Phase 2 — Shared Types Centralization

**Goal:** Single source of truth for all TypeScript types shared across web + api.

### What to do

1. **Read `apps/web/lib/types.ts`** — 14 existing types (keep all, extend).
2. **Read `apps/api/src/types/index.ts`** — AuditEvent interface.
3. **Rewrite `packages/shared/src/index.ts`** with unified v2 types:

```typescript
// Enums (mirrors DB enums)
export type CaseStatus = 'draft' | 'submitted' | 'processing' | 'needs_review' | 'escalated' | 'approved' | 'rejected' | 'closed'
export type DecisionType = 'approve' | 'reject' | 'escalate' | 'hold' | 'request_documents' | 'monitor'
export type EntityType = 'company' | 'beneficiary' | 'bank_account' | 'bank' | 'person' | 'document' | 'case'
export type ModuleType = 'intake' | 'extraction' | 'authenticity' | 'entity_verification' | 'relationship_matching' | 'historical_intelligence' | 'challenge_phase' | 'decision'
export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical'
export type SignalDirection = 'risk_increasing' | 'risk_reducing' | 'unresolved'
export type ActorType = 'system' | 'agent' | 'analyst' | 'admin'
export type RuleType = 'hard_block' | 'warning' | 'informational' | 'scoring'

// Existing web types (keep + re-export)
export type AgentState = 'idle' | 'analyzing' | 'alert' | 'suspicious' | 'debate' | 'consensus' | 'done'
export type DocStatus = 'uploading' | 'uploaded' | 'extracting' | 'hashed' | 'deleted' | 'ready'
export type RiskLevel = 'low' | 'medium' | 'high'

// v2 entity types
export interface Entity {
  id: string; entityType: EntityType; canonicalName: string; normalizedName?: string;
  registrationNumber?: string; countryCode?: string; riskScore?: number;
  firstSeenAt?: string; lastSeenAt?: string; metadata: Record<string, unknown>;
  createdAt: string; updatedAt: string;
}

export interface EntityRelationship {
  id: string; fromEntityId: string; toEntityId: string; relationshipType: string;
  confidence?: number; source?: string; evidence: Record<string, unknown>;
}

// v2 signal types
export interface Signal {
  id: string; caseId: string; documentId?: string; entityId?: string;
  policyRuleId?: string; module: ModuleType; signalCode?: string; signalName: string;
  description?: string; severity: Severity; direction: SignalDirection;
  confidence?: number; contributionScore: number; evidence: Record<string, unknown>;
  generatedBy: ActorType; createdAt: string;
}

// v2 decision types
export interface Decision {
  id: string; caseId: string; decisionType: DecisionType; finalScore?: number;
  confidence?: number; decisionNarrative?: string; recommendation?: string;
  triggeredRuleIds: string[]; riskSummary: Record<string, unknown>;
  computedBy: ActorType; createdAt: string; updatedAt: string;
}

// v2 timeline event
export interface TimelineEvent {
  id: string; caseId: string; eventType: string; module?: ModuleType;
  actorType: ActorType; actorUserId?: string; title: string; description?: string;
  payload: Record<string, unknown>; createdAt: string;
}

// v2 analyst action
export interface AnalystAction {
  id: string; caseId: string; actionType: DecisionType; note?: string;
  performedByUserId?: string; createdAt: string;
}

// v2 case (full)
export interface Case {
  id: string; caseReference: string; status: CaseStatus; priority: number;
  companyEntity?: Entity; beneficiaryEntity?: Entity; bankEntity?: Entity;
  intakePayload: Record<string, unknown>; currentModule: ModuleType;
  submittedAt?: string; decidedAt?: string; createdAt: string; updatedAt: string;
}

// Case list item (for queue)
export interface CaseListItem {
  id: string; caseReference: string; status: CaseStatus; priority: number;
  companyName: string; beneficiaryName?: string; bankName?: string;
  score?: number; createdAt: string;
}

// Audit event (replaces old AuditEvent)
export interface AuditLog {
  id: string; caseId?: string; entityId?: string; documentId?: string;
  actorType: ActorType; actorUserId?: string; module?: ModuleType;
  action: string; inputSummary?: Record<string, unknown>;
  outputSummary?: Record<string, unknown>; metadata: Record<string, unknown>;
  createdAt: string;
}

// Policy rule
export interface PolicyRule {
  id: string; policyVersionId?: string; ruleCode: string; ruleName: string;
  ruleType: RuleType; module: ModuleType; severity: Severity; description?: string;
  scoringWeight?: number; isActive: boolean;
}

// Dashboard KPIs
export interface DashboardStats {
  total: number; approved: number; rejected: number; escalated: number;
  pending: number; avgScore: number; highRiskCount: number;
}
```

4. **Update `packages/shared/package.json`** exports if needed.
5. **Update import paths** in `apps/api` and `apps/web` to use shared types where appropriate.

### Documentation references
- Old types: `apps/web/lib/types.ts`, `apps/api/src/types/index.ts`
- DB enums: `docs/claude-ready.md` lines 29-145

### Verification
```bash
cd packages/shared && npx tsc --noEmit
cd apps/api && npx tsc --noEmit
cd apps/web && npx tsc --noEmit
```

---

## Phase 3 — API v2 Routes

**Goal:** Add entity, signals, policy-rules, timeline, analyst-actions, and dashboard routes.

### What to do

1. **Create `apps/api/src/routes/entities.ts`**:
   - `GET /api/entities?q=&type=&page=` — search entities (paginated)
   - `GET /api/entities/:id` — entity detail with relationships
   - `POST /api/entities` — create entity (with upsert logic)
   - `GET /api/entities/:id/cases` — linked cases for entity

2. **Create `apps/api/src/routes/signals.ts`**:
   - `GET /api/cases/:caseId/signals` — all signals for a case, grouped by module
   - `GET /api/cases/:caseId/signals/summary` — score breakdown by module

3. **Create `apps/api/src/routes/policy.ts`**:
   - `GET /api/policy/rules` — list active rules
   - `GET /api/policy/versions` — list policy versions

4. **Create `apps/api/src/routes/timeline.ts`**:
   - `GET /api/cases/:caseId/timeline` — ordered timeline events
   - `POST /api/cases/:caseId/timeline` — insert event (for analyst notes)

5. **Create `apps/api/src/routes/actions.ts`**:
   - `POST /api/cases/:caseId/actions/approve` — approve + log
   - `POST /api/cases/:caseId/actions/reject` — reject + log
   - `POST /api/cases/:caseId/actions/escalate` — escalate + log
   - `POST /api/cases/:caseId/actions/request-documents` — request docs + log
   - Each action: update `cases.status`, insert `analyst_actions`, insert `timeline_events`, insert `audit_logs`

6. **Create `apps/api/src/routes/dashboard.ts`**:
   - `GET /api/dashboard/stats` — aggregated KPIs (total, by status, avg score, high-risk count)
   - `GET /api/dashboard/recent` — last 10 cases with status + score

7. **Update `apps/api/src/server.ts`** to mount all new route modules.

8. **Update swarmService.ts** to write structured `signals` rows (not just `risk_signals`) and `timeline_events` rows after each agent run.

### Documentation references
- Route pattern: `apps/api/src/routes/cases.ts` (Zod validation, async handlers, db queries)
- Repository pattern: `apps/api/src/db/caseRepository.ts`
- Schema target: `docs/claude-ready.md` (signals, timeline_events, analyst_actions tables)

### Verification
```bash
# Test each new route:
curl http://localhost:4000/api/entities
curl http://localhost:4000/api/dashboard/stats
curl -X POST http://localhost:4000/api/cases/TEST_ID/actions/approve \
  -H "Content-Type: application/json" -d '{"note":"test"}'
```

---

## Phase 4 — App Shell v2 (Navigation + Layout)

**Goal:** Replace single-page layout with multi-page enterprise shell.

### What to do

1. **Update `apps/web/app/layout.tsx`** with top navigation bar:
   - Logo: "🐸 Tadpools" (aquatic brand)
   - Nav links: Dashboard, Queue, Active Case, Entity Intel, Evidence, Audit
   - Active state using `usePathname()`
   - Sticky header, full-width content area

2. **Create shared UI primitives in `apps/web/components/ui/`**:
   - `Badge.tsx` — severity/status colored badges (reuse CSS vars: --high, --medium, --low, --accent)
   - `Card.tsx` — glass panel card (uses --panel, --border, --shadow)
   - `SectionHeader.tsx` — module/section header with optional icon + description
   - `EmptyState.tsx` — empty list placeholder with icon + message
   - `LoadingSpinner.tsx` — branded teal spinner
   - `StatCard.tsx` — KPI metric card (label + value + trend)
   - `ScoreBar.tsx` — horizontal risk score bar (0–200 range, color by threshold)

3. **Add new routes** to Next.js:
   - `/dashboard` — Command Center Dashboard (new page)
   - `/entities` — Entity Intelligence Workspace (new page)
   - `/evidence` — Evidence & Signal Explorer (new page — or case-level tab)
   - `/audit` — Audit & Governance Panel (new page)
   - Existing: `/` (intake + active case), `/cases` (queue)

4. **Update `apps/web/app/globals.css`** with any new utility classes needed by v2 components.

### Documentation references
- CSS theme: `apps/web/app/globals.css` lines 1-100 (--accent, --bg, --panel, --border, --shadow, etc.)
- Existing nav hint: `apps/web/app/layout.tsx` (currently minimal — expand it)
- Existing case card styles: `apps/web/app/cases/page.tsx` (STATUS_META map)

### Verification
- All pages render without error in dev server
- Navigation active state correct on each page
- UI primitives render with correct theme colors

---

## Phase 5 — Command Center Dashboard

**Goal:** Operational visibility for fraud/compliance teams. Page: `/dashboard`.

### What to do

1. **Create `apps/web/app/dashboard/page.tsx`**:

   **KPI Row (top section):**
   - Total cases today / this week
   - Approved count (green)
   - Rejected count (red)
   - Escalated count (amber)
   - Avg risk score
   - High-risk flags count
   - Data from `GET /api/dashboard/stats`

   **Risk distribution (mid section):**
   - 5-bar horizontal chart: approved / manual_review / escalated / rejected / processing
   - Bars use CSS vars (--low, --medium, --high colors)
   - Label shows count + percentage

   **Live case feed (right column):**
   - Last 10 cases from `GET /api/dashboard/recent`
   - Each row: company name, status badge, score, time elapsed
   - Click → navigate to `/?caseId=xxx`

   **Action queue (bottom section):**
   - Cases with status = needs_review or escalated
   - "Requires attention" framing
   - Quick-action buttons (View, Assign)

2. Use StatCard, Badge, ScoreBar, EmptyState primitives from Phase 4.
3. Poll `/api/dashboard/stats` every 30s for live updates.

### Why each visualization:
- KPI row: immediate operational status without drilling down
- Risk distribution: identifies systemic bias (too many escalates = tuning needed)
- Live case feed: real-time awareness without navigating queue
- Action queue: ensures nothing is forgotten

### Documentation references
- UI primitives: Phase 4 output (StatCard, Badge, ScoreBar)
- Data source: `GET /api/dashboard/stats`, `GET /api/dashboard/recent`
- Style tokens: `apps/web/app/globals.css`

---

## Phase 6 — Entity Intelligence Workspace

**Goal:** Search and reuse validated entities across cases. Page: `/entities`.

### What to do

1. **Create `apps/web/app/entities/page.tsx`**:

   **Search bar (top):**
   - Input: search by company name, beneficiary, bank, registration number
   - Filters: entity type dropdown (company / beneficiary / bank / person)
   - Debounced search → `GET /api/entities?q=...&type=...`

   **Entity list (left panel):**
   - Cards: entity name, type badge, risk score indicator, linked case count, last seen date
   - Click → loads entity profile in right panel

   **Entity profile (right panel):**
   - Header: entity name, type, registration number, country
   - Risk score bar
   - Metadata key-value display
   - Linked cases list (from `GET /api/entities/:id/cases`)
   - Relationships section: entities this entity connects to (from entityRelationships)

   **Relationship graph (embedded):**
   - Reuse existing `apps/web/lib/graph/buildGraph.ts` pattern
   - Nodes: entity + linked entities
   - Edges: relationship types (owns, controls, beneficiary_of, etc.)
   - Mini force-directed layout (no heavy library — SVG-based)

2. **Create `apps/web/components/entities/EntityCard.tsx`** — list item component.
3. **Create `apps/web/components/entities/EntityProfile.tsx`** — detail panel.
4. **Create `apps/web/components/entities/RelationshipMiniGraph.tsx`** — embedded graph.

### Documentation references
- Graph pattern: `apps/web/lib/graph/buildGraph.ts`, `apps/web/lib/graph/types.ts`
- Entity API: Phase 3 routes (`GET /api/entities`, `GET /api/entities/:id`)
- Types: Phase 2 (Entity, EntityRelationship interfaces)

---

## Phase 7 — Evidence & Signal Explorer

**Goal:** Investigate documents and signals per case. Integrated as a case tab.

### What to do

1. **Update `apps/web/components/case/EvidenceTab.tsx`** (existing, expand it):

   **Documents section:**
   - List uploaded documents: filename, type badge, SHA256 hash (truncated), status, upload date
   - Status: uploaded / parsed / verified / failed

   **Extracted fields section:**
   - Table: field_name | value | normalized_value | confidence bar
   - Grouped by document

   **Signals by module section:**
   - Accordion per module (extraction, authenticity, entity_verification, etc.)
   - Each signal: name, direction icon (↑ risk / ↓ risk / ⚪ unresolved), severity badge, contribution score, description
   - Total risk score at bottom of each module

   **Cross-reference mismatches:**
   - Highlight signals where direction = risk_increasing AND severity >= high
   - Show "Mismatch detected: [field_name] in [doc] vs [other_doc]"

   **Evidence summary:**
   - Net risk score (sum of contribution_scores by direction)
   - Most critical signals (top 3 by contribution_score)
   - Confidence range across all signals

2. **Create `apps/web/components/evidence/SignalRow.tsx`** — single signal display.
3. **Create `apps/web/components/evidence/ModuleAccordion.tsx`** — collapsible module group.
4. Data from: `GET /api/cases/:caseId/signals` (Phase 3).

### Documentation references
- Existing tab: `apps/web/components/case/EvidenceTab.tsx`
- Signal types: Phase 2 (Signal interface)
- API: `GET /api/cases/:caseId/signals` (Phase 3)

---

## Phase 8 — Audit & Governance Panel

**Goal:** Full traceability and compliance. Page: `/audit`.

### What to do

1. **Create `apps/web/app/audit/page.tsx`**:

   **Audit log stream (main section):**
   - Filterable by: case_id, actor_type (system/agent/analyst), module, date range
   - Each row: timestamp | actor | module | action | case ref (link) | expand for payload
   - Data from `GET /api/cases/:caseId/audit` (existing) or new global `GET /api/audit`

   **Decision reconstruction (right panel):**
   - Select a case → show decision chain: signals → rules triggered → final score → decision
   - Show if any overrides applied (decision_overrides table)
   - Show analyst actions taken

   **Override history:**
   - List all `decision_overrides` rows
   - Columns: case ref, original decision, new decision, reason, override note, date

   **Version tracking (bottom):**
   - Active policy version
   - Active model versions (per module)
   - Placeholder for future model version diff

2. **Create `apps/web/components/audit/AuditLogRow.tsx`** — expandable log entry.
3. **Create `apps/web/components/audit/DecisionReconstruction.tsx`** — decision chain view.
4. **Create `apps/api/src/routes/audit.ts`** — global audit log endpoint (not just per-case):
   - `GET /api/audit?limit=50&offset=0&actorType=&module=&caseId=`

### Documentation references
- Existing audit route: `apps/api/src/routes/auditRoutes.ts`
- Audit service: `apps/api/src/services/auditService.ts`
- DB table: `docs/claude-ready.md` audit_logs, decision_overrides tables

---

## Phase 9 — Intake Flow v2

**Goal:** Enhanced intake with entity reuse hint and parameter infographic.

### What to do

1. **Update `apps/web/components/IntakeForm.tsx`**:

   **Entity lookup hint (new):**
   - After typing company name: debounced check `GET /api/entities?q=...&type=company`
   - If match found: "We found [Company Name] — reusing verified entity" inline hint
   - Same for beneficiary name

   **Parameter infographic (new — add below form or as collapsible):**
   - Visual grid showing 8 system checks:
     1. Document Authenticity — "We verify document metadata and signatures"
     2. Entity Verification — "Company and beneficiary cross-referenced against registry"
     3. Name Matching — "Beneficiary name vs account name checked"
     4. Registration Age — "Entity age evaluated for risk"
     5. Nature of Business — "Sector risk classification applied"
     6. Historical Intelligence — "Prior case history retrieved"
     7. Relationship Mapping — "Entity connections traced"
     8. Challenge Phase — "Skeptic and Prosecutor agents stress-test findings"
   - Icons: simple SVG or Lucide icons; soft teal styling
   - Label: "Tadpools runs 8 verification checks across your submission"

   **Existing fields:** keep all 8 current fields (company 4, beneficiary 4).

2. **Update `POST /api/cases` handler** in `apps/api/src/routes/cases.ts`:
   - After validation, look up entities using `upsertEntity()` for company + beneficiary + bank
   - Store entity IDs in case row (`company_entity_id`, `beneficiary_entity_id`, `bank_entity_id`)
   - Insert `timeline_events` row: `case_created` event

### Documentation references
- Current form: `apps/web/components/IntakeForm.tsx`
- Entity upsert: Phase 1 (`entityRepository.ts`)
- API update: `apps/api/src/routes/cases.ts` POST handler

---

## Phase 10 — Case Reasoning Dashboard v2

**Goal:** Show WHY a case is risky. Enhanced existing case workspace.

### What to do

1. **Update `apps/web/components/case/OverviewTab.tsx`** (or create new `ReasoningTab.tsx`):

   **Case header (enhanced):**
   - Case reference, status badge, priority indicator, elapsed time, policy version
   - Entity links: company name (→ entity profile), beneficiary, bank

   **Reasoning rail (8 stages):**
   - Intake → Extraction → Authenticity → Entity → Relationship → Historical → Challenge → Decision
   - Each stage: module name, status (complete/active/pending), key finding summary, signal count
   - Current module highlighted; completed stages show green checkmark

   **Signal contribution panel:**
   - Stacked bar: risk_increasing vs risk_reducing scores by module
   - Net score = sum(risk_increasing) - sum(risk_reducing)
   - "Most impactful signals" — top 3 sorted by |contribution_score|

   **Decision narrative:**
   - `decisions.decision_narrative` text rendered as readable prose
   - Confidence percentage displayed as circular progress
   - Recommendation text

   **Recommended actions:**
   - From `decisions.risk_summary.recommendedActions` or `recommended_actions` table
   - Cards with priority color (high/medium/low)

2. Data sources: `GET /api/cases/:caseId` + `GET /api/cases/:caseId/signals/summary`

### Documentation references
- Existing tabs: `apps/web/components/case/OverviewTab.tsx`, `InvestigationTab.tsx`
- Signal types: Phase 2 (Signal, ModuleType)
- Decision type: Phase 2 (Decision interface)

---

## Phase 11 — Analyst Actions

**Goal:** Wire approve/reject/escalate/request-docs buttons to full audit trail.

### What to do

1. **Update `apps/web/components/case/DecisionTab.tsx`**:
   - Replace current override form with structured action buttons:
     - **Approve** (green) — only when status = needs_review
     - **Reject** (red) — available anytime post-processing
     - **Escalate** (amber) — routes to senior analyst
     - **Request Documents** (blue) — prompts document type dropdown + note field
   - Each button: confirmation modal with note textarea
   - After action: refresh case state, show success toast, update timeline

2. **API already created in Phase 3** (`POST /api/cases/:caseId/actions/*`).

3. **Timeline tab updates automatically** — new `analyst_action` events appear in timeline.

4. **Audit tab** reflects the action in audit_logs.

### Action flow per button:
```
User clicks "Reject" →
  Modal: "Reason for rejection" textarea + confirm
  → POST /api/cases/:caseId/actions/reject { note }
  → API: UPDATE cases SET status='rejected', decided_at=NOW()
  → API: INSERT analyst_actions (action_type='reject', note, performed_by_user_id)
  → API: INSERT timeline_events (event_type='analyst_action', title='Case Rejected', ...)
  → API: INSERT audit_logs (actor_type='analyst', action='case_rejected', ...)
  → Frontend: refresh case, show toast "Case rejected and logged"
```

### Documentation references
- Current override: `apps/web/components/case/DecisionTab.tsx` (override section)
- API: Phase 3 (`apps/api/src/routes/actions.ts`)
- Audit service: `apps/api/src/services/auditService.ts`

---

## Phase 12 — Production Hardening

**Goal:** UX consistency, error handling, type safety, responsiveness.

### Checklist

**Type safety:**
- `npx tsc --noEmit` passes in all 3 workspaces (api, web, packages/shared)
- No `any` types in new code
- All API responses typed against shared interfaces

**Error handling:**
- All `fetch()` calls have try/catch with user-visible error state
- API error middleware returns consistent `{ message: string }` shape
- Empty states for every list (entities, signals, audit logs)
- Loading spinners for all async data fetches

**UX consistency:**
- All status badges use same STATUS_META color map
- Score bars use consistent threshold: 0-40 green, 40-90 amber, 90+ red
- Navigation active state correct on all pages
- Mobile breakpoint (min 768px) doesn't break layout

**Performance:**
- Case list fetches max 50 rows (add LIMIT)
- Entity search debounced 300ms
- Dashboard stats cached 30s (no re-fetch on every render)

**Final build verification:**
```bash
cd apps/web && npx next build   # must succeed with no errors
cd apps/api && npx tsc --noEmit # must pass clean
```

---

## Execution Order

```
Phase 1  →  Database Migration
Phase 2  →  Shared Types
Phase 3  →  API Routes v2
Phase 4  →  App Shell + UI Primitives
Phase 5  →  Command Center Dashboard
Phase 6  →  Entity Intelligence Workspace
Phase 7  →  Evidence & Signal Explorer
Phase 8  →  Audit Panel
Phase 9  →  Intake Flow v2
Phase 10 →  Case Reasoning Dashboard
Phase 11 →  Analyst Actions
Phase 12 →  Production Hardening
```

Each phase is self-contained — a new chat context should read only its referenced files and execute only its tasks. The phases are ordered so each phase's outputs are available for the next.

---

## Key Invariants (Never Break)

1. **Local-first** — no fetch to external URLs; all data from `localhost:4000` or direct DB
2. **OASIS theme** — always use CSS vars (`--accent`, `--bg`, `--panel`, `--border`, `--shadow`) — no hardcoded hex in JSX
3. **Pool DB** — always import `db` from `apps/api/src/db/pool.ts`; never open a second PG connection
4. **Idempotent migrations** — all DDL uses `IF NOT EXISTS`; migrate.ts can be re-run safely
5. **No mock data in production code** — local DB seeds only; no hardcoded arrays in page components
6. **TypeScript strict** — no `as any`, no `@ts-ignore` without a comment explaining why
