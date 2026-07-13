# Example cases

Four synthetic onboarding cases for trying Tadpools without preparing your own data.

> ⚠️ **All sample companies, people, bank accounts, transactions and documents in this
> folder are entirely fictional and generated exclusively for testing.**
> Do **not** upload real customer data, internal bank documents, confidential
> investigation procedures, actual account details or proprietary rules from your
> workplace into any Tadpools instance — demo or otherwise.

| Case | What it exercises | Expected outcome |
|---|---|---|
| `legitimate-company/` | Established company, matching beneficiary | Approve |
| `newly-registered-company/` | 6-week-old entity, vague "general trading" purpose | Manual review / escalate |
| `suspicious-beneficiary/` | Beneficiary is an unrelated third party | Escalate |
| `document-mismatch/` | Invoice issuer differs from the onboarding company | Manual review / escalate |

Each folder contains:

- `company.json` — a ready-made `CaseInput` payload
- `sample-invoice.pdf` — a synthetic supporting document (watermarked as fictional)

## Run a demo investigation

With the stack running (`docker compose -f infra/docker-compose.yml up -d` and `npm run dev`):

```bash
npm run demo                          # runs the legitimate-company case
npm run demo suspicious-beneficiary   # or pick any example by folder name
```

The script submits the case to the local API, waits for the swarm to finish,
and prints the decision with every agent's findings. To attach the sample PDF as
evidence, use the web UI at http://localhost:3000 and upload it during intake.

`newly-registered-company/company.json` uses a registration date ~6 weeks before
this folder was generated; regenerate the date if you want it to stay "new".
