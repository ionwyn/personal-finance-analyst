export function SymLogo({
  symbol,
  bg,
  size = 22
}: {
  symbol: string;
  bg?: string;
  size?: number;
}) {
  const txt = symbol.replace(/\..*$/, "").slice(0, 4);
  return (
    <div
      className="sym-logo"
      style={{
        background: bg ?? "var(--invest)",
        width: size,
        height: size,
        fontSize: size <= 22 ? 9.5 : 10
      }}
    >
      {txt}
    </div>
  );
}
