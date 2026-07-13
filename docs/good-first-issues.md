# Good first issues — ready to paste into GitHub

Create these at https://github.com/Blackstall/Tadpools/issues/new, apply the
suggested labels (create labels once under Issues → Labels).

---
**Title:** Add unit tests for the remaining core agents
**Labels:** `good first issue`, `testing`, `agents`
RegistrationAge and NameMatching agents have tests (`packages/agents/test/`).
Add equivalent tests for DocumentAuthenticity, ExistenceVerification,
BeneficiaryConsistency, NatureOfBusiness and HistoricalSuspicion using the
helpers in `packages/agents/test/helpers.ts` (mocked offline LLM). Every test
must assert `reasoning[]` is populated.

---
**Title:** Create a mock LLM client for testing
**Labels:** `good first issue`, `testing`, `agents`
Add a `MockLLMClient` that returns configurable canned responses, so agent tests
can also cover the LLM-enrichment path (not just the null fallback).

---
**Title:** Add Windows setup instructions to the README
**Labels:** `good first issue`, `documentation`
Document Docker Desktop specifics, port 5433 vs local PostgreSQL conflicts, and
`cp .env.example .env` equivalents for PowerShell.

---
**Title:** Add loading and error states to the intake form
**Labels:** `good first issue`, `frontend`
`apps/web/components/IntakeForm.tsx` — show a spinner while submitting and a
readable error when the API is down.

---
**Title:** Document tested Ollama models
**Labels:** `good first issue`, `documentation`
Run the `examples/` cases with 2–3 Ollama models, record results in
`docs/evaluation.md`, and list working models in MODEL_CARD.md.

---
**Title:** Add health checks for PostgreSQL and MinIO to docker-compose
**Labels:** `good first issue`, `backend`
Add `healthcheck` blocks to `infra/docker-compose.yml` so `docker compose ps`
reports readiness, and document the wait in the README quick start.

---
**Title:** Make agent timeouts configurable per agent
**Labels:** `help wanted`, `agents`, `backend`
`LLM_TIMEOUT_MS` is global. Allow per-agent overrides via env or config file.

---
**Title:** Create an architecture diagram
**Labels:** `good first issue`, `documentation`
A single diagram (Mermaid preferred, kept in docs/) showing web → api →
postgres/minio/ollama and the 3-round swarm flow.

---
**Title:** Improve accessibility and keyboard navigation
**Labels:** `help wanted`, `frontend`
Audit the dashboard and case pages: focus order, aria labels on the pool
canvas, contrast of risk badges.

---
**Title:** Agent registry — pluggable agents without editing orchestration
**Labels:** `help wanted`, `agents`, `design`
Design an `agentRegistry` (core / challenge / consensus groups) so a new agent
can be contributed by registering it. See ROADMAP v0.2. Discussion issue first.
