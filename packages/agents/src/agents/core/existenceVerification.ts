import type { AgentFinding } from "@tadpools/shared/index";
import type { AgentContext, SwarmAgent } from "../../index.js";
import { getModelForAgent } from "../../llm/modelRouter.js";

const SYSTEM_PROMPT = `You are ExistenceVerificationAgent in a KYC compliance swarm.
Assess whether the company appears to be a legitimately registered Malaysian entity.
Consider: company name conventions, registration number format, sector.
Respond in 1-2 sentences only.`;

// Valid Malaysian company name suffixes
const VALID_SUFFIXES = [
  "sdn bhd", "sdn. bhd.", "bhd", "berhad", "plt", "llp",
  "enterprise", "trading", "industries", "services", "group",
];

// Malaysian SSM registration number patterns:
// Old format: 7-digit number (e.g., 0123456-P)
// New format: 202X-XXXXXXXX (year + 8 digits)
function validateRegNumber(regNum: string): { valid: boolean; format: string; issue?: string } {
  const cleaned = regNum.replace(/[\s-]/g, "").toUpperCase();
  // New format: 202X followed by 8 digits = 12 digits
  if (/^20\d{10}$/.test(cleaned)) return { valid: true, format: "new-SSM-12digit" };
  // Old format: 6–7 digits optionally followed by letter
  if (/^\d{6,7}[A-Z]?$/.test(cleaned)) return { valid: true, format: "old-SSM-7digit" };
  // Numeric only (some imported entities)
  if (/^\d{8,12}$/.test(cleaned)) return { valid: true, format: "numeric" };
  return { valid: false, format: "unknown", issue: `Format not recognised: "${regNum}"` };
}

function hasValidSuffix(companyName: string): boolean {
  const n = companyName.toLowerCase();
  return VALID_SUFFIXES.some((s) => n.includes(s));
}

export const existenceVerificationAgent: SwarmAgent = {
  name: "ExistenceVerificationAgent",

  async run(ctx: AgentContext): Promise<AgentFinding> {
    const { companyName, registrationNumber } = ctx.caseInput.company;

    const reasoning: string[] = [];
    const flags: string[] = [];
    let riskLevel: AgentFinding["riskLevel"] = "low";
    let confidence = 0.70;
    let summary: string;

    reasoning.push(`Company name: "${companyName}"`);
    reasoning.push(`Registration number: "${registrationNumber}"`);

    // 1. Company name suffix check
    if (!hasValidSuffix(companyName)) {
      flags.push("INVALID_COMPANY_NAME_SUFFIX");
      riskLevel = "medium";
      reasoning.push(`"${companyName}" does not contain a recognised legal entity suffix.`);
    } else {
      reasoning.push("Company name contains a recognised legal entity suffix.");
    }

    // 2. Registration number format check
    const regCheck = validateRegNumber(registrationNumber);
    if (!regCheck.valid) {
      flags.push("INVALID_REG_NUMBER_FORMAT");
      riskLevel = "high";
      confidence = 0.87;
      reasoning.push(`Registration number validation failed: ${regCheck.issue}`);
    } else {
      reasoning.push(`Registration number format valid (${regCheck.format}).`);
    }

    // 3. External registry — provisional (real call in Phase 5)
    flags.push("EXTERNAL_CHECK_PENDING");
    reasoning.push("External SSM registry API not yet connected — result marked provisional.");
    if (riskLevel === "low") riskLevel = "low"; // keep low but flag pending

    // 4. Cross-check with extracted fields
    const extractedCompany = ctx.extractedFields.find((f) =>
      ["issuer_name", "party_a", "vendor_name"].includes(f.fieldName)
    );
    if (extractedCompany && !extractedCompany.value.includes("[EXTRACTED")) {
      reasoning.push(`Extracted entity name found: "${extractedCompany.value}"`);
      const nameLower = extractedCompany.value.toLowerCase();
      const companyLower = companyName.toLowerCase();
      if (!nameLower.includes(companyLower.split(" ")[0])) {
        flags.push("ENTITY_NAME_DISCREPANCY");
        riskLevel = riskLevel === "high" ? "high" : "medium";
        reasoning.push("Extracted entity name does not appear to match submitted company name.");
      }
    }

    const criticalFlags = flags.filter((f) => f !== "EXTERNAL_CHECK_PENDING");
    if (criticalFlags.length === 0) {
      summary = `Company name and registration number pass format validation. External registry check pending.`;
    } else {
      summary = `Existence check raised ${criticalFlags.length} concern(s): ${criticalFlags.join(", ")}.`;
      if (riskLevel === "low") riskLevel = "medium";
    }

    // ── LLM enrichment ─────────────────────────────────────────────────────────
    if (riskLevel !== "low" || flags.some(f => f !== "EXTERNAL_CHECK_PENDING")) {
      const model = getModelForAgent(this.name);
      const llmResult = await ctx.llm.complete(
        model,
        SYSTEM_PROMPT,
        `Company name: "${companyName}", registration number: "${registrationNumber}", sector: "${ctx.caseInput.company.natureOfBusiness}". Format check: ${flags.includes("INVALID_REG_NUMBER_FORMAT") ? "FAILED" : "passed"}. Name suffix: ${flags.includes("INVALID_COMPANY_NAME_SUFFIX") ? "not recognised" : "valid"}. Does this company appear legitimate?`,
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
        `company.companyName:${companyName}`,
        `company.registrationNumber:${registrationNumber}`,
      ],
      flags,
      reasoning,
      round: ctx.round,
    };

    ctx.sharedMemory.publish(finding);
    return finding;
  },
};
