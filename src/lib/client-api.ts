export async function requestApi(url: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(url, init);
  if (response.ok) return response;

  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  throw new Error(body?.error ?? `Request failed with ${response.status}`);
}
