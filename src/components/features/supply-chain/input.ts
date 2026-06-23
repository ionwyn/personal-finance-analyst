// Normalises free-text ticker entry from the search boxes: strips a leading
// "$", whitespace and stray punctuation, uppercases the rest.
export function normalizeInput(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/^\$/, "")
    .replace(/[^A-Z0-9.]/g, "");
}
