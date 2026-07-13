# 🐸 Tadpools v2 — Claude Build Prompts (Local-First, Bank-Safe)

## 🔐 Context (IMPORTANT — include in every prompt)

```md
Important:
- This project is a LOCAL-FIRST prototype
- No external cloud services should be assumed
- No sensitive data leaves the local environment
- Design must be portable to future on-prem or bank-controlled infrastructure
- Focus on system design, reasoning clarity, and enterprise usability
- Do not over-engineer prematurely
- Output code file by file
- Reuse components where possible
- Prioritize clarity over visual decoration
```

---

# 🧱 Prompt 1 — Architecture Design

```md
You are helping me rebuild Tadpools v2 into an enterprise-grade AI-powered Risk Intelligence Platform.

Backend direction:
- Local-first architecture
- No external cloud dependencies
- Database should be PostgreSQL-compatible but runnable locally
- System must be portable to future on-prem deployment

Frontend:
- Next.js 14 + TypeScript + Tailwind
- Maintain Tadpools theme (aquatic, soft teal, swarm identity)

What I want:
1. Full system architecture
2. Folder structure
3. Route structure
4. Component hierarchy
5. Data flow (frontend → backend → database)
6. Implementation phases

Core product:
- Command Center Dashboard
- Case Reasoning Dashboard
- Entity Intelligence Workspace
- Evidence Explorer
- Audit Panel

Reasoning pipeline:
- Intake → Extraction → Authenticity → Entity → Relationship → Historical → Challenge → Decision

Do not generate code yet.
Act like a senior system architect.
```

---

# 🗄️ Prompt 2 — Database Schema (Local PostgreSQL)

```md
Design a PostgreSQL-compatible schema for Tadpools v2.

Constraints:
- Must run locally (no cloud dependency)
- Must support audit-grade traceability
- Must support entity reuse across cases
- Must support document hashing
- Must support explainable signals and decisions

Tables required:
- cases
- entities (company, beneficiary, bank)
- documents
- extracted_fields
- signals
- decisions
- policy_rules
- audit_logs
- timeline_events
- entity_relationships

Requirements:
- proper foreign keys
- indexing for performance
- scalable structure
- future-ready for on-prem deployment

Output:
1. Table design explanation
2. SQL CREATE TABLE statements
```

---

# 🧩 Prompt 3 — App Shell

```md
Build the Tadpools v2 application shell.

Stack:
- Next.js + TypeScript + Tailwind
- Local-first system

Requirements:
- Top navigation:
  - Queue
  - Active Case
  - History
  - Audit
- Layout system
- Reusable UI primitives:
  - cards
  - badges
  - section headers
  - empty states

Design:
- Maintain Tadpools identity
- Keep UI enterprise-clean
- Subtle animated background allowed
- No clutter

Do not build feature pages yet.
```

---

# 📊 Prompt 4 — Command Center Dashboard

```md
Build Command Center Dashboard.

Purpose:
Operational visibility for fraud/compliance teams.

Sections:
1. KPI row
2. Risk distribution
3. Live case feed
4. Action queue

Requirements:
- Use mock local data
- Clean enterprise layout
- Avoid decorative noise
- Focus on decision usefulness

Explain why each visualization is chosen.
```

---

# 🧠 Prompt 5 — Case Reasoning Dashboard

```md
Build Case Reasoning Dashboard.

Goal:
Explain WHY a case is risky or safe.

Components:
1. Case header
2. Reasoning rail (all stages)
3. Signal contribution panel
4. Decision narrative
5. Recommended actions

Rules:
- Structured reasoning, not AI black box
- Show contribution scores
- Show confidence levels

Use mock data.
Make it feel like institutional reasoning.
```

---

# 🧬 Prompt 6 — Entity Intelligence Workspace

```md
Build Entity Intelligence Workspace.

Purpose:
Search and reuse validated entities.

Features:
- search bar (company, beneficiary, bank, document hash)
- entity list
- entity profile
- relationship graph
- linked cases

Design:
- clean intelligence system
- not CRM-style clutter
- use mock data

Keep it scalable for real data later.
```

---

# 📂 Prompt 7 — Evidence & Signal Explorer

```md
Build Evidence Explorer.

Purpose:
Investigate documents and signals.

Sections:
- uploaded documents
- extracted fields
- signals grouped by module
- cross-reference mismatches
- evidence summary

Design:
- investigative clarity
- structured hierarchy

Use mock data.
```

---

# 🧾 Prompt 8 — Audit & Governance Panel

```md
Build Audit Panel.

Purpose:
Full traceability and compliance.

Features:
- audit logs
- version tracking (policy/model placeholder)
- decision reconstruction
- override history

Design:
- minimal
- forensic
- readable

Use mock data.
```

---

# 🧱 Prompt 9 — Shared Types & Mock Data

```md
Refactor app:
- centralize TypeScript types
- centralize mock data
- remove duplication
- improve maintainability

Ensure:
- consistent data structures
- reusable across pages
```

---

# 🔌 Prompt 10 — Local Data Integration

```md
Replace mock data with local database integration.

Requirements:
- use local PostgreSQL or SQLite
- create simple API layer
- fetch:
  - cases
  - entities
  - signals
  - documents
  - audit logs

Handle:
- loading
- empty states
- error states

Do not introduce external services.
```

---

# 📝 Prompt 11 — Intake Flow

```md
Build intake form.

Fields:
- company
- registration
- beneficiary
- bank
- documents

Add:
- parameter infographic explaining system checks

On submit:
- create case
- store locally
- route to case dashboard

Keep UX clean and structured.
```

---

# 🧠 Prompt 12 — Reasoning Refinement

```md
Improve reasoning UI:

Focus:
- clearer stage logic
- better signal hierarchy
- cause-effect visibility
- distinguish:
  - rules
  - probabilistic signals
  - inferred reasoning
  - human actions

Make it feel intelligent and trustworthy.
```

---

# ⚖️ Prompt 13 — Analyst Actions

```md
Implement actions:
- approve
- reject
- escalate
- request documents

Each must:
- log audit
- update case
- update timeline

Ensure traceability.
```

---

# 🛠️ Prompt 14 — Production Hardening

```md
Review system:
- UX consistency
- error handling
- loading states
- type safety
- responsiveness

Fix issues and summarize readiness.
```

---

# 🧭 Execution Order

1 → Architecture
2 → Database
3 → App Shell
4 → Dashboard
5 → Reasoning
6 → Entity
7 → Evidence
8 → Audit
9 → Types
10 → Local DB
11 → Intake
12 → Refinement
13 → Actions
14 → Hardening

---

# 🧠 Final Positioning

When presenting:

> “This is a locally executed prototype focused on explainable fraud reasoning, entity intelligence, and audit-ready workflows. No external infrastructure is used.”

---
