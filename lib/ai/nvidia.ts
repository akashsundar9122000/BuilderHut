import "server-only";

import { parsePlan, SYSTEM_PROMPT, type AiProvider, type PlanRequest } from "./provider";
import type { AiPlan } from "./ops";

/*
 * NVIDIA NIM, over its OpenAI-compatible chat completions endpoint.
 *
 * No SDK. This is one POST, and an SDK here would add a dependency, a bundle
 * and a second set of types for something that is a fetch call.
 */

const TIMEOUT_MS = 25_000;

export function nvidiaConfigured(): boolean {
  return Boolean(process.env.NVIDIA_API_KEY && process.env.NVIDIA_MODEL);
}

export function nvidiaProvider(): AiProvider {
  return {
    name: "nvidia",
    async plan(request: PlanRequest): Promise<AiPlan> {
      const base = process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";
      const model = process.env.NVIDIA_MODEL;
      const key = process.env.NVIDIA_API_KEY;
      if (!model || !key) throw new Error("The AI assistant is not configured.");

      /*
       * A hard timeout. The builder is a live editing surface; a request that
       * hangs leaves a spinner on screen forever, and the offline planner is
       * standing right there ready to answer.
       */
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);

      try {
        const response = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          signal: abort.signal,
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${key}`,
          },
          body: JSON.stringify({
            model,
            temperature: 0.2,
            max_tokens: 1200,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              {
                role: "user",
                content: `${request.context}\n\nInstruction: ${request.instruction}`,
              },
            ],
          }),
        });

        if (!response.ok) {
          // The body can carry the provider's own explanation, but it can also
          // carry the key back in an echoed request. Only the status travels.
          throw new Error(`The assistant service answered ${response.status}.`);
        }

        const body = (await response.json()) as {
          choices?: { message?: { content?: string } }[];
        };
        const content = body.choices?.[0]?.message?.content;
        if (!content) throw new Error("The assistant service returned an empty reply.");
        return parsePlan(content);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
