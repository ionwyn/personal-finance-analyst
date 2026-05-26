# Settings Redesign — Implementation Checklist

Tracks the build-out of the redesigned Settings page (designer mockup `settings.jsx` +
`styles-2.css`), re-grounded against what the codebase can actually back. Work is split
into **phases**, each tiered: **Must-have · Good-to-have · Not worth (now) · Impossible
without overhaul**.

Legend: `[x]` done · `[~]` partial (see note) · `[ ]` not started · `[—]` intentionally deferred

---

## Design-adaptation notes (mockup → this codebase)

- Routing uses Next App Router, not `location.hash`. Sections are deep-linked via
  `/app/settings?s=<section>`.
- Mockup's hand-rolled controls map onto existing `src/components/ui/` primitives
  (`Switch`, `SegmentedControl`, `Panel`, `Button`, `StatusPill`, …).
- Styles ported into `settings.module.scss`. The design's `--font-cond` token does **not**
  exist here → mapped to `--font-sans` (uppercased). All other tokens exist in `_tokens.scss`.
- Webhook path corrected: mockup says `/api/plaid/webhook`; real path is `/api/webhooks/plaid`.
- `tenant_id` chip wired to the real session tenant, not a hardcoded id.

---

## Phase 1 — IA refactor + surface existing data

### Must-have

- [x] Settings left-rail sub-nav shell (6 sections, URL-synced via `?s=`) — `settings-shell.tsx` + `settings.module.scss`
- [x] Fold existing panels into the new IA (Pay Cycle, Categories & Rules) — no backend change
- [~] **Pay-frequency selector** — persists the previously-dormant `UserSettings.payFrequencyDays`
  and threads it through the cycle engine (default 14). **Note:** weekly (7) / biweekly (14)
  are enabled; semi-monthly / monthly are disabled (engine overhaul, see below). Changing
  frequency regenerates forward cycles + reclassifies but does **not** rebuild closed history.
- [x] **Connections & Sync** section — Plaid items + SnapTrade (reuses `getDashboardData`, `ItemActions`, `SyncAllButton`, `snaptrade-actions`)
- [x] **Recent sync runs** viewer — new `getSyncRuns` read of existing `SyncRun` rows

### Good-to-have

- [x] Webhook endpoint display + copy button (correct path `/api/webhooks/plaid`)
- [x] Export section UI wrapping the existing CSV export (`/api/transactions/export`), period selector
- [x] Default landing-page preference (`UserSettings.defaultLanding`) honored on `/app` after login
      (sidebar Dashboard link uses `?home=1` to stay reachable)

### Not worth (now) — deferred, will revisit

- [—] Auto-sync toggle + sync-interval segmented control. **Why:** scheduling is a single
  **global Vercel cron** (every 6h) + webhooks; a per-tenant toggle/interval would be
  cosmetic/misleading without scheduler rework. Revisit alongside the scheduler change below.

### Impossible without overhaul — deferred

- [—] **Semi-monthly / monthly pay frequencies** + **retro re-bucketing** when frequency
  changes. **Why:** the cycle engine (`generate.ts`) is a fixed-stride model; semi-monthly
  ("1st & 15th") isn't a fixed N-day period, and switching frequency on an existing tenant
  needs historical cycles deleted/rebuilt and every transaction's `cycleId` reassigned while
  preserving closed-cycle data. Weekly/biweekly (fixed strides) **are** supported now.
- [—] Per-item/per-tenant sync interval actually honored by the scheduler (cron → queue rearchitecture).

---

## Phase 2 — Classification & money models (net-new) — IN PROGRESS

> ✅ **Categories decision gate — RESOLVED 2026-05-26 (owner).** Stay on **Plaid
> `categoryPrimary`**; do **not** rebuild a custom-category override/classification system.
> Plaid's transaction enrichment + MCC codes beat reinventing it, and a prior custom system was
> deliberately removed on 2026-05-11 (`20260511000000_remove_custom_categories`). Anything that
> renames/hides/recolors/overrides categories is **out of scope**. Pattern-based buckets (savings
> destinations / settlement patterns / income sources) remain the model.

**Owner decisions captured 2026-05-26:**

- **Categories/rules**: skip entirely (above).
- **Plaid Unlink**: **hard delete** — call Plaid `/item/remove` to revoke the token, then
  cascade-delete the item's accounts, transactions, snapshots, and sync runs. **Re-authenticate**
  needed for compliance and `ERROR` items.
- **Income detection**: **manual income sources + keep Plaid `INCOME_SALARY` auto-classify** (no
  credit-side auto-discovery this phase).
- **Budgets**: per-`categoryPrimary` caps, **calendar-month** reset (aligns with `getSpendingInsight` MTD).
- **Budgets & Goals get their own top-level workspace page** (`/app/budgets`, new sidebar item),
  while the _configuration_ (create/edit budgets + goals) lives in Settings → Budgets & Goals.

### Must-have

- [ ] **Plaid Unlink** (item/remove + cascade hard-delete) + **Re-authenticate** (update-mode link token)
- [ ] **Multiple income sources** (new `IncomeSource` model; migrate the single
      `employerMerchantPattern`; thread through `classify`/`context`; verify pay-cycle income +
      spending-insight `totalIncome` pick it up automatically)
- [ ] **Budgets & Goals workspace page** (`/app/budgets`) + sidebar nav + settings config

### Good-to-have

- [ ] **Budgets**: per-category caps with warn/over bars (new `Budget` model; spend via `spendingWhere`)
- [ ] **Savings goals** (new `SavingsGoal` model; tie to `SavingsDestination`; progress from savings txns)

### Out of scope (owner decision)

- [—] Custom **Categories** model, rename/hide/recolor, manual per-transaction category override,
  "Make rule", category auto-classification rules. **Why:** Plaid enrichment + MCC is better; a
  prior custom system was deliberately removed. Don't reinvent it.

### Not worth (now)

- [—] Per-account rule scoping + precise "hits this cycle" counters (bookkeeping; can derive).
- [—] Credit-side income auto-detection (discovery for deposits) — manual entry suffices for now.

---

## Phase 3 — Display, account & data (cross-cutting) — NOT STARTED

### Must-have

- [ ] Locale / date / number format prefs (refactor `format.ts` away from hardcoded `en-US`/`USD`)

### Good-to-have

- [ ] Theme light/dark/system (define light palette + switch) — heavy, cross-cutting
- [ ] Multi-currency conversion (FX via `SnapTradeFxRate`) — heavy, pervasive
- [ ] Sessions: list active + "sign out all" (DB-strategy sessions make this feasible)
- [ ] Danger zone: Unlink-all (needs Phase 2 unlink) + Purge tenant (cascade deletes exist)
- [ ] Row density + tabular-numbers toggles; Export JSON + extra datasets

### Not worth (now)

- [—] Alert thresholds with **push notifications**/banners — no notification infra; could degrade to in-app badges only.
- [—] Market-session pill (live TSX/NYSE clock) — unrelated net-new feature.
- [—] Export XLSX/OFX — extra deps; CSV/JSON suffice.

### Impossible without overhaul

- [—] Token-encryption key rotation w/ KMS + `kid` ("rotated 47d ago"). **Why:** single static
  env key (`token-crypto.ts`), no KMS, no key versioning. Real rotation = key-version column +
  re-encrypt-all migration + KMS integration. Mockup control is fictional.

---

## Implementation log

### Phase 1 — landed (2026-05-26)

**Schema / data**

- `UserSettings.defaultLanding` added (`prisma/migrations/20260526120000_add_default_landing`, applied).
- `src/lib/settings/landing.ts` — shared landing options/paths + validator.
- `src/lib/settings/getSyncRuns.ts` — recent `SyncRun` reader.

**Cycle engine**

- `src/lib/cycles/generate.ts` — `cycleStartForDate`/`cycleEndForStart`/`generatePayCycles`/
  `ensureCycleForDate` now take/resolve `lengthDays` (defaults to `payFrequencyDays`, else 14).
  All existing callers unchanged (length resolved from settings).
- `src/lib/cycles/generate.test.ts` — added weekly-stride + default-length coverage.

**API**

- `src/app/api/settings/user-settings/route.ts` — accepts `payFrequencyDays` (7/14 only) and
  `defaultLanding`; regenerates + reclassifies on frequency change.

**UI**

- `settings-shell.tsx` (new) — left-rail sub-nav, 6 sections, URL-synced.
- `settings.module.scss` (new) — chrome ported from the mockup (`--font-cond` → `--font-sans`).
- `connections-section.tsx`, `display-section.tsx`, `data-section.tsx`, `copy-button.tsx` (new).
- `pay-cycle-section.tsx` — added the frequency selector + dynamic meta.
- `settings/page.tsx` — fetches settings + dashboard + sync runs, renders the shell.
- `app/page.tsx` + `sidebar.tsx` — default-landing redirect + `?home=1` escape.
- `eslint.config.mjs` — ignore the standalone `settings.jsx` design mockup.

**Verification:** `npm run typecheck` ✅ · `npm run lint` ✅ · `npm test` ✅ (53 passed) ·
`npm run build` ✅.

**Known caveats**

- Pay frequency: weekly/biweekly only; changing it does not retro-rebucket closed cycles.
- Sync schedule shows the global 6h cadence (read-only) — per-item interval deferred.
- Categories/Budgets/Display-theme/currency/Data-danger-zone render as Phase-2/3 placeholders.

### Ready for Phase 2

Phase 1 is complete and verified. **Before starting Phase 2, resolve the Categories & Rules
decision gate** (custom categories were deliberately removed on 2026-05-11 — see the warning
in the Phase 2 section).
