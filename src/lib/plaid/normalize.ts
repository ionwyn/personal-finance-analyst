import { Prisma } from "@prisma/client";
import type { AccountBase, Transaction } from "plaid";

export function parsePlaidDate(value?: string | null) {
  if (!value) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

export function parsePlaidDateTime(value?: string | null) {
  if (!value) return null;
  return new Date(value);
}

export function toDecimal(value?: number | null) {
  return value == null ? null : new Prisma.Decimal(value);
}

export function normalizeAccount(account: AccountBase) {
  return {
    plaidAccountId: account.account_id,
    name: account.name,
    officialName: account.official_name,
    type: String(account.type),
    subtype: account.subtype ? String(account.subtype) : null,
    mask: account.mask,
    isoCurrencyCode: account.balances.iso_currency_code,
    unofficialCurrencyCode: account.balances.unofficial_currency_code,
    availableBalance: toDecimal(account.balances.available),
    currentBalance: toDecimal(account.balances.current),
    limit: toDecimal(account.balances.limit)
  };
}

export function normalizeTransaction(transaction: Transaction) {
  const pfc = transaction.personal_finance_category;

  return {
    plaidTransactionId: transaction.transaction_id,
    plaidAccountId: transaction.account_id,
    pendingTransactionId: transaction.pending_transaction_id,
    name: transaction.name,
    merchantName: transaction.merchant_name ?? null,
    amount: toDecimal(transaction.amount) ?? new Prisma.Decimal(0),
    isoCurrencyCode: transaction.iso_currency_code,
    unofficialCurrencyCode: transaction.unofficial_currency_code,
    date: parsePlaidDate(transaction.date) ?? new Date(0),
    authorizedDate: parsePlaidDate(transaction.authorized_date),
    datetime: parsePlaidDateTime(transaction.datetime),
    authorizedDatetime: parsePlaidDateTime(transaction.authorized_datetime),
    paymentChannel: transaction.payment_channel ? String(transaction.payment_channel) : null,
    categoryPrimary: pfc?.primary ?? null,
    categoryDetailed: pfc?.detailed ?? null,
    categoryConfidence: pfc?.confidence_level ?? null,
    pending: transaction.pending,
    raw: transaction as unknown as Prisma.InputJsonValue
  };
}

export function summarizeTransactionChanges(input: {
  added: unknown[];
  modified: unknown[];
  removed: unknown[];
}) {
  return {
    addedCount: input.added.length,
    modifiedCount: input.modified.length,
    removedCount: input.removed.length
  };
}
