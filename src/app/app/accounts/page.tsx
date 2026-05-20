import { getServerSession } from "next-auth";
import { CreditCard, Landmark, TrendingUp } from "lucide-react";

import { AccountRowMenu } from "@/components/account-row-menu";
import { AppShell } from "@/components/app-shell";
import { ItemActions } from "@/components/item-actions";
import { PlaidLinkButton } from "@/components/plaid-link-button";
import {
  SnapTradeConnectionActions,
  SnapTradeLinkButton,
  SnapTradeSyncButton,
} from "@/components/snaptrade-actions";
import { SyncAllButton } from "@/components/sync-all-button";
import { formatMoney } from "@/components/big-number";
import { PageHeader, StatusPill } from "@/components/ui";
import { getDashboardData } from "@/lib/analytics";
import { authOptions } from "@/lib/auth";
import { formatRelativeTime, formatYearMonth } from "@/lib/format";
import { resolveSessionTenant } from "@/lib/tenant";

import styles from "./accounts.module.scss";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const session = await getServerSession(authOptions);
  const { tenantSlug, isDemo } = await resolveSessionTenant(session);
  const data = await getDashboardData(tenantSlug);
  const institutions = data.institutions;
  const accountCount = institutions.reduce((s, i) => s + i.accounts.length, 0);

  const lastSyncAt = institutions
    .map((p) => p.lastSyncAt)
    .filter((s): s is string => Boolean(s))
    .sort()
    .pop();

  const subLine = [
    `${institutions.length} INSTITUTIONS`,
    `${accountCount} ACCOUNTS`,
    lastSyncAt ? `LAST SYNC ${formatRelativeTime(lastSyncAt)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <AppShell
      mode={isDemo ? "demo" : "private"}
      user={
        isDemo
          ? undefined
          : {
              name: session?.user?.name,
              email: session?.user?.email,
              image: session?.user?.image,
              handle: session?.user?.email ?? undefined,
            }
      }
    >
      <PageHeader
        title="Accounts"
        subtitle={subLine}
        actions={
          <>
            {!isDemo && (
              <SyncAllButton items={institutions.map((i) => ({ id: i.id, status: i.status }))} />
            )}
            {!isDemo && <PlaidLinkButton />}
          </>
        }
      />

      <div className="summary-bar">
        <div className="cell">
          <div className="lbl">Total assets</div>
          <div className="val pos">+{formatMoney(data.totals.totalAssets)}</div>
        </div>
        <div className="cell">
          <div className="lbl">Total liabilities</div>
          <div className="val neg">−{formatMoney(data.totals.totalLiabilities)}</div>
        </div>
        <div className="cell">
          <div className="lbl">Net worth</div>
          <div className="val">{formatMoney(data.totals.currentBalance)}</div>
        </div>
        <div className="cell">
          <div className="lbl">Plaid status</div>
          <div
            className="val"
            style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--pos)",
                boxShadow: "0 0 0 3px rgba(74,222,128,0.15)",
              }}
            />
            <span
              style={{ fontFamily: "var(--font-sans)", fontWeight: 400, color: "var(--text-2)" }}
            >
              Connected · {process.env.PLAID_ENV ?? "sandbox"}
            </span>
          </div>
        </div>
      </div>

      {institutions.length === 0 ? (
        !isDemo && (
          <section className="empty-state">
            <h2>No linked institutions</h2>
            <p>Connect a Plaid account to start syncing accounts and transactions.</p>
            <PlaidLinkButton />
          </section>
        )
      ) : (
        <div>
          {institutions.map((inst) => (
            <InstitutionCard key={inst.id} institution={inst} isDemo={isDemo} />
          ))}

          {!isDemo && <PlaidLinkButton />}
        </div>
      )}

      <InvestmentsSection data={data.investments} isDemo={isDemo} />

      <div className="foot-note">
        <span>Plaid items stored encrypted at rest · webhook /api/webhooks/plaid online</span>
        <span>⌘R sync all · ⌘N link new</span>
      </div>
    </AppShell>
  );
}

function InvestmentsSection({
  data,
  isDemo,
}: {
  data: Awaited<ReturnType<typeof getDashboardData>>["investments"];
  isDemo: boolean;
}) {
  const { summary, accounts } = data;
  const plPos = summary.plCAD >= 0;
  const connectionIds = [...new Set(accounts.map((account) => account.connectionId))];
  const singleConnectionId = connectionIds.length === 1 ? connectionIds[0] : null;

  return (
    <>
      <div className={styles.sectionDivider}>
        <span className={styles.sectionDividerLbl}>Investment accounts</span>
        <span className={styles.sectionDividerLine} />
        <span className={styles.sectionDividerMeta}>
          {accounts.length} {accounts.length === 1 ? "account" : "accounts"} ·{" "}
          {summary.positionCount} positions · SnapTrade
        </span>
      </div>

      {accounts.length > 0 ? (
        <div className={styles.instCard}>
          <div className={styles.instHead}>
            <div className={styles.instLogo} style={{ background: summary.institutionLogoBg }}>
              {summary.institutionLogoText}
            </div>
            <div className={styles.instMeta}>
              <div className={styles.instName}>
                {summary.institution}
                <span className="status brokerage">
                  <i className="pulse" />
                  BROKERAGE
                </span>
                <StatusPill status={summary.status} />
              </div>
              <div className={styles.instSub}>
                <span>
                  {accounts.length} {accounts.length === 1 ? "account" : "accounts"} ·{" "}
                  {summary.positionCount} positions
                </span>
                <span className={styles.instSubSep}>·</span>
                <span>
                  Last sync {summary.lastSync ? formatRelativeTime(summary.lastSync) : "never"}
                </span>
                <span className={styles.instSubSep}>·</span>
                <span style={{ color: "var(--invest)" }}>
                  P&amp;L {plPos ? "+" : "−"}
                  {formatMoney(Math.abs(summary.plCAD))} ({plPos ? "+" : "−"}
                  {Math.abs(summary.plPct).toFixed(2)}%)
                </span>
                {summary.errorCode || summary.errorMessage ? (
                  <>
                    <span className={styles.instSubSep}>·</span>
                    <span style={{ color: "var(--neg)" }}>
                      {summary.errorCode ?? "ERROR"}
                      {summary.failingConnectionCount > 1
                        ? ` (${summary.failingConnectionCount} connections)`
                        : ""}
                    </span>
                  </>
                ) : null}
              </div>
              {summary.errorMessage ? (
                <div className={styles.instSub} style={{ color: "var(--neg)", marginTop: 4 }}>
                  {summary.errorMessage}
                </div>
              ) : null}
            </div>
            <div className={styles.instBalance}>
              <div className={styles.instBalanceV}>{formatMoney(summary.portfolioCAD)}</div>
              <div className={styles.instBalanceL}>Portfolio</div>
            </div>
            {!isDemo && (
              <div className={styles.instActions}>
                {singleConnectionId ? (
                  <SnapTradeConnectionActions connectionId={singleConnectionId} />
                ) : (
                  <SnapTradeSyncButton compact />
                )}
              </div>
            )}
          </div>

          <div className={styles.acctList}>
            {accounts.map((a) => (
              <div className={styles.acctRow} key={a.id}>
                <div
                  className={styles.acctIcon}
                  style={{ width: 28, height: 28, color: "var(--invest)" }}
                >
                  <TrendingUp size={14} />
                </div>
                <div>
                  <div>
                    <span className={styles.acctName}>{a.name}</span>
                    <span className={styles.acctMask}>··{a.registration}</span>
                  </div>
                  <div className={styles.acctType}>
                    {a.registration} · {a.currency}
                    {a.openedAt ? ` · OPENED ${formatYearMonth(a.openedAt)}` : ""}
                  </div>
                </div>
                <div className={styles.acctBal}>{formatMoney(a.totalValue)}</div>
                <AccountRowMenu accountName={a.name} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {!isDemo && (
        <div className={styles.addInstCard}>
          <SnapTradeLinkButton />
        </div>
      )}
    </>
  );
}

type Institution = Awaited<ReturnType<typeof getDashboardData>>["institutions"][number];

function InstitutionCard({ institution, isDemo }: { institution: Institution; isDemo: boolean }) {
  const inst = institution;
  const logoBg = pickLogoBg(inst.institutionName);
  const logoText = inst.institutionName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className={styles.instCard}>
      <div className={styles.instHead}>
        <div className={styles.instLogo} style={{ background: logoBg }}>
          {logoText || "—"}
        </div>
        <div className={styles.instMeta}>
          <div className={styles.instName}>
            {inst.institutionName}
            <StatusPill status={inst.status} />
          </div>
          <div className={styles.instSub}>
            <span>
              {inst.accounts.length} {inst.accounts.length === 1 ? "account" : "accounts"}
            </span>
            <span className={styles.instSubSep}>·</span>
            <span>Last sync {inst.lastSyncAt ? formatRelativeTime(inst.lastSyncAt) : "never"}</span>
            {inst.errorCode ? (
              <>
                <span className={styles.instSubSep}>·</span>
                <span style={{ color: "var(--neg)" }}>{inst.errorCode}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className={styles.instBalance}>
          <div
            className={styles.instBalanceV}
            style={{ color: inst.total < 0 ? "var(--neg)" : "var(--text)" }}
          >
            {inst.total < 0 ? "−" : ""}
            {formatMoney(Math.abs(inst.total))}
          </div>
          <div className={styles.instBalanceL}>Net</div>
        </div>
        {!isDemo && (
          <div className={styles.instActions}>
            <ItemActions itemId={inst.id} status={inst.status} />
          </div>
        )}
      </div>

      <div className={styles.acctList}>
        {inst.accounts.map((account) => {
          const kind = accountKind(account.type, account.subtype);
          const Icon =
            kind === "credit" ? CreditCard : kind === "investment" ? TrendingUp : Landmark;
          return (
            <div className={styles.acctRow} key={account.id}>
              <div className={styles.acctIcon} style={{ width: 28, height: 28 }}>
                <Icon size={14} />
              </div>
              <div>
                <div>
                  <span className={styles.acctName}>{account.name}</span>
                  {account.mask ? (
                    <span className={styles.acctMask}>··{account.mask}</span>
                  ) : null}
                </div>
                <div className={styles.acctType}>
                  {[account.type, account.subtype].filter(Boolean).join(" · ").toUpperCase()}
                </div>
              </div>
              <div
                className={styles.acctBal}
                style={{ color: account.currentBalance < 0 ? "var(--neg)" : "var(--text)" }}
              >
                {account.currentBalance < 0 ? "−" : ""}
                {formatMoney(Math.abs(account.currentBalance))}
              </div>
              <AccountRowMenu accountName={account.name} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function accountKind(type: string, subtype: string | null) {
  const t = (type + " " + (subtype ?? "")).toLowerCase();
  if (t.includes("credit") || t.includes("loan")) return "credit";
  if (t.includes("investment") || t.includes("retirement") || t.includes("brokerage"))
    return "investment";
  return "depository";
}

const LOGO_PALETTE = [
  "#117ACA",
  "#016FD0",
  "#138138",
  "#6B21A8",
  "#dc2626",
  "#0891b2",
  "#f59e0b",
  "#7c3aed",
];
function pickLogoBg(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) | 0;
  return LOGO_PALETTE[Math.abs(h) % LOGO_PALETTE.length];
}
