import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { CreditCard, Landmark, MoreHorizontal, TrendingUp } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ItemActions } from "@/components/item-actions";
import { PlaidLinkButton } from "@/components/plaid-link-button";
import { SyncAllButton } from "@/components/sync-all-button";
import { formatMoney } from "@/components/big-number";
import { getDashboardData } from "@/lib/analytics";
import { authOptions } from "@/lib/auth";
import { getUserTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/signin");

  const tenant = await getUserTenant(session.user.id);
  const data = await getDashboardData(tenant?.slug ?? "personal");
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
    lastSyncAt ? `LAST SYNC ${formatRelative(lastSyncAt)}` : null
  ]
    .filter(Boolean)
    .join(" · ");

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
          <div className="page-title">Accounts</div>
          <div className="page-sub">{subLine}</div>
        </div>
        <div className="page-actions">
          <SyncAllButton items={institutions.map((i) => ({ id: i.id, status: i.status }))} />
          <PlaidLinkButton />
        </div>
      </div>

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
                boxShadow: "0 0 0 3px rgba(74,222,128,0.15)"
              }}
            />
            <span style={{ fontFamily: "var(--font-sans)", fontWeight: 400, color: "var(--text-2)" }}>
              Connected · {process.env.PLAID_ENV ?? "sandbox"}
            </span>
          </div>
        </div>
      </div>

      {institutions.length === 0 ? (
        <section className="empty-state">
          <h2>No linked institutions</h2>
          <p>Connect a Plaid account to start syncing accounts and transactions.</p>
          <PlaidLinkButton />
        </section>
      ) : (
        <div>
          {institutions.map((inst) => (
            <InstitutionCard key={inst.id} institution={inst} />
          ))}

          <PlaidLinkButton />
        </div>
      )}

      <div className="foot-note">
        <span>Plaid items stored encrypted at rest · webhook /api/webhooks/plaid online</span>
        <span>⌘R sync all · ⌘N link new</span>
      </div>
    </AppShell>
  );
}

type Institution = Awaited<ReturnType<typeof getDashboardData>>["institutions"][number];

function InstitutionCard({ institution }: { institution: Institution }) {
  const inst = institution;
  const logoBg = pickLogoBg(inst.institutionName);
  const logoText = inst.institutionName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="inst-card">
      <div className="inst-head">
        <div className="inst-logo" style={{ background: logoBg }}>
          {logoText || "—"}
        </div>
        <div className="inst-meta">
          <div className="inst-name">
            {inst.institutionName}
            <StatusPill status={inst.status} />
          </div>
          <div className="inst-sub">
            <span>
              {inst.accounts.length} {inst.accounts.length === 1 ? "account" : "accounts"}
            </span>
            <span className="sep">·</span>
            <span>
              Last sync {inst.lastSyncAt ? formatRelative(inst.lastSyncAt) : "never"}
            </span>
            {inst.errorCode ? (
              <>
                <span className="sep">·</span>
                <span style={{ color: "var(--neg)" }}>{inst.errorCode}</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="inst-balance">
          <div className="v" style={{ color: inst.total < 0 ? "var(--neg)" : "var(--text)" }}>
            {inst.total < 0 ? "−" : ""}
            {formatMoney(Math.abs(inst.total))}
          </div>
          <div className="l">Net</div>
        </div>
        <div className="inst-actions">
          <ItemActions itemId={inst.id} status={inst.status} />
        </div>
      </div>

      <div className="acct-list">
        {inst.accounts.map((account) => {
          const kind = accountKind(account.type, account.subtype);
          const Icon = kind === "credit" ? CreditCard : kind === "investment" ? TrendingUp : Landmark;
          return (
            <div className="acct-row" key={account.id}>
              <div className="acct-icon" style={{ width: 28, height: 28 }}>
                <Icon size={14} />
              </div>
              <div>
                <div>
                  <span className="acct-name">{account.name}</span>
                  {account.mask ? <span className="acct-mask">··{account.mask}</span> : null}
                </div>
                <div className="acct-type">
                  {[account.type, account.subtype].filter(Boolean).join(" · ").toUpperCase()}
                </div>
              </div>
              <div
                className="acct-bal"
                style={{ color: account.currentBalance < 0 ? "var(--neg)" : "var(--text)" }}
              >
                {account.currentBalance < 0 ? "−" : ""}
                {formatMoney(Math.abs(account.currentBalance))}
              </div>
              <button
                className="btn btn-ghost btn-sm"
                style={{ padding: 4 }}
                type="button"
                aria-label="More actions"
              >
                <MoreHorizontal size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls = status === "SYNCING" ? "syncing" : status === "ERROR" ? "error" : "idle";
  return (
    <span className={`status ${cls}`}>
      <i className="pulse" />
      {status}
    </span>
  );
}

function accountKind(type: string, subtype: string | null) {
  const t = (type + " " + (subtype ?? "")).toLowerCase();
  if (t.includes("credit") || t.includes("loan")) return "credit";
  if (t.includes("investment") || t.includes("retirement") || t.includes("brokerage"))
    return "investment";
  return "depository";
}

function formatRelative(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const LOGO_PALETTE = [
  "#117ACA",
  "#016FD0",
  "#138138",
  "#6B21A8",
  "#dc2626",
  "#0891b2",
  "#f59e0b",
  "#7c3aed"
];
function pickLogoBg(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) | 0;
  return LOGO_PALETTE[Math.abs(h) % LOGO_PALETTE.length];
}

