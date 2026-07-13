# Open Source Launch Checklist — Tadpools

## ✅ Done (in this repo)

- [x] `.gitignore` — excludes `.env`, `node_modules`, `.next`, `dist`, `.claude`, build artifacts
- [x] `.env.example` at root with accurate local-dev defaults (Ollama, PG 5433, MinIO)
- [x] `LICENSE` — MIT, © 2026 Farris Nasarudin
- [x] `README.md` — public-facing: what it is, how it works, quick start, docs links, disclaimer
- [x] `CONTRIBUTING.md` — setup, monorepo build order, agent contract, PR conventions
- [x] `CODE_OF_CONDUCT.md` — Contributor Covenant 2.1
- [x] `SECURITY.md` — private vulnerability reporting
- [x] `.github/` issue templates + PR template
- [x] Secret audit — no real credentials in source (only local-dev defaults)

## 🔲 To do (manual steps, in order)

### 1. Git & GitHub

- [ ] `git init` in the project folder (it is not a git repo yet)
- [ ] Verify ignores work: `git status` should NOT list `.env`, `node_modules/`, `apps/web/.next/`, `packages/*/dist/`, `.claude/`
- [ ] First commit, then create a **public** repo named `tadpools` on GitHub and push:
  ```bash
  git init
  git add .
  git commit -m "Initial public release"
  git branch -M main
  git remote add origin https://github.com/<your-username>/tadpools.git
  git push -u origin main
  ```
- [ ] Replace `<your-username>` in README.md clone URL with your actual GitHub username

### 2. GitHub repo settings

- [ ] Add description ("Swarm-based, explainable fraud detection & KYC intelligence — runs fully local") and topics: `fraud-detection`, `kyc`, `ai-agents`, `swarm-intelligence`, `typescript`, `nextjs`, `ollama`
- [ ] Enable **Issues** and **Discussions**
- [ ] Settings → Security → enable **private vulnerability reporting** (SECURITY.md links to it)
- [ ] Protect `main` branch (require PR before merge) once contributors arrive

### 3. Code polish (recommended before/soon after launch)

- [ ] Decide whether to commit `packages/*/dist/` — currently gitignored (recommended); contributors build from source
- [ ] Remove or consolidate internal working docs in `docs/` that aren't useful to the public (`claude-ready.md`, `update.md`, `redesign.md`, `v2-build-plan.md`, `master-plan.md`) — or move them to a `docs/archive/`
- [ ] Duplicate route check: `apps/api/src/routes/audit.ts` vs `auditRoutes.ts` — confirm both are intentional
- [ ] Add at least a smoke test and a CI workflow (`.github/workflows/ci.yml` running `npm run typecheck && npm run build`)
- [ ] Add a demo GIF/screenshot of the tadpole pool to the README — visual projects get far more stars
- [ ] Document which Ollama model(s) you tested with in the README prerequisites

### 4. Launch

- [ ] Tag `v0.1.0` release with release notes
- [ ] Share (Reddit r/selfhosted, r/opensource, Hacker News Show HN, LinkedIn) with the demo GIF
