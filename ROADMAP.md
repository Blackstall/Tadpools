# Tadpools Roadmap

Direction, not deadlines. Pick a piece and open a PR — see [CONTRIBUTING.md](CONTRIBUTING.md).

## v0.1 — Working prototype (current)

- [x] Ten-agent swarm (7 core + Skeptic, Prosecutor, Chair)
- [x] Local Ollama integration with deterministic fallback
- [x] PostgreSQL persistence and MinIO temporary document storage
- [x] Explainable decisions (`reasoning[]` on every finding)
- [x] Policy engine with hard rules and score floors
- [x] Audit trail and decision reconstruction
- [x] Unit tests (policy engine, agents)
- [x] CI pipeline (build, typecheck, test)
- [x] Synthetic demo dataset (`examples/`)
- [ ] Demo GIF in README
- [ ] Broader agent test coverage (all 10 agents)
- [ ] Evaluation report with real measurements (docs/evaluation.md)

## v0.2 — Extensible agents

- [ ] Agent registry — contribute a new agent without touching orchestration
- [ ] Configurable policy rules (JSON/YAML instead of hard-coded)
- [ ] Additional LLM providers (OpenAI-compatible endpoints, llama.cpp)
- [ ] Mock LLM client for fully offline testing
- [ ] Configurable agent timeouts
- [ ] Investigation relationship graph improvements

## v0.3 — Investigation platform

- [ ] User authentication
- [ ] Role-based access control
- [ ] Case assignment and queues
- [ ] Human reviewer feedback loop (decisions improve prompts/rules)
- [ ] Evaluation dashboard
- [ ] Optional external-data plugin interface (sanctions screening, adverse media)
