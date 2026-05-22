import Link from "next/link";
import { CheckCircle2, Clock, Hourglass } from "lucide-react";

import { BigNumber } from "@/components/shared/big-number";
import { CategoryBar } from "@/components/features/cycles/category-bar";
import { DiscoveryPanel } from "@/components/features/cycles/discovery-panel";
import { SweepPrompt } from "@/components/features/cycles/sweep-prompt";
import { PageHeader } from "@/components/ui";
import { formatMoney, formatUtcDate } from "@/lib/format";
import type { CommittedItem, CurrentCycleData } from "@/lib/cycles/getCurrentCycle";
import type { DiscoveryCandidate } from "@/lib/cycles/discovery";

function toNumber(value: { toString(): string } | null | undefined): number {
  if (value == null) return 0;
  return Number(value.toString());
}

function StatusBadge({ status }: { status: CommittedItem["status"] }) {
  const config = {
    debited: { label: "Debited", Icon: CheckCircle2, color: "var(--pos)" },
    accrued: { label: "Accrued", Icon: Hourglass, color: "var(--text-3)" },
    upcoming: { label: "Upcoming", Icon: Clock, color: "var(--info)" },
  } as const;
  const { label, Icon, color } = config[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        color,
        fontFamily: "var(--font-mono)",
      }}
    >
      <Icon size={11} />
      {label}
    </span>
  );
}

export function CycleView({
  data,
  discoveryCandidates,
}: {
  data: CurrentCycleData;
  discoveryCandidates: DiscoveryCandidate[];
}) {
  const {
    cycle,
    daysRemaining,
    committed,
    spentSoFar,
    pendingSum,
    pendingCount,
    chequingBalance,
    creditCardBalance,
    sweepBuffer,
    safeToSweep,
    settingsConfigured,
    breakdown,
  } = data;

  const cycleLabel = `${formatUtcDate(cycle.startDate)} – ${formatUtcDate(cycle.endDate)}`;
  const incomeReceived = toNumber(cycle.incomeReceived);
  const fixedSavingsPull = toNumber(cycle.fixedSavingsPull);
  const sweptAmount = toNumber(cycle.sweptAmount);
  const spent = toNumber(spentSoFar);
  const pending = toNumber(pendingSum);
  const chequing = toNumber(chequingBalance);
  const ccBalance = toNumber(creditCardBalance);
  const buffer = toNumber(sweepBuffer);
  const sweepSpace = toNumber(safeToSweep.rawAmount);
  const sweepSuggestion = toNumber(safeToSweep.amount);
  const dailySpendBudget = daysRemaining > 0 ? Math.max(0, sweepSpace) / daysRemaining : 0;

  return (
    <>
      <PageHeader
        title="Current cycle"
        subtitle={
          <>
            {cycleLabel.toUpperCase()} · {daysRemaining} {daysRemaining === 1 ? "DAY" : "DAYS"}{" "}
            REMAINING
          </>
        }
        actions={
          <>
            <Link className="btn btn-sm" href={"/app/cycles/history" as never}>
              History
            </Link>
            <Link className="btn btn-sm" href={"/app/settings" as never}>
              Settings
            </Link>
          </>
        }
      />

      {!settingsConfigured ? (
        <section className="panel" style={{ marginBottom: 16, borderColor: "var(--accent-dim)" }}>
          <div className="panel-body" style={{ fontSize: 13, lineHeight: 1.6 }}>
            <strong style={{ color: "var(--accent)" }}>Set up your paycheck anchor.</strong> Open{" "}
            <Link href={"/app/settings" as never}>Settings → Pay cycle</Link> and set your{" "}
            <em>Last paycheck date</em> + <em>Employer merchant pattern</em>. We&apos;ll generate
            cycles forward from there and start populating income / Stage&nbsp;1 savings
            automatically.
          </div>
        </section>
      ) : null}

      {settingsConfigured && daysRemaining <= 1 ? (
        <SweepPrompt suggestedAmount={sweepSuggestion} alreadySwept={toNumber(cycle.sweptAmount)} />
      ) : null}

      {safeToSweep.overCommitted ? (
        <section
          className="panel"
          style={{ marginBottom: 16, borderColor: "var(--neg)", background: "var(--neg-bg)" }}
        >
          <div className="panel-body" style={{ fontSize: 12, color: "var(--neg)" }}>
            <strong>Over-committed.</strong> Pending charges + accruals exceed available cash. Sweep
            suggestions are clamped to zero.
          </div>
        </section>
      ) : null}

      {discoveryCandidates.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <DiscoveryPanel candidates={discoveryCandidates} />
        </div>
      ) : null}

      <div className="kpi-grid">
        <div className="kpi">
          <div className="kpi-label">
            <span className="dot" style={{ background: "var(--accent)" }} />
            Sweep Space
          </div>
          <BigNumber value={sweepSpace} />
          <div className="kpi-meta">
            <span>Buffer {formatMoney(buffer)}</span>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-label">
            <span className="dot" style={{ background: "var(--pos)" }} />
            Income received
          </div>
          <BigNumber value={incomeReceived} />
          <div className="kpi-meta">
            <span>{incomeReceived > 0 ? "Paycheck booked" : "Pending"}</span>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-label">
            <span className="dot" style={{ background: "var(--invest)" }} />
            Stage 1 savings
          </div>
          <BigNumber value={fixedSavingsPull} />
          <div className="kpi-meta">
            <span>{fixedSavingsPull > 0 ? "Pulled" : "Awaiting"}</span>
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-label">
            <span className="dot" style={{ background: "var(--neg)" }} />
            Spent so far
          </div>
          <BigNumber value={spent} />
          <div className="kpi-meta">
            <span>
              includes {pendingCount} pending · {formatMoney(pending)}
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">Committed this cycle</div>
              <div className="panel-meta">
                {committed.length} {committed.length === 1 ? "ITEM" : "ITEMS"}
              </div>
            </div>
            <div className="panel-body flush">
              {committed.length === 0 ? (
                <div style={{ padding: 14, color: "var(--text-3)", fontSize: 12 }}>
                  No active recurring expenses. Add them in Settings → Recurring expenses.
                </div>
              ) : (
                <table className="table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Frequency</th>
                      <th>Status</th>
                      <th className="num">Amount</th>
                      <th className="num">Accrual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {committed.map((c) => (
                      <tr key={c.id}>
                        <td>{c.name}</td>
                        <td style={{ color: "var(--text-3)", fontSize: 11 }}>{c.frequency}</td>
                        <td>
                          <StatusBadge status={c.status} />
                        </td>
                        <td className="num mono">{formatMoney(toNumber(c.amount))}</td>
                        <td className="num mono">{formatMoney(toNumber(c.accrualPerCycle))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">Safe-to-sweep breakdown</div>
              <div className="panel-meta">DERIVED · CONSERVATIVE</div>
            </div>
            <div className="panel-body">
              <BreakdownRow label="Chequing balance" value={chequing} sign="+" />
              <BreakdownRow label="Pending expenses" value={pending} sign="−" />
              <BreakdownRow
                label="Unsettled recurring accruals"
                value={committed
                  .filter((c) => c.status !== "debited")
                  .reduce((sum, c) => sum + toNumber(c.accrualPerCycle), 0)}
                sign="−"
              />
              <BreakdownRow
                label={
                  cycle.creditCardPaymentDate
                    ? `Credit card balance (due this cycle ${formatUtcDate(cycle.creditCardPaymentDate)})`
                    : "Credit card balance (not due this cycle)"
                }
                value={ccBalance}
                sign="−"
              />
              <BreakdownRow label="Sweep buffer" value={buffer} sign="−" />
              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  marginTop: 8,
                  paddingTop: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--text-3)",
                  }}
                >
                  Sweep Space
                </span>
                <span className="mono" style={{ fontSize: 14, fontVariantNumeric: "tabular-nums" }}>
                  {formatMoney(sweepSpace)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">Cycle summary</div>
              <div className="panel-meta">{cycleLabel.toUpperCase()}</div>
            </div>
            <div className="panel-body">
              <Row label="Income received" value={formatMoney(incomeReceived)} />
              <Row label="Stage 1 savings (auto pull)" value={formatMoney(fixedSavingsPull)} />
              <Row label="Stage 2 sweep (manual)" value={formatMoney(sweptAmount)} />
              <Row label="Spent so far (excl. settlements)" value={formatMoney(spent)} />
              <Row label="Pending charges" value={`${formatMoney(pending)} (${pendingCount})`} />
              <Row
                label="Net cash flow this cycle"
                value={formatMoney(incomeReceived - fixedSavingsPull - sweptAmount - spent, {
                  sign: true,
                })}
                accent
              />
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">Account snapshot</div>
              <div className="panel-meta">LIVE</div>
            </div>
            <div className="panel-body">
              <Row label="Chequing (depository)" value={formatMoney(chequing)} />
              <Row label="Credit card outstanding" value={formatMoney(ccBalance)} />
              <Row
                label="CC due this cycle"
                value={
                  cycle.creditCardPaymentDate ? formatUtcDate(cycle.creditCardPaymentDate) : "—"
                }
              />
              <Row label="Sweep buffer setting" value={formatMoney(buffer)} />
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div className="panel-title">Avg daily spend budget</div>
              <div className="panel-meta">SWEEP SPACE ÷ DAYS LEFT</div>
            </div>
            <div className="panel-body" style={{ textAlign: "center" }}>
              <BigNumber value={dailySpendBudget} />
              <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 6 }}>
                {formatMoney(Math.max(0, sweepSpace))} ÷ {daysRemaining}{" "}
                {daysRemaining === 1 ? "day" : "days"} remaining
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head" style={{ justifyContent: "space-between" }}>
          <div className="panel-title">Discretionary spend vs. last cycle</div>
          <div className="panel-meta" style={{ display: "flex", gap: 16, textAlign: "right" }}>
            <span>
              THIS{" "}
              <span className="mono" style={{ color: "var(--text)" }}>
                {formatMoney(breakdown.total)}
              </span>
            </span>
            <span>
              LAST{" "}
              <span className="mono" style={{ color: "var(--text-3)" }}>
                {formatMoney(breakdown.previousTotal)}
              </span>
            </span>
            <span style={{ minWidth: 56 }}>
              <span
                className="mono"
                style={{
                  color: breakdown.total > breakdown.previousTotal ? "var(--neg)" : "var(--pos)",
                }}
              >
                {formatMoney(breakdown.total - breakdown.previousTotal, { sign: true })}
              </span>
            </span>
          </div>
        </div>
        <div className="panel-body">
          {breakdown.rows.length === 0 ? (
            <div style={{ color: "var(--text-3)", fontSize: 12 }}>No expenses this cycle yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {breakdown.rows.map((r) => (
                <CategoryBar
                  key={r.category}
                  label={r.category}
                  color={r.color}
                  amount={r.amount}
                  pct={r.pct}
                  delta={r.delta}
                  prevAmount={r.prevAmount}
                  prevPct={r.prevPct}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "4px 0",
        fontSize: 12,
      }}
    >
      <span style={{ color: "var(--text-3)" }}>{label}</span>
      <span
        className="mono"
        style={{
          fontVariantNumeric: "tabular-nums",
          color: accent ? "var(--accent)" : "var(--text)",
          fontWeight: accent ? 600 : 400,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function BreakdownRow({ label, value, sign }: { label: string; value: number; sign: "+" | "−" }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "3px 0",
        fontSize: 12,
      }}
    >
      <span style={{ color: "var(--text-3)" }}>{label}</span>
      <span
        className="mono"
        style={{
          fontVariantNumeric: "tabular-nums",
          color: sign === "+" ? "var(--pos)" : "var(--neg)",
        }}
      >
        {sign}
        {formatMoney(value)}
      </span>
    </div>
  );
}
