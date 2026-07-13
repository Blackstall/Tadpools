/**
 * LLMClient — thin wrapper around Ollama's OpenAI-compatible API.
 *
 * Design intent:
 * - Rule-based logic runs first (fast, deterministic, explainable)
 * - LLM enriches reasoning for ambiguous/medium-risk cases
 * - On timeout or failure, agents fall back silently to rule-based output
 */

export interface LLMResponse {
  content: string;
  model: string;
  durationMs: number;
}

export class LLMClient {
  readonly baseUrl: string;
  readonly timeoutMs: number;

  constructor(
    baseUrl = "http://localhost:11434",
    timeoutMs = 25_000
  ) {
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Call the LLM and return a plain-text response.
   * Returns null on any error so callers can fall back gracefully.
   */
  async complete(
    model: string,
    systemPrompt: string,
    userMessage: string,
    maxTokens = 200
  ): Promise<LLMResponse | null> {
    const start = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user",   content: userMessage },
          ],
          max_tokens: maxTokens,
          temperature: 0.15,  // low temp for consistent compliance reasoning
          stream: false,
        }),
      });

      if (!res.ok) {
        console.warn(`[LLM] HTTP ${res.status} from model ${model}`);
        return null;
      }

      const json = await res.json() as {
        choices: Array<{ message: { content: string } }>;
        model: string;
      };

      const content = json.choices[0]?.message?.content?.trim() ?? "";
      return { content, model: json.model ?? model, durationMs: Date.now() - start };
    } catch (err) {
      const label = (err as Error).name === "AbortError" ? "timeout" : (err as Error).message;
      console.warn(`[LLM] ${model} skipped (${label}) — rule-based fallback active`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
