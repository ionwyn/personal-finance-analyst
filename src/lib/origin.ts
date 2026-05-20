import { NextResponse } from "next/server";

function addUrlOrigin(origins: Set<string>, value: string | undefined) {
  if (!value) return;

  try {
    origins.add(new URL(value).origin);
  } catch {
    // Ignore malformed deployment config here; callers will still compare against request origin.
  }
}

function requestOrigin(request: Request) {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return null;

  const protocol = request.headers.get("x-forwarded-proto") ?? "https";
  return `${protocol}://${host}`;
}

export function allowedOriginsForRequest(request: Request) {
  const origins = new Set<string>();

  addUrlOrigin(origins, process.env.NEXTAUTH_URL);
  if (process.env.VERCEL_URL) addUrlOrigin(origins, `https://${process.env.VERCEL_URL}`);

  const currentOrigin = requestOrigin(request);
  if (currentOrigin) addUrlOrigin(origins, currentOrigin);

  return origins;
}

export function validateRequestOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  if (allowedOriginsForRequest(request).has(origin)) return null;

  return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
}
