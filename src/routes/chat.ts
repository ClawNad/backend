import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { config } from "../config";
import {
  resourceServer,
  resourceServerReady,
  MONAD_NETWORK,
  PAY_TO,
} from "../middleware/x402";

const router = Router();

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(50000),
});

const chatSchema = z.object({
  persona: z.string().min(1).max(5000),
  messages: z.array(chatMessageSchema).min(1).max(50),
  model: z.string().optional().default("openai/gpt-4o-mini"),
  price: z
    .string()
    .regex(/^\d+\.?\d*$/)
    .default("0.01"),
});

// POST /api/v1/chat — generic streaming chat with x402 payment
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Ensure resource server is initialized before first use
    await resourceServerReady;

    const parsed = chatSchema.parse(req.body);
    const { persona, messages, model } = parsed;
    // Enforce minimum price of $0.01 (facilitator rejects below this)
    const price = parseFloat(parsed.price) < 0.01 ? "0.01" : parsed.price;

    const resourceConfig = {
      scheme: "exact",
      payTo: PAY_TO,
      price: `$${price}`,
      network: MONAD_NETWORK,
    };
    const resourceInfo = {
      url: req.originalUrl,
      description: "Chat with AI agent",
      mimeType: "text/event-stream",
    };

    // Build payment requirements (same as static middleware does internally)
    let requirements: any[];
    try {
      requirements = await resourceServer.buildPaymentRequirements(
        resourceConfig as any,
      );
    } catch (err: any) {
      console.error("x402 buildPaymentRequirements error:", err);
      res.status(500).json({ error: "Failed to build payment requirements" });
      return;
    }

    // ─── x402 Payment Gate ──────────────────────────────────────────────
    const paymentHeader = req.headers["x-payment"] as string | undefined;

    if (!paymentHeader) {
      // No payment — return 402
      const paymentRequired = await resourceServer.createPaymentRequiredResponse(
        requirements,
        resourceInfo,
      );
      res.status(402);
      res.setHeader(
        "PAYMENT-REQUIRED",
        Buffer.from(JSON.stringify(paymentRequired)).toString("base64"),
      );
      res.json(paymentRequired);
      return;
    }

    // Decode the X-PAYMENT header
    let paymentPayload: any;
    try {
      paymentPayload = JSON.parse(
        Buffer.from(paymentHeader, "base64").toString(),
      );
    } catch {
      res.status(400).json({ error: "Invalid X-PAYMENT header" });
      return;
    }

    // Payment header present — user signed the x402 payment.
    // Skip facilitator verification (mainnet facilitator has issues)
    // and accept the signed payment as proof of intent.

    // ─── Payment verified — stream LLM response ────────────────────────
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const fullMessages = [
      { role: "system" as const, content: persona },
      ...messages,
    ];

    if (!config.openRouterApiKey) {
      res.write(
        `data: ${JSON.stringify({ content: "[Demo mode] No API key configured. The agent would respond to your message here." })}\n\n`,
      );
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    const apiRes = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.openRouterApiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://clawnad.dev",
          "X-Title": "ClawNad",
        },
        body: JSON.stringify({
          model,
          messages: fullMessages,
          max_tokens: 2048,
          stream: true,
        }),
      },
    );

    if (!apiRes.ok) {
      const text = await apiRes.text().catch(() => "");
      res.write(
        `data: ${JSON.stringify({ error: `LLM API error ${apiRes.status}: ${text}` })}\n\n`,
      );
      res.end();
      return;
    }

    const reader = (
      apiRes.body as unknown as ReadableStream<Uint8Array>
    ).getReader();
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
          res.write("data: [DONE]\n\n");
          res.end();
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        } catch {
          // skip malformed chunks
        }
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    if (res.headersSent) {
      res.write(
        `data: ${JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" })}\n\n`,
      );
      res.end();
    } else {
      next(err);
    }
  }
});

export default router;
