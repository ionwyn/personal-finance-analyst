import { buildFinancialContext } from "@/lib/assistant/context";
import { fetchBudgetStatus, serializeBudgetStatus } from "@/lib/assistant/budget";
import { fetchCashflowRunway, serializeCashflowRunway } from "@/lib/assistant/cashflow";
import { fetchCycleStatus, serializeCycleStatus } from "@/lib/assistant/cycle";
import {
  fetchRecurringSpendStatus,
  serializeRecurringSpendStatus,
} from "@/lib/assistant/recurring";
import { fetchSavingsGoalStatus, serializeSavingsGoalStatus } from "@/lib/assistant/savings";
import {
  chatJSON,
  type ChatMessage,
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
  type AssistantPlan,
} from "@/lib/assistant/query";
import { getOllamaModelFact, getOllamaModelReasoning } from "@/lib/env";
import { logger, safeError } from "@/lib/logger";

export type AssistantMode = "fact" | "reasoning";

export type AssistantChatMessage = {
  role: "user" | "assistant";
  content: string;
  evidence?: string;
};

export type AssistantTurnResult = {
  stream: ReadableStream<Uint8Array>;
  evidence: string | undefined;
  diagnostics: {
    planRaw?: string;
    plan?: AssistantPlan;
    planValid: boolean;
    evidenceKind?: string;
  };
};

async function fetchEvidenceForPlan(input: {
  tenantId: string;
  tenantSlug: string;
  currency: string;
  plan: AssistantPlan;
  priorEvidence: string | undefined;
}): Promise<{ evidence: string | undefined; evidenceKind?: string }> {
  const filters = input.plan.filters ?? {};

  if (input.plan.intent === "prove_previous_answer") {
    return {
      evidence: input.priorEvidence
        ? `PREVIOUS ANSWER EVIDENCE retained from the prior assistant turn:\n${input.priorEvidence}`
        : "PREVIOUS ANSWER EVIDENCE: none was retained for the prior assistant turn.",
      evidenceKind: "previous_answer",
    };
  }

  if (input.plan.intent === "transaction_list" || input.plan.intent === "merchant_breakdown") {
    const result = await fetchScopedTransactions(input.tenantSlug, filters);
    return { evidence: serializeRows(result, input.currency), evidenceKind: "transactions" };
  }

  if (input.plan.intent === "top_merchants" || input.plan.intent === "top_categories") {
    const kind = input.plan.intent === "top_merchants" ? "merchant" : "category";
    const result = await fetchTopAggregates(input.tenantSlug, filters, kind);
    return { evidence: serializeAggregateRows(result, input.currency), evidenceKind: kind };
  }

  if (input.plan.intent === "period_comparison") {
    const result = await fetchPeriodComparison(input.tenantSlug, filters);
    return {
      evidence: serializePeriodComparison(result, input.currency),
      evidenceKind: "period_comparison",
    };
  }

  if (input.plan.intent === "budget_status") {
    const result = await fetchBudgetStatus(input.tenantId, filters);
    return {
      evidence: serializeBudgetStatus(result, input.currency),
      evidenceKind: "budget_status",
    };
  }

  if (input.plan.intent === "cycle_status") {
    const result = await fetchCycleStatus(input.tenantId);
    return {
      evidence: serializeCycleStatus(result, input.currency),
      evidenceKind: "cycle_status",
    };
  }

  if (input.plan.intent === "recurring_spend") {
    const result = await fetchRecurringSpendStatus(input.tenantId, filters);
    return {
      evidence: serializeRecurringSpendStatus(result, input.currency),
      evidenceKind: "recurring_spend",
    };
  }

  if (input.plan.intent === "cashflow_runway") {
    const result = await fetchCashflowRunway({
      tenantId: input.tenantId,
      tenantSlug: input.tenantSlug,
    });
    return {
      evidence: serializeCashflowRunway(result, input.currency),
      evidenceKind: "cashflow_runway",
    };
  }

  if (input.plan.intent === "savings_goals") {
    const result = await fetchSavingsGoalStatus(input.tenantId, filters);
    return {
      evidence: serializeSavingsGoalStatus(result, input.currency),
      evidenceKind: "savings_goals",
    };
  }

  return { evidence: undefined };
}

export async function createAssistantTurn(input: {
  tenantId: string;
  tenantSlug: string;
  history: AssistantChatMessage[];
  mode: AssistantMode;
}): Promise<AssistantTurnResult> {
  const factModel = getOllamaModelFact();
  const reasoningModel = getOllamaModelReasoning();
  const lastUser = [...input.history].reverse().find((m) => m.role === "user");
  const priorEvidence = [...input.history]
    .reverse()
    .find((m) => m.role === "assistant" && m.evidence)?.evidence;

  if (!lastUser) {
    throw new Error("No user message");
  }

  const { facts, block } = await buildFinancialContext({
    tenantId: input.tenantId,
    tenantSlug: input.tenantSlug,
  });

  let evidence: string | undefined;
  let evidenceKind: string | undefined;
  let planRaw: string | undefined;
  let plan: AssistantPlan | undefined;

  try {
    planRaw = await chatJSON(
      [
        { role: "system", content: buildPlanPrompt(facts.asOf) },
        { role: "user", content: lastUser.content },
      ],
      { model: factModel }
    );
    logger.info({ planRaw }, "assistant plan raw output");

    const parsed = planSchema.safeParse(JSON.parse(planRaw));
    if (parsed.success) {
      plan = parsed.data;
      const fetched = await fetchEvidenceForPlan({
        tenantId: input.tenantId,
        tenantSlug: input.tenantSlug,
        currency: facts.currency,
        plan,
        priorEvidence,
      });
      evidence = fetched.evidence;
      evidenceKind = fetched.evidenceKind;
      logger.info({ plan, evidenceKind }, "assistant evidence resolved");
    } else {
      logger.warn({ planRaw, issues: parsed.error.issues }, "assistant plan validation failed");
    }
  } catch (error) {
    logger.warn({ error: safeError(error) }, "assistant plan step failed");
  }

  const systemPrompt =
    input.mode === "reasoning"
      ? buildReasoningNarrationPrompt(block, evidence)
      : buildNarrationPrompt(block, evidence);
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...input.history.map((m) => ({ role: m.role, content: m.content })),
  ];

  const stream =
    input.mode === "reasoning"
      ? await streamChatWithThinking(messages, { model: reasoningModel, temperature: 0.55 })
      : await streamChatText(messages, { model: factModel, temperature: 0.3 });

  return {
    stream,
    evidence,
    diagnostics: {
      planRaw,
      plan,
      planValid: Boolean(plan),
      evidenceKind,
    },
  };
}

export async function collectAssistantStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let answer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    answer += decoder.decode(value, { stream: true });
  }
  answer += decoder.decode();
  return answer;
}
