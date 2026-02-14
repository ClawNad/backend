import { config } from "../config";

// ─── GraphQL Client ──────────────────────────────────────────────────────────

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(config.subgraphUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new Error(`Subgraph request failed: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };

  if (json.errors?.length) {
    throw new Error(`Subgraph error: ${json.errors[0].message}`);
  }

  return json.data!;
}

// ─── Agent Queries ───────────────────────────────────────────────────────────

interface AgentsQueryParams {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: string;
  active?: boolean;
  creator?: string;
  search?: string;
}

export async function queryAgents(params: AgentsQueryParams = {}) {
  const {
    limit = 20,
    offset = 0,
    orderBy = "launchedAt",
    orderDirection = "desc",
    active,
    creator,
    search,
  } = params;

  const whereClause = buildWhereClause({ active, creator, search });

  const data = await gql<{
    agents: Array<Record<string, unknown>>;
  }>(`
    query GetAgents($first: Int!, $skip: Int!, $orderBy: Agent_orderBy!, $orderDirection: OrderDirection!) {
      agents(
        first: $first
        skip: $skip
        orderBy: $orderBy
        orderDirection: $orderDirection
        ${whereClause}
      ) {
        id
        agentId
        tokenAddress
        creator
        agentWallet
        agentURI
        endpoint
        tokenName
        tokenSymbol
        active
        launchedAt
        blockNumber
        txHash
        totalRevenue
        totalFeedback
        totalScore
        tokenGraduated
      }
    }
  `, {
    first: Math.min(limit, 100),
    skip: offset,
    orderBy,
    orderDirection,
  });

  return data.agents;
}

function buildWhereClause(filters: { active?: boolean; creator?: string; search?: string }): string {
  const conditions: string[] = [];
  if (filters.active !== undefined) conditions.push(`active: ${filters.active}`);
  if (filters.creator) conditions.push(`creator: "${filters.creator.toLowerCase()}"`);
  if (filters.search) {
    // The Graph supports _contains_nocase for case-insensitive substring match
    // Use an OR filter to search across tokenName and tokenSymbol
    const escaped = filters.search.replace(/"/g, '\\"');
    conditions.push(`or: [{ tokenName_contains_nocase: "${escaped}" }, { tokenSymbol_contains_nocase: "${escaped}" }]`);
  }
  return conditions.length > 0 ? `where: { ${conditions.join(", ")} }` : "";
}

export async function queryAgent(agentId: string) {
  const data = await gql<{
    agent: Record<string, unknown> | null;
  }>(`
    query GetAgent($id: ID!) {
      agent(id: $id) {
        id
        agentId
        tokenAddress
        creator
        agentWallet
        agentURI
        endpoint
        tokenName
        tokenSymbol
        active
        launchedAt
        blockNumber
        txHash
        totalRevenue
        totalFeedback
        totalScore
        tokenGraduated
        trades(first: 10, orderBy: blockTimestamp, orderDirection: desc) {
          id
          tradeType
          monAmount
          tokenAmount
          trader
          txHash
          blockTimestamp
        }
        feedback(first: 10, orderBy: blockTimestamp, orderDirection: desc) {
          id
          rater
          score
          tag1
          tag2
          txHash
          blockTimestamp
        }
        revenueEvents(first: 10, orderBy: blockTimestamp, orderDirection: desc) {
          id
          eventType
          amount
          paymentToken
          txHash
          blockTimestamp
        }
      }
    }
  `, { id: agentId });

  return data.agent;
}

// ─── Token Queries ───────────────────────────────────────────────────────────

export async function queryTokenTrades(
  tokenAddress: string,
  limit = 20,
  offset = 0,
  tradeType?: string
) {
  const whereConditions = [`tokenAddress: "${tokenAddress.toLowerCase()}"`];
  if (tradeType) whereConditions.push(`tradeType: "${tradeType}"`);

  const data = await gql<{
    tokenTrades: Array<Record<string, unknown>>;
  }>(`
    query GetTrades($first: Int!, $skip: Int!) {
      tokenTrades(
        first: $first
        skip: $skip
        orderBy: blockTimestamp
        orderDirection: desc
        where: { ${whereConditions.join(", ")} }
      ) {
        id
        tokenAddress
        trader
        tradeType
        monAmount
        tokenAmount
        blockNumber
        txHash
        blockTimestamp
      }
    }
  `, { first: Math.min(limit, 100), skip: offset });

  return data.tokenTrades;
}

export async function queryLatestSnapshot(tokenAddress: string) {
  const data = await gql<{
    tokenSnapshots: Array<Record<string, unknown>>;
  }>(`
    query GetSnapshot {
      tokenSnapshots(
        first: 1
        orderBy: blockTimestamp
        orderDirection: desc
        where: { tokenAddress: "${tokenAddress.toLowerCase()}" }
      ) {
        id
        tokenAddress
        realMonReserve
        realTokenReserve
        virtualMonReserve
        virtualTokenReserve
        blockNumber
        blockTimestamp
      }
    }
  `);

  return data.tokenSnapshots[0] ?? null;
}

// ─── Reputation Queries ──────────────────────────────────────────────────────

export async function queryFeedback(agentId: string, limit = 20, offset = 0) {
  const data = await gql<{
    reputationFeedbacks: Array<Record<string, unknown>>;
  }>(`
    query GetFeedback($first: Int!, $skip: Int!) {
      reputationFeedbacks(
        first: $first
        skip: $skip
        orderBy: blockTimestamp
        orderDirection: desc
        where: { agent: "${agentId}" }
      ) {
        id
        rater
        score
        tag1
        tag2
        feedbackHash
        blockNumber
        txHash
        blockTimestamp
      }
    }
  `, { first: Math.min(limit, 100), skip: offset });

  return data.reputationFeedbacks;
}

// ─── Revenue Queries ─────────────────────────────────────────────────────────

export async function queryRevenueEvents(agentId: string, limit = 20, offset = 0) {
  const data = await gql<{
    revenueEvents: Array<Record<string, unknown>>;
  }>(`
    query GetRevenue($first: Int!, $skip: Int!) {
      revenueEvents(
        first: $first
        skip: $skip
        orderBy: blockTimestamp
        orderDirection: desc
        where: { agent: "${agentId}" }
      ) {
        id
        eventType
        paymentToken
        amount
        agentShare
        buybackShare
        platformFee
        fromAddress
        toAddress
        blockNumber
        txHash
        blockTimestamp
      }
    }
  `, { first: Math.min(limit, 100), skip: offset });

  return data.revenueEvents;
}

// ─── Activity Feed ───────────────────────────────────────────────────────────

export async function queryActivity(limit = 20) {
  // Fetch recent agents, trades, and feedback in parallel
  const [agents, trades, feedback] = await Promise.all([
    gql<{ agents: Array<Record<string, unknown>> }>(`
      query { agents(first: ${limit}, orderBy: launchedAt, orderDirection: desc) {
        agentId endpoint tokenName tokenSymbol creator launchedAt txHash
      }}
    `),
    gql<{ tokenTrades: Array<Record<string, unknown>> }>(`
      query { tokenTrades(first: ${limit}, orderBy: blockTimestamp, orderDirection: desc, where: { agent_not: null }) {
        tradeType monAmount tokenAmount trader blockTimestamp txHash
        agent { agentId tokenSymbol }
      }}
    `),
    gql<{ reputationFeedbacks: Array<Record<string, unknown>> }>(`
      query { reputationFeedbacks(first: ${limit}, orderBy: blockTimestamp, orderDirection: desc) {
        score tag1 rater blockTimestamp txHash
        agent { agentId }
      }}
    `).catch(() => ({ reputationFeedbacks: [] })),
  ]);

  // Merge and sort by timestamp
  type ActivityItem = { type: string; timestamp: string; [key: string]: unknown };
  const items: ActivityItem[] = [];

  for (const a of agents.agents) {
    items.push({ type: "launch", timestamp: a.launchedAt as string, ...a });
  }
  for (const t of trades.tokenTrades) {
    items.push({ type: "trade", timestamp: t.blockTimestamp as string, ...t });
  }
  for (const f of feedback.reputationFeedbacks) {
    items.push({ type: "feedback", timestamp: f.blockTimestamp as string, ...f });
  }

  items.sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
  return items.slice(0, limit);
}

// ─── Platform Stats ──────────────────────────────────────────────────────────

export async function queryPlatformStats() {
  const data = await gql<{
    platformStats: { totalAgents: number; totalTrades: number; totalRevenue: string; totalFeedback: number } | null;
  }>(`
    query {
      platformStats(id: "platform") {
        totalAgents
        totalTrades
        totalRevenue
        totalFeedback
      }
    }
  `);

  return data.platformStats ?? { totalAgents: 0, totalTrades: 0, totalRevenue: "0", totalFeedback: 0 };
}
