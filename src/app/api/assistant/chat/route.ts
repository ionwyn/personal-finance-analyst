import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { buildFinancialContext } from "@/lib/assistant/context";
import {
  chatJSON,
  type ChatMessage,
  OllamaUnavailableError,
  streamChatText,
  streamChatWithThinking,
} from "@/lib/assistant/ollama";
import {
  buildNarrationPrompt,
  buildPlanPrompt,
  buildReasoningNarrationPrompt,
} from "@/lib/assistant/prompt";
import { fetchScopedTransactions, planSchema, serializeRows } from "@/lib/assistant/query";
import { authOptions } from "@/lib/auth";
import { getOllamaModelFact, getOllamaModelReasoning } from "@/lib/env";
import { parseJson } from "@/lib/http";
import { setLogContext, withRequestLogging } from "@/lib/logger";
import { validateRequestOrigin } from "@/lib/origin";
import { rateLimitRequest } from "@/lib/rate-limit";
import { resolveSessionTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      })
    )
    .min(1)
    .max(20),
  mode: z.enum(["fact", "reasoning"]).default("fact"),
});

export async function POST(request: Request) {
  return withRequestLogging(request, { route: "/api/assistant/chat" }, async () => {
    const limited = rateLimitRequest(request, {
      keyPrefix: "assistant:chat",
      limit: 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const invalidOrigin = validateRequestOrigin(request);
    if (invalidOrigin) return invalidOrigin;

    const session = await getServerSession(authOptions);
    const { tenantId, tenantSlug } = await resolveSessionTenant(session);
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant found" }, { status: 404 });
    }
    setLogContext({ tenantId });

    const parsed = await parseJson(request, bodySchema);
    if ("error" in parsed) return parsed.error;

    // Keep only the most recent turns to bound prompt size.
    const history = parsed.data.messages.slice(-12);
    const mode = parsed.data.mode;
    const factModel = getOllamaModelFact();
    const reasoningModel = getOllamaModelReasoning();
    const lastUser = [...history].reverse().find((m) => m.role === "user");
    if (!lastUser) {
      return NextResponse.json({ error: "No user message" }, { status: 400 });
    }

    try {
      const { facts, block } = await buildFinancialContext({
        tenantId,
        tenantSlug,
      });

      // ── Plan step: decide whether row-level data is needed (constrained JSON) ──
      let rowsBlock: string | undefined;
      try {
        const planRaw = await chatJSON(
          [
            { role: "system", content: buildPlanPrompt(facts.asOf) },
            { role: "user", content: lastUser.content },
          ],
          { model: factModel }
        );
        const plan = planSchema.safeParse(JSON.parse(planRaw));
        if (plan.success && plan.data.needsTransactions) {
          const result = await fetchScopedTransactions(tenantSlug, plan.data.filters ?? {});
          rowsBlock = serializeRows(result, facts.currency);
        }
      } catch {
        // Plan step failed or returned junk → fall back to summaries-only answer.
      }

      // ── Narration step: answer from facts (+ bounded rows), streamed ──
      const systemPrompt =
        mode === "reasoning"
          ? buildReasoningNarrationPrompt(block, rowsBlock)
          : buildNarrationPrompt(block, rowsBlock);
      const messages: ChatMessage[] = [
        { role: "system", content: systemPrompt },
        ...history.map((m) => ({ role: m.role, content: m.content })),
      ];

      const stream =
        mode === "reasoning"
          ? await streamChatWithThinking(messages, { model: reasoningModel, temperature: 0.55 })
          : await streamChatText(messages, { model: factModel, temperature: 0.3 });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Accel-Buffering": "no",
        },
      });
    } catch (error) {
      if (error instanceof OllamaUnavailableError) {
        return NextResponse.json(
          { error: "The local AI model is unavailable. Is Ollama running?" },
          { status: 503 }
        );
      }
      throw error;
    }
  });
}
