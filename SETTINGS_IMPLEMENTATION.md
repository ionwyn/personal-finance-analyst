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

## Phase 2 — Classification & money models (net-new) — LANDED (2026-05-26)

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

- [x] **Plaid Unlink** (item/remove + cascade hard-delete) + **Re-authenticate** (update-mode link
      token) — `DELETE /api/plaid/items/[itemId]`, `.../update-link-token`, wired in `item-actions.tsx`
- [x] **Multiple income sources** (new `IncomeSource` model; migrated the single
      `employerMerchantPattern`; threaded through `classify`/`context`). Pay-cycle income +
      spending-insight `totalIncome` pick it up automatically (both aggregate on txnType/credits).
- [x] **Budgets & Goals workspace page** (`/app/budgets`) + sidebar nav (⌘7). **Management lives on
      the workspace page** (per owner: it's confusing to set budgets from Settings); Settings keeps
      only the **Alert thresholds** (warn % / alarm % / roll-forward) which drive the status flags.

### Good-to-have

- [x] **Budgets**: per-category monthly caps with under/warn/over bars (`Budget` model; spend via
      `spendingWhere`; warn/alarm % are configurable in Settings → `UserSettings.budgetWarnPct`/`budgetAlarmPct`).
      Caps are added/edited/removed inline on the workspace page (mockup-faithful `budgets.module.scss`).
- [x] **Savings goals** (`SavingsGoal` model; **start + target date via `DateRangePicker`**; optional
      link to a `SavingsDestination`; progress computed from savings-classified transactions matching
      that destination's pattern, **windowed to on/after the goal's start date**)

### Out of scope (owner decision)

- [—] Custom **Categories** model, rename/hide/recolor, manual per-transaction category override,
  "Make rule", category auto-classification rules. **Why:** Plaid enrichment + MCC is better; a
  prior custom system was deliberately removed. Don't reinvent it.

### Not worth (now)

- [—] Per-account rule scoping + precise "hits this cycle" counters (bookkeeping; can derive).
- [—] Credit-side income auto-detection (discovery for deposits) — manual entry suffices for now.

---

## Phase 3 — Display, account & data (cross-cutting) — IN PROGRESS

> Doing Phase 3 slowly, one section at a time. **Display & Preferences UI is scaffolded
> (2026-05-26)** from the `TD Personal Finance.html` design handoff (`claude.ai/design` bundle:
> `settings.jsx` DisplayTab + `theme.js` + `styles.css`). The controls render but are **UI-only /
> not wired** except the Default landing page (shipped Phase 1). Feature wiring comes next, section
> by section.

### Must-have

- [~] Locale / date / number format prefs — **UI built** (currency / locale selects, date- and
  number-format segmented controls). **Not wired:** needs `lib/format.ts` refactored off hardcoded
  `en-US`/`USD` + persistence on `UserSettings`.

### Good-to-have

- [~] Theme light/dark/system — **UI built** (3 preview cards, ported `theme-*` styles). **Not
  wired:** needs a theme controller (localStorage + `<html data-theme>`, cf. design `theme.js`) and
  a light palette in `_tokens.scss`.
- [ ] Multi-currency conversion (FX via `SnapTradeFxRate`) — heavy, pervasive
- [ ] Sessions: list active + "sign out all" (DB-strategy sessions make this feasible)
- [ ] Danger zone: Unlink-all (Phase 2 unlink endpoint now exists — reuse it) + Purge tenant (cascade deletes exist)
- [~] Row density + tabular-numbers toggles — **UI built** (segmented + switches, incl. market-session
  toggle). **Not wired:** global CSS preference classes + persistence. Export JSON + extra datasets still TODO.

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

### Phase 2 — landed (2026-05-26)

**Schema / data** (two migrations: `20260526130000_add_income_sources`, `20260526140000_add_budgets_goals`)

- `IncomeSource` (1:N labelled merchant pattern → income). Migration copies each tenant's
  `employerMerchantPattern` into a "Primary employer" source.
- `Budget` (per-`categoryPrimary` monthly cap, unique per category) and `SavingsGoal`
  (target/date, optional `savingsDestinationId`).

**Classification (income sources)**

- `classify.ts` / `context.ts` — match any active `IncomeSource`; legacy `employerMerchantPattern`
  kept as a fallback. Downstream (`recomputeCycleTotals` → `PayCycle.incomeReceived`,
  `getSpendingInsight.totalIncome`) is source-agnostic, so it picked up automatically.
- `classify.test.ts` — multi-source / inactive / paycheck-window coverage.

**Plaid unlink + re-auth**

- `client.ts` — `removePlaidItem` (`/item/remove`), `createUpdateLinkToken` (update mode).
- `DELETE /api/plaid/items/[itemId]` (revoke token best-effort, then cascade hard-delete) and
  `POST .../update-link-token`. `item-actions.tsx` does Unlink (with a destructive confirm) and a
  Re-authenticate button for `ERROR` items.

**Budgets & Goals** (revised 2026-05-26 — management on the workspace page, not Settings)

- `/api/settings/budgets` + `/api/settings/savings-goals` CRUD. Goals carry `startDate` + `targetDate`.
- **Workspace `/app/budgets` is the management surface** — `budgets-view.tsx`: inline cap editing,
  add/remove caps, goal cards with create/edit/delete via `DateRangePicker` (start → target). Styling
  ported from the mockup into `budgets.module.scss`. Sidebar entry (⌘7) + landing option.
- **Settings → Budgets & Goals keeps only Alert thresholds** — `alert-thresholds-section.tsx`
  (warn % / alarm % / roll-forward) persisted on `UserSettings`. The old `budgets-goals-section.tsx`
  creation UI was removed.
- `getBudgetGoalData.ts` — MTD spend per category, goal progress, status from the configured
  warn/alarm %, plus available categories + destinations for the management UI. Goal progress is
  **windowed to savings dated on/after the goal's `startDate`** (no start date = all-time).
  `getSettingsData` trimmed back (no longer fetches budgets/goals/categories).
- `lib/spending/category.ts` — shared `formatCategoryName` (dedup from `getSpendingInsight`).
- New `UserSettings` fields: `budgetWarnPct` (85), `budgetAlarmPct` (100), `budgetRollForward` (false).

**Verification:** `npm run typecheck` ✅ · `npm run lint` ✅ · `npm test` ✅ (56 passed) ·
`npm run build` ✅.

**Known caveats**

- Income sources are pattern-matched only (no credit-side auto-discovery yet).
- Budgets are calendar-month and per Plaid `categoryPrimary` (no sub-category / per-cycle budgets).
- `budgetRollForward` is stored but not yet applied — month-rollover carry isn't implemented.
- Savings-goal progress is windowed to savings on/after the goal's start date (or all-time when no
  start date is set); manual (unlinked) goals show 0.
- Unlink is a hard delete — that bank's history disappears from all charts (by design).

### Phase 3 — in progress (2026-05-26)

Tackling Phase 3 one section at a time. Source of truth for the UI is the `TD Personal Finance.html`
design handoff (Claude Design bundle — `project/settings.jsx` DisplayTab, `project/theme.js`,
`project/styles.css`).

**Display & Preferences — Theme wired (2026-05-26)**

- `display-section.tsx` rebuilt to the design: **Localization** (currency + locale selects, date- and
  number-format segmented controls), **Theme** (dark/light/system preview cards), **Interface**
  (default landing page, row density, tabular numbers, market-session toggle).
- Built on existing primitives (`SegmentedControl`, `Switch`, `Panel`) + the shared `.row`/`.rowLabel`
  classes. Theme-card styles ported into `settings.module.scss` (`.themeGrid`/`.themeCard`/`.themePv*`).

**Theme — now wired to next-themes (2026-05-26)**

- Installed `next-themes` 0.4.6 and set up `ThemeProvider` in `providers.tsx` with attribute
  `data-theme` (not class), defaulting to dark, with system-preference detection.
- Added light-mode palette in `_tokens.scss` (warm cream desk/document family `#e6e1ce`/`#efe9d4`)
  - saturated categorical colors (matching light-mode design tokens). All CSS custom properties
    automatically flip on `[data-theme="light"]` without component changes.
- Added 160ms ease transitions on background/border/color in `_base.scss` for smooth theme flips.
- Created `useMounted` hook (via `useSyncExternalStore`) to detect hydration and gate theme-dependent
  UI without setState-in-effect linting violations.
- Wired theme picker in `display-section.tsx` to `next-themes.setTheme()` and topbar theme toggle
  (`topbar.tsx` sun/moon button). Theme persists to localStorage + `<html data-theme>` attribute.
- Updated chart tooltips to stay dark-glass in both themes (Bloomberg convention per mockup).

**Default landing page and theme are wired** (Phase 1 & Phase 3). Everything else holds local state
and is intentionally not persisted/applied — file-header comments mark each seam for follow-up:

- currency/locale/formats → `lib/format.ts` refactor + `UserSettings` persistence.
- density/tabular-nums → global CSS preference classes; market-session → topbar pill.

**Verification:** `npm run typecheck` ✅ · `npm run lint` ✅ · Theme switching tested end-to-end
(all 3 cards, localStorage persistence, topbar toggle, hydration-guard) ✅.

Note: **Danger-zone "Unlink-all" is unblocked** by the Phase 2 unlink endpoint when that section comes.
