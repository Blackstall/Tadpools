# Evaluation Report

> **Status: template.** The table below defines the scenario matrix; results
> must be filled in from real runs before being cited anywhere. Simulated demos
> do not establish accuracy (see LIMITATIONS.md).

## Environment

| Field | Value |
|---|---|
| Ollama model | qwen2.5:7b _(fill in tag + digest)_ |
| Ollama version | _(fill in)_ |
| Hardware | _(CPU/GPU, RAM)_ |
| Tadpools commit | _(git SHA)_ |
| LLM or deterministic fallback | _(per run)_ |
| Date | _(fill in)_ |

## Scenario matrix

| # | Scenario | Expected | Tadpools result | Correct? | Time (s) |
|---|---|---|---|---|---|
| 1 | Established company, matching beneficiary (`examples/legitimate-company`) | Approve | | | |
| 2 | New company, insufficient documents (`examples/newly-registered-company`) | Manual review | | | |
| 3 | Beneficiary-name mismatch (`examples/suspicious-beneficiary`) | Escalate | | | |
| 4 | Clearly inconsistent documents (`examples/document-mismatch`) | Manual review / Escalate | | | |
| 5 | _(add adversarial variants…)_ | | | | |

## Aggregates

- Scenarios run: _n_
- False positives (legitimate flagged high-risk): _n_
- False negatives (suspicious approved): _n_
- Average processing time: _s_
- Runs using LLM enrichment vs deterministic fallback: _n / n_

## Method notes

Run each scenario with `npm run demo <example>` against a fresh database, record
the decision JSON verbatim, and repeat 3× per scenario to observe model variance.
Deterministic-fallback runs (Ollama stopped) should be reported separately —
they are expected to be fully reproducible.
