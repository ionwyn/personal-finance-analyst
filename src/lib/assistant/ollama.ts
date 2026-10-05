import { getOllamaBaseUrl, getOllamaModel } from "@/lib/env";

// ─── Thin Ollama client ────────────────────────────────────────────────────
// Talks to the local Ollama server's /api/chat endpoint. Used by the assistant
// route for two calls: a non-streaming JSON "plan" step and a streaming
// narration step. No data ever leaves the machine.

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

// Stream framing for reasoning mode: thinking tokens are prefixed with THINK_SEP,
// answer tokens with ANSWER_SEP. These C0 control bytes never appear in normal
// UTF-8 prose, so the client can split a single text stream into two channels.
export const THINK_SEP = "\x02";
export const ANSWER_SEP = "\x03";

/** Thrown when the local Ollama server can't be reached. Route maps this to 503. */
export class OllamaUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("Local Ollama server is not reachable");
    this.name = "OllamaUnavailableError";
    if (cause) this.cause = cause;
  }
}

type ChatOptions = {
  temperature?: number;
  /** Override the Ollama model for this call. Defaults to getOllamaModel(). */
  model?: string;
};

async function postChat(body: unknown, signal?: AbortSignal): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${getOllamaBaseUrl()}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    throw new OllamaUnavailableError(error);
  }
  if (!res.ok) {
    if (res.status >= 500 || res.status === 404) throw new OllamaUnavailableError();
    throw new Error(`Ollama error ${res.status}: ${await res.text().catch(() => "")}`);
  }
  return res;
}

/**
 * Single non-streaming completion constrained to JSON output (Ollama
 * `format: "json"`). Returns the raw assistant content string (expected JSON).
 */
export async function chatJSON(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<string> {
  const res = await postChat({
    model: options.model ?? getOllamaModel(),
    messages,
    stream: false,
    format: "json",
    options: { temperature: options.temperature ?? 0 },
  });
  const data = (await res.json()) as { message?: { content?: string } };
  return data.message?.content ?? "";
}

/**
 * Streaming chat. Returns a ReadableStream of plain text tokens (the assistant's
 * content), decoded from Ollama's NDJSON stream.
 */
export async function streamChatText(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<ReadableStream<Uint8Array>> {
  const res = await postChat({
    model: options.model ?? getOllamaModel(),
    messages,
    stream: true,
    options: { temperature: options.temperature ?? 0.3 },
  });

  const body = res.body;
  if (!body) throw new OllamaUnavailableError();

  const reader = body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  // A start()-based pump loop: continuously drain Ollama's NDJSON body and
  // enqueue just the assistant content tokens. More robust than a per-pull read,
  // which can stall on chunks that decode to no content (e.g. the final done:true).
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const json = JSON.parse(trimmed) as { message?: { content?: string } };
              const token = json.message?.content;
              if (token) controller.enqueue(encoder.encode(token));
            } catch {
              // Ignore partial/non-JSON lines; the next chunk will complete them.
            }
          }
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

/**
 * Streaming chat for reasoning models (e.g. deepseek-r1) that emit a separate
 * `message.thinking` chain-of-thought alongside `message.content`. Thinking
 * tokens are prefixed with THINK_SEP and answer tokens with ANSWER_SEP so the
 * client can route them into separate display channels from one text stream.
 */
export async function streamChatWithThinking(
  messages: ChatMessage[],
  options: ChatOptions = {}
): Promise<ReadableStream<Uint8Array>> {
  const res = await postChat({
    model: options.model ?? getOllamaModel(),
    messages,
    stream: true,
    options: { temperature: options.temperature ?? 0.5 },
  });

  const body = res.body;
  if (!body) throw new OllamaUnavailableError();

  const reader = body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const json = JSON.parse(trimmed) as {
                message?: { content?: string; thinking?: string };
              };
              const thinking = json.message?.thinking;
              if (thinking) controller.enqueue(encoder.encode(THINK_SEP + thinking));
              const token = json.message?.content;
              if (token) controller.enqueue(encoder.encode(ANSWER_SEP + token));
            } catch {
              // Ignore partial/non-JSON lines; the next chunk will complete them.
            }
          }
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
