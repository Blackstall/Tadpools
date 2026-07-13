import type { AgentFinding } from "@tadpools/shared/index";
import type { AgentContext, SwarmAgent } from "../../index.js";
import { getModelForAgent } from "../../llm/modelRouter.js";

const SYSTEM_PROMPT = `You are BeneficiaryConsistencyAgent in a KYC compliance swarm.
Assess whether the bank account and beneficiary details are consistent and legitimate.
Consider: known Malaysian banks, account number formats, extracted document cross-check.
Respond in 1-2 sentences only.`;

const KNOWN_BANKS = new Set([
  "maybank", "cimb", "public bank", "rhb", "hong leong bank", "ambank",
  "affin bank", "alliance bank", "bank islam", "bank muamalat", "ocbc",
  "standard chartered", "hsbc", "uob", "citibank", "bsn", "agrobank",
  "bank rakyat", "bank simpanan nasional", "mbsb", "Kuwait finance house", "kfh",
]);

function normalizeBank(name: string): string {
  return name.toLowerCase().replace(/\bberhad\b|\bbhd\b/g, "").trim();
}

function isKnownBank(name: string): boolean {
  const n = normalizeBank(name);
  return [...KNOWN_BANKS].some((b) => n.includes(b));
}

function validateAccountNumber(acc: string, bankName: string): {
  valid: boolean;
  issue?: string;
} {
  const digits = acc.replace(/\D/g, "");
  // Malaysian bank account numbers: typically 8–16 digits
  if (digits.length < 8) return { valid: false, issue: "Account number too short (< 8 digits)" };
  if (digits.length > 16) return { valid: false, issue: "Account number too long (> 16 digits)" };
  // Maybank: 12 digits
  if (normalizeBank(bankName).includes("maybank") && digits.length !== 12) {
    return { valid: false, issue: `Maybank accounts are 12 digits; got ${digits.length}` };
  }
  return { valid: true };
}

export const beneficiaryConsistencyAgent: SwarmAgent = {
  name: "BeneficiaryConsistencyAgent",

  async run(ctx: AgentContext): Promise<AgentFinding> {
    const { accountNumber, bankName, beneficiaryName } = ctx.caseInput.beneficiary;

    const reasoning: string[] = [];
    const flags: string[] = [];
    let riskLevel: AgentFinding["riskLevel"] = "low";
    let confidence = 0.82;
    let summary: string;

    reasoning.push(`Beneficiary: "${beneficiaryName}"`);
    reasoning.push(`Bank: "${bankName}", Account: "${accountNumber}"`);

    // Bank validation
    if (!isKnownBank(bankName)) {
      flags.push("UNKNOWN_BANK");
      riskLevel = "medium";
      reasoning.push(`"${bankName}" is not in the known Malaysian bank directory.`);
    } else {
      reasoning.push(`"${bankName}" is a recognised institution.`);
    }

    // Account number validation
    const accCheck = validateAccountNumber(accountNumber, bankName);
    if (!accCheck.valid) {
      flags.push("ACCOUNT_FORMAT_INVALID");
      riskLevel = "high";
      confidence = 0.91;
      reasoning.push(`Account validation failed: ${accCheck.issue}`);
    } else {
      reasoning.push(`Account number format is valid (${accountNumber.replace(/\D/g, "").length} digits).`);
    }

    // Cross-check with extracted payment fields
    const extractedAccount = ctx.extractedFields.find((f) =>
      ["payee_account", "bank_account"].includes(f.fieldName)
    );
    const extractedBank = ctx.extractedFields.find((f) => f.fieldName === "payee_bank");

    if (extractedAccount && !extractedAccount.value.includes("[EXTRACTED")) {
      if (!extractedAccount.value.includes(accountNumber)) {
        flags.push("ACCOUNT_MISMATCH");
        riskLevel = "high";
        reasoning.push(`Extracted account "${extractedAccount.value}" does not match submitted account "${accountNumber}".`);
      } else {
        reasoning.push("Extracted account number matches submitted account.");
      }
    }

    if (extractedBank && !extractedBank.value.includes("[EXTRACTED")) {
      if (!normalizeBank(extractedBank.value).includes(normalizeBank(bankName))) {
        flags.push("BANK_MISMATCH");
        riskLevel = riskLevel === "high" ? "high" : "medium";
        reasoning.push(`Extracted bank "${extractedBank.value}" does not match submitted bank "${bankName}".`);
      }
    }

    if (flags.length === 0) {
      reasoning.push("All beneficiary fields are consistent and validated.");
      summary = `Beneficiary account and bank details pass consistency checks.`;
    } else if (flags.includes("ACCOUNT_MISMATCH")) {
      summary = `Critical: beneficiary account number extracted from documents does not match submitted data.`;
    } else {
      summary = `Beneficiary details raised ${flags.length} concern(s): ${flags.join(", ")}.`;
    }

    // ── LLM enrichment ─────────────────────────────────────────────────────────
    if (riskLevel !== "low") {
      const model = getModelForAgent(this.name);
      const llmResult = await ctx.llm.complete(
        model,
        SYSTEM_PROMPT,
        `Beneficiary: "${beneficiaryName}", Bank: "${bankName}", Account: "${accountNumber}". Issues: ${flags.join(", ") || "none"}. Assess legitimacy of beneficiary banking details.`,
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
        `beneficiary.accountNumber:${accountNumber}`,
        `beneficiary.bankName:${bankName}`,
      ],
      flags,
      reasoning,
      round: ctx.round,
    };

    ctx.sharedMemory.publish(finding);
    return finding;
  },
};
