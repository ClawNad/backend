import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { queryAgent, queryFeedback } from "../services/subgraph";
import { AppError } from "../middleware/error";

const router = Router();

const feedbackSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// GET /api/v1/reputation/:agentId
router.get("/:agentId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agentId = String(req.params.agentId);
    const agent = await queryAgent(agentId);
    if (!agent) {
      throw new AppError(404, "AGENT_NOT_FOUND", `Agent ${req.params.agentId} not found`);
    }

    const totalFeedback = agent.totalFeedback as number;
    const totalScore = BigInt(agent.totalScore as string);
    const avgScore = totalFeedback > 0 ? Number(totalScore) / totalFeedback : 0;

    res.json({
      data: {
        agentId: req.params.agentId,
        totalFeedback,
        avgScore: avgScore.toFixed(2),
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/reputation/:agentId/feedback
router.get("/:agentId/feedback", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = feedbackSchema.parse(req.query);
    const feedback = await queryFeedback(String(req.params.agentId), params.limit, params.offset);

    res.json({
      data: feedback,
      pagination: {
        total: feedback.length,
        limit: params.limit,
        offset: params.offset,
        hasMore: feedback.length === params.limit,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
