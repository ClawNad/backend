import dotenv from "dotenv";
dotenv.config();

function env(key: string, fallback?: string): string {
  const val = process.env[key] ?? fallback;
  if (!val) throw new Error(`Missing env: ${key}`);
  return val;
}

export const config = {
  port: parseInt(env("PORT", "3001"), 10),
  nodeEnv: env("NODE_ENV", "development"),

  subgraphUrl: env(
    "SUBGRAPH_URL",
    "https://api.studio.thegraph.com/query/113915/clawnad-indexer/v0.0.5"
  ),

  monadRpcUrl: env("MONAD_RPC_URL", "https://rpc.monad.xyz"),
  chainId: 143,

  contracts: {
    agentFactory: env(
      "AGENT_FACTORY_ADDRESS",
      "0xB0C3Db074C3eaaF1DC80445710857f6c39c0e822"
    ) as `0x${string}`,
    revenueRouter: env(
      "REVENUE_ROUTER_ADDRESS",
      "0xbF5b983F3F75c02d72B452A15885fb69c95b3f2F"
    ) as `0x${string}`,
    agentRating: env(
      "AGENT_RATING_ADDRESS",
      "0xEb6850d45Cb177C930256a62ed31093189a0a9a7"
    ) as `0x${string}`,
    lens: env(
      "LENS_ADDRESS",
      "0x7e78A8DE94f21804F7a17F4E8BF9EC2c872187ea"
    ) as `0x${string}`,
    bondingCurveRouter: env(
      "BONDING_CURVE_ROUTER_ADDRESS",
      "0x6F6B8F1a20703309951a5127c45B49b1CD981A22"
    ) as `0x${string}`,
  },

  openRouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  nadFunApiUrl: env("NADFUN_API_URL", "https://api.nadapp.net"),

  x402: {
    payToAddress: env(
      "X402_PAY_TO_ADDRESS",
      "0xa8aE120c6CaA10e43878da47274Ed5544e66C1d5"
    ) as `0x${string}`,
    facilitatorUrl: env(
      "X402_FACILITATOR_URL",
      "https://x402-facilitator.molandak.org"
    ),
    network: "eip155:143" as const,
    usdcAddress: "0x534b2f3A21130d7a60830c2Df862319e593943A3",
    enabled: process.env.X402_ENABLED !== "false",
  },
} as const;
