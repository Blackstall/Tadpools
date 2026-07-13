"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import EntityCard from "../../components/entities/EntityCard";
import EntityProfile from "../../components/entities/EntityProfile";
import EmptyState from "../../components/ui/EmptyState";
import type { Entity } from "@tadpools/shared/index";

const API = "http://localhost:4000";

interface ListResult {
  entities: Entity[];
  total: number;
}

const ENTITY_TYPES = ["", "company", "beneficiary", "bank", "bank_account", "person"];
const TYPE_LABELS: Record<string, string> = {
  "":            "All Types",
  company:       "Company",
  beneficiary:   "Beneficiary",
  bank:          "Bank",
  bank_account:  "Bank Account",
  person:        "Person",
};

export default function EntitiesPage() {
  const [query,    setQuery]    = useState("");
  const [typeFilter, setType]   = useState("");
  const [entities, setEntities] = useState<Entity[]>([]);
  const [total,    setTotal]    = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = useCallback(async (q: string, type: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q)    params.set("q", q);
      if (type) params.set("type", type);
      const r = await fetch(`${API}/api/entities?${params}`);
      if (!r.ok) throw new Error("Search failed");
      const d = await r.json() as ListResult;
      setEntities(d.entities ?? []);
      setTotal(d.total ?? 0);
    } catch {
      setEntities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void search(query, typeFilter), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, typeFilter, search]);

  return (
    <div className="entities-page">

      {/* Left sidebar */}
      <div className="entities-sidebar">
        <div className="entities-search-bar">
          <input
            className="entities-search-input"
            placeholder="Search by name, registration…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <select
            className="entities-type-filter"
            value={typeFilter}
            onChange={e => setType(e.target.value)}
          >
            {ENTITY_TYPES.map(t => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>
          {total > 0 && (
            <span style={{ fontSize: 10, color: "var(--muted)" }}>{total} result{total !== 1 ? "s" : ""}</span>
          )}
        </div>

        <div className="entities-list">
          {loading && (
            <div className="page-loading" style={{ height: 80 }}>
              <span className="intel-spinner" />
            </div>
          )}
          {!loading && entities.length === 0 && (
            <EmptyState message={query ? "No entities found" : "Search to find entities"} />
          )}
          {entities.map(e => (
            <EntityCard
              key={e.id}
              entity={e}
              active={selected === e.id}
              onClick={() => setSelected(e.id)}
            />
          ))}
        </div>
      </div>

      {/* Right profile panel */}
      <div style={{ overflow: "auto" }}>
        {selected
          ? <EntityProfile entityId={selected} />
          : <div className="page-loading" style={{ flexDirection: "column", height: "100%", color: "var(--muted)" }}>
              <span style={{ fontSize: 32, opacity: 0.3 }}>🔍</span>
              <span>Select an entity to view its profile</span>
            </div>
        }
      </div>
    </div>
  );
}
