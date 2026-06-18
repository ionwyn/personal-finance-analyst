"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import chartStyles from "@/components/shared/charts.module.scss";
import { formatMoney } from "@/lib/format";
import type { ContributionData } from "@/lib/investments/types";

type ChartDatum = {
  month: string;
  contribution: number;
  withdrawal: number;
  cumulative: number;
};

const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function buildChartData(data: ContributionData): ChartDatum[] {
  const allMonths = data.years
    .slice()
    .sort((a, b) => a.year - b.year)
    .flatMap((yr) => yr.months.slice().sort((a, b) => a.month.localeCompare(b.month)));

  let cumulative = 0;
  return allMonths.map((m) => {
    const net = m.contributionCad - m.withdrawalCad;
    cumulative += net;
    return {
      month: m.month,
      contribution: m.contributionCad,
      withdrawal: m.withdrawalCad > 0 ? -m.withdrawalCad : 0,
      cumulative,
    };
  });
}

type TTProps = {
  active?: boolean;
  payload?: Array<{ value: number; dataKey?: string }>;
  label?: string;
};

function ContribTooltip({ active, payload, label }: TTProps) {
  if (!active || !payload?.length) return null;
  const contribution = payload.find((p) => p.dataKey === "contribution")?.value ?? 0;
  const withdrawal = Math.abs(payload.find((p) => p.dataKey === "withdrawal")?.value ?? 0);
  const cumulative = payload.find((p) => p.dataKey === "cumulative")?.value ?? 0;
  const net = contribution - withdrawal;

  const parts = (label ?? "").split("-");
  const monthLabel = MONTH_ABBR[parseInt(parts[1], 10) - 1] ?? parts[1];

  return (
    <div className={chartStyles.tt}>
      <div className={chartStyles.ttLabel}>
        {monthLabel} {parts[0]}
      </div>
      {contribution > 0 && (
        <div className={chartStyles.ttRow}>
          <span className={chartStyles.ttKey}>
            <i className={chartStyles.ttSw} style={{ background: "var(--pos)" }} />
            Contributed
          </span>
          <span className={chartStyles.ttVal}>{formatMoney(contribution)}</span>
        </div>
      )}
      {withdrawal > 0 && (
        <div className={chartStyles.ttRow}>
          <span className={chartStyles.ttKey}>
            <i className={chartStyles.ttSw} style={{ background: "var(--neg)" }} />
            Withdrawn
          </span>
          <span className={chartStyles.ttVal}>{formatMoney(withdrawal)}</span>
        </div>
      )}
      <div className={chartStyles.ttRow}>
        <span className={chartStyles.ttKey}>Net</span>
        <span
          className={chartStyles.ttVal}
          style={{ color: net >= 0 ? "var(--pos)" : "var(--neg)" }}
        >
          {formatMoney(net, { sign: true })}
        </span>
      </div>
      <div className={chartStyles.ttRow}>
        <span className={chartStyles.ttKey}>Cumulative</span>
        <span className={chartStyles.ttVal} style={{ color: "var(--accent)" }}>
          {formatMoney(cumulative)}
        </span>
      </div>
    </div>
  );
}

const AXIS_TICK = {
  fontSize: 10,
  fill: "var(--text-3)",
  fontFamily: "var(--font-mono)",
} as const;

function tickFormatter(month: string): string {
  const mo = parseInt(month.split("-")[1], 10);
  if (mo === 1) return month.split("-")[0];
  if (mo === 4) return "Apr";
  if (mo === 7) return "Jul";
  if (mo === 10) return "Oct";
  return "";
}

export function ContributionChart({ contributions }: { contributions: ContributionData }) {
  const data = buildChartData(contributions);
  if (data.length < 2) return null;

  const maxContrib = Math.max(...data.map((d) => d.contribution));
  const maxWithdrawal = Math.max(...data.map((d) => Math.abs(d.withdrawal)));
  const barRange = Math.max(maxContrib, maxWithdrawal, 1);

  const yearBoundaries = data.map((d) => d.month).filter((m, i) => i > 0 && m.endsWith("-01"));

  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">Net contribution over time</div>
        <div className="panel-meta" style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <i
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                background: "var(--pos)",
                borderRadius: 2,
                flexShrink: 0,
              }}
            />
            Contributed
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <i
              style={{
                display: "inline-block",
                width: 10,
                height: 10,
                background: "var(--neg)",
                borderRadius: 2,
                flexShrink: 0,
              }}
            />
            Withdrawn
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <i
              style={{
                display: "inline-block",
                width: 18,
                height: 2,
                background: "var(--accent)",
                borderRadius: 1,
                flexShrink: 0,
              }}
            />
            Cumulative net
          </span>
        </div>
      </div>
      <div className="panel-body">
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer initialDimension={{ width: 1, height: 1 }}>
            <ComposedChart data={data} margin={{ top: 10, right: 58, bottom: 0, left: -2 }}>
              <CartesianGrid vertical={false} stroke="var(--border-subtle)" />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tick={AXIS_TICK}
                tickFormatter={tickFormatter}
              />
              <YAxis
                yAxisId="bar"
                tickLine={false}
                axisLine={false}
                tick={AXIS_TICK}
                tickFormatter={(v: number) =>
                  (v < 0 ? "−$" : "$") + (Math.abs(v) / 1000).toFixed(0) + "k"
                }
                width={42}
                domain={[-barRange * 1.25, barRange * 1.25]}
              />
              <YAxis
                yAxisId="line"
                orientation="right"
                tickLine={false}
                axisLine={false}
                tick={AXIS_TICK}
                tickFormatter={(v: number) => "$" + (v / 1000).toFixed(0) + "k"}
                width={52}
              />
              <Tooltip content={<ContribTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <ReferenceLine yAxisId="bar" y={0} stroke="var(--border-subtle)" />
              {yearBoundaries.map((m) => (
                <ReferenceLine
                  key={m}
                  yAxisId="bar"
                  x={m}
                  stroke="var(--border-subtle)"
                  strokeDasharray="2 4"
                />
              ))}
              <Bar
                yAxisId="bar"
                dataKey="contribution"
                fill="var(--pos)"
                radius={[2, 2, 0, 0]}
                maxBarSize={14}
                isAnimationActive={false}
              />
              <Bar
                yAxisId="bar"
                dataKey="withdrawal"
                fill="var(--neg)"
                radius={[0, 0, 2, 2]}
                maxBarSize={14}
                isAnimationActive={false}
              />
              <Line
                yAxisId="line"
                type="monotone"
                dataKey="cumulative"
                stroke="var(--accent)"
                strokeWidth={1.8}
                dot={false}
                activeDot={{ r: 3, fill: "var(--accent)", stroke: "var(--bg)", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
