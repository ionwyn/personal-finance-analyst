"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatMoney } from "@/components/big-number";

type CashflowDatum = { month: string; income: number; spending: number; net: number };
type BalanceDatum = { date: string; balance: number };
type CategoryDatum = { category: string; amount: number; pct: number; color: string };

type RechartsTooltipProps = {
  active?: boolean;
  payload?: Array<{ value: number; dataKey?: string; payload?: Record<string, unknown> }>;
  label?: string | number;
};

function CashflowTooltip({ active, payload, label }: RechartsTooltipProps) {
  if (!active || !payload?.length) return null;
  const inc = payload.find((p) => p.dataKey === "income")?.value ?? 0;
  const sp = payload.find((p) => p.dataKey === "spending")?.value ?? 0;
  const net = inc - sp;
  return (
    <div className="tt">
      <div className="tt-label">{label}</div>
      <div className="tt-row">
        <span className="k">
          <i className="tt-sw" style={{ background: "var(--pos)" }} />
          Income
        </span>
        <span className="v">{formatMoney(inc)}</span>
      </div>
      <div className="tt-row">
        <span className="k">
          <i className="tt-sw" style={{ background: "var(--neg)" }} />
          Spending
        </span>
        <span className="v">{formatMoney(sp)}</span>
      </div>
      <div className="tt-row">
        <span className="k">Net</span>
        <span className="v" style={{ color: net >= 0 ? "var(--pos)" : "var(--neg)" }}>
          {formatMoney(net, { sign: true })}
        </span>
      </div>
    </div>
  );
}

function BalanceTooltip({ active, payload, label }: RechartsTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="tt">
      <div className="tt-label">{label}</div>
      <div className="tt-row">
        <span className="k">Net worth</span>
        <span className="v">{formatMoney(payload[0].value)}</span>
      </div>
    </div>
  );
}

const AXIS_TICK = { fontSize: 10, fill: "var(--text-3)", fontFamily: "var(--font-mono)" } as const;

export function CashflowChart({ data }: { data: CashflowDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -8 }} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke="var(--border-subtle)" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tick={AXIS_TICK} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => "$" + (v / 1000).toFixed(0) + "k"}
          tick={AXIS_TICK}
          width={42}
        />
        <Tooltip content={<CashflowTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <Bar dataKey="income" fill="var(--pos)" radius={[2, 2, 0, 0]} />
        <Bar dataKey="spending" fill="var(--neg)" radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BalanceChart({ data }: { data: BalanceDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border-subtle)" />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tick={AXIS_TICK} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => "$" + (v / 1000).toFixed(0) + "k"}
          tick={AXIS_TICK}
          width={42}
          domain={["dataMin - 2000", "dataMax + 2000"]}
        />
        <Tooltip
          content={<BalanceTooltip />}
          cursor={{ stroke: "var(--border-strong)", strokeDasharray: "2 2" }}
        />
        <Area
          type="monotone"
          dataKey="balance"
          stroke="var(--accent)"
          strokeWidth={1.6}
          fill="url(#balGrad)"
          dot={false}
          activeDot={{ r: 3, fill: "var(--accent)", stroke: "var(--bg)", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CategoryDonut({ data, total }: { data: CategoryDatum[]; total: number }) {
  return (
    <div style={{ position: "relative", width: 120, height: 120 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="amount"
            nameKey="category"
            innerRadius={36}
            outerRadius={56}
            stroke="var(--surface)"
            strokeWidth={2}
            paddingAngle={1}
            isAnimationActive={false}
          >
            {data.map((c, i) => (
              <Cell key={`${c.category}-${i}`} fill={c.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          pointerEvents: "none",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 14,
              fontWeight: 500,
              letterSpacing: "-0.02em",
            }}
          >
            ${(total / 1000).toFixed(1)}k
          </div>
          <div
            style={{
              fontSize: 9,
              color: "var(--text-4)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginTop: 1,
            }}
          >
            Total
          </div>
        </div>
      </div>
    </div>
  );
}
