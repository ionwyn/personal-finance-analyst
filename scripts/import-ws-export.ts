import "dotenv/config";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { Prisma, TenantKind } from "@prisma/client";

import {
  commitCanonicalCsvEntries,
  previewCanonicalCsvEntries,
  type CanonicalCsvEntry,
} from "../src/lib/investments/csv-ledger-service";
import { prisma } from "../src/lib/prisma";

const CSV_COLUMNS = [
  "transaction_date",
  "settlement_date",
  "account_id",
  "account_type",
  "activity_type",
  "activity_sub_type",
  "direction",
  "symbol",
  "name",
  "currency",
  "quantity",
  "unit_price",
  "commission",
  "net_cash_amount",
] as const;

type CsvColumn = (typeof CSV_COLUMNS)[number];
type CsvRow = Record<CsvColumn, string>;

type ParsedRow = {
  sourceLine: number;
  raw: CsvRow;
  tradeDate: Date;
  settlementDate: Date | null;
  units: Prisma.Decimal;
  unitPrice: Prisma.Decimal | null;
  sourceCashAmount: Prisma.Decimal | null;
};

const EXCLUDED_ACCOUNT_TYPES = new Set(["Chequing", "Smart Savings"]);
const UNIT_AFFECTING_TYPES = new Set([
  "Trade\0BUY",
  "Trade\0SELL",
  "StockDividend\0",
  "LegacyCorporateAction\0SPLIT",
  "LegacyCorporateAction\0NAME_CHANGE",
  "InternalSecurityTransfer\0",
]);
const KNOWN_ACTIVITY_TYPES = new Set([
  "MoneyMovement\0EFT",
  "MoneyMovement\0TRANSFER_TF",
  "MoneyMovement\0TRANSFER",
  "MoneyMovement\0SPEND",
  "Trade\0BUY",
  "Trade\0SELL",
  "Dividend\0",
  "StockDividend\0",
  "Interest\0",
  "Fee\0",
  "AdministrativePayment\0MANAGEMENT_FEE_REFUND",
  "BonusPayment\0CASHBACK",
  "BonusPayment\0GIVEAWAY",
  "BonusPayment\0PROMOTION",
  "Reimbursement\0",
  "LegacyCorporateAction\0SPLIT",
  "LegacyCorporateAction\0NAME_CHANGE",
  "InternalSecurityTransfer\0",
]);
const SHARE_TOLERANCE = new Prisma.Decimal("0.01");
const CASH_TOLERANCE = new Prisma.Decimal("0.01");

function parseArguments() {
  const values = new Map<string, string>();

  for (let index = 2; index < process.argv.length; index += 1) {
    const argument = process.argv[index];
    if (!argument?.startsWith("--")) {
      throw new Error(`Unexpected argument: ${argument ?? ""}`);
    }

    const value = process.argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`${argument} requires a value`);
    }

    values.set(argument.slice(2), value);
    index += 1;
  }

  const file = values.get("file");
  if (!file) {
    throw new Error("Usage: npm run import:ws-export -- --file <path> [--tenant <id-or-slug>]");
  }

  return {
    file: resolve(file),
    tenant: values.get("tenant") ?? null,
  };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.endsWith("\r") ? field.slice(0, -1) : field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) {
    throw new Error("CSV ends inside a quoted field");
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field.endsWith("\r") ? field.slice(0, -1) : field);
    rows.push(row);
  }

  return rows;
}

function validateHeader(header: string[]) {
  const normalized = [...header];
  if (normalized[0]?.startsWith("\uFEFF")) {
    normalized[0] = normalized[0].slice(1);
  }

  if (
    normalized.length !== CSV_COLUMNS.length ||
    normalized.some((column, index) => column !== CSV_COLUMNS[index])
  ) {
    throw new Error(
      `Unexpected CSV header. Expected: ${CSV_COLUMNS.join(",")}; received: ${normalized.join(",")}`
    );
  }
}

function csvRow(cells: string[]): CsvRow {
  return Object.fromEntries(
    CSV_COLUMNS.map((column, index) => [column, cells[index] ?? ""])
  ) as CsvRow;
}

function parseDate(value: string, label: string, sourceLine: number): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid ${label} on CSV line ${sourceLine}: ${value || "(blank)"}`);
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`Invalid ${label} on CSV line ${sourceLine}: ${value}`);
  }
  return parsed;
}

function parseOptionalDate(value: string, label: string, sourceLine: number): Date | null {
  return value ? parseDate(value, label, sourceLine) : null;
}

function parseDecimal(value: string, label: string, sourceLine: number): Prisma.Decimal {
  if (!value) {
    throw new Error(`Missing ${label} on CSV line ${sourceLine}`);
  }
  try {
    return new Prisma.Decimal(value);
  } catch {
    throw new Error(`Invalid ${label} on CSV line ${sourceLine}: ${value}`);
  }
}

function parseOptionalDecimal(
  value: string,
  label: string,
  sourceLine: number
): Prisma.Decimal | null {
  return value ? parseDecimal(value, label, sourceLine) : null;
}

function activityKey(row: CsvRow) {
  return `${row.activity_type}\0${row.activity_sub_type}`;
}

function normalizeSymbol(symbol: string | null | undefined) {
  const normalized = symbol?.trim().toUpperCase() ?? "";
  return normalized ? normalized.replace(/\.TO$/, "") : null;
}

function addAmount(amounts: Map<string, Prisma.Decimal>, key: string, amount: Prisma.Decimal) {
  amounts.set(key, (amounts.get(key) ?? new Prisma.Decimal(0)).add(amount));
}

function nonZeroHoldings(amounts: Map<string, Prisma.Decimal>) {
  return new Map([...amounts].filter(([, amount]) => amount.abs().greaterThan(SHARE_TOLERANCE)));
}

function reconstructAccountHoldings(rows: ParsedRow[]) {
  const holdings = new Map<string, Prisma.Decimal>();

  for (const row of rows) {
    if (!UNIT_AFFECTING_TYPES.has(activityKey(row.raw))) continue;
    const symbol = normalizeSymbol(row.raw.symbol);
    if (!symbol) {
      throw new Error(`Unit-affecting row has no symbol on CSV line ${row.sourceLine}`);
    }
    addAmount(holdings, symbol, row.units);
  }

  return nonZeroHoldings(holdings);
}

function currentAccountHoldings(positions: Array<{ symbol: string; units: Prisma.Decimal }>) {
  const holdings = new Map<string, Prisma.Decimal>();
  for (const position of positions) {
    const symbol = normalizeSymbol(position.symbol);
    if (symbol) addAmount(holdings, symbol, position.units);
  }
  return nonZeroHoldings(holdings);
}

function holdingsMatch(
  exported: Map<string, Prisma.Decimal>,
  positions: Array<{ symbol: string; units: Prisma.Decimal }>
) {
  const current = currentAccountHoldings(positions);
  const symbols = new Set([...exported.keys(), ...current.keys()]);

  for (const symbol of symbols) {
    const difference = (exported.get(symbol) ?? new Prisma.Decimal(0)).sub(
      current.get(symbol) ?? new Prisma.Decimal(0)
    );
    if (difference.abs().greaterThan(SHARE_TOLERANCE)) return false;
  }
  return true;
}

async function resolveTenant(identifier: string | null) {
  if (identifier) {
    const tenant = await prisma.tenant.findFirst({
      where: { OR: [{ id: identifier }, { slug: identifier }] },
      select: { id: true, slug: true },
    });
    if (!tenant) throw new Error(`Tenant not found: ${identifier}`);
    return tenant;
  }

  const tenants = await prisma.tenant.findMany({
    where: { kind: TenantKind.PERSONAL },
    select: { id: true, slug: true },
  });
  if (tenants.length !== 1) {
    throw new Error(
      `Expected exactly one PERSONAL tenant, found ${tenants.length}; pass --tenant <id-or-slug>`
    );
  }
  return tenants[0]!;
}

async function matchAccounts(tenantId: string, rows: ParsedRow[]) {
  const rowsByExternalId = new Map<string, ParsedRow[]>();
  for (const row of rows) {
    const accountRows = rowsByExternalId.get(row.raw.account_id) ?? [];
    accountRows.push(row);
    rowsByExternalId.set(row.raw.account_id, accountRows);
  }

  const accountTypes = [...new Set(rows.map((row) => row.raw.account_type))];
  const candidates = await prisma.snapTradeAccount.findMany({
    where: {
      tenantId,
      rawType: { in: accountTypes },
    },
    select: {
      id: true,
      name: true,
      rawType: true,
      unifiedAccountType: true,
      positions: {
        select: {
          symbol: true,
          units: true,
        },
      },
    },
  });
  const priorLedgerMappings = await prisma.brokerLedgerEntry.findMany({
    where: {
      tenantId,
      accountExternalId: { in: [...rowsByExternalId.keys()] },
      accountId: { not: null },
    },
    select: {
      accountExternalId: true,
      accountId: true,
    },
  });

  const sourceAccounts = [...rowsByExternalId].map(([externalId, accountRows]) => ({
    externalId,
    accountType: accountRows[0]!.raw.account_type,
    holdings: reconstructAccountHoldings(accountRows),
  }));
  sourceAccounts.sort((left, right) => right.holdings.size - left.holdings.size);

  const usedAccountIds = new Set<string>();
  const matches = new Map<string, (typeof candidates)[number]>();
  const priorIdsByExternalId = new Map<string, Set<string>>();
  for (const mapping of priorLedgerMappings) {
    if (!mapping.accountId) continue;
    const accountIds = priorIdsByExternalId.get(mapping.accountExternalId) ?? new Set<string>();
    accountIds.add(mapping.accountId);
    priorIdsByExternalId.set(mapping.accountExternalId, accountIds);
  }

  for (const source of sourceAccounts) {
    const priorIds = priorIdsByExternalId.get(source.externalId);
    if (priorIds) {
      if (priorIds.size !== 1) {
        throw new Error(
          `Export account ${source.externalId} is already mapped to multiple SnapTrade accounts: ${[...priorIds].join(", ")}`
        );
      }

      const priorId = [...priorIds][0]!;
      const priorMatch = candidates.find((candidate) => candidate.id === priorId);
      if (!priorMatch) {
        throw new Error(
          `Previously matched SnapTrade account ${priorId} is unavailable for export account ${source.externalId}`
        );
      }
      if (usedAccountIds.has(priorId)) {
        throw new Error(`SnapTrade account ${priorId} is mapped to multiple export accounts`);
      }

      usedAccountIds.add(priorId);
      matches.set(source.externalId, priorMatch);
      continue;
    }

    const matching = candidates.filter(
      (candidate) =>
        !usedAccountIds.has(candidate.id) &&
        candidate.rawType?.toUpperCase() === source.accountType.toUpperCase() &&
        holdingsMatch(source.holdings, candidate.positions)
    );

    if (matching.length !== 1) {
      const candidateSummary = candidates
        .filter(
          (candidate) => candidate.rawType?.toUpperCase() === source.accountType.toUpperCase()
        )
        .map(
          (candidate) =>
            `${candidate.id} (${candidate.unifiedAccountType ?? candidate.rawType}, ${currentAccountHoldings(candidate.positions).size} held symbols)`
        )
        .join(", ");
      throw new Error(
        `Could not uniquely match export account ${source.externalId} (${source.accountType}, ${source.holdings.size} held symbols). Matching candidates: ${matching.length}. Available: ${candidateSummary || "none"}`
      );
    }

    const match = matching[0]!;
    usedAccountIds.add(match.id);
    matches.set(source.externalId, match);
  }

  return matches;
}

function verifyInternalTransfers(rows: ParsedRow[]) {
  let transferCash = new Prisma.Decimal(0);
  const transferUnits = new Map<string, Prisma.Decimal>();

  for (const row of rows) {
    if (row.raw.activity_type === "MoneyMovement" && row.raw.activity_sub_type === "TRANSFER_TF") {
      transferCash = transferCash.add(row.sourceCashAmount ?? new Prisma.Decimal(0));
    }

    if (row.raw.activity_type === "InternalSecurityTransfer") {
      const symbol = normalizeSymbol(row.raw.symbol);
      if (!symbol) {
        throw new Error(`Internal security transfer has no symbol on CSV line ${row.sourceLine}`);
      }
      addAmount(transferUnits, symbol, row.units);
    }
  }

  const unmatchedUnits = [...transferUnits].filter(([, units]) =>
    units.abs().greaterThan(SHARE_TOLERANCE)
  );
  if (transferCash.abs().greaterThan(CASH_TOLERANCE)) {
    throw new Error(`TRANSFER_TF entries do not net to zero: ${transferCash.toString()} CAD`);
  }
  if (unmatchedUnits.length > 0) {
    throw new Error(
      `InternalSecurityTransfer entries do not net to zero: ${unmatchedUnits
        .map(([symbol, units]) => `${symbol}=${units.toString()}`)
        .join(", ")}`
    );
  }

  return {
    transferCash,
    transferSymbolCount: transferUnits.size,
  };
}

function canonicalRow(row: CsvRow) {
  return JSON.stringify(CSV_COLUMNS.map((column) => row[column]));
}

function dedupeKey(tenantId: string, canonical: string, occurrence: number) {
  return createHash("sha256")
    .update(["wealthsimple-activities-v1", tenantId, canonical, String(occurrence)].join("\0"))
    .digest("hex");
}

async function main() {
  const arguments_ = parseArguments();
  const tenant = await resolveTenant(arguments_.tenant);
  const content = await readFile(arguments_.file, "utf8");
  const matrix = parseCsv(content);
  const header = matrix.shift();
  if (!header) throw new Error("CSV is empty");
  validateHeader(header);

  const includedRows: ParsedRow[] = [];
  let excludedRows = 0;
  let nonDataRows = 0;

  for (let index = 0; index < matrix.length; index += 1) {
    const cells = matrix[index]!;
    const sourceLine = index + 2;
    if (
      (cells.length === 1 && cells[0]?.trim() === "") ||
      (cells.length === 1 && cells[0]?.startsWith("As of "))
    ) {
      nonDataRows += 1;
      continue;
    }
    if (cells.length !== CSV_COLUMNS.length) {
      throw new Error(
        `CSV line ${sourceLine} has ${cells.length} columns; expected ${CSV_COLUMNS.length}`
      );
    }

    const raw = csvRow(cells);
    if (!KNOWN_ACTIVITY_TYPES.has(activityKey(raw))) {
      throw new Error(
        `Unknown activity taxonomy on CSV line ${sourceLine}: ${raw.activity_type}/${raw.activity_sub_type}`
      );
    }

    const parsed: ParsedRow = {
      sourceLine,
      raw,
      tradeDate: parseDate(raw.transaction_date, "transaction_date", sourceLine),
      settlementDate: parseOptionalDate(raw.settlement_date, "settlement_date", sourceLine),
      units: parseDecimal(raw.quantity, "quantity", sourceLine),
      unitPrice: parseOptionalDecimal(raw.unit_price, "unit_price", sourceLine),
      sourceCashAmount: parseOptionalDecimal(raw.net_cash_amount, "net_cash_amount", sourceLine),
    };

    if (EXCLUDED_ACCOUNT_TYPES.has(raw.account_type)) {
      excludedRows += 1;
      continue;
    }
    includedRows.push(parsed);
  }

  const transferGuard = verifyInternalTransfers(includedRows);
  const accountMatches = await matchAccounts(tenant.id, includedRows);
  const occurrences = new Map<string, number>();

  const entries = includedRows.map((row): CanonicalCsvEntry => {
    const canonical = canonicalRow(row.raw);
    const occurrence = (occurrences.get(canonical) ?? 0) + 1;
    occurrences.set(canonical, occurrence);

    const account = accountMatches.get(row.raw.account_id);
    if (!account) {
      throw new Error(`No account match for export account ${row.raw.account_id}`);
    }

    const symbol = row.raw.symbol.trim() || null;
    return {
      tenantId: tenant.id,
      accountId: account.id,
      accountExternalId: row.raw.account_id,
      accountType: row.raw.account_type,
      tradeDate: row.tradeDate,
      settlementDate: row.settlementDate,
      activityType: row.raw.activity_type,
      activitySubType: row.raw.activity_sub_type || null,
      symbol,
      symbolNorm: normalizeSymbol(symbol),
      name: row.raw.name || null,
      currency: row.raw.currency || null,
      units: row.units,
      unitPrice: row.unitPrice,
      cashAmount: row.sourceCashAmount?.negated() ?? null,
      dedupeKey: dedupeKey(tenant.id, canonical, occurrence),
      raw: row.raw,
    };
  });

  const preview = await previewCanonicalCsvEntries(entries);
  const result = await commitCanonicalCsvEntries(entries);

  console.log(`Imported Wealthsimple ledger for tenant ${tenant.slug} (${tenant.id})`);
  for (const [externalId, account] of [...accountMatches].sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    console.log(
      `  ${externalId} -> ${account.id} (${account.unifiedAccountType ?? account.rawType ?? account.name})`
    );
  }
  console.log(
    `Transfer guards: TRANSFER_TF=${transferGuard.transferCash.toFixed(2)} CAD, InternalSecurityTransfer symbols=${transferGuard.transferSymbolCount}`
  );
  console.log(
    `Preview: existing=${preview.existingCount} overlap=${preview.linkedCount} new=${preview.newCount} conflicts=${preview.conflictCount}`
  );
  console.log(
    `Rows: inserted=${result.inserted} updated=${result.updated} linked=${result.linked} conflicts=${result.conflicts} skipped=${excludedRows + nonDataRows} (excluded=${excludedRows}, nonData=${nonDataRows})`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
