import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { queryTokenTrades, queryLatestSnapshot } from "../services/subgraph";
import { getTokenProgress, isTokenGraduated } from "../services/chain";
import { formatEther } from "viem";
import { config } from "../config";

const router = Router();

const tradesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  tradeType: z.enum(["buy", "sell"]).optional(),
});

// GET /api/v1/tokens/:tokenAddress/trades
router.get("/:tokenAddress/trades", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = tradesSchema.parse(req.query);
    const trades = await queryTokenTrades(
      String(req.params.tokenAddress),
      params.limit,
      params.offset,
      params.tradeType
    );

    res.json({
      data: trades,
      pagination: {
        total: trades.length,
        limit: params.limit,
        offset: params.offset,
        hasMore: trades.length === params.limit,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/tokens/:tokenAddress/price
router.get("/:tokenAddress/price", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const addr = String(req.params.tokenAddress) as `0x${string}`;
    const [snapshot, progress, graduated] = await Promise.all([
      queryLatestSnapshot(addr),
      getTokenProgress(addr).catch(() => 0n),
      isTokenGraduated(addr).catch(() => false),
    ]);

    if (!snapshot) {
      res.json({
        data: {
          tokenAddress: addr,
          priceInMon: "0",
          marketCap: "0",
          progress: 0,
          graduated: false,
          reserves: null,
        },
      });
      return;
    }

    const vMon = BigInt(snapshot.virtualMonReserve as string);
    const rMon = BigInt(snapshot.realMonReserve as string);
    const vToken = BigInt(snapshot.virtualTokenReserve as string);
    const rToken = BigInt(snapshot.realTokenReserve as string);
    const totalMon = vMon + rMon;
    const totalToken = vToken + rToken;

    const priceInMon = totalToken > 0n
      ? Number(formatEther(totalMon)) / Number(formatEther(totalToken))
      : 0;

    const totalSupply = 1_000_000_000;
    const marketCap = priceInMon * totalSupply;

    res.json({
      data: {
        tokenAddress: addr,
        priceInMon: priceInMon.toFixed(18),
        marketCap: marketCap.toFixed(2),
        progress: Number(progress) / 100, // basis points → percentage
        graduated,
        reserves: {
          realMon: formatEther(rMon),
          realToken: formatEther(rToken),
          virtualMon: formatEther(vMon),
          virtualToken: formatEther(vToken),
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// In-memory cache for token metadata (ttl: 5 minutes)
const metadataCache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

// GET /api/v1/tokens/:tokenAddress/metadata
router.get("/:tokenAddress/metadata", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const addr = String(req.params.tokenAddress).toLowerCase();
    const cached = metadataCache.get(addr);
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      res.json({ data: cached.data });
      return;
    }

    const response = await fetch(`${config.nadFunApiUrl}/token/${addr}`);
    if (!response.ok) {
      res.json({ data: null });
      return;
    }

    const json = await response.json() as { token_info?: { image_uri?: string; description?: string; website?: string; twitter?: string; is_graduated?: boolean } };
    const info = json.token_info;
    const result = {
      imageUri: info?.image_uri ?? null,
      description: info?.description ?? null,
      website: info?.website ?? null,
      twitter: info?.twitter ?? null,
      isGraduated: info?.is_graduated ?? false,
    };

    metadataCache.set(addr, { data: result, ts: Date.now() });
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
