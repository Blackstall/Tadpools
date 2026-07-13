import type { AgentFinding } from "@tadpools/shared/index";
import type { AgentContext, SwarmAgent } from "../../index.js";
import { getModelForAgent } from "../../llm/modelRouter.js";

const SYSTEM_PROMPT = `You are DocumentAuthenticityAgent in a KYC compliance swarm.
Assess whether uploaded documents are internally consistent and authentic.
Consider: name matches, account number consistency, issuer/buyer alignment.
Respond in 1-2 sentences only. Highlight the most critical concern if any.`;

export const documentAuthenticityAgent: SwarmAgent = {
  name: "DocumentAuthenticityAgent",

  async run(ctx: AgentContext): Promise<AgentFinding> {
    const reasoning: string[] = [];
    const flags: string[] = [];
    let riskLevel: AgentFinding["riskLevel"] = "low";
    let confidence = 0.65;
    let summary: string;

    const fields = ctx.extractedFields;
    reasoning.push(`Extracted field count: ${fields.length}`);

    if (fields.length === 0) {
      flags.push("NO_DOCUMENTS_UPLOADED");
      riskLevel = "high";
      confidence = 0.93;
      summary = "No documents were uploaded or extracted. Cannot verify transaction authenticity.";
      reasoning.push("No extracted fields available — document-based verification impossible.");

      const finding: AgentFinding = {
        agent: this.name, summary, confidence, riskLevel,
        evidenceRefs: [], flags, reasoning, round: ctx.round,
      };
      ctx.sharedMemory.publish(finding);
      return finding;
    }

    // Group fields by docId
    const docMap = new Map<string, Map<string, string>>();
    for (const f of fields) {
      if (!docMap.has(f.docId)) docMap.set(f.docId, new Map());
      docMap.get(f.docId)!.set(f.fieldName, f.value);
    }

    reasoning.push(`Documents found: ${docMap.size}`);

    const evidenceRefs: string[] = [];
    let docsWithMockValues = 0;
    let totalDocs = 0;

    for (const [docId, docFields] of docMap) {
      totalDocs++;
      const docType = docFields.get("document_type") ?? "unknown";
      reasoning.push(`Doc [${docType}]: ${docId.split("/").pop()}`);
      evidenceRefs.push(`doc:${docId}`);

      // Count fields still showing mock placeholder
      const mockCount = [...docFields.values()].filter((v) => v.includes("[EXTRACTED")).length;
      const totalFields = docFields.size;
      const mockRatio = mockCount / totalFields;

      reasoning.push(`  ${totalFields - mockCount}/${totalFields} fields extracted (${mockCount} pending OCR).`);

      if (mockRatio >= 1.0) {
        docsWithMockValues++;
        flags.push("DOC_FIELDS_UNEXTRACTED");
        reasoning.push("  All fields are placeholder — document may not have been OCR-processed.");
      } else if (mockRatio > 0.5) {
        flags.push("DOC_PARTIAL_EXTRACTION");
        reasoning.push("  Majority of fields unextracted — partial readability.");
      }

      // Cross-field consistency checks per doc type
      if (docType === "invoice") {
        const issuer = docFields.get("issuer_name") ?? "";
        const buyer = docFields.get("buyer_name") ?? "";
        const companyName = ctx.caseInput.company.companyName.toLowerCase();
        const benName = ctx.caseInput.beneficiary.beneficiaryName.toLowerCase();

        if (!issuer.includes("[EXTRACTED") && !issuer.toLowerCase().includes(companyName.split(" ")[0])) {
          flags.push("INVOICE_ISSUER_MISMATCH");
          riskLevel = "high";
          reasoning.push(`  Invoice issuer "${issuer}" does not match company "${companyName}".`);
        }
        if (!buyer.includes("[EXTRACTED") && !buyer.toLowerCase().includes(benName.split(" ")[0])) {
          flags.push("INVOICE_BUYER_MISMATCH");
          riskLevel = riskLevel === "high" ? "high" : "medium";
          reasoning.push(`  Invoice buyer "${buyer}" does not match beneficiary "${benName}".`);
        }
      }

      if (docType === "payment_voucher") {
        const payeeAcc = docFields.get("payee_account") ?? "";
        const submittedAcc = ctx.caseInput.beneficiary.accountNumber;
        if (!payeeAcc.includes("[EXTRACTED") && !payeeAcc.includes(submittedAcc)) {
          flags.push("VOUCHER_ACCOUNT_MISMATCH");
          riskLevel = "high";
          confidence = 0.91;
          reasoning.push(`  Voucher payee account "${payeeAcc}" != submitted account "${submittedAcc}".`);
        }
      }
    }

    // Peer reading: if NameMatchingAgent found NAME_MISMATCH, elevate risk
    const nameAgent = ctx.sharedMemory.get("NameMatchingAgent");
    if (nameAgent?.flags.includes("NAME_MISMATCH") && riskLevel !== "high") {
      riskLevel = "medium";
      reasoning.push("Peer (NameMatchingAgent) reported name mismatch — elevating document scrutiny.");
    }

    if (docsWithMockValues === totalDocs && totalDocs > 0) {
      confidence = 0.55;
      riskLevel = riskLevel === "high" ? "high" : "medium";
      reasoning.push("All documents have unextracted fields — authenticity cannot be confirmed.");
    }

    const criticalFlags = flags.filter((f) =>
      ["DOC_FORGERY_SIGNAL", "VOUCHER_ACCOUNT_MISMATCH", "INVOICE_ISSUER_MISMATCH"].includes(f)
    );

    if (criticalFlags.length > 0) {
      summary = `Document authenticity check FAILED: ${criticalFlags.join(", ")}.`;
    } else if (flags.length === 0) {
      summary = `All ${totalDocs} document(s) pass internal consistency checks.`;
    } else {
      summary = `Document check raised ${flags.length} signal(s): ${flags.join(", ")}.`;
    }

    // ── LLM enrichment ─────────────────────────────────────────────────────────
    if (riskLevel !== "low" && flags.some(f => !["DOC_FIELDS_UNEXTRACTED","DOC_PARTIAL_EXTRACTION"].includes(f))) {
      const model = getModelForAgent(this.name);
      const llmResult = await ctx.llm.complete(
        model,
        SYSTEM_PROMPT,
        `Company: "${ctx.caseInput.company.companyName}", Beneficiary: "${ctx.caseInput.beneficiary.beneficiaryName}". Documents: ${totalDocs}. Flags: ${flags.join(", ")}. Key concern: ${criticalFlags.length > 0 ? criticalFlags.join(", ") : "none critical"}. Assess document authenticity risk.`,
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
      evidenceRefs,
      flags,
      reasoning,
      round: ctx.round,
    };

    ctx.sharedMemory.publish(finding);
    return finding;
  },
};
