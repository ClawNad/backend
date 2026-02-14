import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { config } from "../config";

// Exported for manual x402 verification in routes (e.g. /api/v1/chat)
export const MONAD_NETWORK = config.x402.network;
export const MONAD_USDC = config.x402.usdcAddress;
export const PAY_TO = config.x402.payToAddress;

const facilitatorClient = new HTTPFacilitatorClient({
  url: config.x402.facilitatorUrl,
});

// Resource server — shared between static middleware and manual verification
const monadScheme = new ExactEvmScheme();

monadScheme.registerMoneyParser(async (amount: number, network: string) => {
  if (network === MONAD_NETWORK) {
    return {
      amount: Math.floor(amount * 1_000_000).toString(),
      asset: MONAD_USDC,
      extra: { name: "USDC", version: "2" },
    };
  }
  return null;
});

export const resourceServer = new x402ResourceServer(facilitatorClient);
resourceServer.register(MONAD_NETWORK, monadScheme);

// Initialize the server (fetches supported kinds from facilitator)
// This promise is awaited lazily before first manual verification
export const resourceServerReady = resourceServer.initialize().catch((err) => {
  console.error("x402 resourceServer.initialize() failed:", err);
});

export function createX402Middleware() {
  return paymentMiddleware(
    {
      "POST /agents/summary/summarize": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.01",
            network: MONAD_NETWORK,
            payTo: PAY_TO,
          },
        ],
        description: "AI text summarization by SummaryBot",
        mimeType: "application/json",
      },
      "POST /agents/code-audit/audit": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.01",
            network: MONAD_NETWORK,
            payTo: PAY_TO,
          },
        ],
        description: "Smart contract security audit by CodeAuditor",
        mimeType: "application/json",
      },
      "POST /agents/orchestrator/execute": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.01",
            network: MONAD_NETWORK,
            payTo: PAY_TO,
          },
        ],
        description: "Multi-agent task execution by Orchestrator",
        mimeType: "application/json",
      },
      "POST /agents/summary/chat": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.01",
            network: MONAD_NETWORK,
            payTo: PAY_TO,
          },
        ],
        description: "Chat with SummaryBot",
        mimeType: "text/event-stream",
      },
      "POST /agents/code-audit/chat": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.01",
            network: MONAD_NETWORK,
            payTo: PAY_TO,
          },
        ],
        description: "Chat with CodeAuditor",
        mimeType: "text/event-stream",
      },
      "POST /agents/orchestrator/chat": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.01",
            network: MONAD_NETWORK,
            payTo: PAY_TO,
          },
        ],
        description: "Chat with Orchestrator",
        mimeType: "text/event-stream",
      },
    },
    resourceServer,
  );
}
