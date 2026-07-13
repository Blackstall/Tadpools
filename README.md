# 🐸 Tadpools

> Swim through the noise. Surface the risk.

**Tadpools** is an open-source, swarm-based fraud detection and KYC (Know Your Customer) onboarding intelligence system. Ten AI agents collaborate across three rounds to analyse a company onboarding case, challenge each other's findings, and produce an **explainable** risk decision — visualised in real time as animated tadpoles swimming through a bioluminescent pool.

Everything runs locally: PostgreSQL and MinIO via Docker, and a local LLM via [Ollama](https://ollama.com). No cloud dependencies, no data leaves your machine.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## How it works

```
Intake → Extraction → Swarm Analysis (3 rounds) → Policy Engine → Decision → Cleanup
```

1. **Intake** — a case is submitted (company details + supporting documents).
2. **Extraction** — structured fields are pulled from uploaded documents.
3. **Swarm analysis** — seven core agents analyse the case independently, publish findings to shared memory, then read each other's findings across rounds:
   - Nature of Business · Registration Age · Document Authenticity · Existence Verification · Name Matching · Beneficiary Consistency · Historical Suspicion
4. **Challenge phase** — three meta-agents stress-test the findings:
   - **Skeptic** questions weak evidence · **Prosecutor** argues the worst case · **Chair** forms consensus
5. **Policy engine** — deterministic rules convert consensus into a final decision: *Approve*, *Manual Review*, *Escalate*, or *Reject*.
6. **Audit trail** — every agent's reasoning is persisted so any decision can be fully reconstructed.

Deterministic checks run before LLM calls, raw documents are stored only temporarily, and every finding carries a `reasoning[]` array for explainability.

## Repository layout

```
tadpools/
├── apps/
│   ├── api/          Express REST API (port 4000)
│   └── web/          Next.js frontend (port 3000)
├── packages/
│   ├── shared/       Shared TypeScript types
│   └── agents/       The 10 swarm agents + LLM client + shared memory
├── infra/            Docker Compose (PostgreSQL + MinIO)
└── docs/             Architecture, design, logic, and audit documentation
```

## Prerequisites

- Node.js 20+ and npm
- Docker (for PostgreSQL and MinIO)
- [Ollama](https://ollama.com) running locally with a chat model pulled

## Quick start

```bash
git clone https://github.com/<your-username>/tadpools.git
cd tadpools

# 1. Environment
cp .env.example .env

# 2. Infrastructure (PostgreSQL on 5433, MinIO on 9000/9001)
docker compose -f infra/docker-compose.yml up -d

# 3. Install and build workspace packages (shared → agents → api → web)
npm install
npm run build

# 4. Run API + web together
npm run dev
```

Open http://localhost:3000 for the UI. The API health check is at http://localhost:4000/health.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Run API and web concurrently in watch mode |
| `npm run build` | Build all workspaces in dependency order |
| `npm run typecheck` | Typecheck every workspace |

## Documentation

Full documentation lives in [`docs/`](docs/):

- [`docs/overview.md`](docs/overview.md) — complete system overview and API reference
- [`docs/logic.md`](docs/logic.md) — swarm workflow and decision logic
- [`docs/design.md`](docs/design.md) — design system
- [`docs/audit_trail.md`](docs/audit_trail.md) — audit and compliance model
- [`docs/schema.sql`](docs/schema.sql) — database schema

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for setup, conventions, and how to submit a pull request. Please also read our [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

Found a vulnerability? Please report it privately — see [SECURITY.md](SECURITY.md).

## Disclaimer

Tadpools is a decision-support tool. It does not replace human judgment or regulatory compliance obligations. Risk decisions produced by this system should always be reviewed by qualified personnel before being acted upon.

## License

[MIT](LICENSE) © 2026 Farris Nasarudin
