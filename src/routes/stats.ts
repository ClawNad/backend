import { Router, Request, Response, NextFunction } from "express";
import { queryPlatformStats } from "../services/subgraph";

const router = Router();

// GET /api/v1/stats
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await queryPlatformStats();
    res.json({ data: stats });
  } catch (err) {
    next(err);
  }
});

export default router;
