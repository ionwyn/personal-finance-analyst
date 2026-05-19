# TD Personal Finance Analysis

Local-first personal finance dashboard for banking, spending, pay-cycle planning, and investment tracking.

The app syncs read-only banking data through Plaid and brokerage data through SnapTrade, stores it in your own PostgreSQL database, and renders a private Next.js dashboard.

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
SNAPTRADE_USER_SECRET=""
SNAPTRADE_USER_SECRET_ENCRYPTED=""
```

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
```

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

Plaid access tokens and optional SnapTrade user secrets are encrypted with AES-256-GCM using `TOKEN_ENCRYPTION_KEY`.

## Development Notes

- The demo seed uses local mock data, not a live Plaid sandbox item.
- Plaid transaction amounts follow Plaid convention: positive values are outflows, negative values are inflows.
- Private users are assigned to the shared `personal` tenant.
- Unauthenticated users resolve to the `demo` tenant when it exists.
- Pay-cycle classification runs during Plaid sync and can be backfilled with `npm run backfill:cycles`.
- Production must not run with `PLAID_VERIFY_WEBHOOKS=false`.
