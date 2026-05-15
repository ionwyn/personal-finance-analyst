import { SyncSource, TenantKind, SyncRunStatus, SnapTradeConnectionStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { encryptToken } from "../security/token-crypto";

const DEMO_ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || "0123456789abcdef0123456789abcdef";

function encrypt(token: string): string {
  return encryptToken(token, DEMO_ENCRYPTION_KEY);
}

function getLastFriday(daysBack: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - daysBack);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 5 ? 0 : day === 6 ? -1 : 5 - day - 7);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function getDateDaysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function seedMockupDemo() {
  console.log("🌱 Seeding mockup demo data...");

  const existingTenant = await prisma.tenant.findUnique({ where: { slug: "demo" } });
  if (existingTenant) {
    console.log("  Wiping existing demo tenant...");
    const tenantId = existingTenant.id;

    const connIds = await prisma.snapTradeConnection.findMany({ where: { tenantId }, select: { id: true } }).then(c => c.map(x => x.id));

    await prisma.syncRun.deleteMany({ where: { tenantId } });
    await prisma.balanceSnapshot.deleteMany({ where: { tenantId } });
    await prisma.plaidTransaction.deleteMany({ where: { tenantId } });
    await prisma.plaidAccount.deleteMany({ where: { tenantId } });
    await prisma.plaidItem.deleteMany({ where: { tenantId } });
    await prisma.snapTradeSyncRun.deleteMany({ where: { tenantId } });
    await prisma.snapTradeCashBalance.deleteMany({ where: { tenantId } });
    await prisma.snapTradePosition.deleteMany({ where: { tenantId } });
    if (connIds.length > 0) {
      await prisma.snapTradeAccount.deleteMany({ where: { connectionId: { in: connIds } } });
    }
    await prisma.snapTradeConnection.deleteMany({ where: { tenantId } });
    await prisma.payCycle.deleteMany({ where: { tenantId } });
    await prisma.recurringExpense.deleteMany({ where: { tenantId } });
    await prisma.savingsDestination.deleteMany({ where: { tenantId } });
    await prisma.settlementPattern.deleteMany({ where: { tenantId } });
    await prisma.userSettings.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
  }

  const tenant = await prisma.tenant.create({
    data: {
      slug: "demo",
      name: "Sandbox Demo",
      kind: TenantKind.DEMO
    }
  });
  console.log(`  ✓ Created tenant: ${tenant.slug}`);

  const lastPaycheckDate = getLastFriday(7);
  await prisma.userSettings.create({
    data: {
      tenantId: tenant.id,
      payFrequencyDays: 14,
      lastPaycheckDate,
      employerMerchantPattern: "TD BANK PAYROLL",
      defaultFixedSavings: 200000
    }
  });

  const plaidItem = await prisma.plaidItem.create({
    data: {
      tenantId: tenant.id,
      plaidItemId: "item_mock_tdbank",
      institutionId: "ins_3",
      institutionName: "TD Canada Trust",
      accessTokenEncrypted: encrypt("access-sandbox-demo-tdbank"),
      syncCursor: null,
      status: "IDLE",
      lastSyncAt: new Date()
    }
  });

  const accounts = await Promise.all([
    prisma.plaidAccount.create({
      data: {
        tenantId: tenant.id,
        itemId: plaidItem.id,
        plaidAccountId: "acct_chequing",
        type: "depository",
        subtype: "checking",
        name: "TD Chequing",
        availableBalance: 8200,
        currentBalance: 8200,
        officialName: "TD Chequing Account"
      }
    }),
    prisma.plaidAccount.create({
      data: {
        tenantId: tenant.id,
        itemId: plaidItem.id,
        plaidAccountId: "acct_savings",
        type: "depository",
        subtype: "savings",
        name: "TD eSavings",
        availableBalance: 12500,
        currentBalance: 12500,
        officialName: "TD eSavings Account"
      }
    }),
    prisma.plaidAccount.create({
      data: {
        tenantId: tenant.id,
        itemId: plaidItem.id,
        plaidAccountId: "acct_visa",
        type: "credit",
        subtype: "credit card",
        name: "TD Visa",
        availableBalance: 23160,
        currentBalance: -1840,
        officialName: "TD Visa Credit Card"
      }
    })
  ]);

  const [chequing, savings, visa] = accounts;
  console.log(`  ✓ Created 3 PlaidAccounts`);

  const transactions: Parameters<typeof prisma.plaidTransaction.createMany>[0]["data"] = [];
  let txnId = 0;

  for (let i = 0; i < 13; i++) {
    const date = getLastFriday(180 - i * 14);
    transactions.push({
      tenantId: tenant.id,
      itemId: plaidItem.id,
      accountId: chequing.id,
      plaidTransactionId: `mock-txn-${txnId++}`,
      name: "TD Bank Payroll",
      merchantName: "TD BANK PAYROLL",
      amount: -4650.0,
      date,
      categoryPrimary: "INCOME",
      categoryDetailed: "INCOME_WAGES",
      pending: false,
      source: SyncSource.SEED,
      removed: false,
      raw: {}
    });
  }

  for (let i = 0; i < 6; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    date.setDate(1);
    transactions.push({
      tenantId: tenant.id,
      itemId: plaidItem.id,
      accountId: chequing.id,
      plaidTransactionId: `mock-txn-${txnId++}`,
      name: "Rent",
      merchantName: "FIDELITY REALTY GROUP",
      amount: 2500.0,
      date,
      categoryPrimary: "RENT_AND_UTILITIES",
      categoryDetailed: "RENT_AND_UTILITIES_RENT",
      pending: false,
      source: SyncSource.SEED,
      removed: false,
      raw: {}
    });
  }

  for (let i = 0; i < 6; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    date.setDate(5);
    transactions.push({
      tenantId: tenant.id,
      itemId: plaidItem.id,
      accountId: chequing.id,
      plaidTransactionId: `mock-txn-${txnId++}`,
      name: "Visa Payment",
      merchantName: "TD VISA PAYMENT",
      amount: 2000.0,
      date,
      categoryPrimary: "TRANSFER_OUT",
      categoryDetailed: "TRANSFER_OUT_ACCOUNT_TRANSFER",
      pending: false,
      source: SyncSource.SEED,
      removed: false,
      raw: {}
    });
  }

  for (let i = 0; i < 6; i++) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    date.setDate(15);
    transactions.push({
      tenantId: tenant.id,
      itemId: plaidItem.id,
      accountId: chequing.id,
      plaidTransactionId: `mock-txn-${txnId++}`,
      name: "Investment Transfer",
      merchantName: "QUESTRADE INC",
      amount: 2000.0,
      date,
      categoryPrimary: "TRANSFER_OUT",
      categoryDetailed: "TRANSFER_OUT_INVESTMENT_AND_RETIREMENT_FUNDS",
      pending: false,
      source: SyncSource.SEED,
      removed: false,
      raw: {}
    });
  }

  const subscriptions = [
    { name: "BELL CANADA", amount: 120, cat: "RENT_AND_UTILITIES", catDetail: "RENT_AND_UTILITIES_UTILITIES" },
    { name: "NETFLIX", amount: 18.99, cat: "ENTERTAINMENT", catDetail: "ENTERTAINMENT_STREAMING_AND_DOWNLOADS" },
    { name: "SPOTIFY", amount: 10.99, cat: "ENTERTAINMENT", catDetail: "ENTERTAINMENT_STREAMING_AND_DOWNLOADS" },
    { name: "GOODLIFE FITNESS", amount: 59.99, cat: "PERSONAL_CARE", catDetail: "PERSONAL_CARE_GYMS_AND_FITNESS" }
  ];

  for (const sub of subscriptions) {
    for (let i = 0; i < 6; i++) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      date.setDate(10 + Math.floor(Math.random() * 5));
      transactions.push({
        tenantId: tenant.id,
        itemId: plaidItem.id,
        accountId: visa.id,
        plaidTransactionId: `mock-txn-${txnId++}`,
        name: sub.name,
        merchantName: sub.name,
        amount: sub.amount,
        date,
        categoryPrimary: sub.cat,
        categoryDetailed: sub.catDetail,
        pending: false,
        source: SyncSource.SEED,
        removed: false,
        raw: {}
      });
    }
  }

  const foodPlaces = [
    { name: "STARBUCKS", min: 6, max: 15 },
    { name: "TIM HORTONS", min: 3, max: 8 },
    { name: "LCBO", min: 25, max: 60 },
    { name: "LOBLAWS", min: 80, max: 140 },
    { name: "FOOD BASICS", min: 40, max: 90 },
    { name: "RESTAURANT", min: 30, max: 90 },
    { name: "MCDONALDS", min: 10, max: 20 }
  ];

  for (let i = 0; i < 100; i++) {
    const daysBack = Math.floor(Math.random() * 180);
    const place = foodPlaces[Math.floor(Math.random() * foodPlaces.length)];
    const amount = place.min + Math.random() * (place.max - place.min);

    transactions.push({
      tenantId: tenant.id,
      itemId: plaidItem.id,
      accountId: visa.id,
      plaidTransactionId: `mock-txn-${txnId++}`,
      name: place.name,
      merchantName: place.name,
      amount: parseFloat(amount.toFixed(2)),
      date: getDateDaysAgo(daysBack),
      categoryPrimary: "FOOD_AND_DRINK",
      categoryDetailed: "FOOD_AND_DRINK_RESTAURANTS",
      pending: false,
      source: SyncSource.SEED,
      removed: false,
      raw: {}
    });
  }

  for (let i = 0; i < 48; i++) {
    const daysBack = Math.floor(Math.random() * 180);
    const isPresto = Math.random() < 0.15;
    const merchant = isPresto ? "PRESTO CARD" : "UBER CANADA";
    transactions.push({
      tenantId: tenant.id,
      itemId: plaidItem.id,
      accountId: visa.id,
      plaidTransactionId: `mock-txn-${txnId++}`,
      name: merchant,
      merchantName: merchant,
      amount: isPresto ? 50 : 12 + Math.random() * 23,
      date: getDateDaysAgo(daysBack),
      categoryPrimary: "TRANSPORTATION",
      categoryDetailed: isPresto ? "TRANSPORTATION_PUBLIC_TRANSIT" : "TRANSPORTATION_TAXIS_AND_RIDE_SHARING",
      pending: false,
      source: SyncSource.SEED,
      removed: false,
      raw: {}
    });
  }

  const shopping = [
    { name: "AMAZON.CA", min: 20, max: 150, cat: "GENERAL_MERCHANDISE_ONLINE_MARKETPLACES" },
    { name: "REXALL DRUG STORE", min: 15, max: 45, cat: "PERSONAL_CARE_DRUGSTORES" }
  ];

  for (let i = 0; i < 36; i++) {
    const daysBack = Math.floor(Math.random() * 180);
    const place = shopping[Math.floor(Math.random() * shopping.length)];
    const amount = place.min + Math.random() * (place.max - place.min);

    transactions.push({
      tenantId: tenant.id,
      itemId: plaidItem.id,
      accountId: visa.id,
      plaidTransactionId: `mock-txn-${txnId++}`,
      name: place.name,
      merchantName: place.name,
      amount: parseFloat(amount.toFixed(2)),
      date: getDateDaysAgo(daysBack),
      categoryPrimary: "GENERAL_MERCHANDISE",
      categoryDetailed: place.cat,
      pending: false,
      source: SyncSource.SEED,
      removed: false,
      raw: {}
    });
  }

  await prisma.plaidTransaction.createMany({ data: transactions });
  console.log(`  ✓ Created ${transactions.length} PlaidTransactions`);

  const snapshots: Parameters<typeof prisma.balanceSnapshot.createMany>[0]["data"] = [];
  const accountTxnsByDay: Record<string, Record<string, number>> = {};

  for (const txn of transactions) {
    const dayKey = txn.date.toISOString().split("T")[0];
    accountTxnsByDay[dayKey] ??= {};
    accountTxnsByDay[dayKey][txn.plaidAccountId] ??= 0;
    accountTxnsByDay[dayKey][txn.plaidAccountId] += txn.amount;
  }

  const accountBalances: Record<string, number> = {
    [chequing.id]: 8200,
    [savings.id]: 12500,
    [visa.id]: -1840
  };

  for (let daysBack = 180; daysBack >= 0; daysBack--) {
    const date = getDateDaysAgo(daysBack);
    const dayKey = date.toISOString().split("T")[0];

    if (accountTxnsByDay[dayKey]) {
      for (const accId of Object.keys(accountBalances)) {
        accountBalances[accId] -= accountTxnsByDay[dayKey][accId] ?? 0;
      }
    }

    for (const accId of Object.keys(accountBalances)) {
      snapshots.push({
        tenantId: tenant.id,
        accountId: accId,
        availableBalance: accountBalances[accId],
        currentBalance: accountBalances[accId],
        capturedAt: date,
        raw: {}
      });
    }
  }

  await prisma.balanceSnapshot.createMany({ data: snapshots });
  console.log(`  ✓ Created ${snapshots.length} BalanceSnapshots`);

  await prisma.syncRun.create({
    data: {
      tenantId: tenant.id,
      itemId: plaidItem.id,
      source: SyncSource.SEED,
      status: SyncRunStatus.SUCCESS,
      addedCount: transactions.length,
      modifiedCount: 0,
      removedCount: 0
    }
  });

  const connection = await prisma.snapTradeConnection.create({
    data: {
      tenantId: tenant.id,
      snapTradeAuthorizationId: "mock-qt-auth-001",
      brokerageName: "Questrade",
      brokerageSlug: "QUESTRADE",
      status: SnapTradeConnectionStatus.IDLE,
      disabled: false,
      lastSyncAt: new Date()
    }
  });

  console.log(`  ✓ Created SnapTradeConnection`);

  const snapTradeAccounts = await Promise.all([
    prisma.snapTradeAccount.create({
      data: {
        tenantId: tenant.id,
        connectionId: connection.id,
        snapTradeAccountId: "acct-tfsa",
        rawType: "TFSA",
        accountCategory: "TFSA",
        totalValue: 95000,
        isPaper: false,
        holdingsInitialSyncComplete: true,
        name: "Questrade TFSA"
      }
    }),
    prisma.snapTradeAccount.create({
      data: {
        tenantId: tenant.id,
        connectionId: connection.id,
        snapTradeAccountId: "acct-rrsp",
        rawType: "RRSP",
        accountCategory: "RRSP",
        totalValue: 80000,
        isPaper: false,
        holdingsInitialSyncComplete: true,
        name: "Questrade RRSP"
      }
    }),
    prisma.snapTradeAccount.create({
      data: {
        tenantId: tenant.id,
        connectionId: connection.id,
        snapTradeAccountId: "acct-nonreg",
        rawType: "Individual",
        accountCategory: "Individual",
        totalValue: 27000,
        isPaper: false,
        holdingsInitialSyncComplete: true,
        name: "Questrade Non-Registered"
      }
    })
  ]);

  const [tfsaAcc, rrspAcc, nonregAcc] = snapTradeAccounts;
  console.log(`  ✓ Created 3 SnapTradeAccounts`);

  const usdToCAD = 1.38;

  const positions: Parameters<typeof prisma.snapTradePosition.createMany>[0]["data"] = [
    { snapTradeAccountId: tfsaAcc.id, symbol: "QQQ", rawSymbol: "QQQ", assetType: "et", exchange: "ARCA", currency: "USD", units: 35, price: 538.42, avgCost: 494.18 },
    { snapTradeAccountId: tfsaAcc.id, symbol: "SPY", rawSymbol: "SPY", assetType: "et", exchange: "ARCA", currency: "USD", units: 20, price: 568.25, avgCost: 527.12 },
    { snapTradeAccountId: tfsaAcc.id, symbol: "XIC.TO", rawSymbol: "XIC", assetType: "et", exchange: "TSX", currency: "CAD", units: 400, price: 34.15, avgCost: 29.5 },
    { snapTradeAccountId: tfsaAcc.id, symbol: "XUU.TO", rawSymbol: "XUU", assetType: "et", exchange: "TSX", currency: "CAD", units: 600, price: 44.8, avgCost: 38.2 },
    { snapTradeAccountId: tfsaAcc.id, symbol: "BND", rawSymbol: "BND", assetType: "et", exchange: "BATS", currency: "USD", units: 80, price: 81.22, avgCost: 83.67 },
    { snapTradeAccountId: rrspAcc.id, symbol: "AAPL", rawSymbol: "AAPL", assetType: "cs", exchange: "NASDAQ", currency: "USD", units: 40, price: 227.45, avgCost: 189.22 },
    { snapTradeAccountId: rrspAcc.id, symbol: "MSFT", rawSymbol: "MSFT", assetType: "cs", exchange: "NASDAQ", currency: "USD", units: 20, price: 415.3, avgCost: 363.45 },
    { snapTradeAccountId: rrspAcc.id, symbol: "NVDA", rawSymbol: "NVDA", assetType: "cs", exchange: "NASDAQ", currency: "USD", units: 25, price: 214.82, avgCost: 158.34 },
    { snapTradeAccountId: rrspAcc.id, symbol: "VTI", rawSymbol: "VTI", assetType: "et", exchange: "ARCA", currency: "USD", units: 25, price: 363.48, avgCost: 324.22 },
    { snapTradeAccountId: rrspAcc.id, symbol: "IVV", rawSymbol: "IVV", assetType: "et", exchange: "BATS", currency: "USD", units: 18, price: 568.15, avgCost: 530.27 },
    { snapTradeAccountId: rrspAcc.id, symbol: "RY.TO", rawSymbol: "RY", assetType: "cs", exchange: "TSX", currency: "CAD", units: 100, price: 175.4, avgCost: 165.5 },
    { snapTradeAccountId: nonregAcc.id, symbol: "META", rawSymbol: "META", assetType: "cs", exchange: "NASDAQ", currency: "USD", units: 8, price: 611.25, avgCost: 550.75 },
    { snapTradeAccountId: nonregAcc.id, symbol: "GOOG", rawSymbol: "GOOG", assetType: "cs", exchange: "NASDAQ", currency: "USD", units: 10, price: 396.45, avgCost: 357.29 },
    { snapTradeAccountId: nonregAcc.id, symbol: "TSLA", rawSymbol: "TSLA", assetType: "cs", exchange: "NASDAQ", currency: "USD", units: 15, price: 427.15, avgCost: 505.12 },
    { snapTradeAccountId: nonregAcc.id, symbol: "TD.TO", rawSymbol: "TD", assetType: "cs", exchange: "TSX", currency: "CAD", units: 50, price: 81.6, avgCost: 76.8 }
  ].map((p) => {
    const marketValueNative = p.units * p.price;
    const costNative = p.units * p.avgCost;
    const multiplier = p.currency === "USD" ? usdToCAD : 1;
    const marketValueCad = marketValueNative * multiplier;
    const costCad = costNative * multiplier;
    const pnlCad = marketValueCad - costCad;
    const pnlPct = costCad > 0 ? (pnlCad / costCad) * 100 : 0;

    return {
      tenantId: tenant.id,
      accountId: p.snapTradeAccountId,
      symbol: p.symbol,
      rawSymbol: p.rawSymbol,
      assetType: p.assetType,
      exchange: p.exchange,
      currency: p.currency,
      units: p.units,
      price: p.price,
      avgCost: p.avgCost,
      marketValueNative,
      marketValueCad,
      costNative,
      costCad,
      pnlCad,
      pnlPct
    };
  });

  await prisma.snapTradePosition.createMany({ data: positions });
  console.log(`  ✓ Created ${positions.length} SnapTradePositions`);

  await prisma.snapTradeCashBalance.createMany({
    data: [
      { tenantId: tenant.id, accountId: tfsaAcc.id, currency: "CAD", cash: 3796, cashCad: 3796, buyingPower: 3796 },
      { tenantId: tenant.id, accountId: rrspAcc.id, currency: "CAD", cash: 4000, cashCad: 4000, buyingPower: 4000 },
      { tenantId: tenant.id, accountId: nonregAcc.id, currency: "CAD", cash: 1850, cashCad: 1850, buyingPower: 1850 },
      { tenantId: tenant.id, accountId: nonregAcc.id, currency: "USD", cash: 1200, cashCad: 1656, buyingPower: 2400 }
    ]
  });

  await prisma.snapTradeFxRate.upsert({
    where: { pair: "USD-CAD" },
    create: {
      pair: "USD-CAD",
      sourceCurrency: "USD",
      targetCurrency: "CAD",
      rate: usdToCAD,
      fetchedAt: new Date()
    },
    update: {
      rate: usdToCAD,
      fetchedAt: new Date()
    }
  });

  const cycles: Parameters<typeof prisma.payCycle.createMany>[0]["data"] = [];
  for (let i = 0; i < 13; i++) {
    const endDate = getLastFriday(i * 14);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 14);

    cycles.push({
      tenantId: tenant.id,
      startDate,
      endDate,
      incomeReceived: 4650,
      fixedSavingsPull: 2000,
      sweptAmount: 0,
      carryover: 0
    });
  }
  await prisma.payCycle.createMany({ data: cycles });
  console.log(`  ✓ Created ${cycles.length} PayCycles`);

  await prisma.recurringExpense.createMany({
    data: [
      { tenantId: tenant.id, name: "Rent", merchantPattern: "FIDELITY REALTY", amount: 2500, frequency: "monthly", anchorDate: 1, accrualPerCycle: 2500 },
      { tenantId: tenant.id, name: "Questrade Transfer", merchantPattern: "QUESTRADE", amount: 2000, frequency: "monthly", anchorDate: 15, accrualPerCycle: 2000 },
      { tenantId: tenant.id, name: "Bell Canada", merchantPattern: "BELL CANADA", amount: 120, frequency: "monthly", anchorDate: 10, accrualPerCycle: 120 }
    ]
  });

  await prisma.savingsDestination.createMany({
    data: [{ tenantId: tenant.id, accountName: "Questrade", matchPattern: "QUESTRADE", label: "investing" }]
  });

  await prisma.settlementPattern.createMany({
    data: [
      { tenantId: tenant.id, label: "TD Visa payment", matchPattern: "TD VISA PAYMENT" },
      { tenantId: tenant.id, label: "Credit card payment", matchPattern: "CREDIT CARD PAYMENT" },
      { tenantId: tenant.id, label: "Remboursement (FR)", matchPattern: "REMBOURSEMENT" }
    ]
  });

  console.log("\n✅ Demo data seeded successfully!");
  console.log(`   Tenant: ${tenant.slug}`);
  console.log(`   Plaid: 3 accounts, ${transactions.length} transactions, ${snapshots.length} balance snapshots`);
  console.log(`   SnapTrade: 3 accounts, ${positions.length} positions`);
}