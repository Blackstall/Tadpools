# Threat Model (v0.1)

Scope: a single-operator, localhost deployment — the only supported setup in v0.1.

## Assets

- Case data (company, beneficiary, account details)
- Uploaded documents (temporarily in MinIO)
- Audit trail (PostgreSQL)
- Decision integrity

## Trust boundaries

1. **Browser → API (port 4000).** No authentication in v0.1. Anyone who can
   reach the port can create cases, read decisions and trigger actions.
   *Mitigation: bind to localhost only; do not port-forward or reverse-proxy.*
2. **API → PostgreSQL / MinIO.** Default credentials in docker-compose are for
   local development. *Mitigation: never expose 5433/9000/9001 publicly; change
   credentials for any shared environment.*
3. **API → Ollama.** Plain HTTP to localhost. A malicious local process could
   impersonate the LLM endpoint; enrichment text never drives decisions, which
   bounds the impact.
4. **Documents → extraction → LLM prompts.** Extracted field values are
   interpolated into LLM prompts. A crafted document could attempt prompt
   injection. Impact bounded: LLM output only lands in `reasoning[]` commentary.
   *Planned hardening: delimit or sanitise extracted values in prompts.*

## Non-goals in v0.1

- Multi-user isolation, RBAC (planned v0.3)
- Encrypted storage at rest
- Network deployment of any kind

## Reporting

Security issues: see [SECURITY.md](SECURITY.md) — please report privately.
