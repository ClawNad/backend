import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { queryActivity } from "../services/subgraph";

const router = Router();

const activitySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// GET /api/v1/activity
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params = activitySchema.parse(req.query);
    const activity = await queryActivity(params.limit);
    res.json({ data: activity });
  } catch (err) {
    next(err);
  }
});

export default router;
