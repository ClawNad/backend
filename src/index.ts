import express from "express";
import cors from "cors";
import { config } from "./config";
import { errorHandler } from "./middleware/error";
import { createX402Middleware } from "./middleware/x402";

// Routes
import agentsRouter from "./routes/agents";
import tokensRouter from "./routes/tokens";
import reputationRouter from "./routes/reputation";
import revenueRouter from "./routes/revenue";
import activityRouter from "./routes/activity";
import statsRouter from "./routes/stats";
import nadfunRouter from "./routes/nadfun";
import chatRouter from "./routes/chat";

// Agents
import { SummaryAgent } from "./agents/summary";
import { CodeAuditAgent } from "./agents/code-audit";
import { OrchestratorAgent } from "./agents/orchestrator";

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  exposedHeaders: ["PAYMENT-REQUIRED", "X-PAYMENT-RESPONSE"],
}));
app.use(express.json({ limit: "10mb" }));

// ─── Health Check ────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", version: "1.0.0", timestamp: new Date().toISOString() });
});

// ─── REST API Routes ─────────────────────────────────────────────────────────
app.use("/api/v1/agents", agentsRouter);
app.use("/api/v1/tokens", tokensRouter);
app.use("/api/v1/reputation", reputationRouter);
app.use("/api/v1/revenue", revenueRouter);
app.use("/api/v1/activity", activityRouter);
app.use("/api/v1/stats", statsRouter);
app.use("/api/v1/nadfun", nadfunRouter);
app.use("/api/v1/chat", chatRouter);

// ─── x402 Payment Middleware ─────────────────────────────────────────────────
if (config.x402.enabled) {
  app.use(createX402Middleware());
  console.log(`  x402:         enabled (${config.x402.network})`);
}

// ─── AI Agent Endpoints ──────────────────────────────────────────────────────
const summaryAgent = new SummaryAgent();
const codeAuditAgent = new CodeAuditAgent();
const orchestratorAgent = new OrchestratorAgent();

app.use("/agents/summary", summaryAgent.router);
app.use("/agents/code-audit", codeAuditAgent.router);
app.use("/agents/orchestrator", orchestratorAgent.router);

// ─── Error Handler ───────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ────────────────────────────────────────────────────────────
app.listen(config.port, () => {
  console.log(`ClawNad Backend running on port ${config.port}`);
  console.log(`  REST API:     http://localhost:${config.port}/api/v1`);
  console.log(`  SummaryBot:   http://localhost:${config.port}/agents/summary`);
  console.log(`  CodeAuditor:  http://localhost:${config.port}/agents/code-audit`);
  console.log(`  Orchestrator: http://localhost:${config.port}/agents/orchestrator`);
  console.log(`  nad.fun API:  http://localhost:${config.port}/api/v1/nadfun`);
  console.log(`  Subgraph:     ${config.subgraphUrl}`);
});

export default app;
