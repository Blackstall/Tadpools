#!/usr/bin/env node
/**
 * Tadpools demo — submits a synthetic example case to the local API and
 * prints the swarm's decision. Requires the API (port 4000) to be running.
 *
 *   npm run demo                        # legitimate-company
 *   npm run demo suspicious-beneficiary
 */
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const API = process.env.TADPOOLS_API ?? "http://localhost:4000";
const example = process.argv[2] ?? "legitimate-company";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const file = resolve(root, "examples", example, "company.json");
let caseInput;
try {
  caseInput = JSON.parse(await readFile(file, "utf8"));
} catch {
  console.error(`Could not read ${file}\nUsage: npm run demo [example-folder-name]`);
  process.exit(1);
}

console.log(`🐸 Submitting example "${example}" (${caseInput.company.companyName}) to ${API} …`);

let res;
try {
  res = await fetch(`${API}/api/cases`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(caseInput),
  });
} catch {
  console.error(`✗ Could not reach the API at ${API}. Is it running? (npm run dev)`);
  process.exit(1);
}
if (!res.ok) {
  console.error(`✗ API returned ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const { caseId } = await res.json();
console.log(`   Case created: ${caseId}\n   Swarm running — polling for a decision …`);

const started = Date.now();
while (Date.now() - started < 120_000) {
  await new Promise((r) => setTimeout(r, 2500));
  const c = await (await fetch(`${API}/api/cases/${caseId}`)).json();
  const status = c.status ?? c.case?.status;
  process.stdout.write(`   status: ${status}        \r`);
  if (["decided", "needs_review", "escalated", "approved", "rejected"].includes(status)) {
    const decision = c.decision ?? c.case?.decision;
    console.log("\n");
    if (decision) {
      console.log(`🏁 Decision: ${String(decision.status).toUpperCase()}  (score ${decision.score})`);
      for (const r of decision.reasons ?? []) console.log(`   • ${r}`);
    } else {
      console.log(`🏁 Final status: ${status} — inspect the case at http://localhost:3000`);
    }
    console.log(`\nFull audit trail: ${API}/api/cases/${caseId}/audit`);
    process.exit(0);
  }
}
console.error("\n✗ Timed out after 120s — check the API logs.");
process.exit(1);
