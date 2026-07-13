# Tadpools — EXECUTION MASTER PLAN (Claude-Ready)

## OBJECTIVE

Transform Tadpools into:

> **Graph-Native KYC Investigation Workbench with Autonomous Agent Swarm**

Do NOT rebuild backend.
Refactor frontend + extend schema + enhance agent outputs.

---

# GLOBAL EXECUTION RULES

* DO NOT modify core swarm logic
* DO NOT remove existing endpoints
* EXTEND only
* FRONTEND drives transformation
* AGENTS become visible investigators
* GRAPH = PRIMARY UI
* REPORT = STRUCTURED OUTPUT
* HISTORY = AUDIT + MEMORY

---

# PHASE 0 — PREP

## TASK 0.1 — Create new folders

```bash
apps/web/components/workbench/
apps/web/components/graph/
apps/web/components/report/
apps/web/components/history/
apps/web/components/agents/
apps/web/lib/graph/
apps/web/lib/workbench/
```

---

# PHASE 1 — UI ARCHITECTURE REFACTOR

## TASK 1.1 — Replace main layout

### Replace:

`apps/web/app/page.tsx`

### With:

```tsx
<WorkbenchLayout>
  <TopBar />

  <MainContent>
    <GraphWorkbench />
    <InvestigationReportPanel />
  </MainContent>

  <BottomTray />
  <CaseHistoryDrawer />
</WorkbenchLayout>
```

---

## TASK 1.2 — Create GraphWorkbench

File:

```bash
apps/web/components/workbench/GraphWorkbench.tsx
```

### Must include:

* canvas (TadpolePool)
* zoom/pan support
* node rendering
* agent movement

---

## TASK 1.3 — Create InvestigationReportPanel

File:

```bash
apps/web/components/report/InvestigationReportPanel.tsx
```

### Structure:

```ts
const STEPS = [
  "01 Intake",
  "02 Document Extraction",
  "03 Authenticity Check",
  "04 Company Verification",
  "05 Beneficiary & Bank",
  "06 Decision"
]
```

Each step:

* status
* summary
* findings list
* expandable

---

## TASK 1.4 — Create CaseHistoryDrawer

File:

```bash
apps/web/components/history/CaseHistoryDrawer.tsx
```

### Must show:

* caseId
* company
* status
* score
* flags
* created_at

Expandable:

* documents
* findings summary
* actions

---

# PHASE 2 — GRAPH SYSTEM

## TASK 2.1 — Define Graph Node Model

File:

```bash
apps/web/lib/graph/types.ts
```

```ts
type GraphNode =
  | { type: "company"; id: string }
  | { type: "beneficiary"; id: string }
  | { type: "document"; id: string }
  | { type: "field"; id: string }
  | { type: "bank"; id: string }
  | { type: "risk"; id: string }
```

---

## TASK 2.2 — Define Edges

```ts
type GraphEdge = {
  from: string
  to: string
  type:
    | "extracted_from"
    | "belongs_to"
    | "matched_with"
    | "inconsistent_with"
    | "verified_by"
    | "flagged_by"
}
```

---

## TASK 2.3 — Build Graph Generator

File:

```bash
apps/web/lib/graph/buildGraph.ts
```

### Input:

* case
* extracted_fields
* agent_findings
* risk_signals

### Output:

* nodes[]
* edges[]

---

## TASK 2.4 — Render Graph Nodes

* central: company
* right: beneficiary
* left: documents
* surrounding: extracted fields

---

# PHASE 3 — AGENT VISUAL BEHAVIOR

## TASK 3.1 — Convert Nodes → Tadpoles

Modify:

```bash
components/TadpolePool.tsx
```

### Replace circle nodes with:

* head (ellipse)
* tail (bezier curve)
* directional movement

---

## TASK 3.2 — Movement Logic

Each agent:

```ts
agent.target = node.position
agent.heading → smooth interpolation
agent.velocity → momentum
```

---

## TASK 3.3 — Movement Mapping

| Agent                  | Movement                |
| ---------------------- | ----------------------- |
| DocumentAuthenticity   | doc → fields            |
| NameMatching           | company → beneficiary   |
| ExistenceVerification  | company → external node |
| BeneficiaryConsistency | bank → beneficiary      |
| Skeptic                | orbit suspicious nodes  |
| Prosecutor             | connect inconsistencies |

---

# PHASE 4 — AGENT THOUGHT STREAM

## TASK 4.1 — Add Thought State

File:

```bash
packages/shared/src/index.ts
```

Add:

```ts
type AgentThoughtState = {
  agentName: string
  status: "moving" | "investigating" | "challenging" | "concluding"
  targetNodeId?: string
  currentIntent: string
  interimOpinion?: string
  confidence: number
}
```

---

## TASK 4.2 — Emit Thought Events

Modify:

```bash
packages/agents/src/index.ts
```

Agents must emit:

```ts
emit("agent.thought", AgentThoughtState)
```

---

## TASK 4.3 — Frontend Thought Bubble

File:

```bash
apps/web/components/agents/ThoughtBubble.tsx
```

### Render near tadpole:

```txt
Checking invoice...
Mismatch detected
Confidence: 0.81
```

Rules:

* max 3 bubbles
* auto fade

---

## TASK 4.4 — Agent Detail Panel

Click tadpole → open panel

Show:

* intent
* evidence
* opinion
* confidence progression

---

# PHASE 5 — REPORT GENERATION

## TASK 5.1 — Map Findings → Steps

File:

```bash
apps/web/lib/workbench/mapFindings.ts
```

Mapping:

```ts
DocumentAuthenticity → Step 03
ExistenceVerification → Step 04
NameMatching → Step 05
Chair → Step 06
```

---

## TASK 5.2 — Build Step Renderer

Each step:

* icon
* status color
* findings list
* expand details

---

## TASK 5.3 — Add Recommended Actions

Create:

```ts
type RecommendedAction = {
  title: string
  description: string
  priority: "low" | "medium" | "high"
}
```

Populate from:

* flags
* policy rules

---

# PHASE 6 — BACKEND EXTENSIONS

## TASK 6.1 — Extend `cases`

Add:

```sql
ALTER TABLE cases ADD COLUMN website TEXT;
ALTER TABLE cases ADD COLUMN contact_email TEXT;
ALTER TABLE cases ADD COLUMN invoice_number TEXT;
ALTER TABLE cases ADD COLUMN payment_purpose TEXT;
ALTER TABLE cases ADD COLUMN suspicion_reason TEXT;
```

---

## TASK 6.2 — Create `recommended_actions`

```sql
CREATE TABLE recommended_actions (
  id UUID PRIMARY KEY,
  case_id UUID,
  title TEXT,
  description TEXT,
  priority TEXT,
  source TEXT
);
```

---

## TASK 6.3 — Create `bank_escalation_contacts`

```sql
CREATE TABLE bank_escalation_contacts (
  bank_name TEXT,
  contact_label TEXT,
  contact_number TEXT,
  verified_at TIMESTAMP
);
```

---

## TASK 6.4 — New APIs

```http
GET /api/cases
GET /api/cases/:id/graph
GET /api/cases/:id/report
GET /api/cases/:id/history
GET /api/bank-contacts?bank=
```

---

# PHASE 7 — ACTION SYSTEM

## TASK 7.1 — Show Action Cards

If:

* status = escalate/reject
* OR high risk signals

Show:

```txt
Recommended Actions:
- Verify company via official registry
- Contact bank fraud unit
- Hold onboarding
```

---

## TASK 7.2 — Bank Suggestion Logic

If:

* bank_name exists
* risk high

Fetch:

```http
/api/bank-contacts
```

Display:

* contact number
* support label

---

# PHASE 8 — VISUAL STATES

## MODE 1 — Intake

* minimal nodes
* calm tadpoles

## MODE 2 — Investigation

* active movement
* visible connections
* thought bubbles

## MODE 3 — Decision

* highlight risk nodes
* show actions
* lock report

---

# PHASE 9 — PERFORMANCE

* useRef for canvas state
* no React re-render loop
* max 20 agents
* batch SSE updates

---

# FINAL PRODUCT STATE

After execution:

* Graph-driven investigation UI
* Agents visibly “thinking”
* Step-based explainable report
* Case history tracking
* Actionable fraud recommendations
* Bank escalation integration

---

# FINAL COMMAND

Claude — execute ALL phases sequentially.

DO NOT skip phases.
DO NOT redesign backend core.
FOCUS on:

1. Graph Workbench
2. Agent Thought Stream
3. Investigation Report
4. Case History
5. Action System

---

END
