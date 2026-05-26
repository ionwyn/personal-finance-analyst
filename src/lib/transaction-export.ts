import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { categorizeForSpending } from "@/lib/spending/classify";

export type TransactionExportFilters = {
  tenantSlug: string;
  q?: string;
  from?: string;
  to?: string;
  category?: string;
  account?: string;
  bucket?: string;
  pending?: string;
  amountMin?: string;
  amountMax?: string;
};

const EXPORT_COLUMNS = [
  "id",
  "tenant_id",
  "item_id",
  "institution_name",
  "account_id",
  "plaid_account_id",
  "account_name",
  "account_official_name",
  "account_type",
  "account_subtype",
  "account_mask",
  "plaid_transaction_id",
  "pending_transaction_id",
  "name",
  "merchant_name",
  "display_name",
  "amount",
  "iso_currency_code",
  "unofficial_currency_code",
  "date",
  "authorized_date",
  "datetime",
  "authorized_datetime",
  "payment_channel",
  "category_primary",
  "category_detailed",
  "category_confidence",
  "spending_bucket",
  "pending",
  "removed",
  "cycle_id",
  "txn_type",
  "source",
  "superseded_by_id",
  "created_at",
  "updated_at",
  "raw_json",
] as const;

type ExportColumn = (typeof EXPORT_COLUMNS)[number];
export type TransactionExportRow = Record<ExportColumn, string | number | boolean | null>;

function isoDate(value: Date | null) {
  return value?.toISOString() ?? null;
}

function parseAmount(value?: string) {
  if (!value) return null;
  const amount = Number.parseFloat(value);
  return Number.isNaN(amount) ? null : amount;
}

export async function getTransactionExportRows(
  input: TransactionExportFilters
): Promise<TransactionExportRow[]> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: input.tenantSlug },
    select: { id: true },
  });
  if (!tenant) return [];

  const where: Prisma.PlaidTransactionWhereInput = {
    tenantId: tenant.id,
    removed: false,
  };

  if (input.q) {
    where.OR = [
      { name: { contains: input.q, mode: "insensitive" } },
      { merchantName: { contains: input.q, mode: "insensitive" } },
      { categoryPrimary: { contains: input.q, mode: "insensitive" } },
    ];
  }

  if (input.from || input.to) {
    where.date = {
      gte: input.from ? new Date(`${input.from}T00:00:00.000Z`) : undefined,
      lte: input.to ? new Date(`${input.to}T23:59:59.999Z`) : undefined,
    };
  }

  if (input.category) where.categoryPrimary = input.category;
  if (input.account) where.account = { is: { name: input.account } };
  if (input.pending === "true") where.pending = true;
  if (input.pending === "false") where.pending = false;

  const transactions = await prisma.plaidTransaction.findMany({
    where,
    orderBy: [{ date: "desc" }, { id: "desc" }],
    include: {
      account: {
        select: {
          plaidAccountId: true,
          name: true,
          officialName: true,
          type: true,
          subtype: true,
          mask: true,
        },
      },
      item: {
        select: {
          institutionName: true,
        },
      },
    },
  });

  const amountMin = parseAmount(input.amountMin);
  const amountMax = parseAmount(input.amountMax);

  return transactions.flatMap((transaction) => {
    const spendingBucket = categorizeForSpending(transaction);
    const amount = Number(transaction.amount);
    const absoluteAmount = Math.abs(amount);

    if (input.bucket && input.bucket !== spendingBucket) return [];
    if (amountMin !== null && absoluteAmount < amountMin) return [];
    if (amountMax !== null && absoluteAmount > amountMax) return [];

    return [
      {
        id: transaction.id,
        tenant_id: transaction.tenantId,
        item_id: transaction.itemId,
        institution_name: transaction.item.institutionName,
        account_id: transaction.accountId,
        plaid_account_id: transaction.account.plaidAccountId,
        account_name: transaction.account.name,
        account_official_name: transaction.account.officialName,
        account_type: transaction.account.type,
        account_subtype: transaction.account.subtype,
        account_mask: transaction.account.mask,
        plaid_transaction_id: transaction.plaidTransactionId,
        pending_transaction_id: transaction.pendingTransactionId,
        name: transaction.name,
        merchant_name: transaction.merchantName,
        display_name: transaction.merchantName ?? transaction.name,
        amount,
        iso_currency_code: transaction.isoCurrencyCode,
        unofficial_currency_code: transaction.unofficialCurrencyCode,
        date: transaction.date.toISOString(),
        authorized_date: isoDate(transaction.authorizedDate),
        datetime: isoDate(transaction.datetime),
        authorized_datetime: isoDate(transaction.authorizedDatetime),
        payment_channel: transaction.paymentChannel,
        category_primary: transaction.categoryPrimary,
        category_detailed: transaction.categoryDetailed,
        category_confidence: transaction.categoryConfidence,
        spending_bucket: spendingBucket,
        pending: transaction.pending,
        removed: transaction.removed,
        cycle_id: transaction.cycleId,
        txn_type: transaction.txnType,
        source: transaction.source,
        superseded_by_id: transaction.supersededById,
        created_at: transaction.createdAt.toISOString(),
        updated_at: transaction.updatedAt.toISOString(),
        raw_json: JSON.stringify(transaction.raw),
      },
    ];
  });
}

function csvCell(value: TransactionExportRow[ExportColumn]) {
  if (value == null) return "";

  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function transactionRowsToCsv(rows: TransactionExportRow[]) {
  const lines = [
    EXPORT_COLUMNS.join(","),
    ...rows.map((row) => EXPORT_COLUMNS.map((column) => csvCell(row[column])).join(",")),
  ];

  return `${lines.join("\r\n")}\r\n`;
}
