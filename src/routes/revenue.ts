import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { queryRevenueEvents } from "../services/subgraph";

const router = Router();

const revenueSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// GET /api/v1/revenue/:agentId
router.get("/:agentId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = revenueSchema.parse(req.query);
    const events = await queryRevenueEvents(String(req.params.agentId), params.limit, params.offset);

    res.json({
      data: events,
      pagination: {
        total: events.length,
        limit: params.limit,
        offset: params.offset,
        hasMore: events.length === params.limit,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
