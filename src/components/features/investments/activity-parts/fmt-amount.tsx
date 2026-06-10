import { formatMoney } from "@/lib/format";

export function FmtAmount({ value, ccy }: { value: number | null; ccy?: string }) {
  if (value == null || value === 0) {
    return <span style={{ color: "var(--text-4)" }}>—</span>;
  }
  const pos = value > 0;
  return (
    <span className={pos ? "amt-pos" : "amt-neg"}>
      {formatMoney(value, { sign: true })}
      {ccy ? <span className="ccy-suffix"> {ccy}</span> : null}
    </span>
  );
}
