# ClawNad Backend

API server and AI agent runtime for ClawNad — the AI Agent Launchpad on Monad.

## What it does

- **REST API** — serves indexed on-chain data (agents, tokens, trades, reputation, revenue) to the frontend
- **Agent Runtime** — generic chat endpoint where each agent runs with its own persona/system prompt, powered by x402 micropayments. Creators define the agent's personality, skills, and behavior on-chain — the runtime loads the persona and streams LLM responses.
- **x402 Middleware** — payment verification for agent API endpoints using USDC on Monad. Every chat message requires a signed x402 payment.
- **nad.fun Integration** — token creation flow (image upload, metadata, salt, on-chain deploy) and buy/sell endpoints
- **On-Chain Service** — reads contract state via viem (Monad RPC)

## Tech Stack

- Node.js + TypeScript
- Express.js
- viem (Monad RPC client)
- @x402/express + @x402/core (payment middleware)
- The Graph (subgraph queries)
- OpenRouter (LLM provider)

## Setup

```bash
npm install
```

Create a `.env` file:

```env
PORT=3001
PRIVATE_KEY=<your-wallet-private-key>
OPENROUTER_API_KEY=<your-openrouter-key>
MONAD_RPC_URL=https://rpc.monad.xyz
SUBGRAPH_URL=https://api.studio.thegraph.com/query/113915/clawnad-indexer/v0.0.5
```

All contract addresses and x402 config have sensible defaults — see `src/config.ts` for the full list.

## Running

```bash
# Development (hot reload)
npm run dev

# Production
npm start
```

The server runs on port 3001 by default.

## API Routes

| Route | Description |
|---|---|
| `/api/agents` | List and search agents |
| `/api/tokens` | Token data and trade history |
| `/api/reputation` | Agent ratings and feedback |
| `/api/revenue` | Revenue tracking and distribution |
| `/api/activity` | Platform activity feed |
| `/api/stats` | Platform-wide statistics |
| `/api/nadfun` | nad.fun token creation and trading |
| `/api/v1/chat` | Agent chat with x402 payment gate |

## Agent Chat

`POST /api/v1/chat` — streaming SSE chat with any agent. Protected by x402 paywall.

```json
{
  "persona": "You are a smart contract auditor...",
  "messages": [{ "role": "user", "content": "Audit this contract..." }],
  "model": "openai/gpt-4o-mini",
  "price": "0.01"
}
```

The `persona` field is the agent's system prompt — defined by the creator when they register their agent on-chain. Each agent has its own personality, skills, and behavior. The runtime streams the LLM response as SSE events.

## Contract Addresses (Monad Mainnet)

- AgentFactory: `0xB0C3Db074C3eaaF1DC80445710857f6c39c0e822`
- RevenueRouter: `0xbF5b983F3F75c02d72B452A15885fb69c95b3f2F`
- AgentRating: `0xEb6850d45Cb177C930256a62ed31093189a0a9a7`
- Agent Token: `0x64F1416846cb28C805D7D82Dc49B81aB51567777`

## License

MIT
