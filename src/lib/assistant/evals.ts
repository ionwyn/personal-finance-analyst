import type { AssistantPlan } from "@/lib/assistant/query";

export type AssistantEvalCase = {
  id: string;
  prompt: string;
  description: string;
  expectedPlan: AssistantPlan;
  evidenceKind?:
    | "transactions"
    | "top_merchants"
    | "top_categories"
    | "period_comparison"
    | "budget_status"
    | "cycle_status"
    | "recurring_spend"
    | "cashflow_runway"
    | "savings_goals"
    | "account_status"
    | "previous_answer";
  priorEvidence?: string;
  groundingMustMention?: string[];
};

export const assistantEvalCases = [
  {
    id: "date-today",
    prompt: "what's the date today",
    description: "Date questions should answer from the AS OF fact instead of refusing.",
    expectedPlan: { intent: "summary" },
    groundingMustMention: ["AS OF", "today's date"],
  },
  {
    id: "net-worth-summary",
    prompt: "What's my current net worth?",
    description: "Built-in balance summaries should not trigger row lookups.",
    expectedPlan: { intent: "summary" },
  },
  {
    id: "investment-biggest-winner",
    prompt: "Which of my investments is up the most?",
    description: "Built-in investment extrema should be answered from summary facts.",
    expectedPlan: { intent: "summary" },
  },
  {
    id: "investment-advice-guardrail",
    prompt: "Should I sell VFV and buy AAPL?",
    description:
      "Investment recommendations stay in summary mode and rely on narration guardrails.",
    expectedPlan: { intent: "summary" },
    groundingMustMention: ["must NOT give investment advice"],
  },
  {
    id: "custom-range-top-merchants",
    prompt: "From June 1 2026 until June 18 2026, count top 5 merchants I spend to",
    description: "Custom date-range top merchants require server-computed aggregate evidence.",
    expectedPlan: {
      intent: "top_merchants",
      filters: { from: "2026-06-01", to: "2026-06-18", bucket: "spending" },
    },
    evidenceKind: "top_merchants",
    groundingMustMention: ["TOP MERCHANTS", "server-computed totals"],
  },
  {
    id: "top-categories-last-month",
    prompt: "What categories drove my spending last month?",
    description: "Custom period category rankings require server-computed aggregate evidence.",
    expectedPlan: {
      intent: "top_categories",
      filters: { period: "last_month", bucket: "spending" },
    },
    evidenceKind: "top_categories",
    groundingMustMention: ["TOP CATEGORIES", "server-computed totals"],
  },
  {
    id: "merchant-breakdown-followup",
    prompt: "Show transactions from Marche Barcelo this month",
    description: "Merchant drill-downs should fetch bounded source transaction rows.",
    expectedPlan: {
      intent: "merchant_breakdown",
      filters: { q: "Marche Barcelo", period: "this_month", bucket: "spending" },
    },
    evidenceKind: "transactions",
    groundingMustMention: ["MATCHING TRANSACTIONS"],
  },
  {
    id: "high-value-last-month",
    prompt: "Show me my transactions over $200 last month",
    description: "Amount-bounded row lookups should keep server-side filters explicit.",
    expectedPlan: {
      intent: "transaction_list",
      filters: { period: "last_month", bucket: "spending", amountMin: 200 },
    },
    evidenceKind: "transactions",
  },
  {
    id: "recent-grocery-purchases",
    prompt: "What were my biggest grocery purchases recently?",
    description:
      "Natural language category terms should remain category filters, not broad q terms.",
    expectedPlan: {
      intent: "transaction_list",
      filters: { category: "Food and Drink", period: "last_90_days", bucket: "spending" },
    },
    evidenceKind: "transactions",
  },
  {
    id: "spending-period-comparison",
    prompt: "Why is my spending higher this month than last month?",
    description: "Period comparison questions should get server-computed deltas and drivers.",
    expectedPlan: {
      intent: "period_comparison",
      filters: { period: "this_month", bucket: "spending" },
    },
    evidenceKind: "period_comparison",
    groundingMustMention: ["PERIOD COMPARISON", "server-computed totals"],
  },
  {
    id: "category-period-comparison",
    prompt: "Compare grocery spending this month vs last month",
    description: "Category-specific period comparisons should preserve the category filter.",
    expectedPlan: {
      intent: "period_comparison",
      filters: { category: "Food and Drink", period: "this_month", bucket: "spending" },
    },
    evidenceKind: "period_comparison",
    groundingMustMention: ["PERIOD COMPARISON", "deltas"],
  },
  {
    id: "budget-status-overview",
    prompt: "Am I over budget this month?",
    description:
      "Budget questions should fetch monthly budget cap, spend, room, and pace evidence.",
    expectedPlan: { intent: "budget_status" },
    evidenceKind: "budget_status",
    groundingMustMention: ["BUDGET STATUS", "budget caps", "over/under pace"],
  },
  {
    id: "budget-category-remaining",
    prompt: "How much grocery budget do I have left?",
    description: "Category budget questions should preserve the category filter.",
    expectedPlan: {
      intent: "budget_status",
      filters: { category: "Food and Drink" },
    },
    evidenceKind: "budget_status",
    groundingMustMention: ["BUDGET STATUS", "remaining room"],
  },
  {
    id: "cycle-safe-to-sweep",
    prompt: "How much is safe to sweep right now?",
    description:
      "Safe-to-sweep questions should use current pay-cycle evidence, not budget evidence.",
    expectedPlan: { intent: "cycle_status" },
    evidenceKind: "cycle_status",
    groundingMustMention: ["PAY CYCLE STATUS", "safe-to-sweep"],
  },
  {
    id: "cycle-bills-left",
    prompt: "What bills are left this pay cycle?",
    description: "Committed-bill questions should use current pay-cycle evidence.",
    expectedPlan: { intent: "cycle_status" },
    evidenceKind: "cycle_status",
    groundingMustMention: ["PAY CYCLE STATUS", "committed expenses"],
  },
  {
    id: "cycle-daily-room",
    prompt: "How much can I spend per day until payday?",
    description:
      "Daily room before payday should use server-computed pay-cycle discretionary room.",
    expectedPlan: { intent: "cycle_status" },
    evidenceKind: "cycle_status",
    groundingMustMention: ["PAY CYCLE STATUS", "discretionary room"],
  },
  {
    id: "recurring-spend-overview",
    prompt: "What subscriptions and recurring charges do I have?",
    description: "Subscription questions should fetch confirmed and detected recurring evidence.",
    expectedPlan: { intent: "recurring_spend" },
    evidenceKind: "recurring_spend",
    groundingMustMention: ["RECURRING SPEND STATUS", "confirmed recurring expenses"],
  },
  {
    id: "recurring-merchant-detail",
    prompt: "Show recurring charges from Netflix",
    description: "Recurring merchant detail should preserve the merchant scope.",
    expectedPlan: { intent: "recurring_spend", filters: { q: "Netflix" } },
    evidenceKind: "recurring_spend",
    groundingMustMention: ["RECURRING SPEND STATUS"],
  },
  {
    id: "cashflow-runway",
    prompt: "How long will my cash last at my current burn rate?",
    description: "Runway questions should use cashflow runway evidence and not budget status.",
    expectedPlan: { intent: "cashflow_runway" },
    evidenceKind: "cashflow_runway",
    groundingMustMention: ["CASHFLOW RUNWAY STATUS", "straight-line coverage"],
  },
  {
    id: "cashflow-upcoming-bills",
    prompt: "Do I have enough cash for upcoming bills before payday?",
    description:
      "Upcoming-bill cash coverage questions should use cashflow runway evidence.",
    expectedPlan: { intent: "cashflow_runway" },
    evidenceKind: "cashflow_runway",
    groundingMustMention: ["CASHFLOW RUNWAY STATUS", "upcoming/unsettled bills"],
  },
  {
    id: "savings-goal-overview",
    prompt: "How are my savings goals doing?",
    description: "Savings goal questions should fetch goal progress evidence.",
    expectedPlan: { intent: "savings_goals" },
    evidenceKind: "savings_goals",
    groundingMustMention: ["SAVINGS GOAL STATUS", "savings-goal progress"],
  },
  {
    id: "savings-goal-specific",
    prompt: "How much do I have left for my vacation goal?",
    description: "Specific savings goal questions should preserve the named goal scope.",
    expectedPlan: { intent: "savings_goals", filters: { q: "vacation" } },
    evidenceKind: "savings_goals",
    groundingMustMention: ["SAVINGS GOAL STATUS"],
  },
  {
    id: "account-balance",
    prompt: "What's the balance in my chequing account?",
    description: "Account balance questions should fetch account status evidence.",
    expectedPlan: { intent: "account_status", filters: { q: "chequing" } },
    evidenceKind: "account_status",
    groundingMustMention: ["ACCOUNT STATUS", "account balances"],
  },
  {
    id: "account-spending",
    prompt: "How much did I spend from my credit card this month?",
    description: "Account-specific spending questions should keep account scope and period.",
    expectedPlan: {
      intent: "account_status",
      filters: { q: "credit card", period: "this_month", bucket: "spending" },
    },
    evidenceKind: "account_status",
    groundingMustMention: ["ACCOUNT STATUS", "period spend"],
  },
  {
    id: "prove-prior-answer",
    prompt: "That's not possible. Prove it",
    description: "Challenge turns should reuse retained evidence instead of inventing or refusing.",
    expectedPlan: { intent: "prove_previous_answer" },
    evidenceKind: "previous_answer",
    priorEvidence:
      "TOP MERCHANTS for that query — server-computed totals (showing 1 of 1; 1 matching transactions; combined total = CAD 879.49):\n- Marche Barcelo Inc.: CAD 879.49 across 1 transaction\n  - source row: 2026-06-15 | Marche Barcelo Inc. | CAD 879.49 | Food and Drink",
    groundingMustMention: ["PREVIOUS ANSWER EVIDENCE"],
  },
] satisfies AssistantEvalCase[];

export function getAssistantEvalCase(id: string): AssistantEvalCase {
  const match = assistantEvalCases.find((item) => item.id === id);
  if (!match) throw new Error(`Unknown assistant eval case: ${id}`);
  return match;
}
