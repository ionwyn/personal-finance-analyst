import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { AppShell } from "@/components/app-shell";
import { formatMoney } from "@/components/big-number";
import { authOptions } from "@/lib/auth";
import { closeOverdueCycles } from "@/lib/cycles/close";
import { getCycleHistory } from "@/lib/cycles/getCycleHistory";
import { formatUtcDate } from "@/lib/format";
import { getUserTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

function toNumber(value: { toString(): string } | null | undefined): number {
  if (value == null) return 0;
  return Number(value.toString());
}

export default async function CycleHistoryPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");

  const tenant = await getUserTenant(session.user.id);
  if (!tenant) redirect("/signin");

  await closeOverdueCycles(tenant.id);
  const rows = await getCycleHistory(tenant.id, 36);

  return (
    <AppShell
      mode="private"
      user={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image,
        handle: session.user.email ?? undefined
      }}
    >
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
                  const carry = toNumber(row.carryover);
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
                        style={{ color: carry >= 0 ? "var(--pos)" : "var(--neg)" }}
                      >
                        {carry >= 0 ? "+" : "−"}
                        {formatMoney(Math.abs(carry))}
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
          Carryover is cumulative: previous carryover + income − Stage 1 − Stage 2 − spent.
        </span>
        <span>⌘5 current cycle</span>
      </div>
    </AppShell>
  );
}
