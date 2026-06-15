export type ActivityGroupKey = "trade" | "income" | "cash" | "fee" | "corp" | "other";

export type ActivityGroup = {
  key: ActivityGroupKey;
  name: string;
  color: string;
  types: string[];
};

export const ACTIVITY_GROUPS: Record<ActivityGroupKey, ActivityGroup> = {
  trade: {
    key: "trade",
    name: "Trades",
    color: "var(--cat-2)",
    types: ["BUY", "SELL"],
  },
  income: {
    key: "income",
    name: "Income",
    color: "var(--pos)",
    types: ["DIVIDEND", "REI", "INTEREST", "STOCK_DIVIDEND"],
  },
  cash: {
    key: "cash",
    name: "Cash",
    color: "var(--invest)",
    types: [
      "CONTRIBUTION",
      "WITHDRAWAL",
      "TRANSFER",
      "EXTERNAL_ASSET_TRANSFER_IN",
      "EXTERNAL_ASSET_TRANSFER_OUT",
    ],
  },
  fee: {
    key: "fee",
    name: "Fees & tax",
    color: "var(--cat-7)",
    types: ["FEE", "TAX"],
  },
  corp: {
    key: "corp",
    name: "Corporate",
    color: "var(--cat-4)",
    types: ["SPLIT", "OPTIONEXPIRATION", "OPTIONASSIGNMENT", "OPTIONEXERCISE", "ADJUSTMENT"],
  },
  other: {
    key: "other",
    name: "Other",
    color: "var(--text-3)",
    types: [],
  },
};

export type ActivityTypeMeta = {
  group: ActivityGroupKey;
  short: string;
};

export const ACTIVITY_TYPES: Record<string, ActivityTypeMeta> = {
  BUY: { group: "trade", short: "BUY" },
  SELL: { group: "trade", short: "SELL" },
  DIVIDEND: { group: "income", short: "DIV" },
  REI: { group: "income", short: "REINVEST" },
  INTEREST: { group: "income", short: "INT" },
  STOCK_DIVIDEND: { group: "income", short: "STK·DIV" },
  CONTRIBUTION: { group: "cash", short: "CONTRIB" },
  WITHDRAWAL: { group: "cash", short: "WITHDRAW" },
  TRANSFER: { group: "cash", short: "XFER" },
  EXTERNAL_ASSET_TRANSFER_IN: { group: "cash", short: "XFER IN" },
  EXTERNAL_ASSET_TRANSFER_OUT: { group: "cash", short: "XFER OUT" },
  FEE: { group: "fee", short: "FEE" },
  TAX: { group: "fee", short: "TAX" },
  REIMBURSEMENT: { group: "other", short: "REFUND" },
  SPLIT: { group: "corp", short: "SPLIT" },
  OPTIONEXPIRATION: { group: "corp", short: "OPT·EXP" },
  OPTIONASSIGNMENT: { group: "corp", short: "OPT·ASN" },
  OPTIONEXERCISE: { group: "corp", short: "OPT·EXR" },
  ADJUSTMENT: { group: "corp", short: "ADJ" },
};

export function groupOf(type: string): ActivityGroupKey {
  return ACTIVITY_TYPES[type]?.group ?? "other";
}

export function shortLabel(type: string): string {
  return ACTIVITY_TYPES[type]?.short ?? type;
}
