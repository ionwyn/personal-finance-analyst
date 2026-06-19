import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { buildFinancialContext } from "@/lib/assistant/context";
import { fetchBudgetStatus, serializeBudgetStatus } from "@/lib/assistant/budget";
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
import {
  fetchPeriodComparison,
  fetchScopedTransactions,
  fetchTopAggregates,
  planSchema,
  serializeAggregateRows,
  serializePeriodComparison,
  serializeRows,
} from "@/lib/assistant/query";
import { authOptions } from "@/lib/auth";
import { getOllamaModelFact, getOllamaModelReasoning } from "@/lib/env";
import { parseJson } from "@/lib/http";
import { logger, safeError, setLogContext, withRequestLogging } from "@/lib/logger";
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
        evidence: z.string().max(20000).optional(),
      })
    )
    .min(1)
    .max(20),
  mode: z.enum(["fact", "reasoning"]).default("fact"),
});

const EVIDENCE_SEP = "\x04";

function withEvidenceMetadata(
  stream: ReadableStream<Uint8Array>,
  evidence: string | undefined
): ReadableStream<Uint8Array> {
  if (!evidence) return stream;

  const reader = stream.getReader();
  const encoder = new TextEncoder();
  const frame = `${EVIDENCE_SEP}${Buffer.from(JSON.stringify({ evidence }), "utf8").toString("base64")}\n`;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(frame));
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });
}

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
    const priorEvidence = [...history]
      .reverse()
      .find((m) => m.role === "assistant" && m.evidence)?.evidence;
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
        logger.info({ planRaw }, "assistant plan raw output");
        const plan = planSchema.safeParse(JSON.parse(planRaw));
        if (plan.success) {
          const filters = plan.data.filters ?? {};
          if (plan.data.intent === "prove_previous_answer") {
            rowsBlock = priorEvidence
              ? `PREVIOUS ANSWER EVIDENCE retained from the prior assistant turn:\n${priorEvidence}`
              : "PREVIOUS ANSWER EVIDENCE: none was retained for the prior assistant turn.";
            logger.info(
              {
                plan: plan.data,
                evidence: {
                  kind: "previous_answer",
                  retained: Boolean(priorEvidence),
                  characters: rowsBlock.length,
                },
              },
              "assistant previous evidence reused"
            );
          } else if (
            plan.data.intent === "transaction_list" ||
            plan.data.intent === "merchant_breakdown"
          ) {
            const result = await fetchScopedTransactions(tenantSlug, filters);
            rowsBlock = serializeRows(result, facts.currency);
            logger.info(
              {
                plan: plan.data,
                evidence: {
                  kind: "transactions",
                  rowCount: result.rows.length,
                  total: result.total,
                  truncated: result.truncated,
                  sumAmount: result.sumAmount,
                  resolvedCategory: result.resolvedCategory,
                },
              },
              "assistant transaction evidence fetched"
            );
          } else if (
            plan.data.intent === "top_merchants" ||
            plan.data.intent === "top_categories"
          ) {
            const kind = plan.data.intent === "top_merchants" ? "merchant" : "category";
            const result = await fetchTopAggregates(tenantSlug, filters, kind);
            rowsBlock = serializeAggregateRows(result, facts.currency);
            logger.info(
              {
                plan: plan.data,
                evidence: {
                  kind,
                  rowCount: result.rows.length,
                  totalGroups: result.totalGroups,
                  totalTransactions: result.totalTransactions,
                  truncated: result.truncated,
                  sumAmount: result.sumAmount,
                  resolvedCategory: result.resolvedCategory,
                },
              },
              "assistant aggregate evidence fetched"
            );
          } else if (plan.data.intent === "period_comparison") {
            const result = await fetchPeriodComparison(tenantSlug, filters);
            rowsBlock = serializePeriodComparison(result, facts.currency);
            logger.info(
              {
                plan: plan.data,
                evidence: {
                  kind: "period_comparison",
                  currentAmount: result.current.amount,
                  previousAmount: result.previous.amount,
                  deltaAmount: result.deltaAmount,
                  merchantDriverCount: result.merchantDrivers.length,
                  categoryDriverCount: result.categoryDrivers.length,
                  resolvedCategory: result.resolvedCategory,
                },
              },
              "assistant period comparison evidence fetched"
            );
          } else if (plan.data.intent === "budget_status") {
            const result = await fetchBudgetStatus(tenantId, filters);
            rowsBlock = serializeBudgetStatus(result, facts.currency);
            logger.info(
              {
                plan: plan.data,
                evidence: {
                  kind: "budget_status",
                  rowCount: result.rows.length,
                  totalBudgets: result.totalBudgets,
                  overBudgetCount: result.overBudgetCount,
                  warnBudgetCount: result.warnBudgetCount,
                  overPaceCount: result.overPaceCount,
                  matchedCategory: result.matchedCategory,
                },
              },
              "assistant budget evidence fetched"
            );
          } else {
            logger.info({ plan: plan.data }, "assistant plan selected summary-only answer");
          }
        } else {
          logger.warn({ planRaw, issues: plan.error.issues }, "assistant plan validation failed");
        }
      } catch (error) {
        logger.warn({ error: safeError(error) }, "assistant plan step failed");
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
      return new Response(withEvidenceMetadata(stream, rowsBlock), {
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
