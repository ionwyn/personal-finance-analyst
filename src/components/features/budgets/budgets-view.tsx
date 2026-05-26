"use client";

import Link from "next/link";
import { Target, Wallet } from "lucide-react";

import { PageHeader, Panel } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import type { BudgetGoalData, BudgetProgress, GoalProgress } from "@/lib/budgets/getBudgetGoalData";

const STATUS_COLOR: Record<BudgetProgress["status"], string> = {
  under: "var(--accent)",
  warn: "var(--warn)",
  over: "var(--neg)",
};

const STATUS_LABEL: Record<BudgetProgress["status"], string> = {
  under: "On track",
  warn: "Close to cap",
  over: "Over budget",
};

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div
      style={{
        height: 6,
        borderRadius: 4,
        background: "var(--surface-3)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: `${Math.min(100, Math.max(0, pct))}%`,
          height: "100%",
          background: color,
          transition: "width .2s ease",
        }}
      />
    </div>
  );
}

function BudgetCard({ b }: { b: BudgetProgress }) {
  const color = STATUS_COLOR[b.status];
  return (
    <div
      style={{
        display: "grid",
        gap: 6,
        padding: "10px 0",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 13, color: "var(--text)" }}>{b.categoryLabel}</span>
        <span className="mono" style={{ fontSize: 12, color: "var(--text-2)" }}>
          {formatCurrency(b.spent)}{" "}
          <span style={{ color: "var(--text-4)" }}>/ {formatCurrency(b.cap)}</span>
        </span>
      </div>
      <ProgressBar pct={b.pct} color={color} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5 }}>
        <span style={{ color, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {STATUS_LABEL[b.status]}
        </span>
        <span className="mono" style={{ color: b.remaining < 0 ? "var(--neg)" : "var(--text-3)" }}>
          {b.remaining < 0
            ? `${formatCurrency(Math.abs(b.remaining))} over`
            : `${formatCurrency(b.remaining)} left`}
        </span>
      </div>
    </div>
  );
}

function GoalCard({ g }: { g: GoalProgress }) {
  const color = g.reached ? "var(--pos)" : "var(--accent)";
  return (
    <div
      style={{
        display: "grid",
        gap: 6,
        padding: "10px 0",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 13, color: "var(--text)" }}>
          {g.name}
          {!g.tracked ? (
            <span style={{ fontSize: 10, color: "var(--text-4)", marginLeft: 6 }}>manual</span>
          ) : null}
        </span>
        <span className="mono" style={{ fontSize: 12, color: "var(--text-2)" }}>
          {formatCurrency(g.saved)}{" "}
          <span style={{ color: "var(--text-4)" }}>/ {formatCurrency(g.target)}</span>
        </span>
      </div>
      <ProgressBar pct={g.pct} color={color} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5 }}>
        <span style={{ color: "var(--text-3)" }}>
          {g.reached ? "Reached 🎉" : `${Math.round(g.pct)}%`}
          {g.destinationLabel ? ` · ${g.destinationLabel}` : ""}
        </span>
        <span className="mono" style={{ color: "var(--text-3)" }}>
          {g.targetDate
            ? `by ${g.targetDate.slice(0, 10)}`
            : `${formatCurrency(g.remaining)} to go`}
        </span>
      </div>
    </div>
  );
}

export function BudgetsView({ data }: { data: BudgetGoalData }) {
  const empty = data.budgets.length === 0 && data.goals.length === 0;

  return (
    <div>
      <PageHeader
        title="Budgets & Goals"
        subtitle={`Category caps for ${data.monthLabel} and savings targets`}
        actions={
          <Link href="/app/settings?s=budgets" className="btn btn-sm">
            Manage in settings
          </Link>
        }
      />

      {empty ? (
        <section className="empty-state">
          <h2>No budgets or goals yet</h2>
          <p
            style={{ color: "var(--text-3)", fontSize: 13, maxWidth: 460, margin: "8px auto 16px" }}
          >
            Set monthly category caps and savings targets in Settings, then track your progress here
            each month.
          </p>
          <Link href="/app/settings?s=budgets" className="btn btn-primary">
            Set up budgets & goals
          </Link>
        </section>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          <Panel
            title={
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Wallet size={13} /> Category budgets
              </span>
            }
            meta={
              data.budgets.length
                ? `${formatCurrency(data.totalSpent)} OF ${formatCurrency(data.totalCap)} THIS MONTH`
                : undefined
            }
          >
            {data.budgets.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--text-3)", padding: "8px 0" }}>
                No category budgets set.{" "}
                <Link href="/app/settings?s=budgets" style={{ color: "var(--accent)" }}>
                  Add one
                </Link>
                .
              </div>
            ) : (
              data.budgets.map((b) => <BudgetCard key={b.id} b={b} />)
            )}
          </Panel>

          <Panel
            title={
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Target size={13} /> Savings goals
              </span>
            }
          >
            {data.goals.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--text-3)", padding: "8px 0" }}>
                No savings goals yet.{" "}
                <Link href="/app/settings?s=budgets" style={{ color: "var(--accent)" }}>
                  Add one
                </Link>
                .
              </div>
            ) : (
              data.goals.map((g) => <GoalCard key={g.id} g={g} />)
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}
