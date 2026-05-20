# Personal Finance Analytics — CLAUDE.md

## What This Project Is

Local-first personal finance dashboard. Users link bank accounts via Plaid, which syncs transactions and balance snapshots into a local PostgreSQL database. A Next.js frontend renders interactive charts and transaction search. No financial data leaves your own database.

## Tech Stack

- **Framework**: Next.js 16 (App Router), React 19, TypeScript 6
- **Database**: PostgreSQL 16, Prisma 7 ORM, `@prisma/adapter-pg`
- **Auth**: NextAuth.js 4 (GitHub OAuth), email allowlist via `ADMIN_EMAILS`
- **Banking**: Plaid (plaid-node 42), react-plaid-link 4
- **Charts**: Recharts 3
- **Security**: AES-256-GCM token encryption (Node.js crypto), JWT webhook verification (jose)
- **Testing**: Vitest 4
- **Infra**: Docker Compose (Postgres), Vercel (cron scheduling)

## Project Structure

```
src/
  app/
    api/
      auth/[...nextauth]/   # NextAuth entry point
      plaid/
        link-token/         # POST: create Plaid Link token
        exchange-public-token/ # POST: exchange for access token
        items/[itemId]/
          sync/             # POST: manual transaction sync
          balance/          # POST: manual balance refresh
      jobs/plaid-sync/      # GET|POST: cron endpoint (6-hourly via Vercel)
      webhooks/plaid/       # POST: Plaid webhook receiver
    app/                    # Protected pages (authenticated)
      page.tsx              # Dashboard
      accounts/page.tsx     # Linked accounts
      transactions/page.tsx # Search & filter
    demo/page.tsx           # Public sandbox demo (no login)
    signin/page.tsx
  components/
    auth-button.tsx         # Sign-in button used by /signin
    providers.tsx           # Client providers mounted from app/layout.tsx
    actions/                # Client-side action controls and menus
      account-row-menu.tsx
      item-actions.tsx
      plaid-link-button.tsx # Plaid Link provider/button
      snaptrade-actions.tsx
      sync-all-button.tsx
    layout/                 # App chrome shared by protected pages
      app-shell.tsx
      sidebar.tsx
      topbar.tsx
    shared/                 # Reusable visual primitives/helpers
      big-number.tsx
      charts.tsx            # Recharts: cashflow, category donut, balance line
      sparkline.tsx
      sym-logo.tsx
    features/               # Route/domain-specific component groups
      dashboard/
        dashboard-view.tsx
        chart-panels.tsx
        kpi-strip.tsx
        linked-items-panel.tsx
        recent-transactions-panel.tsx
        insights-panel.tsx
        category-spend-panel.tsx
        investments-card.tsx
        types.ts
      cycles/
        cycle-view.tsx
        category-bar.tsx
        discovery-panel.tsx
        sweep-prompt.tsx
      investments/
        investments-view.tsx
      settings/
        settings-view.tsx
        pay-cycle-section.tsx
        recurring-expenses-section.tsx
        savings-destinations-section.tsx
        settlement-patterns-section.tsx
        settings-form.tsx
      spending-insight/
        spending-insight-view.tsx
      transactions/
        transactions-toolbar.tsx
    ui/                     # Generic UI controls exported via ui/index.ts
      button.tsx
      date-range-picker.tsx
      input.tsx
      menu.tsx
      page-header.tsx
      panel.tsx
      segmented-control.tsx
      select.tsx
      status-pill.tsx
      switch.tsx
  lib/
    analytics.ts            # getDashboardData(), getTransactionsForTenant()
    auth.ts                 # NextAuth config
    tenant.ts               # Tenant lookup/creation
    http.ts                 # requireUserTenant(), requireOwnedPlaidItem()
    env.ts                  # Env var validation
    format.ts               # Currency/date utils
    prisma.ts               # Prisma singleton
    cron.ts                 # CRON bearer token verification
    plaid/
      client.ts             # Plaid API client
      sync.ts               # syncPlaidItem() — cursor-based pagination
      items.ts              # exchangeAndStorePlaidItem()
      accounts.ts           # refreshAccounts(), captureBalanceSnapshot()
      webhook.ts            # JWT signature verification
      errors.ts             # Plaid error normalisation
      normalize.ts          # Transaction/account data normalisation
    security/
      token-crypto.ts       # encryptToken() / decryptToken() — AES-256-GCM
prisma/
  schema.prisma             # Data model
  seed.ts                   # DB seed
  migrations/
scripts/
  sync-plaid.ts             # Manual sync trigger
  seed-demo.ts              # Plaid Sandbox demo data seeder
  print-secret.ts           # Secret key generator
```

## Database Models

| Model              | Purpose                                                        |
| ------------------ | -------------------------------------------------------------- |
| `Tenant`           | PERSONAL or DEMO; all data is tenant-scoped                    |
| `User`             | NextAuth user; belongs to one Tenant                           |
| `PlaidItem`        | A linked bank connection (encrypted access token, sync cursor) |
| `PlaidAccount`     | An individual account under a PlaidItem                        |
| `PlaidTransaction` | Transaction record; soft-deleted via `removed=true`            |
| `BalanceSnapshot`  | Point-in-time balance capture (immutable)                      |
| `SyncRun`          | Audit log: source, status, counts, errors                      |

## Key Behaviours

### Amount Sign Convention

Positive = expense/debit. Negative = income/credit deposit. This is the Plaid convention.

### Transaction Sync (syncPlaidItem)

1. Check 15-minute sync lock → skip if locked
2. Create `SyncRun` (RUNNING)
3. Decrypt access token
4. Call `/transactions/sync` with cursor pagination (500/page)
5. Upsert added/modified; mark removed → `removed=true`
6. Refresh account list
7. Capture balance snapshot (daily prod, every sync for sandbox/demo)
8. Update `SyncRun` (SUCCESS), update `PlaidItem` (cursor, lastSyncAt)

### Sync Triggers

- **Manual**: user clicks "Sync" on `/app/accounts`
- **Scheduled**: Vercel cron → `POST /api/jobs/plaid-sync` every 6 hours
- **Webhook**: Plaid `SYNC_UPDATES_AVAILABLE` → `/api/webhooks/plaid`

### Dashboard Analytics (getDashboardData)

- 6-month transaction window
- Current balance = sum of `currentBalance` across all accounts
- Monthly income/spend from current calendar month
- Cashflow chart = per-month income vs spending for last 6 months
- Category & merchant spend = top 8 by amount in last 90 days (positive amounts only)
- Balance history = daily snapshots aggregated by day label

### Security

- Plaid access tokens: AES-256-GCM with random IV, stored as encrypted string
- Plaid webhooks: verified via ES256 JWT against Plaid's public keys
- Cron endpoint: `Authorization: Bearer $CRON_SECRET` or `x-cron-secret: $CRON_SECRET`
- GitHub OAuth: email allowlist via `ADMIN_EMAILS` env var

## Commands

```bash
npm run dev          # Start Next.js dev server (localhost:3000)
npm run dev:db       # Start Docker PostgreSQL container
npm run db:deploy    # Run Prisma migrations
npm run db:seed      # Seed initial data
npm run seed:demo    # Seed Plaid Sandbox demo tenant
npm run sync:plaid   # Manual one-off Plaid sync
npm run secrets      # Generate NEXTAUTH_SECRET, TOKEN_ENCRYPTION_KEY, CRON_SECRET values
npm run typecheck    # TypeScript type check
npm test             # Vitest unit tests
npm run lint         # ESLint
npm run build        # Production build
```

## Environment Variables

```
DATABASE_URL=                  # PostgreSQL connection string
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=               # From `npm run secrets`
GITHUB_ID=                     # GitHub OAuth app client ID
GITHUB_SECRET=                 # GitHub OAuth app client secret
ADMIN_EMAILS=                  # Comma-separated allowed GitHub emails
PLAID_ENV=sandbox              # sandbox | development | production
PLAID_CLIENT_ID=
PLAID_SECRET=
TOKEN_ENCRYPTION_KEY=          # 32-byte key for AES-256-GCM
CRON_SECRET=                   # Bearer token for cron endpoint
```

## Development Notes

- Always run `npm run db:deploy` after pulling schema changes
- The `demo` tenant is public (no auth); `personal` tenants require GitHub sign-in
- `PlaidItem.status` is IDLE | SYNCING | ERROR — avoid triggering syncs on ERROR items without re-auth
- Balance snapshots accumulate; they are never updated, only inserted
- The `raw` JSON column on `PlaidTransaction` and `BalanceSnapshot` preserves the original Plaid response
- `SyncRun` records are the primary debugging tool for failed syncs — check `errorCode` and `errorMessage`
- Transactions endpoint caps at 250 results — add pagination if needed
- `getDashboardData` loads all 6-month transactions into memory; fine for personal use, but note this if accounts grow large
