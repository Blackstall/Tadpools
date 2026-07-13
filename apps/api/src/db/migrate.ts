import { db } from "./pool.js";

const DDL = `
-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Enum types (idempotent DO block)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'case_status_enum') THEN
    CREATE TYPE case_status_enum AS ENUM (
      'draft','submitted','processing','needs_review',
      'escalated','approved','rejected','closed'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'decision_type_enum') THEN
    CREATE TYPE decision_type_enum AS ENUM (
      'approve','reject','escalate','hold','request_documents','monitor'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'entity_type_enum') THEN
    CREATE TYPE entity_type_enum AS ENUM (
      'company','beneficiary','bank_account','bank','person','document','case'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_status_enum') THEN
    CREATE TYPE document_status_enum AS ENUM (
      'uploaded','parsed','verified','failed','archived'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'module_type_enum') THEN
    CREATE TYPE module_type_enum AS ENUM (
      'intake','extraction','authenticity','entity_verification',
      'relationship_matching','historical_intelligence','challenge_phase','decision'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severity_enum') THEN
    CREATE TYPE severity_enum AS ENUM ('info','low','medium','high','critical');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'signal_direction_enum') THEN
    CREATE TYPE signal_direction_enum AS ENUM ('risk_increasing','risk_reducing','unresolved');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'actor_type_enum') THEN
    CREATE TYPE actor_type_enum AS ENUM ('system','agent','analyst','admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'timeline_event_type_enum') THEN
    CREATE TYPE timeline_event_type_enum AS ENUM (
      'case_created','document_uploaded','extraction_completed','signal_generated',
      'decision_computed','analyst_action','case_status_changed','entity_linked','note_added'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'relationship_type_enum') THEN
    CREATE TYPE relationship_type_enum AS ENUM (
      'owns','controls','linked_to','beneficiary_of','uses_bank_account',
      'submitted_document','appears_in_case','matches','possible_match'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rule_type_enum') THEN
    CREATE TYPE rule_type_enum AS ENUM ('hard_block','warning','informational','scoring');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'override_reason_enum') THEN
    CREATE TYPE override_reason_enum AS ENUM (
      'manual_clearance','false_positive','additional_evidence','policy_exception','other'
    );
  END IF;
END
$$;

-- ── app_users ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      CITEXT UNIQUE,
  full_name  TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'analyst',
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DROP TRIGGER IF EXISTS trg_app_users_updated_at ON app_users;
CREATE TRIGGER trg_app_users_updated_at
BEFORE UPDATE ON app_users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── policy_versions ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS policy_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_label TEXT NOT NULL UNIQUE,
  description   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── model_versions ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS model_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name    TEXT NOT NULL,
  version_label TEXT NOT NULL,
  module        TEXT NOT NULL,
  description   TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (model_name, version_label, module)
);

-- ── entities ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS entities (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type         TEXT NOT NULL,
  canonical_name      TEXT NOT NULL,
  normalized_name     TEXT,
  external_reference  TEXT,
  registration_number TEXT,
  country_code        CHAR(2),
  risk_score          NUMERIC(6,2),
  first_seen_at       TIMESTAMPTZ,
  last_seen_at        TIMESTAMPTZ,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_entities_type_name ON entities(entity_type, canonical_name);
CREATE INDEX IF NOT EXISTS idx_entities_normalized_name ON entities(normalized_name);
CREATE INDEX IF NOT EXISTS idx_entities_registration_number ON entities(registration_number);
CREATE INDEX IF NOT EXISTS idx_entities_metadata_gin ON entities USING GIN(metadata);
DROP TRIGGER IF EXISTS trg_entities_updated_at ON entities;
CREATE TRIGGER trg_entities_updated_at
BEFORE UPDATE ON entities
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── entity_aliases ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS entity_aliases (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id             UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  alias_name            TEXT NOT NULL,
  normalized_alias_name TEXT,
  source                TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_entity_aliases_entity_id ON entity_aliases(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_aliases_normalized ON entity_aliases(normalized_alias_name);

-- ── entity_relationships ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS entity_relationships (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_entity_id    UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  to_entity_id      UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  confidence        NUMERIC(5,2),
  source            TEXT,
  evidence          JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (from_entity_id <> to_entity_id)
);
CREATE INDEX IF NOT EXISTS idx_entity_rel_from ON entity_relationships(from_entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_rel_to ON entity_relationships(to_entity_id);

-- ── cases (v1 kept, v2 columns added) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cases (
  id               UUID PRIMARY KEY,
  company_name     TEXT,
  reg_number       TEXT,
  reg_date         TEXT,
  nature_of_biz    TEXT,
  beneficiary_name TEXT,
  account_number   TEXT,
  bank_name        TEXT,
  ben_nature_biz   TEXT,
  consent_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  status           TEXT NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS case_reference TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS priority SMALLINT DEFAULT 3;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS source_channel TEXT;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS submitted_by_user_id UUID;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS assigned_to_user_id UUID;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS company_entity_id UUID REFERENCES entities(id) ON DELETE SET NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS beneficiary_entity_id UUID REFERENCES entities(id) ON DELETE SET NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS bank_entity_id UUID REFERENCES entities(id) ON DELETE SET NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS bank_account_entity_id UUID REFERENCES entities(id) ON DELETE SET NULL;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS intake_payload JSONB DEFAULT '{}'::jsonb;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS current_module TEXT DEFAULT 'intake';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS policy_version_id UUID;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_company_entity_id ON cases(company_entity_id);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases(created_at DESC);
DROP TRIGGER IF EXISTS trg_cases_updated_at ON cases;
CREATE TRIGGER trg_cases_updated_at
BEFORE UPDATE ON cases
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── documents ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  entity_id       UUID REFERENCES entities(id) ON DELETE SET NULL,
  file_name       TEXT NOT NULL,
  mime_type       TEXT,
  file_size_bytes BIGINT,
  storage_path    TEXT,
  sha256_hash     TEXT NOT NULL,
  hash_algorithm  TEXT NOT NULL DEFAULT 'sha256',
  document_type   TEXT,
  status          TEXT NOT NULL DEFAULT 'uploaded',
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  parsed_at       TIMESTAMPTZ,
  verified_at     TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sha256_hash, case_id)
);
CREATE INDEX IF NOT EXISTS idx_documents_case_id ON documents(case_id);
CREATE INDEX IF NOT EXISTS idx_documents_sha256 ON documents(sha256_hash);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
DROP TRIGGER IF EXISTS trg_documents_updated_at ON documents;
CREATE TRIGGER trg_documents_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── extracted_fields (v1 kept, v2 columns added) ──────────────────────────────
CREATE TABLE IF NOT EXISTS extracted_fields (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id    UUID REFERENCES cases(id) ON DELETE CASCADE,
  doc_id     TEXT,
  field_name TEXT NOT NULL,
  value      TEXT,
  confidence NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE extracted_fields ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES documents(id) ON DELETE CASCADE;
ALTER TABLE extracted_fields ADD COLUMN IF NOT EXISTS normalized_value TEXT;
ALTER TABLE extracted_fields ADD COLUMN IF NOT EXISTS source_location JSONB;
CREATE INDEX IF NOT EXISTS idx_extracted_fields_case_id ON extracted_fields(case_id);
CREATE INDEX IF NOT EXISTS idx_extracted_fields_field_name ON extracted_fields(field_name);

-- ── policy_rules ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS policy_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_version_id UUID REFERENCES policy_versions(id) ON DELETE CASCADE,
  rule_code         TEXT NOT NULL,
  rule_name         TEXT NOT NULL,
  rule_type         TEXT NOT NULL DEFAULT 'scoring',
  module            TEXT NOT NULL,
  severity          TEXT NOT NULL DEFAULT 'medium',
  description       TEXT,
  scoring_weight    NUMERIC(8,2),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_policy_rules_module ON policy_rules(module);
CREATE INDEX IF NOT EXISTS idx_policy_rules_active ON policy_rules(is_active);

-- ── signals ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS signals (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id            UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  document_id        UUID REFERENCES documents(id) ON DELETE SET NULL,
  entity_id          UUID REFERENCES entities(id) ON DELETE SET NULL,
  policy_rule_id     UUID REFERENCES policy_rules(id) ON DELETE SET NULL,
  module             TEXT NOT NULL,
  signal_code        TEXT,
  signal_name        TEXT NOT NULL,
  description        TEXT,
  severity           TEXT NOT NULL DEFAULT 'medium',
  direction          TEXT NOT NULL DEFAULT 'unresolved',
  confidence         NUMERIC(5,2),
  contribution_score NUMERIC(8,2) NOT NULL DEFAULT 0,
  evidence           JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_by       TEXT NOT NULL DEFAULT 'system',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_signals_case_id ON signals(case_id);
CREATE INDEX IF NOT EXISTS idx_signals_module ON signals(module);
CREATE INDEX IF NOT EXISTS idx_signals_severity ON signals(severity);
CREATE INDEX IF NOT EXISTS idx_signals_direction ON signals(direction);
CREATE INDEX IF NOT EXISTS idx_signals_evidence_gin ON signals USING GIN(evidence);

-- ── decisions (v1 kept, v2 columns added) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS decisions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id    UUID NOT NULL UNIQUE REFERENCES cases(id) ON DELETE CASCADE,
  status     TEXT,
  score      NUMERIC(8,2),
  reasons    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS decision_type TEXT;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS final_score NUMERIC(8,2);
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS confidence NUMERIC(5,2);
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS decision_narrative TEXT;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS recommendation TEXT;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS triggered_rule_ids UUID[] DEFAULT '{}';
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS risk_summary JSONB DEFAULT '{}'::jsonb;
ALTER TABLE decisions ADD COLUMN IF NOT EXISTS computed_by TEXT DEFAULT 'system';
CREATE INDEX IF NOT EXISTS idx_decisions_case_id ON decisions(case_id);
DROP TRIGGER IF EXISTS trg_decisions_updated_at ON decisions;
CREATE TRIGGER trg_decisions_updated_at
BEFORE UPDATE ON decisions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── decision_overrides ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS decision_overrides (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id               UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  decision_id           UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  previous_decision_type TEXT NOT NULL,
  new_decision_type     TEXT NOT NULL,
  override_reason       TEXT NOT NULL DEFAULT 'other',
  override_note         TEXT,
  overridden_by_user_id UUID,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_decision_overrides_case_id ON decision_overrides(case_id);

-- ── timeline_events ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS timeline_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id       UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL,
  module        TEXT,
  actor_type    TEXT NOT NULL DEFAULT 'system',
  actor_user_id UUID,
  title         TEXT NOT NULL,
  description   TEXT,
  payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_timeline_events_case_id ON timeline_events(case_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_created_at ON timeline_events(created_at DESC);

-- ── analyst_actions ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analyst_actions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id              UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  action_type          TEXT NOT NULL,
  note                 TEXT,
  performed_by_user_id UUID,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_analyst_actions_case_id ON analyst_actions(case_id);

-- ── audit_logs (v1 kept, v2 columns added) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
  id         BIGSERIAL PRIMARY KEY,
  case_id    UUID REFERENCES cases(id) ON DELETE CASCADE,
  event_type TEXT,
  payload    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS entity_id UUID REFERENCES entities(id) ON DELETE SET NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES documents(id) ON DELETE SET NULL;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_type TEXT DEFAULT 'system';
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS actor_user_id UUID;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS module TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS input_summary JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS output_summary JSONB;
ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_audit_logs_case_id ON audit_logs(case_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ── bank_escalation_contacts (v1 kept) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_escalation_contacts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name     TEXT NOT NULL,
  contact_name  TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  verified_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── agent_findings (v1 kept) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_findings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id    UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  summary    TEXT,
  confidence NUMERIC(5,2),
  risk_level TEXT,
  evidence   JSONB,
  flags      JSONB,
  round      INTEGER DEFAULT 1,
  reasoning  JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_findings_case_id ON agent_findings(case_id);

-- ── risk_signals (v1 kept) ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS risk_signals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id      UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  signal_code  TEXT NOT NULL,
  signal_name  TEXT NOT NULL,
  score_boost  INTEGER DEFAULT 0,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── recommended_actions (v1 kept) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recommended_actions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  priority    TEXT,
  action_text TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Views ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_case_signal_summary AS
SELECT
  c.id AS case_id,
  c.case_reference,
  COUNT(s.id) AS total_signals,
  COUNT(*) FILTER (WHERE s.direction = 'risk_increasing') AS risk_increasing_count,
  COUNT(*) FILTER (WHERE s.direction = 'risk_reducing') AS risk_reducing_count,
  COUNT(*) FILTER (WHERE s.direction = 'unresolved') AS unresolved_count,
  COALESCE(SUM(s.contribution_score) FILTER (WHERE s.direction = 'risk_increasing'), 0) AS risk_increase_total,
  COALESCE(SUM(s.contribution_score) FILTER (WHERE s.direction = 'risk_reducing'), 0) AS risk_reduce_total
FROM cases c
LEFT JOIN signals s ON s.case_id = c.id
GROUP BY c.id, c.case_reference;

CREATE OR REPLACE VIEW v_entity_case_counts AS
SELECT
  e.id AS entity_id,
  e.entity_type,
  e.canonical_name,
  COUNT(DISTINCT c.id) AS linked_case_count,
  MAX(c.created_at) AS last_case_at
FROM entities e
LEFT JOIN cases c
  ON c.company_entity_id = e.id
  OR c.beneficiary_entity_id = e.id
  OR c.bank_entity_id = e.id
  OR c.bank_account_entity_id = e.id
GROUP BY e.id, e.entity_type, e.canonical_name;
`;

export async function runMigrations(): Promise<void> {
  await db.query(DDL);
  console.log("✓ DB migrations complete (v2 schema)");
}
