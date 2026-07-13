import Badge from "../ui/Badge";
import type { Entity } from "@tadpools/shared/index";

interface EntityCardProps {
  entity: Entity;
  active: boolean;
  onClick: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  company:       "Company",
  beneficiary:   "Beneficiary",
  bank:          "Bank",
  bank_account:  "Account",
  person:        "Person",
  document:      "Document",
};

export default function EntityCard({ entity, active, onClick }: EntityCardProps) {
  return (
    <div
      className={`entity-card${active ? " entity-card--active" : ""}`}
      onClick={onClick}
    >
      <div className="entity-card-name">{entity.canonicalName}</div>
      <div className="entity-card-meta">
        <Badge
          label={TYPE_LABELS[entity.entityType] ?? entity.entityType}
          variant={entity.entityType === "company" ? "info" : "default"}
        />
        {entity.countryCode && (
          <span className="entity-card-sub">{entity.countryCode}</span>
        )}
        {entity.riskScore != null && (
          <span className="entity-card-sub" style={{ color: entity.riskScore >= 90 ? "var(--high)" : entity.riskScore >= 40 ? "var(--medium)" : "var(--low)" }}>
            {entity.riskScore} risk
          </span>
        )}
      </div>
    </div>
  );
}
