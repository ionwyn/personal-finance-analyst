import "dotenv/config";

import { TenantKind } from "@prisma/client";

import {
  collectAssistantStream,
  createAssistantTurn,
  type AssistantMode,
} from "../src/lib/assistant/pipeline";
import type { PlanIntent } from "../src/lib/assistant/query";
import { getOllamaBaseUrl, getOllamaModelFact, getOllamaModelReasoning } from "../src/lib/env";
import { prisma } from "../src/lib/prisma";

type LiveEvalCase = {
  id: string;
  prompt: string;
  expectedIntent: PlanIntent;
  expectedEvidence?: string;
  answerMustInclude?: string[];
  answerMustNotInclude?: string[];
};

type CaseResult = {
  id: string;
  ok: boolean;
  prompt: string;
  expectedIntent: PlanIntent;
  actualIntent: string | null;
  evidenceKind: string | null;
  failures: string[];
  answerPreview: string;
};

const DEFAULT_CASES: LiveEvalCase[] = [
  {
    id: "budget-overview",
    prompt: "Am I over budget this month?",
    expectedIntent: "budget_status",
    expectedEvidence: "BUDGET STATUS",
    answerMustInclude: ["budget"],
    answerMustNotInclude: ["don't have", "do not have", "lack the data"],
  },
  {
    id: "budget-category-remaining",
    prompt: "How much grocery budget do I have left?",
    expectedIntent: "budget_status",
    expectedEvidence: "BUDGET STATUS",
    answerMustInclude: ["remaining"],
    answerMustNotInclude: ["don't have", "do not have", "lack the data"],
  },
  {
    id: "budget-burn-rate",
    prompt: "What is my budget burn rate by category?",
    expectedIntent: "budget_status",
    expectedEvidence: "burn rate",
    answerMustInclude: ["burn rate"],
    answerMustNotInclude: ["don't have", "do not have", "lack the data"],
  },
  {
    id: "budget-projected-over",
    prompt: "Based on my current pace, which budgets will I exceed by month end?",
    expectedIntent: "budget_status",
    expectedEvidence: "projected month-end",
    answerMustInclude: ["budget"],
    answerMustNotInclude: ["don't have", "do not have", "lack the data", "need to spend"],
  },
  {
    id: "cycle-safe-to-sweep",
    prompt: "How much is safe to sweep right now?",
    expectedIntent: "cycle_status",
    expectedEvidence: "PAY CYCLE STATUS",
    answerMustInclude: ["CAD"],
    answerMustNotInclude: [
      "don't have",
      "do not have",
      "lack the data",
      "plus this amount",
      "budget cap",
      "cycle cap",
      "spending cap",
      "cap",
    ],
  },
  {
    id: "cycle-bills-left",
    prompt: "What bills are left this pay cycle?",
    expectedIntent: "cycle_status",
    expectedEvidence: "UNSETTLED COMMITTED EXPENSES",
    answerMustInclude: ["bill"],
    answerMustNotInclude: ["don't have", "do not have", "lack the data", "already paid"],
  },
  {
    id: "cycle-daily-room",
    prompt: "How much can I spend per day until payday?",
    expectedIntent: "cycle_status",
    expectedEvidence: "daily room",
    answerMustInclude: ["CAD"],
    answerMustNotInclude: [
      "don't have",
      "do not have",
      "lack the data",
      "safe-to-sweep",
      "we can divide",
    ],
  },
  {
    id: "recurring-overview",
    prompt: "What subscriptions and recurring charges do I have?",
    expectedIntent: "recurring_spend",
    expectedEvidence: "RECURRING SPEND STATUS",
    answerMustInclude: ["recurring"],
    answerMustNotInclude: ["don't have", "do not have", "lack the data"],
  },
  {
    id: "cashflow-runway",
    prompt: "How long will my cash last at my current burn rate?",
    expectedIntent: "cashflow_runway",
    expectedEvidence: "CASHFLOW RUNWAY STATUS",
    answerMustInclude: ["cash"],
    answerMustNotInclude: ["don't have", "do not have", "lack the data"],
  },
  {
    id: "top-merchants-control",
    prompt: "What are my top merchants this month?",
    expectedIntent: "top_merchants",
    expectedEvidence: "TOP MERCHANTS",
    answerMustNotInclude: ["don't have", "do not have", "lack the data"],
  },
];

function argument(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

async function resolveTenant(identifier: string | null) {
  const tenant = await prisma.tenant.findFirst({
    where: identifier
      ? { OR: [{ id: identifier }, { slug: identifier }] }
      : { kind: TenantKind.PERSONAL },
    select: { id: true, slug: true },
  });
  if (!tenant) {
    throw new Error(identifier ? `Tenant not found: ${identifier}` : "No personal tenant found");
  }
  return tenant;
}

function includesAll(haystack: string, needles: string[] | undefined) {
  if (!needles) return [];
  const lower = haystack.toLowerCase();
  return needles.filter((needle) => !lower.includes(needle.toLowerCase()));
}

function includesAny(haystack: string, needles: string[] | undefined) {
  if (!needles) return [];
  const lower = haystack.toLowerCase();
  return needles.filter((needle) => lower.includes(needle.toLowerCase()));
}

function preview(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 240);
}

async function runCase(input: {
  tenant: { id: string; slug: string };
  mode: AssistantMode;
  item: LiveEvalCase;
}): Promise<CaseResult> {
  const turn = await createAssistantTurn({
    tenantId: input.tenant.id,
    tenantSlug: input.tenant.slug,
    mode: input.mode,
    history: [{ role: "user", content: input.item.prompt }],
  });
  const answer = await collectAssistantStream(turn.stream);
  const failures: string[] = [];
  const actualIntent = turn.diagnostics.plan?.intent ?? null;

  if (!turn.diagnostics.planValid) failures.push("planner output did not validate");
  if (actualIntent !== input.item.expectedIntent) {
    failures.push(`expected intent ${input.item.expectedIntent}, got ${actualIntent ?? "null"}`);
  }
  if (input.item.expectedEvidence && !turn.evidence?.includes(input.item.expectedEvidence)) {
    failures.push(`missing evidence marker: ${input.item.expectedEvidence}`);
  }

  for (const missing of includesAll(answer, input.item.answerMustInclude)) {
    failures.push(`answer missing phrase: ${missing}`);
  }
  for (const present of includesAny(answer, input.item.answerMustNotInclude)) {
    failures.push(`answer included forbidden phrase: ${present}`);
  }

  return {
    id: input.item.id,
    ok: failures.length === 0,
    prompt: input.item.prompt,
    expectedIntent: input.item.expectedIntent,
    actualIntent,
    evidenceKind: turn.diagnostics.evidenceKind ?? null,
    failures,
    answerPreview: preview(answer),
  };
}

async function main() {
  const tenant = await resolveTenant(argument("tenant"));
  const mode = (argument("mode") ?? "fact") as AssistantMode;
  if (mode !== "fact" && mode !== "reasoning") {
    throw new Error("--mode must be fact or reasoning");
  }

  const cases = hasFlag("budget-only")
    ? DEFAULT_CASES.filter((item) => item.expectedIntent === "budget_status")
    : hasFlag("cycle-only")
      ? DEFAULT_CASES.filter((item) => item.expectedIntent === "cycle_status")
      : DEFAULT_CASES;
  const started = Date.now();
  const results: CaseResult[] = [];

  console.log(
    JSON.stringify({
      suite: "assistant-live",
      tenant: tenant.slug,
      mode,
      ollamaBaseUrl: getOllamaBaseUrl(),
      factModel: getOllamaModelFact(),
      reasoningModel: getOllamaModelReasoning(),
      cases: cases.length,
    })
  );

  for (const item of cases) {
    const result = await runCase({ tenant, mode, item });
    results.push(result);
    console.log(JSON.stringify(result));
  }

  const pass = results.filter((result) => result.ok).length;
  const summary = {
    pass,
    total: results.length,
    passRate: pass / results.length,
    durationMs: Date.now() - started,
  };
  console.log(JSON.stringify(summary));

  if (pass !== results.length) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
