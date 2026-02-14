import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { queryAgents, queryAgent } from "../services/subgraph";
import { AppError } from "../middleware/error";

const router = Router();

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(["launchedAt", "totalRevenue", "totalFeedback", "agentId"]).default("launchedAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  active: z.coerce.boolean().optional(),
  creator: z.string().optional(),
  search: z.string().max(100).optional(),
});

// GET /api/v1/agents
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = listSchema.parse(req.query);

    const agents = await queryAgents({
      limit: params.limit,
      offset: params.offset,
      orderBy: params.sort,
      orderDirection: params.order,
      active: params.active,
      creator: params.creator,
      search: params.search,
    });

    res.json({
      data: agents,
      pagination: {
        total: agents.length, // subgraph doesn't return total count
        limit: params.limit,
        offset: params.offset,
        hasMore: agents.length === params.limit,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/agents/:agentId
router.get("/:agentId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agentId = String(req.params.agentId);
    const agent = await queryAgent(agentId);
    if (!agent) {
      throw new AppError(404, "AGENT_NOT_FOUND", `Agent ${agentId} not found`);
    }
    res.json({ data: agent });
  } catch (err) {
    next(err);
  }
});

export default router;
