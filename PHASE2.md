# Personal Account — Pay-Cycle Tracking Feature Spec

This document describes the required data, rules, and expected output for the Personal Account
feature of the financial dashboard. The existing app already pulls transaction data from TD and
Wealthsimple. Build on top of that — do not replace existing data pipelines.

---

## 1. Required Data

### 1.1 New Tables / Columns

#### `pay_cycles`
Represents one biweekly pay period. The primary unit of time for all personal finance tracking.

```sql
CREATE TABLE pay_cycles (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  start_date          DATE NOT NULL,
  end_date            DATE NOT NULL,          -- day before next paycheck
  income_received     DECIMAL(10,2),          -- actual net paycheck amount (populated on receipt)
  fixed_savings_pull  DECIMAL(10,2),          -- Stage 1 amount transferred to Wealthsimple on payday
  swept_amount        DECIMAL(10,2),          -- Stage 2 amount manually swept at end of cycle
  carryover           DECIMAL(10,2) DEFAULT 0,-- negative = deficit carried from previous cycle
  credit_card_payment_date DATE,              -- fixed date user pays CC in full this cycle (if any)
  notes               TEXT,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `recurring_expenses`
Committed expenses that repeat on a schedule. Populated via discovery flow or manual entry.

```sql
CREATE TABLE recurring_expenses (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  name                TEXT NOT NULL,
  merchant_pattern    TEXT,                   -- substring match against transaction merchant name
  amount              DECIMAL(10,2) NOT NULL,
  frequency           TEXT NOT NULL,          -- 'monthly' | 'biweekly' | 'weekly' | 'annual'
  anchor_date         INTEGER,                -- day of month it typically hits (1–31), null if biweekly/weekly
  accrual_per_cycle   DECIMAL(10,2),          -- computed: amount / cycles_per_period
  category_id         INTEGER REFERENCES categories(id),
  confirmed           BOOLEAN DEFAULT FALSE,  -- user has confirmed this is real
  active              BOOLEAN DEFAULT TRUE,
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `savings_destinations`
Accounts where outgoing transfers are classified as savings, not expenses.

```sql
CREATE TABLE savings_destinations (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  account_name        TEXT NOT NULL,          -- e.g. "Wealthsimple TFSA"
  match_pattern       TEXT NOT NULL,          -- substring match against transaction merchant/description
  label               TEXT,                   -- 'investing' | 'emergency' | 'goal' | 'general'
  active              BOOLEAN DEFAULT TRUE
);

-- Seed: Wealthsimple is always a savings destination
INSERT INTO savings_destinations (account_name, match_pattern, label)
VALUES ('Wealthsimple', 'WEALTHSIMPLE', 'investing');
```

#### `categories`
Fully user-defined. No system presets are forced on the user.

```sql
CREATE TABLE categories (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  name                TEXT NOT NULL,
  parent_id           INTEGER REFERENCES categories(id), -- null = top-level
  color               TEXT,                              -- hex color for UI
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `category_rules`
Deterministic mapping from merchant name to category. Applied in order of specificity.

```sql
CREATE TABLE category_rules (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_pattern    TEXT NOT NULL,          -- case-insensitive substring match
  category_id         INTEGER NOT NULL REFERENCES categories(id),
  priority            INTEGER DEFAULT 0,      -- higher = applied first
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### `user_settings`
Single-row config table for the personal account feature.

```sql
CREATE TABLE user_settings (
  id                        INTEGER PRIMARY KEY CHECK (id = 1),
  pay_frequency_days        INTEGER DEFAULT 14,     -- always 14 (biweekly)
  last_paycheck_date        DATE,                   -- anchor for cycle generation
  default_fixed_savings     DECIMAL(10,2),          -- suggested Stage 1 amount
  sweep_buffer              DECIMAL(10,2) DEFAULT 100.00, -- held back from safe-to-sweep
  cc_payment_day_of_month   INTEGER,                -- fixed day user pays credit card (e.g. 31)
  created_at                DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at                DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 1.2 Additions to Existing Transactions Table

Add the following columns to the existing transactions table if not already present:

```sql
ALTER TABLE transactions ADD COLUMN cycle_id INTEGER REFERENCES pay_cycles(id);
ALTER TABLE transactions ADD COLUMN type TEXT DEFAULT 'expense';
-- type values: 'income' | 'expense' | 'savings' | 'settlement' | 'transfer'
ALTER TABLE transactions ADD COLUMN is_pending BOOLEAN DEFAULT FALSE;
ALTER TABLE transactions ADD COLUMN category_id INTEGER REFERENCES categories(id);
ALTER TABLE transactions ADD COLUMN is_manually_categorized BOOLEAN DEFAULT FALSE;
```

---

## 2. Rules and Process

### 2.1 Pay Cycle Generation

**Trigger:** User sets `last_paycheck_date` in `user_settings`.

**Rule:** Generate `pay_cycles` rows forward and backward from that anchor date in 14-day intervals.
- `start_date` = paycheck date
- `end_date` = start_date + 13 days (day before next paycheck)
- Generate at least 6 months back and 3 months forward on first run
- On each new paycheck detection, create the next cycle automatically

**Paycheck detection:** When a new transaction arrives from TD with:
- `amount > 0` (credit to account)
- `merchant` matches employer name pattern (user configures this once)
- Date falls within ±1 day of expected paycheck date

→ Mark transaction as `type = 'income'`, assign to the new cycle, populate `income_received`.

---

### 2.2 Transaction Classification

Run in this order for every incoming transaction. Stop at first match.

**Step 1 — Savings destination check**
- If transaction is a debit AND merchant matches any `savings_destinations.match_pattern` (case-insensitive)
- → Set `type = 'savings'`
- → Do NOT apply category rules
- → If it occurs on the same day as `pay_cycles.start_date`, record as `fixed_savings_pull` on the cycle

**Step 2 — Settlement check**
- If transaction is a debit AND merchant matches known credit card payment patterns
  (e.g. "TD VISA PAYMENT", "CREDIT CARD PAYMENT", "REMBOURSEMENT")
- → Set `type = 'settlement'`
- → Exclude from all budget calculations. This is not an expense.

**Step 3 — Income check**
- If transaction is a credit AND matches employer pattern
- → Set `type = 'income'`

**Step 4 — Category rule matching**
- Match `transaction.merchant` against `category_rules.merchant_pattern` (case-insensitive substring)
- Apply highest `priority` match
- → Set `category_id`, leave `is_manually_categorized = FALSE`

**Step 5 — Fallback**
- → Set `category_id = NULL`, flag for user review

---

### 2.3 Cycle Assignment

Assign every transaction to a cycle:

```
cycle_id = pay_cycle where transaction.date >= pay_cycle.start_date
                       AND transaction.date <= pay_cycle.end_date
```

If no cycle exists for that date range, create one using the generation rule above.

---

### 2.4 Recurring Expense Accrual

**Purpose:** Spread monthly fixed costs (especially rent) across pay cycles so end-of-month
bills never appear as surprises.

**Accrual computation:**
```
frequency = 'monthly'  → accrual_per_cycle = amount / 2
frequency = 'annual'   → accrual_per_cycle = amount / 26
frequency = 'biweekly' → accrual_per_cycle = amount
frequency = 'weekly'   → accrual_per_cycle = amount * 2
```

**What accrual means in practice:**
- Each cycle "reserves" `accrual_per_cycle` from the available balance
- This reservation is included in the safe-to-sweep formula (see 2.5) regardless of whether
  the actual debit has hit yet in this cycle
- When the actual transaction clears and is matched to a recurring expense, it absorbs the
  accrual — it does not appear as an additional expense on top of it

**Matching a transaction to a recurring expense:**
- `transaction.merchant` matches `recurring_expenses.merchant_pattern` (case-insensitive)
- Transaction `type = 'expense'`
- → Link transaction to recurring expense, mark accrual as settled for this cycle

---

### 2.5 Safe-to-Sweep Calculation

Computed in real time for the active cycle. Never stored — always derived.

```
safe_to_sweep =
  current_chequing_balance (from TD, latest sync)
  − sum(transactions WHERE is_pending = TRUE AND cycle_id = current AND type = 'expense')
  − sum(recurring_expenses.accrual_per_cycle WHERE active = TRUE
        AND NOT yet matched to a transaction in this cycle)
  − credit_card_current_balance  (if CC payment date falls within remainder of this cycle)
  − user_settings.sweep_buffer
```

**Constraints:**
- If result < 0, clamp to 0 and flag the cycle as "over-committed"
- If `credit_card_payment_date` is in a future cycle, exclude CC balance from this calculation
- Pending transactions always count as committed (conservative assumption)

---

### 2.6 Recurring Expense Discovery

**Trigger:** Run on first load and after any bulk transaction import.

**Process:**
1. Group transactions by normalized merchant name
2. For each group with 2+ occurrences, compute interval between dates
3. If interval is consistently ~30 days (±5), candidate frequency = 'monthly'
4. If interval is consistently ~14 days (±2), candidate frequency = 'biweekly'
5. Surface candidates where `confirmed = FALSE` to the user for review
6. User can: confirm (sets `confirmed = TRUE`), edit amount/name, or dismiss

**Do not auto-confirm.** Always require explicit user confirmation.

---

### 2.7 Carryover

At cycle close (when new paycheck arrives and new cycle starts):

```
closed_cycle.carryover =
  previous_cycle.carryover
  + income_received
  − fixed_savings_pull
  − swept_amount
  − sum(transactions WHERE cycle_id = closed AND type = 'expense')
```

- Positive carryover = surplus (user left money in chequing, did not sweep)
- Negative carryover = deficit (spent more than available after savings pull)
- Carry the value into the next cycle's safe-to-sweep formula as an offset

---

### 2.8 Stage 1 Suggestion

Available after 3+ complete cycles of data.

```
suggested_fixed_savings =
  floor(average(income_received) − average(committed_per_cycle) − sweep_buffer − 200)
  rounded down to nearest 50
```

Where `committed_per_cycle` = sum of all `accrual_per_cycle` for active recurring expenses.

The $200 and rounding are conservative padding. Surface this as a suggestion only — user
accepts or overrides.

---

## 3. Output

### 3.1 Current Cycle View

The primary screen. Shows the active pay cycle.

**Required fields:**
```
Cycle dates                   e.g. "May 2 – May 15"
Days remaining in cycle       integer
Income received               dollar amount (or "pending" if not yet arrived)
Fixed savings pull            dollar amount + date transferred
  └─ Status: done / pending

Committed this cycle
  └─ List of recurring expenses with:
       name, amount, status (✓ debited | ⏳ accrued | 📅 upcoming)

Spent so far                  sum of expense transactions this cycle
Pending transactions          sum + count, flagged separately

Safe to sweep                 computed value (see 2.5), prominently displayed
Buffer held                   user_settings.sweep_buffer
```

### 3.2 Sweep Prompt

Surfaced when: current date = `pay_cycle.end_date` (day before next paycheck).

```
"Ready to invest?"
Suggested amount: $[safe_to_sweep]
[Confirm sweep] [Edit amount] [Skip this cycle]
```

On confirm: log a transaction with `type = 'savings'`, merchant = 'Wealthsimple (manual)',
update `pay_cycle.swept_amount`.

### 3.3 Spending Breakdown

Per-cycle, grouped by category.

```
Category        Spent    % of discretionary    vs. last cycle
────────────────────────────────────────────────────────────
Groceries       $210     18%                   ↑ $40
Dining          $180     15%                   → same
Transport       $95      8%                    ↓ $20
...
Uncategorized   $55      —                     [Review]
```

Discretionary = `income_received − fixed_savings_pull − sum(committed_accruals)`.

### 3.4 Cycle History

List of closed cycles, most recent first.

```
Cycle           Income    Saved (S1+S2)    Spent    Carryover
──────────────────────────────────────────────────────────────
Apr 18 – May 1  $2,840    $700 (25%)      $1,890   +$250
Apr 4 – Apr 17  $2,790    $600 (21%)      $2,050   −$140
...
```

### 3.5 Recurring Expense Discovery Panel

Shown when there are unconfirmed recurring expense candidates.

For each candidate:
```
[Merchant name]   ~$[amount]   every ~[interval]
[Confirm]  [Edit]  [Dismiss]
```

### 3.6 Uncategorized Transaction Queue

Any transaction with `category_id = NULL` and `type = 'expense'` appears here.

For each:
```
[Date]  [Merchant]  [Amount]
Category: [dropdown of user categories]  [Save rule for this merchant]
```

---

## 4. Assumptions and Constraints

- Pay frequency is always 14 days. No variability.
- Paycheck amount may vary by up to ~$200 net. Use actual `income_received` per cycle, not a fixed estimate.
- Wealthsimple transfers are always savings. No exceptions.
- Credit card payments (settlements) are never expenses.
- All spending tracked at transaction date, not credit card payment date.
- The user pays their credit card in full on a fixed day of month (`user_settings.cc_payment_day_of_month`). Model the full outstanding CC balance as reserved when that day falls within the current cycle.
- Safe-to-sweep is always conservative: when in doubt, reserve more.
- No category presets. The user defines all categories from scratch.
- Category rules are applied automatically but the user can override any transaction manually. Manual overrides are never overwritten by rules (`is_manually_categorized = TRUE` locks the category).