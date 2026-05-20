export function BigNumber({
  value,
  signed = false,
  currency = "$",
}: {
  value: number;
  signed?: boolean;
  currency?: string;
}) {
  const sign = value < 0 ? "−" : signed && value > 0 ? "+" : "";
  const abs = Math.abs(value);
  const intPart = Math.floor(abs).toLocaleString("en-US");
  const fracPart = (abs % 1).toFixed(2).slice(1);
  return (
    <span className="kpi-value">
      <span className="ccy">{currency}</span>
      {sign}
      {intPart}
      <span className="frac">{fracPart}</span>
    </span>
  );
}
