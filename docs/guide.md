# Tadpools — Run Guide

> Swim through the noise. Surface the risk.

Tadpools is a swarm-based KYC onboarding intelligence system. Ten AI agents collaborate in three rounds to analyze company onboarding cases and produce an explainable risk decision, visualized as animated tadpoles in a live pool.

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18+ | Runtime for API and web |
| npm | 9+ | Package management (workspaces) |
| Docker Desktop | any | PostgreSQL + MinIO containers |
| Ollama | any | Local LLM inference |
| Git | any | Source control |

---

## Repository Structure

```
tadpools/
├── apps/
│   ├── api/          — Express API (port 4000)
│   └── web/          — Next.js frontend (port 3000)
├── packages/
│   ├── shared/       — Shared TypeScript types
│   └── agents/       — All 10 swarm agents + LLM client
├── infra/
│   └── docker-compose.yml
└── docs/
```

---

## Step 1 — Install Dependencies

From the project root:

```bash
npm install
```

This installs all workspace dependencies for `apps/api`, `apps/web`, `packages/shared`, and `packages/agents`.

---

## Step 2 — Build Packages

The agents and shared packages must be compiled before the API can start:

```bash
npm run build -w @tadpools/shared
npm run build -w @tadpools/agents
```

> You must rebuild after any changes to `packages/shared` or `packages/agents`.

---

## Step 3 — Start Infrastructure (Docker)

Start PostgreSQL and MinIO:

```bash
docker compose -f infra/docker-compose.yml up -d
```

| Service | Host | Notes |
|---------|------|-------|
| PostgreSQL | `localhost:5433` | Port 5433 to avoid conflicts with a local PG install |
| MinIO API | `localhost:9000` | S3-compatible object storage |
| MinIO Console | `localhost:9001` | Web UI — login: `minio` / `minio123` |

Database tables are created automatically on first API startup (migration runs at boot).

> If you have PostgreSQL 17 installed locally, it occupies port 5432. The Docker container is mapped to 5433 to avoid conflict — no action needed.

---

## Step 4 — Start Ollama + Pull Model

Ollama must be running and the Qwen model must be downloaded:

```bash
# Start Ollama (if not already running as a service)
ollama serve

# Pull the model (one-time, ~4.7 GB)
ollama pull qwen2.5:7b
```

Verify the model is available:

```bash
ollama list
# Should show: qwen2.5:7b
```

Ollama serves at `http://localhost:11434` by default.

> **Hardware note:** `qwen2.5:7b` (Q4_K_M) requires ~5 GB RAM or ~4 GB VRAM. On a GTX 1650 (4 GB) it runs fully on GPU. On CPU-only machines it runs in RAM but will be slower (~2–5 min per case).

---

## Step 5 — Start the API

```bash
npx tsx apps/api/src/server.ts
```

On successful start you will see:

```
[migrate] all tables ready
Tadpools API listening on http://localhost:4000
```

### Environment Variables (optional)

Create `apps/api/.env` to override defaults:

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
```

---

## Step 6 — Start the Frontend

In a separate terminal:

```bash
npm run dev -w @tadpools/web
```

Open your browser at `http://localhost:3000`.

---

## Step 7 — Submit a Case

### Via the UI

1. Open `http://localhost:3000`
2. Fill in the intake form (company + beneficiary details)
3. Click **Run Tadpools →**
4. Watch the swarm animate in real time
5. The right panel populates with agent findings and a final decision

### Via cURL

```bash
curl -X POST http://localhost:4000/api/cases \
  -H "Content-Type: application/json" \
  -d '{
    "company": {
      "companyName": "Acme Sdn Bhd",
      "registrationNumber": "202301234567",
      "registrationDate": "2021-06-01",
      "natureOfBusiness": "IT Services"
    },
    "beneficiary": {
      "beneficiaryName": "Acme Sdn Bhd",
      "accountNumber": "112345678901",
      "bankName": "Maybank"
    },
    "documents": [],
    "consentAccepted": true
  }'
```

Returns immediately:
```json
{ "caseId": "<uuid>", "status": "processing" }
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/cases` | Submit a new onboarding case |
| `POST` | `/api/cases/:id/upload` | Upload a document (PDF/JPG/PNG, max 20 MB) |
| `GET` | `/api/cases/:id/stream` | SSE stream — live swarm events |
| `GET` | `/api/cases/:id/audit/replay` | Timeline replay of swarm execution |
| `GET` | `/api/cases/:id/audit/export` | Full compliance export (JSON) |
| `POST` | `/api/cases/:id/cleanup` | Delete temp files, archive case |
| `GET` | `/api/cases/:id/cleanup/status` | Check cleanup status |

---

## Swarm Flow

```
POST /api/cases
    │
    ├─ Returns { caseId } immediately
    │
    └─ Background: runSwarm()
           │
           ├── Round 1 (parallel) ─── 7 core agents
           │     NatureOfBusiness      RegistrationAge
           │     DocumentAuthenticity  ExistenceVerification
           │     NameMatching          BeneficiaryConsistency
           │     HistoricalSuspicion
           │
           ├── Round 2 (sequential) ── 2 meta agents
           │     SkepticAgent    (reduces false positives)
           │     ProsecutorAgent (surfaces hidden patterns)
           │
           ├── Round 3 ────────────── 1 synthesis agent
           │     ChairAgent      (final consensus + decision)
           │
           └── PolicyEngine ────────── 10 hard rules
                 Overrides AI score if hard rules triggered
                 Writes decision to DB + emits SSE "done"
```

---

## Decision Outcomes

| Status | Score Range | Meaning |
|--------|-------------|---------|
| `approve` | 0–39 | Low risk — safe to onboard |
| `manual_review` | 40–69 | Moderate — human review recommended |
| `escalate` | 70–99 | Elevated risk — compliance team review |
| `reject` | 100+ | High risk or hard rule triggered |

---

## LLM Model Routing

Each agent tier is mapped to a model (upgradeable when hardware improves):

| Round | Agents | Current Model | Target Model |
|-------|--------|---------------|--------------|
| 1 | Fact-checkers | `qwen2.5:7b` | `qwen2.5:7b` |
| 1 | Analysis agents | `qwen2.5:7b` | `qwen2.5:14b` |
| 2 | Meta agents | `qwen2.5:7b` | `qwen2.5:14b` |
| 3 | Chair synthesis | `qwen2.5:7b` | `qwen2.5:32b` |

To upgrade, edit `packages/agents/src/llm/modelRouter.ts` and update `TIER_SPECS`.

LLM calls fail gracefully — if Ollama is offline or times out, agents fall back to deterministic rule-based output.

---

## Running All Services Together

```bash
# Terminal 1 — Infrastructure
docker compose -f infra/docker-compose.yml up -d

# Terminal 2 — API
npx tsx apps/api/src/server.ts

# Terminal 3 — Frontend
npm run dev -w @tadpools/web
```

---

## Troubleshooting

**`Cannot find module @tadpools/agents/index`**
The packages need to be built first:
```bash
npm run build -w @tadpools/shared && npm run build -w @tadpools/agents
```

**`EADDRINUSE: port 4000`**
Kill the existing process:
```bash
npx kill-port 4000
```

**`connect ECONNREFUSED localhost:5433`**
Docker containers are not running:
```bash
docker compose -f infra/docker-compose.yml up -d
```

**LLM calls timing out**
Ollama may not be running or the model is not pulled:
```bash
ollama serve
ollama pull qwen2.5:7b
```
The system continues without LLM enrichment (deterministic mode) — it does not crash.

**PostgreSQL auth failure (scram-sha-256)**
If you see SASL auth errors, connect to the container and reset the password with md5:
```bash
docker exec -it <container_id> psql -U postgres
SET password_encryption = 'md5';
ALTER USER postgres WITH PASSWORD 'postgres';
```
Then edit `pg_hba.conf` inside the container to use `md5` instead of `scram-sha-256`.

---

## Type Checking

```bash
# Check all workspaces
npm run typecheck

# Check individual workspace
npx tsc -p apps/api/tsconfig.json --noEmit
npx tsc -p apps/web/tsconfig.json --noEmit
npx tsc -p packages/agents/tsconfig.json --noEmit
```

---

## Full Build (production)

```bash
npm run build
```

Builds in dependency order: `shared` → `agents` → `api` → `web`.
