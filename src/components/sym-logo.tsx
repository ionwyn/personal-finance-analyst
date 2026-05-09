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
  return (
    <div
      className="sym-logo"
      style={{
        background: bg ?? "var(--invest)",
        backgroundImage: logoId ? `url(/api/snaptrade/logos/${logoId})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        width: size,
        height: size,
        fontSize: size <= 22 ? 9.5 : 10
      }}
    >
      {txt}
    </div>
  );
}
