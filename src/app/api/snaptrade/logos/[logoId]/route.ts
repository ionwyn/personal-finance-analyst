import { NextResponse } from "next/server";

import { requireOwnedSnapTradeLogo } from "@/lib/http";
import { fetchAndCacheLogo } from "@/lib/snaptrade/logo";

export async function GET(_request: Request, context: { params: Promise<{ logoId: string }> }) {
  const { logoId } = await context.params;
  const auth = await requireOwnedSnapTradeLogo(logoId);
  if (!("logoId" in auth)) return auth.error;

  const logo = await fetchAndCacheLogo(logoId);
  if (!logo?.data || !logo.contentType || logo.status !== "READY") {
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Cache-Control": "private, max-age=300",
      },
    });
  }

  return new NextResponse(logo.data, {
    status: 200,
    headers: {
      "Content-Type": logo.contentType,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
