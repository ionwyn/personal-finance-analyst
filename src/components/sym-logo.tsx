export function SymLogo({
  symbol,
  bg,
  size = 22,
  logoId
}: {
  symbol: string;
  bg?: string;
  size?: number;
  logoId?: string | null;
}) {
  const txt = symbol.replace(/\..*$/, "").slice(0, 4);
  const hasLogo = Boolean(logoId);

  return (
    <div
      className="sym-logo"
      aria-label={hasLogo ? `${symbol} logo` : undefined}
      style={{
        background: bg ?? "var(--invest)",
        backgroundImage: hasLogo ? `url(/api/snaptrade/logos/${logoId})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        width: size,
        height: size,
        fontSize: size <= 22 ? 9.5 : 10
      }}
    >
      {hasLogo ? null : txt}
    </div>
  );
}
