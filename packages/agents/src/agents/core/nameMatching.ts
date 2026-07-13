import type { AgentFinding } from "@tadpools/shared/index";
import type { AgentContext, SwarmAgent } from "../../index.js";
import { getModelForAgent } from "../../llm/modelRouter.js";

const SYSTEM_PROMPT = `You are NameMatchingAgent in a KYC compliance swarm.
Determine if the company name and beneficiary name represent the same legal entity.
Consider: trading names, subsidiaries, abbreviations, legal suffixes.
Respond in 1-2 sentences only.`;

const LEGAL_SUFFIXES = ["sdn bhd", "bhd", "sdn. bhd.", "pte ltd", "ltd", "llp", "plc", "inc", "corp"];

function normalize(name: string): string {
  let n = name.toLowerCase().replace(/\./g, "").trim();
  for (const suffix of LEGAL_SUFFIXES) {
    n = n.replace(new RegExp(`\\b${suffix}\\b`, "g"), "").trim();
  }
  return n.replace(/\s+/g, " ").trim();
}

/** Simple character n-gram similarity (0–1) */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const n = 2; // bigrams
  const getGrams = (s: string) => {
    const grams = new Set<string>();
    for (let i = 0; i < s.length - n + 1; i++) grams.add(s.slice(i, i + n));
    return grams;
  };

  const ga = getGrams(a);
  const gb = getGrams(b);
  let overlap = 0;
  for (const g of ga) if (gb.has(g)) overlap++;
  return (2 * overlap) / (ga.size + gb.size);
}

export const nameMatchingAgent: SwarmAgent = {
  name: "NameMatchingAgent",

  async run(ctx: AgentContext): Promise<AgentFinding> {
    const companyRaw = ctx.caseInput.company.companyName;
    const beneficiaryRaw = ctx.caseInput.beneficiary.beneficiaryName;

    const companyNorm = normalize(companyRaw);
    const beneficiaryNorm = normalize(beneficiaryRaw);
    const sim = similarity(companyNorm, beneficiaryNorm);

    const reasoning: string[] = [];
    const flags: string[] = [];
    let riskLevel: AgentFinding["riskLevel"];
    let confidence: number;
    let summary: string;

    reasoning.push(`Company (raw): "${companyRaw}" → normalized: "${companyNorm}"`);
    reasoning.push(`Beneficiary (raw): "${beneficiaryRaw}" → normalized: "${beneficiaryNorm}"`);
    reasoning.push(`Bigram similarity score: ${(sim * 100).toFixed(1)}%`);

    // Also check if beneficiary name appears in extracted issuer/payee fields
    const issuerField = ctx.extractedFields.find((f) =>
      ["issuer_name", "payee_name", "party_a", "vendor_name"].includes(f.fieldName)
    );
    if (issuerField && !issuerField.value.includes("[EXTRACTED")) {
      const extractedSim = similarity(normalize(issuerField.value), companyNorm);
      reasoning.push(`Extracted issuer "${issuerField.value}" similarity to company: ${(extractedSim * 100).toFixed(1)}%`);
      if (extractedSim < 0.4) {
        flags.push("ISSUER_MISMATCH");
        reasoning.push("Extracted issuer name does not match company name.");
      }
    }

    if (sim >= 0.75) {
      riskLevel = "low";
      confidence = 0.90;
      summary = `Company and beneficiary names are highly similar (${(sim * 100).toFixed(0)}%) — no name mismatch.`;
      reasoning.push("Names match within acceptable threshold.");
    } else if (sim >= 0.45) {
      riskLevel = "medium";
      confidence = 0.75;
      flags.push("NAME_PARTIAL_MISMATCH");
      summary = `Partial name similarity (${(sim * 100).toFixed(0)}%) — may indicate trading name difference or proxy entity.`;
      reasoning.push("Moderate mismatch — could be alias or related entity. Manual verification recommended.");
    } else {
      riskLevel = "high";
      confidence = 0.88;
      flags.push("NAME_MISMATCH");
      summary = `Low name similarity (${(sim * 100).toFixed(0)}%) — company and beneficiary appear to be different entities.`;
      reasoning.push("Significant mismatch — potential third-party payment or shell structure.");
    }

    // ── LLM enrichment (name ambiguity) ───────────────────────────────────────
    if (riskLevel !== "low") {
      const model = getModelForAgent(this.name);
      const llmResult = await ctx.llm.complete(
        model,
        SYSTEM_PROMPT,
        `Company: "${companyRaw}" (normalized: "${companyNorm}"), Beneficiary: "${beneficiaryRaw}" (normalized: "${beneficiaryNorm}"). Bigram similarity: ${(sim * 100).toFixed(1)}%. Are these the same legal entity?`,
        100
      );
      if (llmResult) {
        reasoning.push(`[LLM ${llmResult.model} ${llmResult.durationMs}ms] ${llmResult.content}`);
      }
    }
    // ───────────────────────────────────────────────────────────────────────────

    const finding: AgentFinding = {
      agent: this.name,
      summary,
      confidence,
      riskLevel,
      evidenceRefs: [
        `company.companyName:${companyRaw}`,
        `beneficiary.beneficiaryName:${beneficiaryRaw}`,
      ],
      flags,
      reasoning,
      round: ctx.round,
    };

    ctx.sharedMemory.publish(finding);
    return finding;
  },
};
