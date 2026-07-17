import { hashColor, logoText } from "@/lib/investments/shared/logo";

type Props = {
  name: string;
  /** Base64 PNG from Plaid. If provided, renders as <img>. */
  logo?: string | null;
  /** Override background colour for the initials fallback. */
  bg?: string | null;
  size?: number;
  radius?: number;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Renders a financial institution logo. Uses the Plaid-fetched base64 PNG when
 * available, falls back to a coloured initials tile derived from the name.
 */
export function InstitutionLogo({
  name,
  logo,
  bg,
  size = 36,
  radius = 7,
  className,
  style,
}: Props) {
  const sharedStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius,
    flexShrink: 0,
    ...style,
  };

  if (logo) {
    const src = logo.startsWith("https://") ? logo : `data:image/png;base64,${logo}`;
    return (
      // next/image can't optimize base64 data URIs (the common case here) and
      // these are fixed ~36px icons, so the optimizer would add config for no win.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className={className}
        style={{ ...sharedStyle, objectFit: "contain", background: "transparent" }}
      />
    );
  }

  const background = bg ?? hashColor(name);
  const text = logoText(name);

  return (
    <div
      className={className}
      style={{
        ...sharedStyle,
        background,
        display: "grid",
        placeItems: "center",
        fontFamily: "var(--font-mono)",
        fontWeight: 700,
        fontSize: Math.round(size * 0.36),
        color: "#fff",
        letterSpacing: "-0.04em",
      }}
    >
      {text || "—"}
    </div>
  );
}
