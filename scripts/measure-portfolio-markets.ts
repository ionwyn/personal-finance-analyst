import "dotenv/config";

import { TenantKind } from "@prisma/client";

import { getPortfolioAnalytics } from "../src/lib/investments/analytics-loader";
import {
  getInvestmentDashboardData,
  getPortfolioContributionData,
  getPortfolioHoldingsData,
} from "../src/lib/investments/analytics";
import { loadActivities } from "../src/lib/investments/activities-loader";
import { getInsiderTape } from "../src/lib/investments/insider-tape-loader";
import { loadInvestmentConnectionSummary } from "../src/lib/investments/loader";
import { getDeskMonitor } from "../src/lib/investments/monitor-loader";
import {
  getMacroBoard,
  getPortfolioPulse,
  getWatchlist,
} from "../src/lib/investments/markets-loader";
import { prisma } from "../src/lib/prisma";
import { withMarketDataStats, type MarketDataStats } from "../src/lib/market-data/stats";

type Measurement = {
  route: string;
  ms: number;
  rows: Record<string, number>;
  marketData: MarketDataStats;
};

function parseTenantArgument() {
  const index = process.argv.indexOf("--tenant");
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value) throw new Error("--tenant requires an id or slug");
  return value;
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

async function measure<T>(
  route: string,
  fn: () => Promise<{ result: T; rows: Record<string, number> }>
): Promise<Measurement> {
  const start = performance.now();
  const { result, stats } = await withMarketDataStats(fn);
  void result.result;
  return {
    route,
    ms: Math.round(performance.now() - start),
    rows: result.rows,
    marketData: stats,
  };
}

function printMeasurement(m: Measurement) {
  console.log(`\n${m.route}: ${m.ms}ms`);
  console.log(`  rows: ${JSON.stringify(m.rows)}`);
  const activeStats = Object.entries(m.marketData)
    .map(([kind, stats]) => [kind, stats] as const)
    .filter(([, stats]) => Object.values(stats).some((value) => value > 0));
  for (const [kind, stats] of activeStats) {
    console.log(
      `  ${kind}: hit=${stats.hit} stale=${stats.stale} miss=${stats.miss} provider=${stats.providerFetch}`
    );
  }
}

async function main() {
  const tenant = await resolveTenant(parseTenantArgument());
  const measurements: Measurement[] = [];

  measurements.push(
    await measure("/app/portfolio", async () => {
      const [data, pulse] = await Promise.all([
        getInvestmentDashboardData(tenant.id),
        getPortfolioPulse(tenant.id),
      ]);
      return {
        result: { data, pulse },
        rows: {
          accounts: data.accounts.length,
          holdings: data.holdings.length,
          sectors: data.sectors.length,
          movers: pulse.portfolio?.movers.length ?? 0,
        },
      };
    })
  );

  measurements.push(
    await measure("/app/portfolio/holdings", async () => {
      const data = await getPortfolioHoldingsData(tenant.id);
      return {
        result: data,
        rows: { holdings: data.holdings.length, cashBalances: data.cashBalances.length },
      };
    })
  );

  measurements.push(
    await measure("/app/portfolio/contribution", async () => {
      const data = await getPortfolioContributionData(tenant.id);
      return { result: data, rows: { years: data.years.length } };
    })
  );

  measurements.push(
    await measure("/app/portfolio/activity", async () => {
      const [activities, investmentConnections] = await Promise.all([
        loadActivities(tenant.id),
        loadInvestmentConnectionSummary(tenant.id),
      ]);
      return {
        result: { activities, investmentConnections },
        rows: {
          activityRows: activities.rows.length,
          totalActivityRows: activities.totalRowCount,
          connections: investmentConnections.connections.length,
        },
      };
    })
  );

  measurements.push(
    await measure("/app/portfolio/performance", async () => {
      const data = await getPortfolioAnalytics(tenant.id);
      return {
        result: data,
        rows: {
          series: data.series.length,
          calendar: data.calendar.length,
          coverageIssues: data.coverageIssues.length,
        },
      };
    })
  );

  measurements.push(
    await measure("/app/markets", async () => {
      const data = await getMacroBoard();
      return {
        result: data,
        rows: { tape: data.tape.length, macro: data.macro.length, canada: data.canada.length },
      };
    })
  );

  measurements.push(
    await measure("/app/markets/intel", async () => {
      const [data, watchlist] = await Promise.all([
        getDeskMonitor(tenant.id),
        getWatchlist(tenant.id),
      ]);
      return {
        result: { data, watchlist },
        rows: { monitorRows: data.rows.length, watchlist: watchlist.length },
      };
    })
  );

  measurements.push(
    await measure("/app/markets/insiders", async () => {
      const data = await getInsiderTape(tenant.id);
      return { result: data, rows: { rows: data.rows.length, covered: data.coveredCount } };
    })
  );

  console.log(`Tenant: ${tenant.slug} (${tenant.id})`);
  for (const measurement of measurements) printMeasurement(measurement);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
