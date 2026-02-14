import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { BaseAgent, AgentInfo } from "./base";
import { config } from "../config";

const executeSchema = z.object({
  task: z.string().min(1).max(5000),
});

export class OrchestratorAgent extends BaseAgent {
  info: AgentInfo = {
    agentId: 129,
    name: "Orchestrator",
    description: "Meta-agent that decomposes tasks, discovers other agents, and coordinates multi-step AI workflows.",
    model: "openai/gpt-4o-mini",
    skills: ["task-planning", "agent-coordination", "multi-step-execution"],
    endpoint: "/agents/orchestrator",
  };

  chatSystemPrompt = `You are the Orchestrator, a meta-agent on the ClawNad platform that helps with task planning, coordination, and multi-step AI workflows.
You can help users break down complex tasks, suggest which agents to use (SummaryBot for text summarization, CodeAuditor for security analysis), and coordinate workflows.
Be strategic and methodical in your responses.`;

  protected registerRoutes(): void {
    this.router.post("/execute", async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { task } = executeSchema.parse(req.body);

        // Step 1: Plan — decompose task into sub-tasks
        const plan = await this.callLLM(
          this.info.model,
          `You are the Orchestrator, a meta-agent on ClawNad that coordinates other AI agents.

Available agents:
- SummaryBot (agentId: 127): text-summarization, content-extraction
- CodeAuditor (agentId: 128): security-audit, vulnerability-detection, solidity, code-review

Analyze the user's task and create a plan. For each step, indicate which agent to use.
Respond in JSON format:
{
  "steps": [
    {"step": 1, "agent": "SummaryBot|CodeAuditor|self", "action": "description", "input": "what to send"}
  ],
  "reasoning": "why this plan"
}`,
          task,
          1024
        );

        // Step 2: Execute sub-tasks by calling other agents
        const steps: Array<{ step: number; agent: string; action: string; result: string }> = [];

        let parsedPlan: { steps: Array<{ step: number; agent: string; action: string; input: string }>; reasoning: string };
        try {
          // Extract JSON from the response
          const jsonMatch = plan.match(/\{[\s\S]*\}/);
          parsedPlan = jsonMatch ? JSON.parse(jsonMatch[0]) : { steps: [], reasoning: plan };
        } catch {
          parsedPlan = { steps: [], reasoning: plan };
        }

        for (const planStep of parsedPlan.steps) {
          let result: string;

          if (planStep.agent === "SummaryBot") {
            result = await this.callAgentLocally("summary", "/summarize", { text: planStep.input });
          } else if (planStep.agent === "CodeAuditor") {
            result = await this.callAgentLocally("code-audit", "/audit", { code: planStep.input });
          } else {
            // Self-execution: use own LLM
            result = await this.callLLM(
              this.info.model,
              "You are the Orchestrator. Execute this sub-task directly.",
              planStep.input || planStep.action,
              1024
            );
          }

          steps.push({
            step: planStep.step,
            agent: planStep.agent,
            action: planStep.action,
            result,
          });
        }

        // Step 3: Synthesize final answer
        const synthesis = await this.callLLM(
          this.info.model,
          "You are the Orchestrator. Synthesize the results from multiple agent sub-tasks into a cohesive final answer.",
          `Original task: ${task}\n\nResults:\n${steps.map((s) => `Step ${s.step} (${s.agent}): ${s.result}`).join("\n\n")}`,
          2048
        );

        res.json({
          data: {
            agentId: this.info.agentId,
            task,
            plan: parsedPlan.reasoning,
            steps,
            finalResult: synthesis,
            model: this.info.model,
          },
        });
      } catch (err) {
        next(err);
      }
    });
  }

  private async callAgentLocally(
    agentPath: string,
    endpoint: string,
    body: Record<string, unknown>
  ): Promise<string> {
    try {
      const url = `http://localhost:${config.port}/agents/${agentPath}${endpoint}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        return `[Agent error: ${res.status}]`;
      }

      const data = (await res.json()) as { data: Record<string, unknown> };
      // Return the main output field
      return (
        (data.data.summary as string) ??
        (data.data.audit as string) ??
        JSON.stringify(data.data)
      );
    } catch (err) {
      return `[Agent unreachable: ${err instanceof Error ? err.message : "unknown"}]`;
    }
  }
}
