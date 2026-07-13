import {
  BrokerLedgerIngestionMode,
  Prisma,
  SyncSource,
  TenantKind,
  SyncRunStatus,
  SnapTradeConnectionStatus,
} from "@prisma/client";
import { canonicalizeSnapTradeActivities } from "../investments/ledger-sync";
import { prisma } from "../prisma";
import { encryptToken } from "../security/token-crypto";

type SeedPosition = {
  snapTradeAccountId: string;
  symbol: string;
  rawSymbol: string;
  assetType: string;
  exchange: string;
  currency: string;
  units: number;
  price: number;
  avgCost: number;
};

type SeedMerchant = {
  name: string;
  min: number;
  max: number;
  primary: string;
  detailed: string;
  mcc: string;
  accountId?: string;
};

function encrypt(token: string): string {
  return encryptToken(token);
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

    const connIds = await prisma.snapTradeConnection
      .findMany({ where: { tenantId }, select: { id: true } })
      .then((c) => c.map((x) => x.id));

    await prisma.syncRun.deleteMany({ where: { tenantId } });
    await prisma.balanceSnapshot.deleteMany({ where: { tenantId } });
    await prisma.committedSettlement.deleteMany({ where: { tenantId } });
    await prisma.plaidTransaction.deleteMany({ where: { tenantId } });
    await prisma.plaidAccount.deleteMany({ where: { tenantId } });
    await prisma.plaidItem.deleteMany({ where: { tenantId } });
    await prisma.snapTradeSyncRun.deleteMany({ where: { tenantId } });
    await prisma.portfolioPerformancePoint.deleteMany({ where: { tenantId } });
    await prisma.portfolioPerformanceSummary.deleteMany({ where: { tenantId } });
    await prisma.brokerLedgerSourceRecord.deleteMany({ where: { tenantId } });
    await prisma.brokerLedgerEntry.deleteMany({ where: { tenantId } });
    await prisma.brokerLedgerIngestionRun.deleteMany({ where: { tenantId } });
    await prisma.brokerLedgerCoverage.deleteMany({ where: { tenantId } });
    await prisma.snapTradeActivity.deleteMany({ where: { tenantId } });
    await prisma.snapTradeCashBalance.deleteMany({ where: { tenantId } });
    await prisma.snapTradePosition.deleteMany({ where: { tenantId } });
    if (connIds.length > 0) {
      await prisma.snapTradeAccount.deleteMany({ where: { connectionId: { in: connIds } } });
    }
    await prisma.snapTradeConnection.deleteMany({ where: { tenantId } });
    await prisma.budget.deleteMany({ where: { tenantId } });
    await prisma.savingsGoal.deleteMany({ where: { tenantId } });
    await prisma.payCycle.deleteMany({ where: { tenantId } });
    await prisma.recurringExpense.deleteMany({ where: { tenantId } });
    await prisma.savingsDestination.deleteMany({ where: { tenantId } });
    await prisma.settlementPattern.deleteMany({ where: { tenantId } });
    await prisma.incomeSource.deleteMany({ where: { tenantId } });
    await prisma.watchlistItem.deleteMany({ where: { tenantId } });
    await prisma.userSettings.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
  }

  const tenant = await prisma.tenant.create({
    data: {
      slug: "demo",
      name: "Sandbox Demo",
      kind: TenantKind.DEMO,
    },
  });
  console.log(`  ✓ Created tenant: ${tenant.slug}`);

  const lastPaycheckDate = getLastFriday(7);
  await prisma.userSettings.create({
    data: {
      tenantId: tenant.id,
      payFrequencyDays: 14,
      lastPaycheckDate,
      defaultFixedSavings: 200000,
    },
  });

  // Income is classified via IncomeSource patterns (supersedes the single
  // employerMerchantPattern). Matching credits become txnType=income.
  await prisma.incomeSource.create({
    data: {
      tenantId: tenant.id,
      label: "Primary employer",
      matchPattern: "TD BANK PAYROLL",
    },
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
      lastSyncAt: new Date(),
    },
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
        officialName: "TD Chequing Account",
      },
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
        officialName: "TD eSavings Account",
      },
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
        officialName: "TD Visa Credit Card",
      },
    }),
  ]);

  const [chequing, savings, visa] = accounts;
  console.log(`  ✓ Created 3 PlaidAccounts`);

  const transactions: Prisma.PlaidTransactionCreateManyInput[] = [];
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
      raw: {},
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
      raw: {},
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
      raw: {},
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
      raw: {},
    });
  }

  const subscriptions = [
    {
      name: "BELL CANADA",
      amount: 120,
      cat: "RENT_AND_UTILITIES",
      catDetail: "RENT_AND_UTILITIES_UTILITIES",
    },
    {
      name: "NETFLIX",
      amount: 18.99,
      cat: "ENTERTAINMENT",
      catDetail: "ENTERTAINMENT_STREAMING_AND_DOWNLOADS",
    },
    {
      name: "SPOTIFY",
      amount: 10.99,
      cat: "ENTERTAINMENT",
      catDetail: "ENTERTAINMENT_STREAMING_AND_DOWNLOADS",
    },
    {
      name: "GOODLIFE FITNESS",
      amount: 59.99,
      cat: "PERSONAL_CARE",
      catDetail: "PERSONAL_CARE_GYMS_AND_FITNESS",
    },
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
        raw: {},
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
    { name: "MCDONALDS", min: 10, max: 20 },
  ];

  for (let i = 0; i < 100; i++) {
    const daysBack = Math.floor(Math.random() * 180);
    const place = foodPlaces[Math.floor(Math.random() * foodPlaces.length)];
    const amount = place.min + Math.random() * (place.max - place.min);
    const isAlcohol = place.name === "LCBO";
    const isGrocery = place.name === "LOBLAWS" || place.name === "FOOD BASICS";
    const detailed = isAlcohol
      ? "FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR"
      : isGrocery
        ? "FOOD_AND_DRINK_GROCERIES"
        : place.name === "STARBUCKS" || place.name === "TIM HORTONS"
          ? "FOOD_AND_DRINK_COFFEE"
          : "FOOD_AND_DRINK_RESTAURANTS";

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
      categoryDetailed: detailed,
      categoryConfidence: "VERY_HIGH",
      pending: false,
      source: SyncSource.SEED,
      removed: false,
      raw: {
        personal_finance_category: {
          primary: "FOOD_AND_DRINK",
          detailed,
          confidence_level: "VERY_HIGH",
        },
        mcc: isAlcohol ? "5921" : isGrocery ? "5411" : "5812",
      },
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
      categoryDetailed: isPresto
        ? "TRANSPORTATION_PUBLIC_TRANSIT"
        : "TRANSPORTATION_TAXIS_AND_RIDE_SHARING",
      categoryConfidence: "VERY_HIGH",
      pending: false,
      source: SyncSource.SEED,
      removed: false,
      raw: {
        personal_finance_category: {
          primary: "TRANSPORTATION",
          detailed: isPresto
            ? "TRANSPORTATION_PUBLIC_TRANSIT"
            : "TRANSPORTATION_TAXIS_AND_RIDE_SHARING",
          confidence_level: "VERY_HIGH",
        },
        mcc: isPresto ? "4111" : "4121",
      },
    });
  }

  const shopping = [
    {
      name: "AMAZON.CA",
      min: 20,
      max: 150,
      primary: "GENERAL_MERCHANDISE",
      detailed: "GENERAL_MERCHANDISE_ONLINE_MARKETPLACES",
      mcc: "5399",
    },
    {
      name: "REXALL DRUG STORE",
      min: 15,
      max: 45,
      primary: "PERSONAL_CARE",
      detailed: "PERSONAL_CARE_DRUGSTORES",
      mcc: "5912",
    },
    {
      name: "WINNERS",
      min: 30,
      max: 120,
      primary: "GENERAL_MERCHANDISE",
      detailed: "GENERAL_MERCHANDISE_DEPARTMENT_STORES",
      mcc: "5311",
    },
    {
      name: "UNIQLO",
      min: 25,
      max: 180,
      primary: "GENERAL_MERCHANDISE",
      detailed: "GENERAL_MERCHANDISE_CLOTHING_AND_ACCESSORIES",
      mcc: "5651",
    },
  ];

  for (let i = 0; i < 56; i++) {
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
      categoryPrimary: place.primary,
      categoryDetailed: place.detailed,
      categoryConfidence: "VERY_HIGH",
      pending: false,
      source: SyncSource.SEED,
      removed: false,
      raw: {
        personal_finance_category: {
          primary: place.primary,
          detailed: place.detailed,
          confidence_level: "VERY_HIGH",
        },
        mcc: place.mcc,
      },
    });
  }

  const gasMerchants = [
    { name: "SHELL GAS STATION", min: 45, max: 65 },
    { name: "ESSO", min: 50, max: 70 },
    { name: "PETRO CANADA", min: 40, max: 60 },
  ];

  for (let i = 0; i < 24; i++) {
    const daysBack = Math.floor(Math.random() * 180);
    const merchant = gasMerchants[Math.floor(Math.random() * gasMerchants.length)];
    const amount = merchant.min + Math.random() * (merchant.max - merchant.min);

    transactions.push({
      tenantId: tenant.id,
      itemId: plaidItem.id,
      accountId: visa.id,
      plaidTransactionId: `mock-txn-${txnId++}`,
      name: merchant.name,
      merchantName: merchant.name,
      amount: parseFloat(amount.toFixed(2)),
      date: getDateDaysAgo(daysBack),
      categoryPrimary: "TRANSPORTATION",
      categoryDetailed: "TRANSPORTATION_GAS",
      pending: false,
      source: SyncSource.SEED,
      removed: false,
      raw: {},
    });
  }

  const medicalPlaces = [
    {
      name: "SHOPPERS DRUG MART PHARMACY",
      min: 15,
      max: 80,
      cat: "MEDICAL_PHARMACIES_AND_SUPPLEMENTS",
    },
    { name: "DENTAL CARE CLINIC", min: 150, max: 400, cat: "MEDICAL_DENTAL_CARE" },
    { name: "CLEARLY EYECARE", min: 200, max: 500, cat: "MEDICAL_EYE_CARE" },
    { name: "WALK IN CLINIC", min: 100, max: 250, cat: "MEDICAL_PRIMARY_CARE" },
  ];

  for (let i = 0; i < 20; i++) {
    const daysBack = Math.floor(Math.random() * 180);
    const place = medicalPlaces[Math.floor(Math.random() * medicalPlaces.length)];
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
      categoryPrimary: "MEDICAL",
      categoryDetailed: place.cat,
      pending: false,
      source: SyncSource.SEED,
      removed: false,
      raw: {},
    });
  }

  const entertainment = [
    { name: "CINEPLEX ODEON", min: 20, max: 35, cat: "ENTERTAINMENT_TV_AND_MOVIES" },
    {
      name: "TICKETMASTER",
      min: 80,
      max: 250,
      cat: "ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_MUSEUMS",
    },
    { name: "STEAM GAMES", min: 10, max: 60, cat: "ENTERTAINMENT_VIDEO_GAMES" },
    { name: "SPOTIFY PREMIUM", min: 10.99, max: 10.99, cat: "ENTERTAINMENT_MUSIC_AND_AUDIO" },
    { name: "CHAPTER INDIGO", min: 20, max: 70, cat: "ENTERTAINMENT_MUSIC_AND_AUDIO" },
  ];

  for (let i = 0; i < 18; i++) {
    const daysBack = Math.floor(Math.random() * 180);
    const place = entertainment[Math.floor(Math.random() * entertainment.length)];
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
      categoryPrimary: "ENTERTAINMENT",
      categoryDetailed: place.cat,
      pending: false,
      source: SyncSource.SEED,
      removed: false,
      raw: {},
    });
  }

  const services: SeedMerchant[] = [
    {
      name: "SPORT CLIPS HAIR SALON",
      min: 25,
      max: 40,
      primary: "PERSONAL_CARE",
      detailed: "PERSONAL_CARE_HAIR_AND_BEAUTY",
      mcc: "7230",
    },
    {
      name: "DRY CLEAN EXPRESS",
      min: 15,
      max: 35,
      primary: "PERSONAL_CARE",
      detailed: "PERSONAL_CARE_LAUNDRY_AND_DRY_CLEANING",
      mcc: "7216",
    },
    {
      name: "STATE FARM INSURANCE",
      min: 180,
      max: 220,
      primary: "GENERAL_SERVICES",
      detailed: "GENERAL_SERVICES_INSURANCE",
      mcc: "6300",
    },
    {
      name: "COURSERA",
      min: 50,
      max: 500,
      primary: "GENERAL_SERVICES",
      detailed: "GENERAL_SERVICES_EDUCATION",
      mcc: "8299",
    },
    {
      name: "HOME DEPOT",
      min: 60,
      max: 250,
      primary: "HOME_IMPROVEMENT",
      detailed: "HOME_IMPROVEMENT_HARDWARE",
      mcc: "5200",
    },
    {
      name: "IKEA FURNITURE",
      min: 100,
      max: 400,
      primary: "HOME_IMPROVEMENT",
      detailed: "HOME_IMPROVEMENT_FURNITURE",
      mcc: "5712",
    },
    {
      name: "BEST BUY ELECTRONICS",
      min: 50,
      max: 300,
      primary: "GENERAL_MERCHANDISE",
      detailed: "GENERAL_MERCHANDISE_ELECTRONICS",
      mcc: "5732",
    },
    {
      name: "PETSMART",
      min: 30,
      max: 150,
      primary: "GENERAL_MERCHANDISE",
      detailed: "GENERAL_MERCHANDISE_PET_SUPPLIES",
      mcc: "5995",
    },
  ];

  for (let i = 0; i < 48; i++) {
    const daysBack = Math.floor(Math.random() * 180);
    const place = services[Math.floor(Math.random() * services.length)];
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
      categoryPrimary: place.primary,
      categoryDetailed: place.detailed,
      categoryConfidence: "VERY_HIGH",
      pending: false,
      source: SyncSource.SEED,
      removed: false,
      raw: {
        personal_finance_category: {
          primary: place.primary,
          detailed: place.detailed,
          confidence_level: "VERY_HIGH",
        },
        mcc: place.mcc,
      },
    });
  }

  const everydayMerchants: SeedMerchant[] = [
    {
      name: "UBER EATS",
      min: 18,
      max: 48,
      primary: "FOOD_AND_DRINK",
      detailed: "FOOD_AND_DRINK_DELIVERY",
      mcc: "5814",
    },
    {
      name: "DOORDASH",
      min: 20,
      max: 55,
      primary: "FOOD_AND_DRINK",
      detailed: "FOOD_AND_DRINK_DELIVERY",
      mcc: "5814",
    },
    {
      name: "THE KEG STEAKHOUSE",
      min: 85,
      max: 180,
      primary: "FOOD_AND_DRINK",
      detailed: "FOOD_AND_DRINK_RESTAURANTS",
      mcc: "5812",
    },
    {
      name: "BAR HOP",
      min: 35,
      max: 110,
      primary: "FOOD_AND_DRINK",
      detailed: "FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR",
      mcc: "5813",
    },
    {
      name: "FARM BOY",
      min: 45,
      max: 155,
      primary: "FOOD_AND_DRINK",
      detailed: "FOOD_AND_DRINK_GROCERIES",
      mcc: "5411",
    },
    {
      name: "BIKE SHARE TORONTO",
      min: 7,
      max: 18,
      primary: "TRANSPORTATION",
      detailed: "TRANSPORTATION_BIKES_AND_SCOOTERS",
      mcc: "7999",
    },
    {
      name: "GO TRANSIT",
      min: 11,
      max: 28,
      primary: "TRANSPORTATION",
      detailed: "TRANSPORTATION_PUBLIC_TRANSIT",
      mcc: "4111",
    },
    {
      name: "GREEN P PARKING",
      min: 6,
      max: 24,
      primary: "TRANSPORTATION",
      detailed: "TRANSPORTATION_PARKING",
      mcc: "7523",
    },
    {
      name: "COMMUNAUTO",
      min: 32,
      max: 95,
      primary: "TRANSPORTATION",
      detailed: "TRANSPORTATION_CAR_RENTAL",
      mcc: "7512",
    },
    {
      name: "AIRBNB",
      min: 120,
      max: 420,
      primary: "TRAVEL",
      detailed: "TRAVEL_LODGING",
      mcc: "7011",
      accountId: chequing.id,
    },
    {
      name: "PORTER AIRLINES",
      min: 180,
      max: 650,
      primary: "TRAVEL",
      detailed: "TRAVEL_FLIGHTS",
      mcc: "4511",
      accountId: chequing.id,
    },
    {
      name: "APPLE SERVICES",
      min: 3,
      max: 16,
      primary: "ENTERTAINMENT",
      detailed: "ENTERTAINMENT_STREAMING_AND_DOWNLOADS",
      mcc: "5815",
    },
    {
      name: "TORONTO PUBLIC LIBRARY",
      min: 2,
      max: 15,
      primary: "ENTERTAINMENT",
      detailed: "ENTERTAINMENT_BOOKSTORES_AND_NEWSSTANDS",
      mcc: "5942",
    },
    {
      name: "MAPLE LEAFS TICKETS",
      min: 95,
      max: 340,
      primary: "ENTERTAINMENT",
      detailed: "ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_MUSEUMS",
      mcc: "7941",
    },
  ];

  for (let i = 0; i < 96; i++) {
    const daysBack = Math.floor(Math.random() * 180);
    const place = everydayMerchants[Math.floor(Math.random() * everydayMerchants.length)];
    const amount = place.min + Math.random() * (place.max - place.min);

    transactions.push({
      tenantId: tenant.id,
      itemId: plaidItem.id,
      accountId: place.accountId ?? visa.id,
      plaidTransactionId: `mock-txn-${txnId++}`,
      name: place.name,
      merchantName: place.name,
      amount: parseFloat(amount.toFixed(2)),
      date: getDateDaysAgo(daysBack),
      categoryPrimary: place.primary,
      categoryDetailed: place.detailed,
      categoryConfidence: "VERY_HIGH",
      pending: false,
      source: SyncSource.SEED,
      removed: false,
      raw: {
        personal_finance_category: {
          primary: place.primary,
          detailed: place.detailed,
          confidence_level: "VERY_HIGH",
        },
        mcc: place.mcc,
      },
    });
  }

  const travel = [
    { name: "AIR CANADA FLIGHTS", min: 350, max: 1200, cat: "TRAVEL_FLIGHTS" },
    { name: "MARRIOTT HOTEL", min: 150, max: 400, cat: "TRAVEL_LODGING" },
    { name: "HERTZ RENTAL CARS", min: 80, max: 150, cat: "TRAVEL_RENTAL_CARS" },
  ];

  for (let i = 0; i < 8; i++) {
    const daysBack = Math.floor(Math.random() * 180);
    const place = travel[Math.floor(Math.random() * travel.length)];
    const amount = place.min + Math.random() * (place.max - place.min);

    transactions.push({
      tenantId: tenant.id,
      itemId: plaidItem.id,
      accountId: chequing.id,
      plaidTransactionId: `mock-txn-${txnId++}`,
      name: place.name,
      merchantName: place.name,
      amount: parseFloat(amount.toFixed(2)),
      date: getDateDaysAgo(daysBack),
      categoryPrimary: "TRAVEL",
      categoryDetailed: place.cat,
      pending: false,
      source: SyncSource.SEED,
      removed: false,
      raw: {},
    });
  }

  const bankFees = [
    { name: "TD BANK - OVERDRAFT FEE", amount: 35, cat: "BANK_FEES_OVERDRAFT_FEES" },
    { name: "ATM WITHDRAWAL FEE", amount: 2.5, cat: "BANK_FEES_ATM_FEES" },
    { name: "FOREIGN TRANSACTION FEE", amount: 5.25, cat: "BANK_FEES_FOREIGN_TRANSACTION_FEES" },
    { name: "INSUFFICIENT FUNDS FEE", amount: 45, cat: "BANK_FEES_INSUFFICIENT_FUNDS" },
  ];

  for (let i = 0; i < 6; i++) {
    const daysBack = Math.floor(Math.random() * 180);
    const fee = bankFees[Math.floor(Math.random() * bankFees.length)];

    transactions.push({
      tenantId: tenant.id,
      itemId: plaidItem.id,
      accountId: chequing.id,
      plaidTransactionId: `mock-txn-${txnId++}`,
      name: fee.name,
      merchantName: fee.name,
      amount: fee.amount,
      date: getDateDaysAgo(daysBack),
      categoryPrimary: "BANK_FEES",
      categoryDetailed: fee.cat,
      pending: false,
      source: SyncSource.SEED,
      removed: false,
      raw: {},
    });
  }

  const dividends = [
    { name: "DIVIDEND FROM AAPL", amount: 42.5 },
    { name: "DIVIDEND FROM MSFT", amount: 28.75 },
    { name: "DIVIDEND FROM JNJ", amount: 65.0 },
    { name: "INTEREST EARNED", amount: 12.3 },
  ];

  for (let i = 0; i < 8; i++) {
    const daysBack = Math.floor(Math.random() * 180);
    const div = dividends[Math.floor(Math.random() * dividends.length)];

    transactions.push({
      tenantId: tenant.id,
      itemId: plaidItem.id,
      accountId: savings.id,
      plaidTransactionId: `mock-txn-${txnId++}`,
      name: div.name,
      merchantName: div.name,
      amount: -div.amount,
      date: getDateDaysAgo(daysBack),
      categoryPrimary: "INCOME",
      categoryDetailed: "INCOME_DIVIDENDS",
      pending: false,
      source: SyncSource.SEED,
      removed: false,
      raw: {},
    });
  }

  await prisma.plaidTransaction.createMany({ data: transactions });
  console.log(`  ✓ Created ${transactions.length} PlaidTransactions`);

  const snapshots: Prisma.BalanceSnapshotCreateManyInput[] = [];
  const accountTxnsByDay: Record<string, Record<string, number>> = {};

  for (const txn of transactions) {
    const dayKey = new Date(txn.date).toISOString().split("T")[0];
    accountTxnsByDay[dayKey] ??= {};
    accountTxnsByDay[dayKey][txn.accountId] ??= 0;
    accountTxnsByDay[dayKey][txn.accountId] += Number(txn.amount);
  }

  const accountBalances: Record<string, number> = {
    [chequing.id]: 8200,
    [savings.id]: 12500,
    [visa.id]: -1840,
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
        raw: {},
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
      removedCount: 0,
    },
  });

  const connection = await prisma.snapTradeConnection.create({
    data: {
      tenantId: tenant.id,
      snapTradeAuthorizationId: "mock-qt-auth-001",
      brokerageName: "Questrade",
      brokerageSlug: "QUESTRADE",
      status: SnapTradeConnectionStatus.IDLE,
      disabled: false,
      lastSyncAt: new Date(),
    },
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
        unifiedAccountType: "SELF_DIRECTED_TFSA",
        institutionName: "Questrade",
        currency: "CAD",
        totalValue: 95000,
        isPaper: false,
        holdingsInitialSyncComplete: true,
        lastHoldingsSyncAt: new Date(),
        name: "Questrade TFSA",
      },
    }),
    prisma.snapTradeAccount.create({
      data: {
        tenantId: tenant.id,
        connectionId: connection.id,
        snapTradeAccountId: "acct-rrsp",
        rawType: "RRSP",
        accountCategory: "RRSP",
        unifiedAccountType: "SELF_DIRECTED_RRSP",
        institutionName: "Questrade",
        currency: "CAD",
        totalValue: 80000,
        isPaper: false,
        holdingsInitialSyncComplete: true,
        lastHoldingsSyncAt: new Date(),
        name: "Questrade RRSP",
      },
    }),
    prisma.snapTradeAccount.create({
      data: {
        tenantId: tenant.id,
        connectionId: connection.id,
        snapTradeAccountId: "acct-nonreg",
        rawType: "Individual",
        accountCategory: "Individual",
        unifiedAccountType: "SELF_DIRECTED_NON_REGISTERED_MARGIN",
        institutionName: "Questrade",
        currency: "CAD",
        totalValue: 27000,
        isPaper: false,
        holdingsInitialSyncComplete: true,
        lastHoldingsSyncAt: new Date(),
        name: "Questrade Non-Registered",
      },
    }),
  ]);

  const [tfsaAcc, rrspAcc, nonregAcc] = snapTradeAccounts;
  console.log(`  ✓ Created 3 SnapTradeAccounts`);

  const usdToCAD = 1.38;

  const seedPositions: SeedPosition[] = [
    {
      snapTradeAccountId: tfsaAcc.id,
      symbol: "QQQ",
      rawSymbol: "QQQ",
      assetType: "et",
      exchange: "ARCA",
      currency: "USD",
      units: 35,
      price: 538.42,
      avgCost: 494.18,
    },
    {
      snapTradeAccountId: tfsaAcc.id,
      symbol: "SPY",
      rawSymbol: "SPY",
      assetType: "et",
      exchange: "ARCA",
      currency: "USD",
      units: 20,
      price: 568.25,
      avgCost: 527.12,
    },
    {
      snapTradeAccountId: tfsaAcc.id,
      symbol: "XIC.TO",
      rawSymbol: "XIC",
      assetType: "et",
      exchange: "TSX",
      currency: "CAD",
      units: 400,
      price: 34.15,
      avgCost: 29.5,
    },
    {
      snapTradeAccountId: tfsaAcc.id,
      symbol: "XUU.TO",
      rawSymbol: "XUU",
      assetType: "et",
      exchange: "TSX",
      currency: "CAD",
      units: 600,
      price: 44.8,
      avgCost: 38.2,
    },
    {
      snapTradeAccountId: tfsaAcc.id,
      symbol: "BND",
      rawSymbol: "BND",
      assetType: "et",
      exchange: "BATS",
      currency: "USD",
      units: 80,
      price: 81.22,
      avgCost: 83.67,
    },
    {
      snapTradeAccountId: rrspAcc.id,
      symbol: "AAPL",
      rawSymbol: "AAPL",
      assetType: "cs",
      exchange: "NASDAQ",
      currency: "USD",
      units: 40,
      price: 227.45,
      avgCost: 189.22,
    },
    {
      snapTradeAccountId: rrspAcc.id,
      symbol: "MSFT",
      rawSymbol: "MSFT",
      assetType: "cs",
      exchange: "NASDAQ",
      currency: "USD",
      units: 20,
      price: 415.3,
      avgCost: 363.45,
    },
    {
      snapTradeAccountId: rrspAcc.id,
      symbol: "NVDA",
      rawSymbol: "NVDA",
      assetType: "cs",
      exchange: "NASDAQ",
      currency: "USD",
      units: 25,
      price: 214.82,
      avgCost: 158.34,
    },
    {
      snapTradeAccountId: rrspAcc.id,
      symbol: "VTI",
      rawSymbol: "VTI",
      assetType: "et",
      exchange: "ARCA",
      currency: "USD",
      units: 25,
      price: 363.48,
      avgCost: 324.22,
    },
    {
      snapTradeAccountId: rrspAcc.id,
      symbol: "IVV",
      rawSymbol: "IVV",
      assetType: "et",
      exchange: "BATS",
      currency: "USD",
      units: 18,
      price: 568.15,
      avgCost: 530.27,
    },
    {
      snapTradeAccountId: rrspAcc.id,
      symbol: "RY.TO",
      rawSymbol: "RY",
      assetType: "cs",
      exchange: "TSX",
      currency: "CAD",
      units: 100,
      price: 175.4,
      avgCost: 165.5,
    },
    {
      snapTradeAccountId: nonregAcc.id,
      symbol: "META",
      rawSymbol: "META",
      assetType: "cs",
      exchange: "NASDAQ",
      currency: "USD",
      units: 8,
      price: 611.25,
      avgCost: 550.75,
    },
    {
      snapTradeAccountId: nonregAcc.id,
      symbol: "GOOG",
      rawSymbol: "GOOG",
      assetType: "cs",
      exchange: "NASDAQ",
      currency: "USD",
      units: 10,
      price: 396.45,
      avgCost: 357.29,
    },
    {
      snapTradeAccountId: nonregAcc.id,
      symbol: "TSLA",
      rawSymbol: "TSLA",
      assetType: "cs",
      exchange: "NASDAQ",
      currency: "USD",
      units: 15,
      price: 427.15,
      avgCost: 505.12,
    },
    {
      snapTradeAccountId: nonregAcc.id,
      symbol: "TD.TO",
      rawSymbol: "TD",
      assetType: "cs",
      exchange: "TSX",
      currency: "CAD",
      units: 50,
      price: 81.6,
      avgCost: 76.8,
    },
  ];

  const positions: Prisma.SnapTradePositionCreateManyInput[] = seedPositions.map((p) => {
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
      pnlPct,
    };
  });

  await prisma.snapTradePosition.createMany({ data: positions });
  console.log(`  ✓ Created ${positions.length} SnapTradePositions`);

  const ibkrConnection = await prisma.snapTradeConnection.create({
    data: {
      tenantId: tenant.id,
      snapTradeAuthorizationId: "mock-ibkr-auth-001",
      brokerageName: "Interactive Brokers",
      brokerageSlug: "IBKR",
      status: SnapTradeConnectionStatus.IDLE,
      disabled: false,
      lastSyncAt: new Date(),
    },
  });

  const ibkrAccounts = await Promise.all([
    prisma.snapTradeAccount.create({
      data: {
        tenantId: tenant.id,
        connectionId: ibkrConnection.id,
        snapTradeAccountId: "ibkr-main",
        rawType: "Individual",
        accountCategory: "Individual",
        unifiedAccountType: "SELF_DIRECTED_NON_REGISTERED_MARGIN",
        institutionName: "Interactive Brokers",
        currency: "USD",
        totalValue: 180000,
        isPaper: false,
        holdingsInitialSyncComplete: true,
        lastHoldingsSyncAt: new Date(),
        name: "Interactive Brokers Main",
      },
    }),
  ]);

  const [ibkrMainAcc] = ibkrAccounts;

  const ibkrStockPositions: SeedPosition[] = [
    {
      snapTradeAccountId: ibkrMainAcc.id,
      symbol: "AAPL",
      rawSymbol: "AAPL",
      assetType: "cs",
      exchange: "NASDAQ",
      currency: "USD",
      units: 50,
      price: 227.45,
      avgCost: 195.6,
    },
    {
      snapTradeAccountId: ibkrMainAcc.id,
      symbol: "MSFT",
      rawSymbol: "MSFT",
      assetType: "cs",
      exchange: "NASDAQ",
      currency: "USD",
      units: 35,
      price: 415.3,
      avgCost: 380.25,
    },
    {
      snapTradeAccountId: ibkrMainAcc.id,
      symbol: "VEA",
      rawSymbol: "VEA",
      assetType: "et",
      exchange: "NASDAQ",
      currency: "USD",
      units: 180,
      price: 52.8,
      avgCost: 48.9,
    },
    {
      snapTradeAccountId: ibkrMainAcc.id,
      symbol: "AGG",
      rawSymbol: "AGG",
      assetType: "bond",
      exchange: "ARCA",
      currency: "USD",
      units: 95,
      price: 98.6,
      avgCost: 100.2,
    },
    {
      snapTradeAccountId: ibkrMainAcc.id,
      symbol: "TLT",
      rawSymbol: "TLT",
      assetType: "bond",
      exchange: "NASDAQ",
      currency: "USD",
      units: 70,
      price: 88.4,
      avgCost: 93.75,
    },
    {
      snapTradeAccountId: ibkrMainAcc.id,
      symbol: "META",
      rawSymbol: "META",
      assetType: "cs",
      exchange: "NASDAQ",
      currency: "USD",
      units: 20,
      price: 611.25,
      avgCost: 545.9,
    },
    {
      snapTradeAccountId: ibkrMainAcc.id,
      symbol: "NVDA",
      rawSymbol: "NVDA",
      assetType: "cs",
      exchange: "NASDAQ",
      currency: "USD",
      units: 15,
      price: 214.82,
      avgCost: 165.4,
    },
    {
      snapTradeAccountId: ibkrMainAcc.id,
      symbol: "BNDX",
      rawSymbol: "BNDX",
      assetType: "bond",
      exchange: "NASDAQ",
      currency: "USD",
      units: 110,
      price: 49.3,
      avgCost: 50.8,
    },
    {
      snapTradeAccountId: ibkrMainAcc.id,
      symbol: "XBB.TO",
      rawSymbol: "XBB",
      assetType: "bond",
      exchange: "TSX",
      currency: "CAD",
      units: 240,
      price: 27.35,
      avgCost: 28.1,
    },
    {
      snapTradeAccountId: ibkrMainAcc.id,
      symbol: "VTI",
      rawSymbol: "VTI",
      assetType: "et",
      exchange: "ARCA",
      currency: "USD",
      units: 35,
      price: 363.48,
      avgCost: 322.4,
    },
    {
      snapTradeAccountId: ibkrMainAcc.id,
      symbol: "VFV.TO",
      rawSymbol: "VFV",
      assetType: "et",
      exchange: "TSX",
      currency: "CAD",
      units: 70,
      price: 162.45,
      avgCost: 141.3,
    },
    {
      snapTradeAccountId: ibkrMainAcc.id,
      symbol: "SGOV",
      rawSymbol: "SGOV",
      assetType: "bond",
      exchange: "ARCA",
      currency: "USD",
      units: 45,
      price: 100.5,
      avgCost: 100.4,
    },
    {
      snapTradeAccountId: ibkrMainAcc.id,
      symbol: "SCHD",
      rawSymbol: "SCHD",
      assetType: "et",
      exchange: "ARCA",
      currency: "USD",
      units: 85,
      price: 27.4,
      avgCost: 24.9,
    },
    {
      snapTradeAccountId: ibkrMainAcc.id,
      symbol: "XIC.TO",
      rawSymbol: "XIC",
      assetType: "et",
      exchange: "TSX",
      currency: "CAD",
      units: 165,
      price: 34.15,
      avgCost: 30.2,
    },
    {
      snapTradeAccountId: ibkrMainAcc.id,
      symbol: "IEFA",
      rawSymbol: "IEFA",
      assetType: "et",
      exchange: "BATS",
      currency: "USD",
      units: 75,
      price: 78.2,
      avgCost: 72.5,
    },
  ];

  const ibkrPositions: Prisma.SnapTradePositionCreateManyInput[] = ibkrStockPositions.map((p) => {
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
      pnlPct,
    };
  });

  await prisma.snapTradePosition.createMany({ data: ibkrPositions });
  console.log(
    `  ✓ Created SnapTradeConnection (Interactive Brokers) with ${ibkrPositions.length} stock positions`
  );

  await prisma.snapTradeCashBalance.createMany({
    data: [
      {
        tenantId: tenant.id,
        accountId: tfsaAcc.id,
        currency: "CAD",
        cash: 3796,
        cashCad: 3796,
        buyingPower: 3796,
      },
      {
        tenantId: tenant.id,
        accountId: rrspAcc.id,
        currency: "CAD",
        cash: 4000,
        cashCad: 4000,
        buyingPower: 4000,
      },
      {
        tenantId: tenant.id,
        accountId: nonregAcc.id,
        currency: "CAD",
        cash: 1850,
        cashCad: 1850,
        buyingPower: 1850,
      },
      {
        tenantId: tenant.id,
        accountId: nonregAcc.id,
        currency: "USD",
        cash: 1200,
        cashCad: 1656,
        buyingPower: 2400,
      },
      {
        tenantId: tenant.id,
        accountId: ibkrMainAcc.id,
        currency: "USD",
        cash: 5000,
        cashCad: 6900,
        buyingPower: 12500,
      },
      {
        tenantId: tenant.id,
        accountId: ibkrMainAcc.id,
        currency: "CAD",
        cash: 2500,
        cashCad: 2500,
        buyingPower: 2500,
      },
    ],
  });

  await prisma.fxRate.upsert({
    where: { pair: "USD-CAD" },
    create: {
      pair: "USD-CAD",
      sourceCurrency: "USD",
      targetCurrency: "CAD",
      rate: usdToCAD,
      fetchedAt: new Date(),
    },
    update: {
      rate: usdToCAD,
      fetchedAt: new Date(),
    },
  });

  const activityRows: Prisma.SnapTradeActivityCreateManyInput[] = [
    {
      tenantId: tenant.id,
      accountId: tfsaAcc.id,
      snapTradeActivityId: "mock-act-tfsa-contribution-001",
      type: "CONTRIBUTION",
      description: "EFT contribution",
      amount: 2000,
      currency: "CAD",
      fxRate: 1,
      tradeDate: getDateDaysAgo(24),
      settlementDate: getDateDaysAgo(24),
      institution: "Questrade",
      raw: {},
    },
    {
      tenantId: tenant.id,
      accountId: tfsaAcc.id,
      snapTradeActivityId: "mock-act-tfsa-buy-xuu-001",
      type: "BUY",
      symbol: "XUU.TO",
      description: "Buy 25 XUU.TO",
      units: 25,
      price: 42.85,
      amount: -1071.25,
      currency: "CAD",
      fxRate: 1,
      tradeDate: getDateDaysAgo(23),
      settlementDate: getDateDaysAgo(21),
      institution: "Questrade",
      raw: {
        symbol: {
          symbol: "XUU.TO",
          raw_symbol: "XUU",
          description: "iShares Core S&P U.S. Total Market Index ETF",
        },
      },
    },
    {
      tenantId: tenant.id,
      accountId: rrspAcc.id,
      snapTradeActivityId: "mock-act-rrsp-div-aapl-001",
      type: "DIVIDEND",
      symbol: "AAPL",
      description: "Dividend from AAPL",
      amount: 18.5,
      currency: "USD",
      fxRate: usdToCAD,
      tradeDate: getDateDaysAgo(18),
      settlementDate: getDateDaysAgo(18),
      institution: "Questrade",
      raw: { symbol: { symbol: "AAPL", raw_symbol: "AAPL", description: "Apple Inc." } },
    },
    {
      tenantId: tenant.id,
      accountId: rrspAcc.id,
      snapTradeActivityId: "mock-act-rrsp-tax-aapl-001",
      type: "TAX",
      symbol: "AAPL",
      description: "Foreign withholding tax AAPL",
      amount: -2.78,
      currency: "USD",
      fxRate: usdToCAD,
      tradeDate: getDateDaysAgo(18),
      settlementDate: getDateDaysAgo(18),
      institution: "Questrade",
      raw: { symbol: { symbol: "AAPL", raw_symbol: "AAPL", description: "Apple Inc." } },
    },
    {
      tenantId: tenant.id,
      accountId: nonregAcc.id,
      snapTradeActivityId: "mock-act-nonreg-sell-tsla-001",
      type: "SELL",
      symbol: "TSLA",
      description: "Sell 3 TSLA",
      units: 3,
      price: 421.2,
      amount: 1263.6,
      currency: "USD",
      fxRate: usdToCAD,
      tradeDate: getDateDaysAgo(12),
      settlementDate: getDateDaysAgo(10),
      institution: "Questrade",
      raw: { symbol: { symbol: "TSLA", raw_symbol: "TSLA", description: "Tesla Inc." } },
    },
    {
      tenantId: tenant.id,
      accountId: ibkrMainAcc.id,
      snapTradeActivityId: "mock-act-ibkr-buy-amzn-001",
      type: "BUY",
      symbol: "AMZN",
      description: "Buy 10 AMZN",
      units: 10,
      price: 184.3,
      amount: -1843,
      currency: "USD",
      fxRate: usdToCAD,
      tradeDate: getDateDaysAgo(35),
      settlementDate: getDateDaysAgo(33),
      institution: "Interactive Brokers",
      raw: { symbol: { symbol: "AMZN", raw_symbol: "AMZN", description: "Amazon.com Inc." } },
    },
    {
      tenantId: tenant.id,
      accountId: ibkrMainAcc.id,
      snapTradeActivityId: "mock-act-ibkr-interest-001",
      type: "INTEREST",
      description: "Cash interest",
      amount: 9.25,
      currency: "USD",
      fxRate: usdToCAD,
      tradeDate: getDateDaysAgo(8),
      settlementDate: getDateDaysAgo(8),
      institution: "Interactive Brokers",
      raw: {},
    },
  ];
  await prisma.snapTradeActivity.createMany({ data: activityRows });
  const ledgerResult = await canonicalizeSnapTradeActivities(tenant.id, {
    mode: BrokerLedgerIngestionMode.MIGRATION,
  });
  console.log(
    `  ✓ Created ${activityRows.length} SnapTradeActivities and ${ledgerResult.canonicalizedCount} BrokerLedgerEntries`
  );

  const cycles: Prisma.PayCycleCreateManyInput[] = [];
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
      carryover: 0,
    });
  }
  await prisma.payCycle.createMany({ data: cycles });
  console.log(`  ✓ Created ${cycles.length} PayCycles`);

  // A due date on the given day-of-month in the current month; monthly projection
  // steps from here, so only the day-of-month matters.
  const dueDay = (day: number) =>
    new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), day));

  await prisma.recurringExpense.createMany({
    data: [
      {
        tenantId: tenant.id,
        name: "Rent",
        merchantPattern: "FIDELITY REALTY",
        amount: 2500,
        frequency: "monthly",
        nextDueDate: dueDay(1),
        accrualPerCycle: 1250,
      },
      {
        tenantId: tenant.id,
        name: "Questrade Transfer",
        merchantPattern: "QUESTRADE",
        amount: 2000,
        frequency: "monthly",
        nextDueDate: dueDay(15),
        accrualPerCycle: 1000,
      },
      {
        tenantId: tenant.id,
        name: "Bell Canada",
        merchantPattern: "BELL CANADA",
        amount: 120,
        frequency: "monthly",
        nextDueDate: dueDay(10),
        accrualPerCycle: 60,
      },
    ],
  });

  await prisma.savingsDestination.createMany({
    data: [
      {
        tenantId: tenant.id,
        accountName: "Questrade",
        matchPattern: "QUESTRADE",
        label: "investing",
      },
    ],
  });

  const investingDestination = await prisma.savingsDestination.findFirstOrThrow({
    where: { tenantId: tenant.id, matchPattern: "QUESTRADE" },
  });

  await prisma.budget.createMany({
    data: [
      { tenantId: tenant.id, categoryPrimary: "FOOD_AND_DRINK", amount: 950 },
      { tenantId: tenant.id, categoryPrimary: "TRANSPORTATION", amount: 425 },
      { tenantId: tenant.id, categoryPrimary: "TRAVEL", amount: 800 },
      { tenantId: tenant.id, categoryPrimary: "ENTERTAINMENT", amount: 300 },
    ],
  });

  await prisma.savingsGoal.createMany({
    data: [
      {
        tenantId: tenant.id,
        name: "Emergency fund",
        targetAmount: 20000,
        startDate: getDateDaysAgo(180),
        targetDate: getDateDaysAgo(-180),
        savingsDestinationId: investingDestination.id,
      },
      {
        tenantId: tenant.id,
        name: "Vacation fund",
        targetAmount: 6000,
        startDate: getDateDaysAgo(90),
        targetDate: getDateDaysAgo(-120),
      },
    ],
  });

  await prisma.watchlistItem.createMany({
    data: [
      { tenantId: tenant.id, symbol: "AMD", name: "Advanced Micro Devices", exchange: "NASDAQ" },
      { tenantId: tenant.id, symbol: "SHOP.TO", name: "Shopify", exchange: "TSX" },
      { tenantId: tenant.id, symbol: "COST", name: "Costco Wholesale", exchange: "NASDAQ" },
    ],
  });

  await prisma.settlementPattern.createMany({
    data: [
      { tenantId: tenant.id, label: "TD Visa payment", matchPattern: "TD VISA PAYMENT" },
      { tenantId: tenant.id, label: "Credit card payment", matchPattern: "CREDIT CARD PAYMENT" },
      { tenantId: tenant.id, label: "Remboursement (FR)", matchPattern: "REMBOURSEMENT" },
    ],
  });

  console.log("\n✅ Demo data seeded successfully!");
  console.log(`   Tenant: ${tenant.slug}`);
  console.log(
    `   Plaid: 3 accounts, ${transactions.length} transactions, ${snapshots.length} balance snapshots`
  );
  console.log(`   SnapTrade Questrade: 3 accounts, ${positions.length} positions`);
  console.log(
    `   SnapTrade Interactive Brokers: 1 account, ${ibkrPositions.length} stock positions`
  );
}
