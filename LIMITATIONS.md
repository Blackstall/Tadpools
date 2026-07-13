# Limitations

Read this before relying on Tadpools for anything.

1. **Tadpools is decision support, not an autonomous rejection system.**
   A human must review every consequential outcome. The Chair deliberately
   withholds auto-reject in ambiguous situations for exactly this reason.
2. **LLM findings may be inaccurate.** Agents use a local LLM to enrich
   reasoning; language models produce plausible-sounding errors. Deterministic
   checks run first, but enriched text should be treated as commentary, not fact.
3. **Results differ between models and model versions.** A case that scores
   84 with one Ollama model may score differently with another. Record the model
   and version with any result you keep (see MODEL_CARD.md).
4. **A high-risk result is not proof of criminal activity.** It is a signal to
   investigate. False positives are expected, especially for young companies
   and name variations across languages.
5. **Synthetic demonstrations do not establish production accuracy.** The
   `examples/` cases and the GitHub Pages demo are illustrations, not benchmarks.
6. **Human review remains necessary** for every escalation and rejection.
7. **You are responsible for lawful data handling.** Tadpools ships with no
   compliance guarantees. Data protection, retention, banking-secrecy and KYC
   regulations vary by jurisdiction; consult your compliance function before
   processing real customer data.
8. **Name matching is heuristic.** Bigram similarity with suffix stripping
   handles common cases; transliteration, initialisms and multi-script names
   can defeat it.
9. **No authentication yet.** v0.1 has no user accounts or access control —
   do not expose it beyond localhost.
