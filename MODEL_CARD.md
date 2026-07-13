# Model Card — Tadpools LLM usage

## What the LLM is used for

Agents run **deterministic rule-based checks first** (dates, name similarity,
flag patterns). The LLM is called only to *enrich reasoning* on medium/high-risk
findings — adding 1–2 sentences of contextual commentary that is appended to the
finding's `reasoning[]`. The LLM does **not** set risk levels, flags or scores
in v0.1.

## Fallback behaviour

If Ollama is unreachable or times out (`LLM_TIMEOUT_MS`), the LLM client returns
`null` and agents silently continue with rule-based output only. The system is
fully functional without any LLM. This path is unit-tested.

## Reference model

- Development and docs reference: `qwen2.5:7b` via Ollama
- Any Ollama chat model with an OpenAI-compatible endpoint should work
- Temperature is fixed low (0.15) for consistency

## Reporting results

When sharing evaluation results, always record: model name and tag, Ollama
version, hardware (CPU/GPU, RAM), number of scenarios, false positives/negatives,
average processing time, and whether the LLM or the deterministic fallback
produced each finding. See docs/evaluation.md for the template.

## Known risks

- Hallucinated context in enrichment text (mitigated: never drives the decision)
- Model-version drift changing enrichment tone or content
- Prompt injection via extracted document fields is theoretically possible;
  extracted values are passed into prompts (see THREAT_MODEL.md)
