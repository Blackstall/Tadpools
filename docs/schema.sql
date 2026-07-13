-- Tadpools v2 Local-First PostgreSQL Schema
-- Purpose: enterprise-style fraud/risk intelligence prototype running locally
-- Notes:
-- 1) Uses PostgreSQL-compatible SQL
-- 2) Avoids cloud-specific assumptions
-- 3) Supports entity reuse, explainable signals, decision traceability, and audit logs

BEGIN;

-- -----------------------------
-- Extensions
-- -----------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

-- -----------------------------
-- Utility trigger for updated_at
-- -----------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -----------------------------
-- Enum types
-- -----------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'case_status_enum') THEN
    CREATE TYPE case_status_enum AS ENUM (
      'draft',
      'submitted',
      'processing',
      'needs_review',
      'escalated',
      'approved',
      'rejected',
      'closed'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'decision_type_enum') THEN
    CREATE TYPE decision_type_enum AS ENUM (
      'approve',
      'reject',
      'escalate',
      'hold',
      'request_documents',
      'monitor'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'entity_type_enum') THEN
    CREATE TYPE entity_type_enum AS ENUM (
      'company',
      'beneficiary',
      'bank_account',
      'bank',
      'person',
      'document',
      'case'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'document_status_enum') THEN
    CREATE TYPE document_status_enum AS ENUM (
      'uploaded',
      'parsed',
      'verified',
      'failed',
      'archived'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'module_type_enum') THEN
    CREATE TYPE module_type_enum AS ENUM (
      'intake',
      'extraction',
      'authenticity',
      'entity_verification',
      'relationship_matching',
      'historical_intelligence',
      'challenge_phase',
      'decision'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severity_enum') THEN
    CREATE TYPE severity_enum AS ENUM ('info', 'low', 'medium', 'high', 'critical');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'signal_direction_enum') THEN
    CREATE TYPE signal_direction_enum AS ENUM ('risk_increasing', 'risk_reducing', 'unresolved');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'actor_type_enum') THEN
    CREATE TYPE actor_type_enum AS ENUM ('system', 'agent', 'analyst', 'admin');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'timeline_event_type_enum') THEN
    CREATE TYPE timeline_event_type_enum AS ENUM (
      'case_created',
      'document_uploaded',
      'extraction_completed',
      'signal_generated',
      'decision_computed',
      'analyst_action',
      'case_status_changed',
      'entity_linked',
      'note_added'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'relationship_type_enum') THEN
    CREATE TYPE relationship_type_enum AS ENUM (
      'owns',
      'controls',
      'linked_to',
      'beneficiary_of',
      'uses_bank_account',
      'submitted_document',
      'appears_in_case',
      'matches',
      'possible_match'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rule_type_enum') THEN
    CREATE TYPE rule_type_enum AS ENUM ('hard_block', 'warning', 'informational', 'scoring');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'override_reason_enum') THEN
    CREATE TYPE override_reason_enum AS ENUM (
      'manual_clearance',
      'false_positive',
      'additional_evidence',
      'policy_exception',
      'other'
    );
  END IF;
END
$$;

-- -----------------------------
-- Core: users / analysts (local app operators)
-- -----------------------------
CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email CITEXT UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'analyst',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_app_users_updated_at
BEFORE UPDATE ON app_users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------
-- Policy / model versioning
-- -----------------------------
CREATE TABLE IF NOT EXISTS policy_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_label TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS model_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name TEXT NOT NULL,
  version_label TEXT NOT NULL,
  module module_type_enum NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (model_name, version_label, module)
);

-- -----------------------------
-- Entities: shared intelligence objects
-- -----------------------------
CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type entity_type_enum NOT NULL,
  canonical_name TEXT NOT NULL,
  normalized_name TEXT,
  external_reference TEXT,
  registration_number TEXT,
  country_code CHAR(2),
  risk_score NUMERIC(6,2),
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entities_type_name ON entities(entity_type, canonical_name);
CREATE INDEX IF NOT EXISTS idx_entities_normalized_name ON entities(normalized_name);
CREATE INDEX IF NOT EXISTS idx_entities_registration_number ON entities(registration_number);
CREATE INDEX IF NOT EXISTS idx_entities_metadata_gin ON entities USING GIN(metadata);

CREATE TRIGGER trg_entities_updated_at
BEFORE UPDATE ON entities
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS entity_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  alias_name TEXT NOT NULL,
  normalized_alias_name TEXT,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_aliases_entity_id ON entity_aliases(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_aliases_normalized_alias_name ON entity_aliases(normalized_alias_name);

CREATE TABLE IF NOT EXISTS entity_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  to_entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  relationship_type relationship_type_enum NOT NULL,
  confidence NUMERIC(5,2),
  source TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (from_entity_id <> to_entity_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_relationships_from ON entity_relationships(from_entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_relationships_to ON entity_relationships(to_entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_relationships_type ON entity_relationships(relationship_type);

-- -----------------------------
-- Cases
-- -----------------------------
CREATE TABLE IF NOT EXISTS cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_reference TEXT NOT NULL UNIQUE,
  status case_status_enum NOT NULL DEFAULT 'draft',
  priority SMALLINT NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  source_channel TEXT,
  submitted_by_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  assigned_to_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  company_entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
  beneficiary_entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
  bank_entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
  bank_account_entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
  intake_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_module module_type_enum NOT NULL DEFAULT 'intake',
  policy_version_id UUID REFERENCES policy_versions(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_priority ON cases(priority);
CREATE INDEX IF NOT EXISTS idx_cases_company_entity_id ON cases(company_entity_id);
CREATE INDEX IF NOT EXISTS idx_cases_beneficiary_entity_id ON cases(beneficiary_entity_id);
CREATE INDEX IF NOT EXISTS idx_cases_current_module ON cases(current_module);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cases_intake_payload_gin ON cases USING GIN(intake_payload);

CREATE TRIGGER trg_cases_updated_at
BEFORE UPDATE ON cases
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- -----------------------------
-- Documents + extracted data
-- -----------------------------
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  file_size_bytes BIGINT,
  storage_path TEXT,
  sha256_hash TEXT NOT NULL,
  hash_algorithm TEXT NOT NULL DEFAULT 'sha256',
  document_type TEXT,
  status document_status_enum NOT NULL DEFAULT 'uploaded',
  uploaded_by_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  parsed_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sha256_hash, case_id)
);

CREATE INDEX IF NOT EXISTS idx_documents_case_id ON documents(case_id);
CREATE INDEX IF NOT EXISTS idx_documents_entity_id ON documents(entity_id);
CREATE INDEX IF NOT EXISTS idx_documents_sha256_hash ON documents(sha256_hash);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_metadata_gin ON documents USING GIN(metadata);

CREATE TRIGGER trg_documents_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS extracted_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_value TEXT,
  normalized_value TEXT,
  confidence NUMERIC(5,2),
  source_location JSONB,
  extraction_model_version_id UUID REFERENCES model_versions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_extracted_fields_document_id ON extracted_fields(document_id);
CREATE INDEX IF NOT EXISTS idx_extracted_fields_field_name ON extracted_fields(field_name);

-- -----------------------------
-- Rules and signals
-- -----------------------------
CREATE TABLE IF NOT EXISTS policy_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_version_id UUID REFERENCES policy_versions(id) ON DELETE CASCADE,
  rule_code TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  rule_type rule_type_enum NOT NULL,
  module module_type_enum NOT NULL,
  severity severity_enum NOT NULL DEFAULT 'medium',
  description TEXT,
  scoring_weight NUMERIC(8,2),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (policy_version_id, rule_code)
);

CREATE INDEX IF NOT EXISTS idx_policy_rules_policy_version_id ON policy_rules(policy_version_id);
CREATE INDEX IF NOT EXISTS idx_policy_rules_module ON policy_rules(module);
CREATE INDEX IF NOT EXISTS idx_policy_rules_active ON policy_rules(is_active);

CREATE TABLE IF NOT EXISTS signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
  policy_rule_id UUID REFERENCES policy_rules(id) ON DELETE SET NULL,
  module module_type_enum NOT NULL,
  signal_code TEXT,
  signal_name TEXT NOT NULL,
  description TEXT,
  severity severity_enum NOT NULL DEFAULT 'medium',
  direction signal_direction_enum NOT NULL,
  confidence NUMERIC(5,2),
  contribution_score NUMERIC(8,2) NOT NULL DEFAULT 0,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  model_version_id UUID REFERENCES model_versions(id) ON DELETE SET NULL,
  generated_by actor_type_enum NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signals_case_id ON signals(case_id);
CREATE INDEX IF NOT EXISTS idx_signals_document_id ON signals(document_id);
CREATE INDEX IF NOT EXISTS idx_signals_entity_id ON signals(entity_id);
CREATE INDEX IF NOT EXISTS idx_signals_module ON signals(module);
CREATE INDEX IF NOT EXISTS idx_signals_severity ON signals(severity);
CREATE INDEX IF NOT EXISTS idx_signals_direction ON signals(direction);
CREATE INDEX IF NOT EXISTS idx_signals_evidence_gin ON signals USING GIN(evidence);

-- -----------------------------
-- Decisions
-- -----------------------------
CREATE TABLE IF NOT EXISTS decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL UNIQUE REFERENCES cases(id) ON DELETE CASCADE,
  decision_type decision_type_enum NOT NULL,
  final_score NUMERIC(8,2),
  confidence NUMERIC(5,2),
  decision_narrative TEXT,
  recommendation TEXT,
  triggered_rule_ids UUID[] NOT NULL DEFAULT '{}',
  risk_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  computed_by actor_type_enum NOT NULL DEFAULT 'system',
  model_version_id UUID REFERENCES model_versions(id) ON DELETE SET NULL,
  policy_version_id UUID REFERENCES policy_versions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decisions_case_id ON decisions(case_id);
CREATE INDEX IF NOT EXISTS idx_decisions_type ON decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_decisions_triggered_rule_ids_gin ON decisions USING GIN(triggered_rule_ids);
CREATE INDEX IF NOT EXISTS idx_decisions_risk_summary_gin ON decisions USING GIN(risk_summary);

CREATE TRIGGER trg_decisions_updated_at
BEFORE UPDATE ON decisions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS decision_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  decision_id UUID NOT NULL REFERENCES decisions(id) ON DELETE CASCADE,
  previous_decision_type decision_type_enum NOT NULL,
  new_decision_type decision_type_enum NOT NULL,
  override_reason override_reason_enum NOT NULL,
  override_note TEXT,
  overridden_by_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decision_overrides_case_id ON decision_overrides(case_id);
CREATE INDEX IF NOT EXISTS idx_decision_overrides_decision_id ON decision_overrides(decision_id);

-- -----------------------------
-- Timeline and analyst actions
-- -----------------------------
CREATE TABLE IF NOT EXISTS timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  event_type timeline_event_type_enum NOT NULL,
  module module_type_enum,
  actor_type actor_type_enum NOT NULL DEFAULT 'system',
  actor_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_timeline_events_case_id ON timeline_events(case_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_created_at ON timeline_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_events_payload_gin ON timeline_events USING GIN(payload);

CREATE TABLE IF NOT EXISTS analyst_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  action_type decision_type_enum NOT NULL,
  note TEXT,
  performed_by_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analyst_actions_case_id ON analyst_actions(case_id);
CREATE INDEX IF NOT EXISTS idx_analyst_actions_user_id ON analyst_actions(performed_by_user_id);

-- -----------------------------
-- Audit logs
-- -----------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,
  entity_id UUID REFERENCES entities(id) ON DELETE SET NULL,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  actor_type actor_type_enum NOT NULL,
  actor_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  module module_type_enum,
  action TEXT NOT NULL,
  input_summary JSONB,
  output_summary JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_case_id ON audit_logs(case_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_document_id ON audit_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_metadata_gin ON audit_logs USING GIN(metadata);

-- -----------------------------
-- Helpful views for dashboarding
-- -----------------------------
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

COMMIT;
