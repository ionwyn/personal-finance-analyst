import Link from "next/link";
import { getServerSession } from "next-auth";

import { AppShell } from "@/components/layout/app-shell";
import { SessionAppShell } from "@/components/layout/session-app-shell";
import { authOptions } from "@/lib/auth";
import { closeOverdueCycles } from "@/lib/cycles/close";
import { getCycleHistory } from "@/lib/cycles/getCycleHistory";
import { formatMoney, formatUtcDate } from "@/lib/format";
import { resolveSessionTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

function toNumber(value: { toString(): string } | null | undefined): number {
  if (value == null) return 0;
  return Number(value.toString());
}

export default async function CycleHistoryPage() {
  const session = await getServerSession(authOptions);
  const { tenantId, isDemo } = await resolveSessionTenant(session);

  if (!tenantId) {
    return (
      <AppShell mode={isDemo ? "demo" : "private"}>
        <section className="empty-state">
          <h2>No tenant found</h2>
        </section>
      </AppShell>
    );
  }

  await closeOverdueCycles(tenantId);
  const rows = await getCycleHistory(tenantId, 36);
  const now = new Date();

  return (
    <SessionAppShell session={session} isDemo={isDemo}>
      <div className="page-header">
        <div>
          <div className="page-title">Cycle history</div>
          <div className="page-sub">
            {rows.length} {rows.length === 1 ? "CYCLE" : "CYCLES"} · MOST RECENT FIRST
          </div>
        </div>
        <div className="page-actions">
          <Link className="btn btn-sm" href={"/app/cycles" as never}>
            Current cycle
          </Link>
        </div>
      </div>

      <div className="panel">
        <div className="panel-body flush" style={{ overflow: "auto" }}>
          {rows.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-4)", fontSize: 12 }}>
              No cycles yet. Set your last paycheck date in{" "}
              <Link href={"/app/settings" as never}>Settings</Link> to generate cycles.
            </div>
          ) : (
            <table className="table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Cycle</th>
                  <th>Status</th>
                  <th className="num">Income</th>
                  <th className="num">Stage 1</th>
                  <th className="num">Stage 2</th>
                  <th className="num">Spent</th>
                  <th className="num">Carryover</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isFuture = !row.closedAt && row.endDate > now;
                  const carry = row.carryover != null ? toNumber(row.carryover) : null;
                  return (
                    <tr key={row.id}>
                      <td>
                        <Link
                          href={`/app/cycles?id=${row.id}` as never}
                          style={{ color: "var(--text)" }}
                        >
                          {formatUtcDate(row.startDate)} – {formatUtcDate(row.endDate)}
                        </Link>
                      </td>
                      <td style={{ fontSize: 11, color: "var(--text-3)" }}>
                        {row.closedAt ? "Closed" : "Open"}
                      </td>
                      <td className="num mono">{formatMoney(toNumber(row.incomeReceived))}</td>
                      <td className="num mono">{formatMoney(toNumber(row.fixedSavingsPull))}</td>
                      <td className="num mono">{formatMoney(toNumber(row.sweptAmount))}</td>
                      <td className="num mono">{formatMoney(toNumber(row.spent))}</td>
                      <td
                        className="num mono"
                        style={{
                          color:
                            isFuture || carry == null
                              ? "var(--text-3)"
                              : carry >= 0
                                ? "var(--pos)"
                                : "var(--neg)",
                        }}
                      >
                        {isFuture ? (
                          "—"
                        ) : carry == null ? (
                          "N/A"
                        ) : (
                          <>
                            {carry >= 0 ? "+" : "−"}
                            {formatMoney(Math.abs(carry))}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="foot-note">
        <span>
          Carryover = chequing balance − credit card balance − unsettled recurring accruals at cycle
          end. N/A means no balance snapshot was available for that period.
        </span>
        <span>⌘5 current cycle</span>
      </div>
    </SessionAppShell>
  );
}
