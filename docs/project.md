# Tadpools — Project Architecture

## Objective
Build an open-source, swarm-based KYC onboarding system using multi-agent intelligence to assess company risk before payment onboarding.

## System Components

### Frontend
- Next.js
- Tailwind CSS
- SVG/canvas-based swarm visualization
- Real-time updates

### Backend
- Node.js / TypeScript
- API routes
- Workflow orchestration layer

### Database
- PostgreSQL
- cases
- companies
- beneficiaries
- documents_temp
- extracted_fields
- agent_findings
- risk_signals
- decisions
- suspicious_directory
- audit_logs

### Storage
- Temporary object storage (S3-compatible)
- Files deleted after processing

### LLM Layer
- Qwen3-8B → lightweight tasks
- Qwen3-14B → structured checks
- Qwen3-32B → reasoning agents
- DeepSeek-R1 → escalation review

### Inference Engine
- vLLM

## Deployment Strategy
### Phase 1
- Single VPS
- Docker Compose
- vLLM serving open models
- Postgres DB

### Phase 2
- Separate inference nodes
- Queue system
- Load balancing
