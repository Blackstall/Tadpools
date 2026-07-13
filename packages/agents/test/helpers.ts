import { SharedMemoryClass } from "@tadpools/agents";
import type { AgentContext } from "@tadpools/agents";
import type { CaseInput } from "@tadpools/shared/index";

/** LLM stub that always fails — exercises the deterministic fallback path. */
export const offlineLLM = {
  baseUrl: "http://localhost:0",
  timeoutMs: 1,
  complete: async () => null,
} as unknown as AgentContext["llm"];

export function makeCaseInput(overrides: {
  companyName?: string;
  registrationDate?: string;
  natureOfBusiness?: string;
  beneficiaryName?: string;
} = {}): CaseInput {
  return {
    company: {
      companyName: overrides.companyName ?? "Aqua Logistics Sdn Bhd",
      registrationNumber: "201401234567",
      registrationDate: overrides.registrationDate ?? "2014-03-01",
      natureOfBusiness: overrides.natureOfBusiness ?? "Freight and warehousing",
    },
    beneficiary: {
      beneficiaryName: overrides.beneficiaryName ?? "Aqua Logistics Sdn Bhd",
      accountNumber: "1234567890",
      bankName: "Fictional Bank Berhad",
    },
    documents: [],
    consentAccepted: true,
  };
}

export function makeContext(caseInput: CaseInput, round = 1): AgentContext {
  return {
    caseId: "00000000-0000-0000-0000-000000000000",
    caseInput,
    extractedFields: [],
    sharedMemory: new SharedMemoryClass(),
    round,
    llm: offlineLLM,
  };
}

/** Date string `months` months in the past (ISO yyyy-mm-dd). */
export function monthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}
