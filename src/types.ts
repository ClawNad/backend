// ─── API Response Types ──────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface SingleResponse<T> {
  data: T;
}

export interface ApiError {
  error: string;
  code: string;
  details?: unknown;
}

// ─── Agent ───────────────────────────────────────────────────────────────────

export interface Agent {
  agentId: string;
  tokenAddress: string | null;
  creator: string;
  agentWallet: string;
  agentURI: string;
  endpoint: string;
  tokenName: string | null;
  tokenSymbol: string | null;
  active: boolean;
  launchedAt: string;
  totalRevenue: string;
  totalFeedback: number;
  totalScore: string;
  tokenGraduated: boolean;
}

// ─── Token Trade ─────────────────────────────────────────────────────────────

export interface TokenTrade {
  id: string;
  tokenAddress: string;
  trader: string;
  tradeType: string;
  monAmount: string;
  tokenAmount: string;
  blockNumber: string;
  txHash: string;
  blockTimestamp: string;
}

// ─── Token Snapshot ──────────────────────────────────────────────────────────

export interface TokenSnapshot {
  id: string;
  tokenAddress: string;
  realMonReserve: string;
  realTokenReserve: string;
  virtualMonReserve: string;
  virtualTokenReserve: string;
  blockNumber: string;
  blockTimestamp: string;
}

// ─── Reputation ──────────────────────────────────────────────────────────────

export interface ReputationFeedback {
  id: string;
  rater: string;
  score: string;
  tag1: string;
  tag2: string;
  feedbackHash: string;
  blockNumber: string;
  txHash: string;
  blockTimestamp: string;
}

// ─── Revenue ─────────────────────────────────────────────────────────────────

export interface RevenueEvent {
  id: string;
  eventType: string;
  paymentToken: string;
  amount: string;
  agentShare: string | null;
  buybackShare: string | null;
  platformFee: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  blockNumber: string;
  txHash: string;
  blockTimestamp: string;
}

// ─── Platform Stats ──────────────────────────────────────────────────────────

export interface PlatformStats {
  totalAgents: number;
  totalTrades: number;
  totalRevenue: string;
  totalFeedback: number;
}
