● Here's how to run the full stack. You need 3 terminals:   

  ---
  Terminal 1 — Start infrastructure (Postgres + MinIO)      

  cd C:\Users\User\Desktop\Business\tadpools\infra
  docker compose up -d

  ▎ Postgres maps to localhost:5433, MinIO API to 9000,     
  ▎ MinIO console to 9001.

  ---
  Terminal 2 — Build packages then start the API

  cd C:\Users\User\Desktop\Business\tadpools

  # Build shared + agents packages first (required once, or 
  after changes)
  npm run build -w @tadpools/shared
  npm run build -w @tadpools/agents

  # Start the API
  npx tsx apps/api/src/server.ts

  ▎ API runs on http://localhost:4000

  ---
  Terminal 3 — Start the frontend

  cd C:\Users\User\Desktop\Business\tadpools
  npm run dev -w @tadpools/web

  ▎ Web app runs on http://localhost:3000

  ---
  Quick reference

  ┌─────────────┬───────────────────────────────────────┐   
  │   Service   │                  URL                  │   
  ├─────────────┼───────────────────────────────────────┤   
  │ Web app     │ http://localhost:3000                 │   
  ├─────────────┼───────────────────────────────────────┤   
  │ API         │ http://localhost:4000                 │   
  ├─────────────┼───────────────────────────────────────┤   
  │ MinIO       │ http://localhost:9001 (user: minio /  │   
  │ console     │ minio123)                             │   
  └─────────────┴───────────────────────────────────────┘   

  ---
  First run only — after Docker starts, the API
  automatically runs migrations on startup (creates all     
  tables including the new recommended_actions and
  bank_escalation_contacts tables added in Phase 6).        

  If the API crashes with Cannot find module
  @tadpools/agents, re-run the two npm run build commands — 
  the packages need to be compiled before tsx can import    
  them.

