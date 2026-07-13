const demoAgents = [
  { id: "reg", name: "Registration Age", x: 90, y: 120, note: "Registration year is 2025" },
  { id: "doc", name: "Document Authenticity", x: 280, y: 210, note: "Document structure valid" },
  { id: "bene", name: "Beneficiary Consistency", x: 460, y: 140, note: "Account mismatch suspicious" },
  { id: "chair", name: "Chair", x: 350, y: 340, note: "Consensus moving to caution" }
];

export function PoolCanvas() {
  return (
    <div className="panel pool">
      <h2 style={{ marginTop: 0 }}>The Pool</h2>
      <p className="muted">Tadpoles swim through evidence, share quick chat signals, and form consensus.</p>
      {demoAgents.map((agent) => (
        <div key={agent.id}>
          <div className="tadpole" style={{ left: agent.x, top: agent.y }} title={agent.name} />
          <div className="bubble" style={{ left: agent.x - 8, top: agent.y - 38 }}>{agent.note}</div>
        </div>
      ))}
    </div>
  );
}
