# Changelog

All notable changes to Tadpools are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning: [SemVer](https://semver.org/).

## [Unreleased]

### Added
- Unit tests for the policy engine and RegistrationAge/NameMatching agents (21 tests)
- GitHub Actions CI (build, typecheck, test on every push and PR)
- Synthetic example dataset: 4 fictional cases with watermarked sample invoices (`examples/`)
- `npm run demo` — submit an example case to the local API and print the decision
- Docs: ROADMAP, LIMITATIONS, MODEL_CARD, THREAT_MODEL, evaluation template, good-first-issue drafts
- Simulated interactive demo on GitHub Pages
- Official logo

### Changed
- Policy engine split into pure logic (`policyRules.ts`) + persistence wrapper (`policyEngine.ts`)
- Fixed Express 5 `req.params` typing in actions route

## [0.1.0] — 2026-07-13

### Added
- Initial public release: ten-agent swarm (7 core + Skeptic, Prosecutor, Chair),
  local Ollama integration with deterministic fallback, PostgreSQL + MinIO,
  explainable findings with `reasoning[]`, policy engine, audit trail,
  Next.js tadpole-pool UI, MIT license.
