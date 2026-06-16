/**
 * Deterministic fallback branding for institutions and symbols that have no
 * fetched logo: a stable background colour derived from the name, plus a short
 * monogram. Same name always yields the same colour/initials.
 */
export const LOGO_PALETTE = [
  "#a6192e",
  "#0072c6",
  "#1d1d1f",
  "#0d8b3e",
  "#00a4ef",
  "#ed1a3b",
  "#7ab55c",
  "#4285f4",
  "#ff6a00",
  "#76b900",
  "#1f3a93",
  "#003168",
  "#ff9900",
  "#0668e1",
  "#cc0000",
  "#e21c2c",
  "#000000",
];

export function hashColor(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) >>> 0;
  }
  return LOGO_PALETTE[h % LOGO_PALETTE.length] ?? "#1f3a93";
}

export function logoText(name: string | null | undefined): string {
  return (
    (name ?? "ST")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "ST"
  );
}
