import express from "express";
import cors from "cors";
import caseRoutes from "./routes/cases.js";
import uploadRoutes from "./routes/upload.js";
import extractionRoutes from "./routes/extraction.js";
import auditRoutes from "./routes/auditRoutes.js";
import cleanupRoutes from "./routes/cleanup.js";
import streamRoutes from "./routes/stream.js";
import { entityRoutes } from "./routes/entities.js";
import { signalRoutes } from "./routes/signals.js";
import { policyRoutes } from "./routes/policy.js";
import { timelineRoutes } from "./routes/timeline.js";
import { actionRoutes } from "./routes/actions.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { auditV2Routes } from "./routes/audit.js";
import { runMigrations } from "./db/migrate.js";
import { ensureBucket } from "./storage/minioClient.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "tadpools-api" });
});

app.use("/api", caseRoutes);
app.use("/api", uploadRoutes);
app.use("/api", extractionRoutes);
app.use("/api", auditRoutes);
app.use("/api", cleanupRoutes);
app.use("/api", streamRoutes);
app.use("/api", entityRoutes);
app.use("/api", signalRoutes);
app.use("/api", policyRoutes);
app.use("/api", timelineRoutes);
app.use("/api", actionRoutes);
app.use("/api", dashboardRoutes);
app.use("/api", auditV2Routes);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : "Unexpected error";
  res.status(400).json({ message });
});

const port = Number(process.env.PORT || 4000);

Promise.all([runMigrations(), ensureBucket()])
  .then(() => {
    app.listen(port, () => {
      console.log(`Tadpools API listening on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("[startup] failed:", err.message);
    process.exit(1);
  });
