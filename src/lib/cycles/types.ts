export const TXN_TYPES = ["income", "expense", "savings", "settlement", "transfer"] as const;
export type TxnType = (typeof TXN_TYPES)[number];

export const FREQUENCIES = ["weekly", "biweekly", "monthly", "annual"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const TX_SOURCE_PLAID = "plaid" as const;
export const TX_SOURCE_MANUAL_SWEEP = "manual_sweep" as const;
export type TxSource = typeof TX_SOURCE_PLAID | typeof TX_SOURCE_MANUAL_SWEEP;
