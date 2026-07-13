# Tadpools — Claude Code Redesign Brief

## Objective

Redesign the Tadpools KYC Investigation Workbench so it becomes **immediately understandable to operational users**, while preserving the existing swarm intelligence, explainability model, and Tadpools visual identity.

This is **not** a backend rewrite. It is primarily a **product UX / IA / layout redesign** on top of the existing architecture.

The current system already has strong foundations:
- queue page
- workbench page
- left drawer
- history drawer
- investigation report panel
- intake form / summary dock
- SSE-driven swarm stream
- clear backend case lifecycle

But the current interface is too fragmented across panes and drawers, so users must assemble the story themselves.

The redesign goal is to make the experience read like this:

> Here is the case.  
> Here is what the system checked.  
> Here is what it found.  
> Here is why it matters.  
> Here is the recommended action.

---

## Primary UX Problems To Solve

### 1. Fragmented information architecture
Important information is split across:
- top bar
- left drawer
- right report panel
- bottom dock
- canvas
- history drawer
- separate queue page

This makes the user ask:
- where do I start?
- where is the real status?
- where do I understand the case?

### 2. The canvas is visually strong but not the best primary reading surface
The TadpolePool is memorable, but many users will not naturally understand:
- motion meaning
- investigation stage
- agent state significance
- node relationships
- when to look at the canvas vs the report

The canvas should be a **supporting explainability layer**, not the primary source of comprehension.

### 3. Too much hidden / collapsible interaction
The current UI relies heavily on:
- drawers
- toggled panes
- manual zoom
- multiple overlay states

This creates friction for users who just want to understand the case quickly.

### 4. Case context and report are separated
The current split between `LeftDrawer` and `InvestigationReportPanel` forces the user to look in multiple places for one story.

### 5. Navigation is not explicit enough
There is currently no strong primary navigation structure for:
- Queue
- Active Case
- History
- Audit / Export

---

## Redesign Principles

### Principle 1 — Report-first, spectacle-second
The user must be able to understand the case without interacting with the swarm canvas.

### Principle 2 — One case, one story
A single case should feel like one coherent workspace, not several scattered panes.

### Principle 3 — Stable layout beats hidden drawers
Use persistent, predictable regions instead of making core understanding depend on overlays.

### Principle 4 — Motion explains, but does not replace explanation
Keep the Tadpools concept. Keep the animated swarm. But pair it with clear textual interpretation.

### Principle 5 — Human-readable stage language
Translate system state into plain language, not only internal labels.

---

## Target Product Architecture

## New Top-Level Navigation

Create a clearer primary navigation structure in the top bar:

- **Queue**
- **Active Case**
- **History**
- **Audit**

### Navigation intent
- `Queue` = operational homepage
- `Active Case` = main case workspace
- `History` = past cases / prior decisions
- `Audit` = replay / export / compliance view

Do **not** hide major navigation inside drawers.

---

## New Active Case Workspace Structure

Replace the current “canvas + right panel + left drawer + bottom dock” mental model with a clearer case workspace.

### Recommended layout

```text
┌──────────────────────────────── top nav ────────────────────────────────┐
│ Tadpools | Queue | Active Case | History | Audit | Search | User tools │
├────────────────────────────── case header ──────────────────────────────┤
│ Company | Case ID | Status | Current Stage | Risk Score | Last Updated │
├─────────────────────────────────────────────────────────────────────────┤
│ Main column                                              | Side column │
│----------------------------------------------------------|------------│
│ 1. Case Summary                                          | Evidence    │
│ 2. Progress Tracker                                      | Documents   │
│ 3. Investigation Overview                                | Rules       │
│ 4. Findings by Step                                      | Agents      │
│ 5. Final Decision                                        | Audit Snips │
│ 6. Activity Timeline                                     |            │
│ 7. Swarm Visual (collapsible / secondary)                |            │
└─────────────────────────────────────────────────────────────────────────┘
```

### Core rule
The **main column** is the primary reading surface.
The **side column** is the evidence / details surface.
The **swarm visual** is secondary and can be embedded lower in the page or collapsed by default.

---

## Replace Current Pane Logic With Tabs Inside Active Case

Inside `Active Case`, add secondary navigation tabs:

- **Overview**
- **Investigation**
- **Evidence**
- **Timeline**
- **Decision**

### Tab purpose
- `Overview` = summary + progress + top findings + current risk
- `Investigation` = step-by-step findings + agent outputs + live status
- `Evidence` = documents, extracted fields, mismatches, signals
- `Timeline` = chronological swarm / policy events
- `Decision` = final decision, reasoning, actions, escalation/export

This reduces the need for drawers as primary navigation.

---

## What To Do With Existing Components

## 1. `InvestigationReportPanel.tsx`

### Current problem
It is doing the right conceptual work, but it is trapped as a narrow right-side panel.

### Change
Promote `InvestigationReportPanel` into the **main case report view**.

### New role
This becomes the backbone of the case experience.

### Expand it to include:
- case summary header
- current stage summary
- progress tracker
- 6 investigation steps
- findings grouped by step
- recommended actions
- final decision block
- triggered rules
- export / escalation actions

### Implementation direction
Refactor into a larger reusable component or page composition:
- `CaseReportView.tsx`
- or split into:
  - `CaseSummaryHeader.tsx`
  - `CaseProgressTracker.tsx`
  - `InvestigationSteps.tsx`
  - `DecisionSummaryCard.tsx`
  - `RecommendedActionsPanel.tsx`

---

## 2. `LeftDrawer.tsx`

### Current problem
Too much essential information lives here.

### Change
Demote `LeftDrawer` from a core understanding surface into an **optional utility drawer**.

### Keep in drawer only:
- case metadata quick view
- agent legend
- optional quick shortcuts

### Move out of drawer into main page:
- progress stepper
- documents summary
- timeline summary
- agent progress summary

If a user never opens the drawer, they should still understand the case.

---

## 3. `CaseHistoryDrawer.tsx`

### Current problem
History is currently hidden behind a drawer and competes with the active case view.

### Change
Convert history into a proper page and keep the drawer only for quick peek mode if desired.

### New primary behavior
- `History` should be a top-level page
- past cases grouped by status
- searchable and filterable
- clicking a case opens its full case workspace

### Optional
Retain a lightweight quick-open history drawer, but do not rely on it as the main historical interface.

---

## 4. `IntakeForm.tsx` and bottom dock

### Current problem
The bottom dock is visually interesting but not the most logical persistent control area for a serious investigation tool.

### Change
For active cases, remove the dock as a dominant element.

### Better usage
- use bottom dock only for **new intake mode**
- once a case is submitted, transition into a normal case workspace layout
- do not keep the active case mentally tied to the intake dock

### Desired flow
- New Case page or modal for intake
- Submit case
- Redirect into `Active Case > Overview`

---

## 5. `GraphWorkbench.tsx`

### Current problem
The manual zoom / scale controls are over-emphasized for a graph that is more explanatory than navigational.

### Change
Make the canvas mostly **auto-framed**.

### Required redesign behavior
- default to fit-to-view
- auto-focus on the currently active investigation region
- smooth animated camera shift when stage changes
- keep manual zoom as secondary advanced control
- add a `Focus Active Step` action instead of relying on plus/minus as the main wayfinding tool

### Better mode labeling
Current mode badges are good conceptually, but should be paired with human-readable subtitles:
- `MODE 1 — Intake` → “Waiting for intake details”
- `MODE 2 — Investigation` → “Agents are reviewing evidence and company signals”
- `MODE 3 — Decision` → “Consensus reached — decision ready for review”

---

## 6. `TadpolePool.tsx`

### Current problem
It carries too much perceived responsibility for explaining the system.

### Change
Keep the pool, but redefine its role.

### New role
The pool should visually answer:
- what step is active?
- which evidence area is being analyzed?
- where is risk accumulating?
- when is debate happening?
- when has consensus been reached?

### It should not require users to:
- chase moving tadpoles for understanding
- manually inspect tiny states to understand the case
- depend on hover/click as the main explanation path

### Recommended improvements
- add a persistent small legend directly near the canvas
- add an “Active Step” banner over the canvas
- highlight only the currently relevant evidence region strongly
- soften or dim inactive nodes
- show one concise live sentence above or below the canvas:
  - “Checking company legitimacy against registry and historical patterns”
  - “Comparing beneficiary details against uploaded documents”
  - “Meta-agents are challenging the initial findings before consensus”

---

## 7. `CaseTimeline.tsx`

### Change
Promote timeline into a first-class case tab or section.

### Why
The timeline is operationally valuable because it maps well to your SSE events and audit model.

### Improve timeline by showing:
- timestamp
- stage
- event type
- concise explanation
- severity
- source (agent / policy / extraction / upload)

### Add filters
- all
- high risk
- agent activity
- policy rules
- document events

---

## 8. Queue page (`app/cases/page.tsx`)

### Current problem
The queue exists, but it feels disconnected from the case workbench.

### Change
Make Queue the true operational homepage.

### Add:
- search
- sort by latest updated
- filter by decision/status
- filter by bank
- filter by high-risk / flagged / manual review
- quick summary metrics at top
  - Processing count
  - Manual review needed
  - Escalated
  - Rejected

### Improve case cards with:
- company name
- case ID
- stage
- status
- risk score if available
- last updated
- top risk signal if any

### Important UX rule
Opening a queue item should move the user into a **full case workspace**, not a drawer-dependent experience.

---

## New Information Hierarchy For Each Case

Every case page should answer these questions in order:

### Section 1 — What is this case?
- company
- registration number
- registration date
- nature of business
- beneficiary
- bank details
- case ID
- created date

### Section 2 — Where are we in the process?
- current stage
- current live status
- progress tracker
- completion state of each step

### Section 3 — What did the system check?
- authenticity
- company verification
- beneficiary & bank
- challenge phase
- decision synthesis

### Section 4 — What did it find?
- mismatches
- suspicious patterns
- missing documents
- extracted fields
- rule triggers
- confidence / severity

### Section 5 — Why does it matter?
- top 3 reasons
- triggered rules
- evidence references
- which agents agree vs challenge

### Section 6 — What should the user do next?
- approve
- manually review
- escalate
- reject
- export audit
- contact bank / compliance

---

## New Page-Level Components To Build

Create or refactor toward these components:

### Core
- `CaseWorkspaceLayout.tsx`
- `CaseHeaderBar.tsx`
- `CaseTopNav.tsx`
- `CaseTabs.tsx`

### Report / Summary
- `CaseSummaryCard.tsx`
- `CaseProgressTracker.tsx`
- `CaseStageNarrative.tsx`
- `FindingsByStep.tsx`
- `DecisionSummaryCard.tsx`
- `TriggeredRulesCard.tsx`
- `NextActionsCard.tsx`

### Evidence / Detail
- `EvidencePanel.tsx`
- `DocumentListCard.tsx`
- `ExtractedFieldsTable.tsx`
- `MismatchSignalsCard.tsx`
- `AgentContributionPanel.tsx`

### Timeline / Audit
- `CaseAuditTimeline.tsx`
- `AuditExportPanel.tsx`

### Visual Layer
- `SwarmExplainerCard.tsx`
- `CanvasLegend.tsx`
- `ActiveStepIndicator.tsx`

---

## Specific UX Behavior Changes

## A. Eliminate “where do I click first?” confusion

### Required
On case open, the user should land on `Overview` with these visible immediately:
- company
- case status
- current stage
- risk level
- progress tracker
- top findings
- next action

No drawer opening should be required.

---

## B. Replace hidden knowledge with explicit text

For every stage, show a plain-English description.

### Examples
- `Intake` → “Waiting for case details and supporting documents.”
- `Document Extraction` → “Reading uploaded documents and extracting structured fields.”
- `Authenticity Check` → “Checking internal consistency and forgery signals.”
- `Company Verification` → “Assessing company age, legitimacy, business nature, and suspicious patterns.”
- `Beneficiary & Bank` → “Comparing beneficiary and bank details against documents and company identity.”
- `Decision` → “Synthesizing agent findings into a final risk recommendation.”

---

## C. Merge context + report into one reading surface

Stop making users combine `LeftDrawer` + `InvestigationReportPanel` mentally.

### Required
The main report view must include:
- case profile
- progress
- findings
- documents summary
- timeline summary
- decision

---

## D. Reposition the canvas lower in the hierarchy

### Recommended display options
Option 1:
- show a compact visual canvas in `Overview`
- expand full canvas in `Investigation`

Option 2:
- embed full canvas below summary / findings
- collapsible with “Show swarm activity” toggle

### Important
Do not put the visual layer in a position where users assume it is the only place to understand the case.

---

## E. Remove maximize/minimize pane logic from core workflow

### Replace with:
- stable sections
- tabs
- collapsible cards
- optional detail drawer on click

This is more logical for investigators than floating pane choreography.

---

## F. Improve decision trust

Surface the reasoning more explicitly.

### Every decision card should show:
- final status
- score
- top reasons
- triggered rules
- confidence cues
- action recommendation
- which agents contributed most

### Explicitly surface challenge layer
Show how:
- Skeptic challenged false positives
- Prosecutor surfaced hidden risk
- Chair synthesized the final recommendation

This is one of Tadpools’ strongest differentiators and should be highly visible.

---

## Recommended File-Level Refactor Plan

## Phase 1 — IA and layout stabilization

### Update / create
- `apps/web/app/page.tsx`
- `apps/web/app/cases/page.tsx`
- `apps/web/components/report/InvestigationReportPanel.tsx`
- `apps/web/components/LeftDrawer.tsx`
- `apps/web/components/history/CaseHistoryDrawer.tsx`
- `apps/web/components/workbench/GraphWorkbench.tsx`

### Goals
- move to clearer top navigation
- make report-first layout
- reduce drawer dependence
- preserve backend wiring

---

## Phase 2 — break monolith UI into stronger case primitives

### Create
- `apps/web/components/case/CaseWorkspaceLayout.tsx`
- `apps/web/components/case/CaseHeaderBar.tsx`
- `apps/web/components/case/CaseTabs.tsx`
- `apps/web/components/case/CaseSummaryCard.tsx`
- `apps/web/components/case/CaseProgressTracker.tsx`
- `apps/web/components/case/DecisionSummaryCard.tsx`
- `apps/web/components/case/TriggeredRulesCard.tsx`
- `apps/web/components/case/NextActionsCard.tsx`
- `apps/web/components/case/EvidencePanel.tsx`
- `apps/web/components/case/CaseAuditTimeline.tsx`

### Goal
Make the case workspace modular and understandable.

---

## Phase 3 — visual layer refinement

### Update
- `apps/web/components/TadpolePool.tsx`
- `apps/web/components/workbench/GraphWorkbench.tsx`

### Goals
- auto-focus instead of manual-zoom-first
- active-step narrative
- better legend
- stronger visual tie between report step and active evidence region

---

## Phase 4 — queue / history operational polish

### Update
- `apps/web/app/cases/page.tsx`
- history-related data fetching and summary cards

### Goals
- queue becomes real operational homepage
- history becomes accessible and searchable
- case transition becomes clean

---

## UI Copy Guidance

Use more human language throughout.

### Avoid overly technical-only labels when possible
Prefer:
- “Checking company legitimacy” instead of only “Company Verification”
- “Review needed” instead of only “manual_review” in user-facing chips
- “High risk signals detected” instead of only “escalate threshold reached”

### Keep internal terminology in technical detail views only
Detailed audit views can still show:
- signal codes
- event types
- agent IDs
- round numbers

---

## Non-Goals

Do **not** rewrite:
- backend orchestration
- SSE event model
- policy engine scoring logic
- agent architecture
- shared memory architecture
- database schema

This redesign should **reuse the existing backend story** and present it more clearly.

---

## Success Criteria

The redesign is successful if:

### 1. A first-time user can understand a case in under 10 seconds
They should be able to identify:
- case subject
- current stage
- risk state
- next action

### 2. The system no longer depends on drawers for core comprehension
Drawers become optional helpers, not required navigation.

### 3. The case report becomes the primary source of truth
The canvas supports understanding, but does not carry it alone.

### 4. Queue-to-case flow feels operationally natural
Queue is the control center; case workspace is the decision room.

### 5. The Tadpools identity remains intact
The redesign should not flatten the product into a generic banking dashboard.
The living swarm visual remains a differentiator, but the UX becomes clearer.

---

## Immediate Build Instruction For Claude Code

Implement the redesign in this order:

1. Create a stronger top navigation with `Queue`, `Active Case`, `History`, and `Audit`.
2. Refactor the current case page into a report-first workspace.
3. Move essential information out of `LeftDrawer` into the main case surface.
4. Expand `InvestigationReportPanel` into the main case understanding layer.
5. Reposition `TadpolePool` / `GraphWorkbench` as a secondary explainability panel.
6. Remove heavy dependence on maximize/minimize pane behavior.
7. Add case tabs: `Overview`, `Investigation`, `Evidence`, `Timeline`, `Decision`.
8. Upgrade queue page to act as the operational homepage.
9. Preserve current backend integration and existing swarm lifecycle.
10. Keep Tadpools visual identity, but optimize for clarity first.

---

## Final Direction

Tadpools should feel like:
- a serious KYC investigation product
- with explainable AI reasoning
- wrapped in a memorable swarm-based visual system

It should **not** feel like the user has to decode the interface before understanding the case.

The redesign target is:

**Operational clarity + explainable intelligence + signature Tadpools visual identity**
