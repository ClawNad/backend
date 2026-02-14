import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { config } from "../config";

export interface AgentInfo {
  agentId: number;
  name: string;
  description: string;
  model: string;
  skills: string[];
  endpoint: string;
}

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(50000),
});

const chatSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(50),
});

export abstract class BaseAgent {
  abstract info: AgentInfo;
  abstract chatSystemPrompt: string;
  router: Router;

  constructor() {
    this.router = Router();
    this.registerCommonRoutes();
    this.registerRoutes();
  }

  private registerCommonRoutes(): void {
    // GET /health — always free
    this.router.get("/health", (_req: Request, res: Response) => {
      res.json({ status: "ok", agent: this.info.name, timestamp: new Date().toISOString() });
    });

    // GET /info — always free
    this.router.get("/info", (_req: Request, res: Response) => {
      res.json({
        data: {
          ...this.info,
          type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
          x402: {
            enabled: config.x402.enabled,
            network: config.x402.network,
            facilitator: config.x402.facilitatorUrl,
            payTo: config.x402.payToAddress,
          },
        },
      });
    });

    // POST /chat — streaming SSE chat
    this.router.post("/chat", async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { messages } = chatSchema.parse(req.body);

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders();

        const fullMessages = [
          { role: "system" as const, content: this.chatSystemPrompt },
          ...messages,
        ];

        await this.callLLMStream(
          this.info.model,
          fullMessages,
          2048,
          (text) => {
            res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
          },
          () => {
            res.write("data: [DONE]\n\n");
            res.end();
          },
        );
      } catch (err) {
        if (res.headersSent) {
          res.write(`data: ${JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" })}\n\n`);
          res.end();
        } else {
          next(err);
        }
      }
    });
  }

  protected abstract registerRoutes(): void;

  // ─── OpenRouter LLM Call ─────────────────────────────────────────────────

  protected async callLLM(
    model: string,
    systemPrompt: string,
    userMessage: string,
    maxTokens = 2048
  ): Promise<string> {
    if (!config.openRouterApiKey) {
      return `[Demo mode] ${this.info.name} would process: "${userMessage.slice(0, 100)}..."`;
    }

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openRouterApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://clawnad.dev",
        "X-Title": "ClawNad",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: maxTokens,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenRouter API error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    return data.choices[0]?.message?.content ?? "";
  }

  // ─── Streaming LLM Call ──────────────────────────────────────────────────

  protected async callLLMStream(
    model: string,
    messages: Array<{ role: string; content: string }>,
    maxTokens: number,
    onChunk: (text: string) => void,
    onDone: () => void,
  ): Promise<void> {
    if (!config.openRouterApiKey) {
      onChunk(`[Demo mode] ${this.info.name} would respond to this conversation.`);
      onDone();
      return;
    }

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openRouterApiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://clawnad.dev",
        "X-Title": "ClawNad",
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        stream: true,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`OpenRouter API error ${res.status}: ${text}`);
    }

    const reader = (res.body as unknown as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") {
          onDone();
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onChunk(content);
        } catch {
          // skip malformed chunks
        }
      }
    }
    onDone();
  }
}
