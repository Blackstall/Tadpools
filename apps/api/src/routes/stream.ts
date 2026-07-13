import { Router } from "express";
import { validate as isUUID } from "uuid";
import { swarmBus, type SwarmEvent } from "../services/eventBus.js";

const router = Router();

/**
 * GET /api/cases/:caseId/stream
 * Server-Sent Events — streams swarm activity for a case in real-time.
 * Clients connect immediately after POST /cases and receive live events.
 */
router.get("/cases/:caseId/stream", (req, res) => {
  const { caseId } = req.params;

  if (!isUUID(caseId)) {
    res.status(400).json({ message: "Invalid case ID format." });
    return;
  }

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (event: SwarmEvent): void => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  // Heartbeat to keep connection alive (every 5s)
  const heartbeat = setInterval(() => {
    res.write(`: heartbeat\n\n`);
  }, 5000);

  const handler = (event: SwarmEvent): void => {
    send(event);
    if (event.type === "done" || event.type === "error") {
      cleanup();
    }
  };

  const cleanup = (): void => {
    clearInterval(heartbeat);
    swarmBus.removeListener(`case:${caseId}`, handler);
    res.end();
  };

  swarmBus.on(`case:${caseId}`, handler);
  req.on("close", cleanup);
});

export default router;
