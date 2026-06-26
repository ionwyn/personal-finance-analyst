import OpenAI from "openai";
import type { ResponseInput, ResponseStreamEvent } from "openai/resources/responses/responses";

import { sanitizeRemoteAssistantText } from "@/lib/assistant/remote-sanitize";
import {
  getOpenAIApiKey,
  getOpenAIModel,
  getOpenAIReasoningEffort,
  type OpenAIReasoningEffort,
} from "@/lib/env";

import { ANSWER_SEP, THINK_SEP, type ChatMessage } from "./ollama";
import { PERIODS, PLAN_INTENTS } from "./query";

export class OpenAIUnavailableError extends Error {
  constructor(message = "OpenAI assistant model is unavailable", cause?: unknown) {
    super(message);
    this.name = "OpenAIUnavailableError";
    if (cause) this.cause = cause;
  }
}

type OpenAIChatOptions = {
  model?: string;
  reasoning?: boolean;
  webSearch?: boolean;
};

const plannerJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["intent"],
  properties: {
    intent: { type: "string", enum: PLAN_INTENTS },
    filters: {
      type: "object",
      additionalProperties: false,
      properties: {
        q: { type: "string", maxLength: 80 },
        category: { type: "string", maxLength: 80 },
        period: { type: "string", enum: PERIODS },
        from: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        to: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
        bucket: { type: "string", enum: ["spending", "income"] },
        amountMin: { type: "number", minimum: 0 },
        amountMax: { type: "number", minimum: 0 },
      },
    },
  },
} as const;

function getClient(): OpenAI {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) {
    throw new OpenAIUnavailableError("OpenAI API key is not configured.");
  }
  return new OpenAI({ apiKey });
}

function toOpenAIInput(messages: ChatMessage[]): ResponseInput {
  return messages.map((message) => ({
    role: message.role,
    content: sanitizeRemoteAssistantText(message.content),
  }));
}

function withRemotePrivacyInstruction(messages: ChatMessage[], webSearch: boolean): ChatMessage[] {
  const remoteInstruction = [
    "REMOTE MODEL PRIVACY RULES:",
    "- The supplied finance facts and evidence are private. Do not infer, expose, or ask for direct identifiers.",
    "- Use only the redacted prompt/evidence provided by the server for private financial facts.",
    webSearch
      ? "- Web search is available only for public market, company, security, macro, and general finance context. Do not search for private account, transaction, merchant, person, address, email, phone, tenant, or account identifiers."
      : "- Web search is not available for this turn.",
  ].join("\n");

  return [{ role: "system", content: remoteInstruction }, ...messages];
}

function reasoningConfig(enabled: boolean): { effort: OpenAIReasoningEffort; summary?: "auto" } {
  if (!enabled) return { effort: "none" };
  return { effort: getOpenAIReasoningEffort(), summary: "auto" };
}

function openAITools(webSearch: boolean) {
  if (!webSearch) return undefined;
  return [{ type: "web_search" as const, search_context_size: "low" as const }];
}

function handleStreamEvent(input: {
  event: ResponseStreamEvent;
  controller: ReadableStreamDefaultController<Uint8Array>;
  encoder: TextEncoder;
  reasoning: boolean;
}) {
  const { event, controller, encoder, reasoning } = input;

  if (event.type === "response.output_text.delta") {
    controller.enqueue(encoder.encode(reasoning ? `${ANSWER_SEP}${event.delta}` : event.delta));
    return;
  }

  if (reasoning && event.type === "response.reasoning_summary_text.delta") {
    controller.enqueue(encoder.encode(`${THINK_SEP}${event.delta}`));
    return;
  }

  if (reasoning && event.type === "response.web_search_call.searching") {
    controller.enqueue(encoder.encode(`${THINK_SEP}Searching public web context...\n`));
    return;
  }

  if (event.type === "response.failed") {
    throw new OpenAIUnavailableError("OpenAI response failed.");
  }
}

export async function chatOpenAIJSON(
  messages: ChatMessage[],
  options: OpenAIChatOptions = {}
): Promise<string> {
  try {
    const response = await getClient().responses.create({
      model: options.model ?? getOpenAIModel(),
      input: toOpenAIInput(withRemotePrivacyInstruction(messages, false)),
      max_output_tokens: 800,
      reasoning: reasoningConfig(false),
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "assistant_plan",
          schema: plannerJsonSchema,
          strict: false,
        },
      },
    });

    return response.output_text ?? "";
  } catch (error) {
    if (error instanceof OpenAIUnavailableError) throw error;
    throw new OpenAIUnavailableError("OpenAI plan step failed.", error);
  }
}

export async function streamOpenAIChat(
  messages: ChatMessage[],
  options: OpenAIChatOptions = {}
): Promise<ReadableStream<Uint8Array>> {
  const reasoning = Boolean(options.reasoning);
  const client = getClient();
  const stream = client.responses.stream({
    model: options.model ?? getOpenAIModel(),
    input: toOpenAIInput(withRemotePrivacyInstruction(messages, Boolean(options.webSearch))),
    max_output_tokens: 2500,
    reasoning: reasoningConfig(reasoning),
    store: false,
    text: { verbosity: "low" },
    tools: openAITools(Boolean(options.webSearch)),
  });

  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          handleStreamEvent({ event, controller, encoder, reasoning });
        }
        controller.close();
      } catch (error) {
        controller.error(
          error instanceof OpenAIUnavailableError
            ? error
            : new OpenAIUnavailableError("OpenAI stream failed.", error)
        );
      }
    },
    cancel() {
      stream.abort();
    },
  });
}
