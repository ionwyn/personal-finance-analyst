export function isCronAuthorized(headers: Headers, secret?: string | null) {
  if (!secret) return false;
  return (
    headers.get("authorization") === `Bearer ${secret}` || headers.get("x-cron-secret") === secret
  );
}
