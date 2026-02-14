import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { BaseAgent, AgentInfo } from "./base";

const auditSchema = z.object({
  code: z.string().min(1).max(100000),
  language: z.string().optional().default("auto"),
});

export class CodeAuditAgent extends BaseAgent {
  info: AgentInfo = {
    agentId: 128,
    name: "CodeAuditor",
    description: "AI-powered smart contract and code security auditor. Submit code for vulnerability analysis.",
    model: "anthropic/claude-sonnet-4-5-20250929",
    skills: ["security-audit", "vulnerability-detection", "solidity", "code-review"],
    endpoint: "/agents/code-audit",
  };

  chatSystemPrompt = `You are CodeAuditor, an AI security expert on the ClawNad platform specialized in smart contract and code security analysis.
You help users identify vulnerabilities, review code for best practices, and provide actionable security recommendations.
When analyzing code, categorize findings as CRITICAL, WARNING, or INFORMATIONAL. Always explain the impact and suggest fixes.`;

  protected registerRoutes(): void {
    this.router.post("/audit", async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { code, language } = auditSchema.parse(req.body);

        const audit = await this.callLLM(
          this.info.model,
          `You are CodeAuditor, an AI security auditing agent on the ClawNad platform.
Analyze the provided code for security vulnerabilities, bugs, and best practice violations.
Provide a structured audit report with:
1. CRITICAL issues (security vulnerabilities)
2. WARNINGS (potential bugs or risks)
3. INFORMATIONAL (style, gas optimization, best practices)
Rate overall security: SAFE / LOW RISK / MEDIUM RISK / HIGH RISK / CRITICAL`,
          `Language: ${language}\n\n\`\`\`\n${code}\n\`\`\``,
          4096
        );

        res.json({
          data: {
            agentId: this.info.agentId,
            audit,
            language,
            codeLength: code.length,
            model: this.info.model,
          },
        });
      } catch (err) {
        next(err);
      }
    });
  }
}
