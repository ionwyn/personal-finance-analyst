import type { InvestmentDashboardData } from "@/lib/investments/types";

type AllocRow = { name: string; pct: number; value: number; color: string };

function AllocPanel({
  title,
  meta,
  rows,
  footer,
}: {
  title: string;
  meta: string;
  rows: AllocRow[];
  footer?: React.ReactNode;
}) {
  return (
    <div className="panel">
      <div className="panel-head">
        <div className="panel-title">{title}</div>
        <div className="panel-meta">{meta}</div>
      </div>
      <div className="panel-body">
        <div className="alloc-bar">
          {rows.map((a) => (
            <div
              key={a.name}
              className="seg"
              style={{ width: `${a.pct}%`, background: a.color }}
              title={`${a.name} ${a.pct.toFixed(1)}%`}
            />
          ))}
        </div>
        <div className="alloc-list">
          {rows.map((a) => (
            <div className="alloc-row" key={a.name}>
              <i className="sw" style={{ background: a.color }} />
              <span className="nm">{a.name}</span>
              <span className="pct">{a.pct.toFixed(1)}%</span>
              <span className="v">
                ${a.value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </span>
            </div>
          ))}
        </div>
        {footer}
      </div>
    </div>
  );
}

export function AllocationPanels({
  allocByType,
  allocByCcy,
  fxUSDtoCAD,
}: {
  allocByType: InvestmentDashboardData["allocByType"];
  allocByCcy: InvestmentDashboardData["allocByCcy"];
  fxUSDtoCAD: number | null;
}) {
  return (
    <div className="alloc-grid">
      <AllocPanel
        title="Allocation · Asset type"
        meta={`${allocByType.length} TYPES`}
        rows={allocByType}
      />
      <AllocPanel
        title="Allocation · Currency"
        meta="FX EXPOSURE"
        rows={allocByCcy}
        footer={
          <div className="fx-note">
            <i className="live-dot" />
            {fxUSDtoCAD
              ? `FX cached · 1 USD = ${fxUSDtoCAD.toFixed(4)} CAD`
              : "FX cached during SnapTrade sync"}
          </div>
        }
      />
    </div>
  );
}
