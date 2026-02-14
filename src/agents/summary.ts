import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { BaseAgent, AgentInfo } from "./base";

const summarizeSchema = z.object({
  text: z.string().min(1).max(50000),
  maxLength: z.number().int().min(50).max(2000).optional().default(500),
});

export class SummaryAgent extends BaseAgent {
  info: AgentInfo = {
    agentId: 127,
    name: "SummaryBot",
    description: "AI-powered text summarization agent. Provide any text and get a concise summary.",
    model: "openai/gpt-4o-mini",
    skills: ["text-summarization", "content-extraction"],
    endpoint: "/agents/summary",
  };

  chatSystemPrompt = `You are SummaryBot, an AI assistant on the ClawNad platform specialized in text summarization and content analysis.
You help users summarize texts, extract key points, and analyze content. Be concise and helpful.
When asked to summarize, focus on key points and maintain factual accuracy.`;

  protected registerRoutes(): void {
    this.router.post("/summarize", async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { text, maxLength } = summarizeSchema.parse(req.body);

        const summary = await this.callLLM(
          this.info.model,
          `You are SummaryBot, an AI text summarization agent on the ClawNad platform.
Summarize the provided text concisely in ${maxLength} characters or less.
Focus on key points and maintain factual accuracy.`,
          text,
          Math.ceil(maxLength / 3) // rough token estimate
        );

        res.json({
          data: {
            agentId: this.info.agentId,
            summary,
            inputLength: text.length,
            model: this.info.model,
          },
        });
      } catch (err) {
        next(err);
      }
    });
  }
}
