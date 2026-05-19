type MetricLabelValue = boolean | number | string;
type MetricLabels = Record<string, MetricLabelValue>;

const DEFAULT_HISTOGRAM_BUCKETS_SECONDS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300,
];

const PROCESS_STARTED_AT_SECONDS = Date.now() / 1000;

type CounterSeries = {
  labels: MetricLabels;
  value: number;
};

type HistogramSeries = {
  labels: MetricLabels;
  buckets: number[];
  count: number;
  sum: number;
};

type CollectableMetric = {
  collect(): string;
};

export class Counter implements CollectableMetric {
  private readonly series = new Map<string, CounterSeries>();

  constructor(
    private readonly name: string,
    private readonly help: string,
    private readonly labelNames: string[] = []
  ) {}

  inc(labels: MetricLabels = {}, value = 1) {
    if (value < 0) {
      throw new Error(`Counter ${this.name} cannot be incremented by a negative value.`);
    }

    const key = labelKey(this.labelNames, labels);
    const series = this.series.get(key) ?? {
      labels: filterLabels(this.labelNames, labels),
      value: 0,
    };
    series.value += value;
    this.series.set(key, series);
  }

  collect() {
    const lines = metricHeader(this.name, this.help, "counter");
    for (const series of this.series.values()) {
      lines.push(`${this.name}${formatLabels(series.labels)} ${formatNumber(series.value)}`);
    }
    return lines.join("\n");
  }
}

export class Histogram implements CollectableMetric {
  private readonly series = new Map<string, HistogramSeries>();

  constructor(
    private readonly name: string,
    private readonly help: string,
    private readonly labelNames: string[] = [],
    private readonly buckets: number[] = DEFAULT_HISTOGRAM_BUCKETS_SECONDS
  ) {}

  observe(labels: MetricLabels = {}, value: number) {
    const key = labelKey(this.labelNames, labels);
    const series = this.series.get(key) ?? {
      labels: filterLabels(this.labelNames, labels),
      buckets: Array.from({ length: this.buckets.length }, () => 0),
      count: 0,
      sum: 0,
    };

    series.count += 1;
    series.sum += value;
    this.buckets.forEach((bucket, index) => {
      if (value <= bucket) series.buckets[index] += 1;
    });
    this.series.set(key, series);
  }

  collect() {
    const lines = metricHeader(this.name, this.help, "histogram");
    for (const series of this.series.values()) {
      this.buckets.forEach((bucket, index) => {
        lines.push(
          `${this.name}_bucket${formatLabels({ ...series.labels, le: bucket })} ${formatNumber(
            series.buckets[index]
          )}`
        );
      });
      lines.push(
        `${this.name}_bucket${formatLabels({ ...series.labels, le: "+Inf" })} ${formatNumber(
          series.count
        )}`
      );
      lines.push(`${this.name}_sum${formatLabels(series.labels)} ${formatNumber(series.sum)}`);
      lines.push(`${this.name}_count${formatLabels(series.labels)} ${formatNumber(series.count)}`);
    }
    return lines.join("\n");
  }
}

export class MetricsRegistry {
  private readonly metrics = new Map<string, CollectableMetric>();

  counter(name: string, help: string, labelNames: string[] = []) {
    const metric = this.metrics.get(name);
    if (metric) return metric as Counter;

    const counter = new Counter(name, help, labelNames);
    this.metrics.set(name, counter);
    return counter;
  }

  histogram(
    name: string,
    help: string,
    labelNames: string[] = [],
    buckets: number[] = DEFAULT_HISTOGRAM_BUCKETS_SECONDS
  ) {
    const metric = this.metrics.get(name);
    if (metric) return metric as Histogram;

    const histogram = new Histogram(name, help, labelNames, buckets);
    this.metrics.set(name, histogram);
    return histogram;
  }

  collect() {
    return Array.from(this.metrics.values())
      .map((metric) => metric.collect())
      .filter(Boolean)
      .join("\n");
  }
}

const globalForMetrics = globalThis as unknown as {
  tdFinanceMetrics?: MetricsRegistry;
};

export const metrics = globalForMetrics.tdFinanceMetrics ?? new MetricsRegistry();
globalForMetrics.tdFinanceMetrics = metrics;

const healthChecksTotal = metrics.counter(
  "td_finance_health_checks_total",
  "Total health checks by check and result.",
  ["check", "result"]
);

const healthCheckDurationSeconds = metrics.histogram(
  "td_finance_health_check_duration_seconds",
  "Health check duration in seconds.",
  ["check", "result"],
  [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5]
);

const metricsScrapesTotal = metrics.counter(
  "td_finance_metrics_scrapes_total",
  "Total Prometheus metrics scrape attempts by result.",
  ["result"]
);

const syncJobRunsTotal = metrics.counter(
  "td_finance_sync_job_runs_total",
  "Total scheduled sync job route executions by provider, source, and result.",
  ["provider", "source", "result"]
);

const syncJobDurationSeconds = metrics.histogram(
  "td_finance_sync_job_duration_seconds",
  "Scheduled sync job route duration in seconds.",
  ["provider", "source", "result"],
  [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60, 120, 300, 600]
);

const syncRunsTotal = metrics.counter(
  "td_finance_sync_runs_total",
  "Total provider sync runs by provider, source, and run status.",
  ["provider", "source", "status"]
);

export function recordHealthCheck(input: {
  check: "live" | "ready";
  durationSeconds: number;
  result: "failure" | "success";
}) {
  healthChecksTotal.inc({ check: input.check, result: input.result });
  healthCheckDurationSeconds.observe(
    { check: input.check, result: input.result },
    input.durationSeconds
  );
}

export function recordMetricsScrape(result: "disabled" | "success" | "unauthorized") {
  metricsScrapesTotal.inc({ result });
}

export function recordSyncJob(input: {
  durationSeconds: number;
  provider: "plaid" | "snaptrade";
  result: "error" | "partial_error" | "success";
  source: string;
}) {
  const labels = {
    provider: input.provider,
    result: input.result,
    source: input.source.toLowerCase(),
  };
  syncJobRunsTotal.inc(labels);
  syncJobDurationSeconds.observe(labels, input.durationSeconds);
}

export function recordSyncRunStatuses(input: {
  provider: "plaid" | "snaptrade";
  runs: Array<{ status: string }>;
  source: string;
}) {
  for (const run of input.runs) {
    syncRunsTotal.inc({
      provider: input.provider,
      source: input.source.toLowerCase(),
      status: run.status.toLowerCase(),
    });
  }
}

export function collectPrometheusMetrics() {
  return [collectProcessMetrics(), metrics.collect()].filter(Boolean).join("\n\n") + "\n";
}

function collectProcessMetrics() {
  const memoryUsage = process.memoryUsage();
  return [
    "# HELP td_finance_app_info Application metadata.",
    "# TYPE td_finance_app_info gauge",
    `td_finance_app_info${formatLabels({
      environment: process.env.NODE_ENV ?? "development",
      service: "td-personal-finance-analysis",
    })} 1`,
    "# HELP td_finance_process_start_time_seconds Unix timestamp when this process started.",
    "# TYPE td_finance_process_start_time_seconds gauge",
    `td_finance_process_start_time_seconds ${formatNumber(PROCESS_STARTED_AT_SECONDS)}`,
    "# HELP td_finance_process_uptime_seconds Process uptime in seconds.",
    "# TYPE td_finance_process_uptime_seconds gauge",
    `td_finance_process_uptime_seconds ${formatNumber(process.uptime())}`,
    "# HELP td_finance_process_resident_memory_bytes Resident memory size in bytes.",
    "# TYPE td_finance_process_resident_memory_bytes gauge",
    `td_finance_process_resident_memory_bytes ${formatNumber(memoryUsage.rss)}`,
    "# HELP td_finance_nodejs_heap_used_bytes Node.js heap used in bytes.",
    "# TYPE td_finance_nodejs_heap_used_bytes gauge",
    `td_finance_nodejs_heap_used_bytes ${formatNumber(memoryUsage.heapUsed)}`,
    "# HELP td_finance_nodejs_heap_total_bytes Node.js heap total in bytes.",
    "# TYPE td_finance_nodejs_heap_total_bytes gauge",
    `td_finance_nodejs_heap_total_bytes ${formatNumber(memoryUsage.heapTotal)}`,
  ].join("\n");
}

function labelKey(labelNames: string[], labels: MetricLabels) {
  return labelNames.map((labelName) => String(labels[labelName] ?? "")).join("\u001f");
}

function filterLabels(labelNames: string[], labels: MetricLabels) {
  return Object.fromEntries(labelNames.map((labelName) => [labelName, labels[labelName] ?? ""]));
}

function metricHeader(name: string, help: string, type: "counter" | "histogram") {
  return [`# HELP ${name} ${escapeHelp(help)}`, `# TYPE ${name} ${type}`];
}

function formatLabels(labels: MetricLabels) {
  const entries = Object.entries(labels);
  if (entries.length === 0) return "";

  return `{${entries
    .map(([key, value]) => `${key}="${escapeLabelValue(String(value))}"`)
    .join(",")}}`;
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : String(value);
}

function escapeHelp(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n");
}

function escapeLabelValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
}
