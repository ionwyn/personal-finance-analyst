import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";

import { OllamaUnavailableError } from "@/lib/assistant/ollama";
import { createAssistantTurn } from "@/lib/assistant/pipeline";
import { authOptions } from "@/lib/auth";
import { parseJson } from "@/lib/http";
import { setLogContext, withRequestLogging } from "@/lib/logger";
import { validateRequestOrigin } from "@/lib/origin";
import { rateLimitRequest } from "@/lib/rate-limit";
import { resolveSessionTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
        evidence: z.string().max(20000).optional(),
      })
    )
    .min(1)
    .max(20),
  mode: z.enum(["fact", "reasoning"]).default("fact"),
});

const EVIDENCE_SEP = "\x04";

function withEvidenceMetadata(
  stream: ReadableStream<Uint8Array>,
  evidence: string | undefined
): ReadableStream<Uint8Array> {
  if (!evidence) return stream;

  const reader = stream.getReader();
  const encoder = new TextEncoder();
  const frame = `${EVIDENCE_SEP}${Buffer.from(JSON.stringify({ evidence }), "utf8").toString("base64")}\n`;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(frame));
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });
}

export async function POST(request: Request) {
  return withRequestLogging(request, { route: "/api/assistant/chat" }, async () => {
    const limited = rateLimitRequest(request, {
      keyPrefix: "assistant:chat",
      limit: 20,
      windowMs: 60_000,
    });
    if (limited) return limited;

    const invalidOrigin = validateRequestOrigin(request);
    if (invalidOrigin) return invalidOrigin;

    const session = await getServerSession(authOptions);
    const { tenantId, tenantSlug } = await resolveSessionTenant(session);
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant found" }, { status: 404 });
    }
    setLogContext({ tenantId });

    const parsed = await parseJson(request, bodySchema);
    if ("error" in parsed) return parsed.error;

    // Keep only the most recent turns to bound prompt size.
    const history = parsed.data.messages.slice(-12);
    const mode = parsed.data.mode;
    if (!history.some((m) => m.role === "user")) {
      return NextResponse.json({ error: "No user message" }, { status: 400 });
    }

    try {
      const result = await createAssistantTurn({
        tenantId,
        tenantSlug,
        history,
        mode,
      });
      return new Response(withEvidenceMetadata(result.stream, result.evidence), {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "X-Accel-Buffering": "no",
        },
      });
    } catch (error) {
      if (error instanceof OllamaUnavailableError) {
        return NextResponse.json(
          { error: "The local AI model is unavailable. Is Ollama running?" },
          { status: 503 }
        );
      }
      throw error;
    }
  });
}
