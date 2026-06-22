import type { DashboardData, DashboardMode } from "@/components/features/dashboard/types";
import type { CalendarData } from "@/lib/calendar/get-calendar-events";
import type { InvestmentDashboardData } from "@/lib/investments/types";

export const OFFLINE_SNAPSHOTS_ENABLED_KEY = "wyn:pwa:offlineSnapshotsEnabled";

const DB_NAME = "wyn-pwa";
const DB_VERSION = 1;
const SNAPSHOT_STORE = "snapshots";

export type OfflineSnapshotKind = "dashboard" | "holdings" | "calendar";

export type OfflineSnapshotMeta = {
  version: 1;
  kind: OfflineSnapshotKind;
  savedAt: string;
  sourcePath: string;
  mode: DashboardMode | "unknown";
};

export type DashboardSnapshot = {
  totals: DashboardData["totals"];
  deltas: DashboardData["deltas"];
  insights: DashboardData["insights"];
  recentTransactions: DashboardData["recentTransactions"];
  categorySpendMTD: DashboardData["categorySpendMTD"];
  categorySpend30d: DashboardData["categorySpend30d"];
  investmentSummary: Pick<
    DashboardData["investments"]["summary"],
    | "portfolioCAD"
    | "netWorthCAD"
    | "cashCAD"
    | "plCAD"
    | "plPct"
    | "positionCount"
    | "lastSync"
    | "status"
  >;
  lastSyncAt: string | null;
};

export type HoldingsSnapshot = {
  summary: Pick<
    InvestmentDashboardData["summary"],
    | "portfolioCAD"
    | "netWorthCAD"
    | "cashCAD"
    | "plCAD"
    | "plPct"
    | "positionCount"
    | "lastSync"
    | "status"
  >;
  holdings: Array<{
    symbol: string;
    description: string;
    currency: string;
    units: number;
    mvCAD: number;
    plCAD: number | null;
    plPct: number | null;
  }>;
  cashBalances: InvestmentDashboardData["cashBalances"];
  allocByType: InvestmentDashboardData["allocByType"];
  allocByCcy: InvestmentDashboardData["allocByCcy"];
};

export type CalendarSnapshot = {
  window: CalendarData["window"];
  todayISO: string;
  counts: CalendarData["counts"];
  confirmedThrough: string | null;
  upcomingEvents: Array<CalendarData["eventsByDay"][string][number] & { date: string }>;
  recentEvents: Array<CalendarData["eventsByDay"][string][number] & { date: string }>;
};

export type OfflineSnapshotData = {
  dashboard: DashboardSnapshot;
  holdings: HoldingsSnapshot;
  calendar: CalendarSnapshot;
};

export type OfflineSnapshotRecord<K extends OfflineSnapshotKind = OfflineSnapshotKind> = {
  kind: K;
  meta: OfflineSnapshotMeta;
  data: OfflineSnapshotData[K];
};

function isBrowser() {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isBrowser()) {
      reject(new Error("IndexedDB is not available."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
        db.createObjectStore(SNAPSHOT_STORE, { keyPath: "kind" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open offline cache."));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T> | void
): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOT_STORE, mode);
    const store = tx.objectStore(SNAPSHOT_STORE);
    const request = run(store);
    let result: T | undefined;

    if (request) {
      request.onsuccess = () => {
        result = request.result;
      };
      request.onerror = () => reject(request.error ?? new Error("Offline cache request failed."));
    }

    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Offline cache transaction failed."));
    };
  });
}

export function offlineSnapshotsEnabled() {
  return (
    typeof window !== "undefined" && localStorage.getItem(OFFLINE_SNAPSHOTS_ENABLED_KEY) === "1"
  );
}

export function setOfflineSnapshotsEnabled(enabled: boolean) {
  localStorage.setItem(OFFLINE_SNAPSHOTS_ENABLED_KEY, enabled ? "1" : "0");
}

export async function saveOfflineSnapshot<K extends OfflineSnapshotKind>(
  kind: K,
  data: OfflineSnapshotData[K],
  mode: OfflineSnapshotMeta["mode"] = "unknown"
) {
  if (!offlineSnapshotsEnabled()) return;

  const record: OfflineSnapshotRecord<K> = {
    kind,
    meta: {
      version: 1,
      kind,
      savedAt: new Date().toISOString(),
      sourcePath: window.location.pathname + window.location.search,
      mode,
    },
    data,
  };

  await withStore("readwrite", (store) => store.put(record));
}

export async function getOfflineSnapshot<K extends OfflineSnapshotKind>(
  kind: K
): Promise<OfflineSnapshotRecord<K> | null> {
  const result = await withStore<OfflineSnapshotRecord<K>>("readonly", (store) => store.get(kind));
  return result ?? null;
}

export async function listOfflineSnapshotMeta(): Promise<OfflineSnapshotMeta[]> {
  const result = await withStore<OfflineSnapshotRecord[]>("readonly", (store) => store.getAll());
  return (result ?? [])
    .map((record) => record.meta)
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export async function clearOfflineSnapshots() {
  await withStore("readwrite", (store) => store.clear());
}

export function buildDashboardSnapshot(data: DashboardData): DashboardSnapshot {
  const lastSyncAt =
    data.plaidItems
      .map((p) => p.lastSyncAt)
      .filter((value): value is string => Boolean(value))
      .sort()
      .pop() ?? data.investments.summary.lastSync;

  return {
    totals: data.totals,
    deltas: data.deltas,
    insights: data.insights,
    recentTransactions: data.recentTransactions,
    categorySpendMTD: data.categorySpendMTD,
    categorySpend30d: data.categorySpend30d,
    investmentSummary: {
      portfolioCAD: data.investments.summary.portfolioCAD,
      netWorthCAD: data.investments.summary.netWorthCAD,
      cashCAD: data.investments.summary.cashCAD,
      plCAD: data.investments.summary.plCAD,
      plPct: data.investments.summary.plPct,
      positionCount: data.investments.summary.positionCount,
      lastSync: data.investments.summary.lastSync,
      status: data.investments.summary.status,
    },
    lastSyncAt,
  };
}

export function buildHoldingsSnapshot(data: InvestmentDashboardData): HoldingsSnapshot {
  return {
    summary: {
      portfolioCAD: data.summary.portfolioCAD,
      netWorthCAD: data.summary.netWorthCAD,
      cashCAD: data.summary.cashCAD,
      plCAD: data.summary.plCAD,
      plPct: data.summary.plPct,
      positionCount: data.summary.positionCount,
      lastSync: data.summary.lastSync,
      status: data.summary.status,
    },
    holdings: data.holdings.map((h) => ({
      symbol: h.symbol,
      description: h.description,
      currency: h.currency,
      units: h.units,
      mvCAD: h.mvCAD,
      plCAD: h.plCAD,
      plPct: h.plPct,
    })),
    cashBalances: data.cashBalances,
    allocByType: data.allocByType,
    allocByCcy: data.allocByCcy,
  };
}

export function buildCalendarSnapshot(data: CalendarData): CalendarSnapshot {
  const events = Object.entries(data.eventsByDay)
    .flatMap(([date, rows]) => rows.map((event) => ({ ...event, date })))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    window: data.window,
    todayISO: data.todayISO,
    counts: data.counts,
    confirmedThrough: data.confirmedThrough,
    upcomingEvents: events.filter((event) => event.date >= data.todayISO).slice(0, 30),
    recentEvents: events
      .filter((event) => event.date < data.todayISO)
      .slice(-15)
      .reverse(),
  };
}
