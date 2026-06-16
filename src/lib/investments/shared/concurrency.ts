/**
 * Run `fn` over `items` with at most `limit` promises in flight at once,
 * preserving input order in the result. Used by the market-data loaders to
 * stay inside provider rate limits (e.g. Finnhub's 60 req/min) on cold sweeps.
 */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await fn(items[index]!);
      }
    })
  );
  return results;
}
