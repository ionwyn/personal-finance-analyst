const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const PHONE_RE =
  /(?<!\d)(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b(?!\d)/g;
const LONG_NUMBER_RE = /\b(?:\d[\s-]?){9,}\b/g;
const SECRET_LINE_RE =
  /\b(api[_\s-]?key|access[_\s-]?token|refresh[_\s-]?token|secret|password|tenant[_\s-]?id|account[_\s-]?id|item[_\s-]?id|connection[_\s-]?id)\b\s*[:=]\s*[^\n,;]+/gi;
const LAST_FOUR_RE =
  /\b(account|card|acct)\s*(ending|last\s*(?:four|4))?\s*(?:in|with|:)?\s*\d{2,}\b/gi;

/**
 * Keep numeric finance facts useful while removing obvious direct identifiers
 * before text is sent to a remote model.
 */
export function sanitizeRemoteAssistantText(value: string): string {
  return value
    .replace(EMAIL_RE, "[email redacted]")
    .replace(PHONE_RE, "[phone redacted]")
    .replace(SECRET_LINE_RE, (match, label: string) => `${label}: [redacted]`)
    .replace(LAST_FOUR_RE, "$1 [redacted]")
    .replace(LONG_NUMBER_RE, "[number redacted]");
}
