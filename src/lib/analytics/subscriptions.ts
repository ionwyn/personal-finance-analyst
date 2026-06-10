const SUBSCRIPTION_HINTS = [
  "netflix",
  "spotify",
  "hulu",
  "apple",
  "amazon prime",
  "disney",
  "youtube",
  "patreon",
  "github",
  "openai",
  "claude",
  "vercel",
  "figma",
  "notion",
  "1password",
  "dropbox",
  "icloud",
  "adobe",
  "ms365",
  "office 365",
  "linkedin",
  "twitter",
  "x premium",
  "equinox",
  "peloton",
  "audible",
  "kindle",
  "new york times",
  "wsj",
];

export function isLikelySubscription(name: string, category: string | null) {
  const lower = name.toLowerCase();
  if (SUBSCRIPTION_HINTS.some((s) => lower.includes(s))) return true;
  if (category && /subscription/i.test(category)) return true;
  return false;
}
