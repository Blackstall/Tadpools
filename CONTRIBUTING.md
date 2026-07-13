# Contributing to Tadpools

Thanks for your interest in contributing! This document explains how to get set up and what we expect from contributions.

## Getting set up

1. Fork and clone the repository.
2. Follow the [Quick start](README.md#quick-start) in the README (Docker services, `.env`, `npm install`, `npm run build`).
3. Make sure `npm run typecheck` passes before you start.

## Project structure

This is an npm-workspaces monorepo. Build order matters: `packages/shared` → `packages/agents` → `apps/api` → `apps/web`. If you change a package, rebuild it before testing dependents.

## Making changes

- Create a feature branch from `main`: `git checkout -b feat/short-description`
- Keep pull requests focused — one feature or fix per PR.
- Run `npm run typecheck` and `npm run build` before opening a PR.
- Update relevant documentation in `docs/` when behaviour changes.

## Agent contract

If you add or modify a swarm agent (`packages/agents`), it must honour the `SwarmAgent` contract:

- Call `sharedMemory.publish(finding)` before returning.
- Set `finding.round = context.round`.
- Populate `reasoning[]` — every finding must be explainable.
- Prefer deterministic checks before LLM calls.

## Commit messages

Use clear, imperative messages, e.g. `Add beneficiary mismatch signal to name matching agent`. Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`) are appreciated but not required.

## Reporting bugs and requesting features

Use the GitHub issue templates. For bugs, include reproduction steps, expected vs. actual behaviour, and your environment (OS, Node version, Ollama model).

## Security issues

Do **not** open a public issue for security vulnerabilities — see [SECURITY.md](SECURITY.md).

## Code of Conduct

By participating, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).
