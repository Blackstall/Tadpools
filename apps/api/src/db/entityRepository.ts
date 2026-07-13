import { db } from "./pool.js";

export interface EntityRecord {
  id: string;
  entityType: string;
  canonicalName: string;
  normalizedName?: string;
  registrationNumber?: string;
  countryCode?: string;
  riskScore?: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

function rowToEntity(r: Record<string, unknown>): EntityRecord {
  return {
    id: r.id as string,
    entityType: r.entity_type as string,
    canonicalName: r.canonical_name as string,
    normalizedName: r.normalized_name as string | undefined,
    registrationNumber: r.registration_number as string | undefined,
    countryCode: r.country_code as string | undefined,
    riskScore: r.risk_score != null ? Number(r.risk_score) : undefined,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export async function findEntityByName(
  name: string,
  type: string
): Promise<EntityRecord | null> {
  const { rows } = await db.query(
    `SELECT * FROM entities WHERE LOWER(canonical_name) = LOWER($1) AND entity_type = $2 LIMIT 1`,
    [name, type]
  );
  return rows.length > 0 ? rowToEntity(rows[0]) : null;
}

export async function upsertEntity(payload: {
  entityType: string;
  canonicalName: string;
  registrationNumber?: string;
  countryCode?: string;
  metadata?: Record<string, unknown>;
}): Promise<EntityRecord> {
  const normalized = payload.canonicalName.toLowerCase().trim();
  const { rows } = await db.query(
    `INSERT INTO entities (entity_type, canonical_name, normalized_name, registration_number, country_code, metadata, first_seen_at, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [
      payload.entityType,
      payload.canonicalName,
      normalized,
      payload.registrationNumber ?? null,
      payload.countryCode ?? null,
      JSON.stringify(payload.metadata ?? {}),
    ]
  );

  if (rows.length > 0) return rowToEntity(rows[0]);

  // Already existed — update last_seen_at and return
  const { rows: existing } = await db.query(
    `UPDATE entities
     SET last_seen_at = NOW(), updated_at = NOW()
     WHERE LOWER(canonical_name) = $1 AND entity_type = $2
     RETURNING *`,
    [normalized, payload.entityType]
  );
  return rowToEntity(existing[0]);
}

export async function listEntities(filter: {
  q?: string;
  type?: string;
  page?: number;
  limit?: number;
}): Promise<{ entities: EntityRecord[]; total: number }> {
  const page = Math.max(1, filter.page ?? 1);
  const limit = Math.min(100, filter.limit ?? 20);
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.q) {
    params.push(`%${filter.q.toLowerCase()}%`);
    conditions.push(`normalized_name LIKE $${params.length}`);
  }
  if (filter.type) {
    params.push(filter.type);
    conditions.push(`entity_type = $${params.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countParams = [...params];
  const { rows: countRows } = await db.query(
    `SELECT COUNT(*) AS total FROM entities ${where}`,
    countParams
  );
  const total = Number(countRows[0].total);

  params.push(limit, offset);
  const { rows } = await db.query(
    `SELECT * FROM entities ${where} ORDER BY last_seen_at DESC NULLS LAST, created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return { entities: rows.map(rowToEntity), total };
}

export async function getEntityWithRelationships(id: string): Promise<{
  entity: EntityRecord | null;
  relationships: Array<{
    id: string;
    fromEntityId: string;
    toEntityId: string;
    relationshipType: string;
    confidence?: number;
    linkedEntity: EntityRecord;
  }>;
}> {
  const { rows: entityRows } = await db.query(
    `SELECT * FROM entities WHERE id = $1`,
    [id]
  );
  if (entityRows.length === 0) return { entity: null, relationships: [] };

  const { rows: relRows } = await db.query(
    `SELECT
       er.id, er.from_entity_id, er.to_entity_id, er.relationship_type, er.confidence,
       e.id AS linked_id, e.entity_type AS linked_type, e.canonical_name AS linked_name,
       e.normalized_name AS linked_normalized, e.registration_number AS linked_reg,
       e.country_code AS linked_country, e.risk_score AS linked_risk,
       e.metadata AS linked_metadata, e.created_at AS linked_created, e.updated_at AS linked_updated
     FROM entity_relationships er
     JOIN entities e ON (
       CASE WHEN er.from_entity_id = $1 THEN er.to_entity_id ELSE er.from_entity_id END = e.id
     )
     WHERE er.from_entity_id = $1 OR er.to_entity_id = $1`,
    [id]
  );

  const relationships = relRows.map((r) => ({
    id: r.id as string,
    fromEntityId: r.from_entity_id as string,
    toEntityId: r.to_entity_id as string,
    relationshipType: r.relationship_type as string,
    confidence: r.confidence != null ? Number(r.confidence) : undefined,
    linkedEntity: {
      id: r.linked_id as string,
      entityType: r.linked_type as string,
      canonicalName: r.linked_name as string,
      normalizedName: r.linked_normalized as string | undefined,
      registrationNumber: r.linked_reg as string | undefined,
      countryCode: r.linked_country as string | undefined,
      riskScore: r.linked_risk != null ? Number(r.linked_risk) : undefined,
      metadata: (r.linked_metadata as Record<string, unknown>) ?? {},
      createdAt: r.linked_created as string,
      updatedAt: r.linked_updated as string,
    },
  }));

  return { entity: rowToEntity(entityRows[0]), relationships };
}

export async function listCasesForEntity(entityId: string): Promise<
  Array<{
    id: string;
    caseReference?: string;
    status: string;
    companyName?: string;
    createdAt: string;
  }>
> {
  const { rows } = await db.query(
    `SELECT id, case_reference, status, company_name, created_at
     FROM cases
     WHERE company_entity_id = $1
        OR beneficiary_entity_id = $1
        OR bank_entity_id = $1
        OR bank_account_entity_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [entityId]
  );
  return rows.map((r) => ({
    id: r.id as string,
    caseReference: r.case_reference as string | undefined,
    status: r.status as string,
    companyName: r.company_name as string | undefined,
    createdAt: r.created_at as string,
  }));
}
