import type { AgentFinding } from "@tadpools/shared/index";
import type { AgentContext, SwarmAgent } from "../../index.js";
import { getModelForAgent } from "../../llm/modelRouter.js";

const SYSTEM_PROMPT = `You are NatureOfBusinessAgent in a KYC compliance swarm.
Assess if the stated business sector presents money laundering or fraud risk.
Respond in 1-2 sentences only. Be specific about the sector risk profile.`;

// High-risk business sectors that warrant elevated scrutiny
const HIGH_RISK_SECTORS = new Set([
  "gambling", "gaming", "casino", "cryptocurrency", "crypto", "forex",
  "money changer", "remittance", "pawnshop", "jewellery", "jewelry",
  "arms", "weapon", "defence", "tobacco", "alcohol",
]);

// Sector pairs that are mismatched (company biz → suspicious payment purpose)
const MISMATCH_PAIRS: Array<[string, string]> = [
  ["it", "construction"],
  ["technology", "agriculture"],
  ["food", "software"],
  ["trading", "medical"],
  ["education", "real estate"],
];

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").trim();
}

function isHighRisk(sector: string): boolean {
  const n = normalize(sector);
  return [...HIGH_RISK_SECTORS].some((r) => n.includes(r));
}

function sectorMismatch(companyBiz: string, benBiz: string | undefined): boolean {
  if (!benBiz) return false;
  const c = normalize(companyBiz);
  const b = normalize(benBiz);
  return MISMATCH_PAIRS.some(([a, x]) => c.includes(a) && b.includes(x));
}

export const natureOfBusinessAgent: SwarmAgent = {
  name: "NatureOfBusinessAgent",

  async run(ctx: AgentContext): Promise<AgentFinding> {
    const { natureOfBusiness: companyBiz } = ctx.caseInput.company;
    const { natureOfBusiness: benBiz } = ctx.caseInput.beneficiary;

    const reasoning: string[] = [];
    const flags: string[] = [];
    let riskLevel: AgentFinding["riskLevel"] = "low";
    let confidence = 0.78;
    let summary: string;

    reasoning.push(`Company sector: "${companyBiz}"`);
    if (benBiz) reasoning.push(`Beneficiary sector: "${benBiz}"`);

    // Check extracted fields for payment purpose
    const purposeField = ctx.extractedFields.find((f) => f.fieldName === "purpose");
    const goodsField = ctx.extractedFields.find((f) => f.fieldName === "goods_description");
    if (purposeField) reasoning.push(`Payment purpose (extracted): "${purposeField.value}"`);
    if (goodsField) reasoning.push(`Goods description (extracted): "${goodsField.value}"`);

    if (isHighRisk(companyBiz)) {
      flags.push("HIGH_RISK_SECTOR");
      riskLevel = "high";
      confidence = 0.91;
      reasoning.push(`"${companyBiz}" is a high-risk sector requiring enhanced due diligence.`);
    }

    if (sectorMismatch(companyBiz, benBiz)) {
      flags.push("SECTOR_MISMATCH");
      riskLevel = riskLevel === "high" ? "high" : "medium";
      reasoning.push(`Sector mismatch detected between company ("${companyBiz}") and beneficiary ("${benBiz}").`);
    }

    if (flags.length === 0) {
      reasoning.push("No sector-based risk signals detected.");
    }

    summary = flags.includes("HIGH_RISK_SECTOR")
      ? `Company operates in high-risk sector "${companyBiz}" — enhanced due diligence required.`
      : flags.includes("SECTOR_MISMATCH")
        ? `Business sector mismatch between company and beneficiary activities.`
        : `Nature of business "${companyBiz}" does not present sector-level risk signals.`;

    // Read peer findings if any are already published (swarm interaction)
    const peers = ctx.sharedMemory.readAll(this.name);
    if (peers.length > 0) {
      const peerFlags = peers.flatMap((p) => p.flags);
      if (peerFlags.includes("NEW_ENTITY_HIGH_RISK") && riskLevel === "low") {
        reasoning.push("Peer finding (RegistrationAgeAgent): new entity — elevated scrutiny applied.");
        riskLevel = "medium";
        confidence = Math.min(confidence + 0.05, 0.95);
      }
    }

    // ── LLM enrichment (domain sector knowledge) ───────────────────────────────
    if (riskLevel === "medium" || riskLevel === "high" || flags.length > 0) {
      const model = getModelForAgent(this.name);
      const benDesc = benBiz ? ` paying to a "${benBiz}" business` : "";
      const llmResult = await ctx.llm.complete(
        model,
        SYSTEM_PROMPT,
        `Company sector: "${companyBiz}"${benDesc}. Registration age context: ${peers.find(p => p.agent === "RegistrationAgeAgent")?.summary ?? "unknown"}. Flags raised: ${flags.join(", ") || "none"}. Provide sector-level compliance insight.`,
        120
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
        `company.natureOfBusiness:${companyBiz}`,
        ...(benBiz ? [`beneficiary.natureOfBusiness:${benBiz}`] : []),
      ],
      flags,
      reasoning,
      round: ctx.round,
    };

    ctx.sharedMemory.publish(finding);
    return finding;
  },
};
