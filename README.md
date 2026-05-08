# Personal Finance Analytics

Local-first finance analytics built with Next.js, Postgres, Prisma, Plaid, Auth.js, and Recharts.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Fill `.env` from `.env.example`.

Generate local secrets with:

```bash
npm run secrets
```

Use the generated value for `NEXTAUTH_SECRET`, `TOKEN_ENCRYPTION_KEY`, and `CRON_SECRET` as separate secrets.

3. Start Postgres after Docker Desktop is running:

```bash
npm run dev:db
npm run db:deploy
npm run db:seed
```

4. Start the app:

```bash
npm run dev
```

The app runs at `http://localhost:3000`.

## Plaid Sandbox

Set `PLAID_ENV=sandbox`, `PLAID_CLIENT_ID`, `PLAID_SECRET`, and `TOKEN_ENCRYPTION_KEY`, then seed the public demo tenant:

```bash
npm run seed:demo
```

The seed script creates a Plaid Sandbox Item, exchanges the public token, syncs `/transactions/sync`, and captures `/accounts/balance/get` snapshots for the `demo` tenant.

## Main Commands

```bash
npm run typecheck
npm test
npm run lint
npm run build
npm run sync:plaid
```

`/api/jobs/plaid-sync` accepts `POST` and `GET` with either `Authorization: Bearer $CRON_SECRET` or `x-cron-secret: $CRON_SECRET`.
