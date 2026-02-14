import { createPublicClient, http, defineChain, parseAbi } from "viem";
import { config } from "../config";

const monad = defineChain({
  id: 143,
  name: "Monad",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: [config.monadRpcUrl] },
  },
  blockExplorers: {
    default: { name: "MonadScan", url: "https://monadscan.com" },
  },
});

export const publicClient = createPublicClient({
  chain: monad,
  transport: http(config.monadRpcUrl),
});

const lensAbi = parseAbi([
  "function getProgress(address token) view returns (uint256)",
  "function isGraduated(address token) view returns (bool)",
  "function getAmountOut(address token, uint256 amountIn, bool isBuy) view returns (uint256)",
]);

export async function getTokenProgress(tokenAddress: `0x${string}`): Promise<bigint> {
  return publicClient.readContract({
    address: config.contracts.lens,
    abi: lensAbi,
    functionName: "getProgress",
    args: [tokenAddress],
  });
}

export async function isTokenGraduated(tokenAddress: `0x${string}`): Promise<boolean> {
  return publicClient.readContract({
    address: config.contracts.lens,
    abi: lensAbi,
    functionName: "isGraduated",
    args: [tokenAddress],
  });
}

export async function getAmountOut(
  tokenAddress: `0x${string}`,
  amountIn: bigint,
  isBuy: boolean
): Promise<bigint> {
  return publicClient.readContract({
    address: config.contracts.lens,
    abi: lensAbi,
    functionName: "getAmountOut",
    args: [tokenAddress, amountIn, isBuy],
  });
}
