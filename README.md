# Personal Finance Analysis

[![License: Proprietary](https://img.shields.io/badge/license-Proprietary-red.svg)](LICENSE)

Local-first personal finance dashboard for banking, spending, pay-cycle planning, and investment tracking.

The app syncs read-only banking data through Plaid and brokerage data through SnapTrade, stores it in your own PostgreSQL database, and renders a private Next.js dashboard.

<img width="2940" height="1678" alt="Screenshot 2026-05-19 at 10-17-13 WYN Financial Ltd  — Read-only finance terminal" src="https://github.com/user-attachments/assets/4a728ce2-ac0e-49a0-9a0f-8ad963777038" />

<img width="2940" height="1550" alt="Screenshot 2026-05-19 at 10-16-15 WYN Financial Ltd  — Read-only finance terminal" src="https://github.com/user-attachments/assets/b21c7cfb-6e12-41ad-8f9d-d6cc6589e9c7" />

## Features

- Plaid banking connection for Canadian transaction and balance data
- SnapTrade brokerage connection for investment accounts, holdings, cash balances, and CAD-equivalent portfolio value
- Dashboard with net worth, cashflow, recent transactions, category spend, and investment summary
- Transactions view with search, date/category/account filters, CSV export, and transfer/savings/settlement exclusions
- Spending Insight view for MTD/YTD category analysis
- Biweekly pay-cycle tracking with recurring expense accruals and safe-to-sweep suggestions
- Settings for paycheck anchors, employer patterns, recurring expenses, savings destinations, and settlement patterns
- Public demo tenant seeded from local mock data
- GitHub OAuth for private access, with optional email allowlist
- Prometheus-style metrics, health checks, and Vercel cron sync jobs

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript 6
- PostgreSQL 16
- Prisma 7 with `@prisma/adapter-pg`
- NextAuth.js 4 with GitHub OAuth
- Plaid Transactions
- SnapTrade
- Recharts
- Vitest
- Docker Compose for local Postgres

## Getting Started

Pre-requisite:
For Compliance, Safety, and Security Reasons, this app is currently usable under local circumstances only. You must obtain and generate your own secrets through affiliated third party integrators: Plaid, SnapTrade, TwelveData, and GitHub.

Install dependencies:

```bash
npm install
```

Create local environment config:

```bash
cp .env.example .env
npm run secrets
```

Use separate generated values for `NEXTAUTH_SECRET`, `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`, and optionally `METRICS_TOKEN`.

Start Postgres and apply migrations:

```bash
npm run dev:db
npm run db:deploy
npm run db:generate
```

Seed the public demo tenant:

```bash
npm run db:seed
```

Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

Unauthenticated users see the demo tenant at `/app`. Private settings and provider linking require GitHub OAuth.

## Environment Variables

Required for local app/database startup:

```env
DATABASE_URL="postgresql://finance:finance@localhost:5432/finance?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET=""
TOKEN_ENCRYPTION_KEY=""
CRON_SECRET=""
```

`TOKEN_ENCRYPTION_KEY` is the legacy single-key format. New installs and key rotations can use
keyed encryption instead:

```env
TOKEN_ENCRYPTION_KEYS='{"2026-06":""}'
TOKEN_ENCRYPTION_ACTIVE_KID="2026-06"
```

During a rotation from the legacy key, keep the old key available until rotation and verification
finish:

```env
TOKEN_ENCRYPTION_KEY="old-key-for-current-v1-payloads"
TOKEN_ENCRYPTION_KEYS='{"2026-06":"new-key"}'
TOKEN_ENCRYPTION_ACTIVE_KID="2026-06"
```

Auth:

```env
GITHUB_ID=""
GITHUB_SECRET=""
ADMIN_EMAILS="you@example.com"
```

Plaid:

```env
PLAID_ENV="sandbox"
PLAID_CLIENT_ID=""
PLAID_SECRET=""
PLAID_WEBHOOK_URL="http://localhost:3000/api/webhooks/plaid"
PLAID_VERIFY_WEBHOOKS="false"
```

SnapTrade:

```env
SNAPTRADE_CLIENT_ID=""
SNAPTRADE_CONSUMER_KEY=""
SNAPTRADE_USER_ID=""
SNAPTRADE_USER_SECRET_ENCRYPTED=""
```

Generate the encrypted SnapTrade user secret after token encryption env vars are set in `.env`:

```bash
npm run snaptrade:encrypt-secret
```

Paste the printed `SNAPTRADE_USER_SECRET_ENCRYPTED="..."` value into `.env`.

Rotate provider-token encryption only while the app and cron jobs are stopped, and after backing up
Postgres and `.env`:

```bash
npm run token-key:rotate -- --dry-run
npm run token-key:rotate -- --execute
```

The rotation script re-encrypts `PlaidItem.accessTokenEncrypted` rows in Postgres and prints a new
`SNAPTRADE_USER_SECRET_ENCRYPTED="..."` value to paste into `.env`. It never prints plaintext tokens.

Optional:

```env
TWELVEDATA_API_KEY=""
METRICS_TOKEN=""
```

## Main Commands

```bash
npm run dev              # Start Next.js dev server
npm run build            # Production build
npm run start            # Start production server
npm run lint             # ESLint
npm run lint:fix         # ESLint autofix
npm run format           # Prettier write
npm run format:check     # Prettier check
npm run typecheck        # TypeScript check
npm test                 # Vitest test suite
npm run test:watch       # Vitest watch mode
```

Database:

```bash
npm run dev:db           # Start local Postgres
npm run db:migrate       # Create/apply local Prisma migration
npm run db:deploy        # Apply existing migrations
npm run db:generate      # Generate Prisma client
npm run db:studio        # Open Prisma Studio
npm run db:seed          # Seed mock demo data
```

Operational scripts:

```bash
npm run sync:plaid       # Sync all Plaid items
npm run backfill:cycles  # Generate cycles and classify historical transactions
npm run seed:demo        # Alias for mock demo seeding
npm run secrets          # Print local secret values
npm run snaptrade:encrypt-secret # Encrypt the SnapTrade user secret for .env
npm run eval:assistant-live        # Live Ollama assistant evals against local DB
npm run eval:assistant-live:budget # Budget-only live assistant evals
```

Assistant live evals are opt-in because they require local Ollama, a reachable
database, and a `personal` tenant with data. They are not part of `npm test`.

## Application Routes

- `/` - marketing/sign-in landing page
- `/signin` - GitHub OAuth sign-in
- `/app` - main dashboard
- `/app/accounts` - Plaid and SnapTrade account status
- `/app/transactions` - searchable transaction table
- `/app/spending-insight` - MTD/YTD category spend analysis
- `/app/investments` - portfolio holdings and allocation
- `/app/cycles` - current pay cycle and safe-to-sweep view
- `/app/cycles/history` - historical pay cycles
- `/app/settings` - private configuration for cycle rules and patterns

Legal/static pages are available at `/privacy`, `/terms`, `/security`, and `/contact`.

## Sync Jobs and APIs

Manual provider actions are exposed through authenticated API routes under:

- `/api/plaid/*`
- `/api/snaptrade/*`
- `/api/settings/*`
- `/api/cycles/*`

Scheduled jobs:

- `/api/jobs/plaid-sync`
- `/api/jobs/snaptrade-sync`

Both accept `GET` or `POST` and require either:

```http
Authorization: Bearer $CRON_SECRET
```

or:

```http
x-cron-secret: $CRON_SECRET
```

Vercel cron runs Plaid every 6 hours on the hour and SnapTrade every 6 hours at minute 30.

Health and metrics:

- `/api/health/live`
- `/api/health/ready`
- `/api/metrics`

`/api/metrics` is protected by `METRICS_TOKEN` when configured, and disabled in production if no token is set.

## Data Model

Core tenant-scoped tables include:

- `Tenant`, `User`, `Account`, `Session` for tenancy and auth
- `PlaidItem`, `PlaidAccount`, `PlaidTransaction`, `BalanceSnapshot`, `SyncRun`
- `SnapTradeConnection`, `SnapTradeAccount`, `SnapTradePosition`, `SnapTradeCashBalance`, `SnapTradeSyncRun`
- `PayCycle`, `RecurringExpense`, `SavingsDestination`, `SettlementPattern`, `UserSettings`

Plaid access tokens and optional SnapTrade user secrets are encrypted with AES-256-GCM.
Legacy payloads use `TOKEN_ENCRYPTION_KEY`; keyed payloads use `TOKEN_ENCRYPTION_KEYS` plus
`TOKEN_ENCRYPTION_ACTIVE_KID`.

## Development Notes

- The demo seed uses local mock data, not a live Plaid sandbox item.
- Plaid transaction amounts follow Plaid convention: positive values are outflows, negative values are inflows.
- Private users are assigned to the shared `personal` tenant.
- Unauthenticated users resolve to the `demo` tenant when it exists.
- Pay-cycle classification runs during Plaid sync and can be backfilled with `npm run backfill:cycles`.
- Production must not run with `PLAID_VERIFY_WEBHOOKS=false`.

## License

Copyright © 2026 Ionwyn Sean. All rights reserved.

This is proprietary software — see [LICENSE](LICENSE). No permission is granted to use, copy, modify, or distribute it without prior written consent.
