"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  Copy,
  RotateCw,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import clsx from "clsx";
import type { ElementContent, Root, RootContent } from "hast";

import { PageHeader, SegmentedControl } from "@/components/ui";
import { REASONING_STARTER_PROMPTS, STARTER_PROMPTS } from "@/lib/assistant/prompt";

import styles from "./assistant-view.module.scss";

type ChatRole = "user" | "assistant";
type AssistantMode = "fact" | "reasoning";
type Feedback = "up" | "down";
type Msg = {
  role: ChatRole;
  content: string;
  thinking?: string;
  evidence?: string;
  feedback?: Feedback;
};

// Stream sentinels mirrored from lib/assistant/ollama.ts: thinking tokens are
// prefixed with \x02, answer tokens with \x03. Only used in reasoning mode.
const THINK_SEP = "\x02";
const ANSWER_SEP = "\x03";
const EVIDENCE_SEP = "\x04";

function decodeEvidenceFrame(encoded: string): string | undefined {
  try {
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes)) as { evidence?: string };
    return data.evidence;
  } catch {
    return undefined;
  }
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Money like "CAD 1,234.56", "CAD -1,234.56", "$1,234", "-$50", "C$1,000.00".
const CURRENCY_RE =
  /\b(?:CAD|USD)\s-?\d[\d,]*(?:\.\d{1,2})?|-?(?:C\$|US\$|\$)\s?\d[\d,]*(?:\.\d{1,2})?/g;

// Split a text node, wrapping each currency amount in a span we can style. A
// global class (not CSS-module-hashed) is used so a plain string className
// survives react-markdown; it's targeted via :global() in the stylesheet.
function splitCurrencyText(value: string): ElementContent[] {
  const re = new RegExp(CURRENCY_RE.source, "g");
  const out: ElementContent[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(value)) !== null) {
    if (match.index > last) out.push({ type: "text", value: value.slice(last, match.index) });
    out.push({
      type: "element",
      tagName: "span",
      properties: { className: ["assistant-currency"] },
      children: [{ type: "text", value: match[0] }],
    });
    last = match.index + match[0].length;
  }
  if (last < value.length) out.push({ type: "text", value: value.slice(last) });
  return out;
}

function expandCurrency<T extends RootContent>(children: T[]): T[] {
  const next: T[] = [];
  for (const child of children) {
    if (child.type === "text") {
      next.push(...(splitCurrencyText(child.value) as T[]));
    } else {
      // Leave code/pre untouched so amounts stay literal inside code spans.
      if (child.type === "element" && child.tagName !== "code" && child.tagName !== "pre") {
        child.children = expandCurrency(child.children);
      }
      next.push(child);
    }
  }
  return next;
}

/** rehype plugin: highlight currency amounts in the rendered answer. */
function rehypeHighlightCurrency() {
  return (tree: Root) => {
    tree.children = expandCurrency(tree.children);
  };
}

/**
 * Render an assistant answer as Markdown. The model is prompted to use Markdown
 * (bold, bullets, GitHub-flavoured tables) for structured replies; `remark-gfm`
 * adds table/strikethrough/autolink support on top of CommonMark. Raw HTML is not
 * enabled, so model output can't inject markup. A rehype pass then highlights
 * currency amounts so the figures stand out from the prose.
 *
 * While `streaming`, only blocks that have closed (everything up to the last
 * blank line) are parsed as Markdown; the in-progress trailing block is shown as
 * plain text. This stops a half-built table or list from re-parsing and
 * reflowing on every token. The closed portion is memoised so it isn't re-parsed
 * until another block actually completes.
 */
function AssistantMarkdown({
  children,
  streaming = false,
}: {
  children: string;
  streaming?: boolean;
}) {
  const splitAt = streaming ? children.lastIndexOf("\n\n") : -1;
  const settled = streaming ? (splitAt === -1 ? "" : children.slice(0, splitAt)) : children;
  const tail = streaming ? (splitAt === -1 ? children : children.slice(splitAt + 2)) : "";

  const rendered = useMemo(
    () =>
      settled ? (
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlightCurrency]}>
          {settled}
        </ReactMarkdown>
      ) : null,
    [settled]
  );

  return (
    <div className={styles.markdown}>
      {rendered}
      {tail ? <div className={styles.streamTail}>{tail}</div> : null}
    </div>
  );
}

/** Three staggered pulsing dots shown while the model's answer is still empty. */
function TypingDots() {
  return (
    <span className={styles.dots} role="status" aria-label="Assistant is typing">
      <span className={styles.dot} />
      <span className={styles.dot} />
      <span className={styles.dot} />
    </span>
  );
}

/**
 * Collapsible chain-of-thought. While `live` (the model is still reasoning), it
 * auto-expands and streams so the long wait is visible; once the answer starts
 * it collapses back to a toggle.
 */
function ThinkingBlock({
  text,
  live = false,
  elapsed,
}: {
  text: string;
  live?: boolean;
  elapsed?: number;
}) {
  const [open, setOpen] = useState(false);
  const show = open || live;
  const bodyRef = useRef<HTMLDivElement>(null);

  // Keep the streaming reasoning scrolled to the latest line while live.
  useEffect(() => {
    if (live && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [text, live]);

  return (
    <div className={styles.thinking}>
      <button type="button" className={styles.thinkingToggle} onClick={() => setOpen((o) => !o)}>
        <ChevronRight size={12} className={show ? styles.thinkingChevronOpen : undefined} />
        <span className={live ? styles.thinkingLive : undefined}>
          Reasoning
          {live && elapsed != null ? ` · ${formatElapsed(elapsed)}` : ""}
        </span>
      </button>
      {show ? (
        <div ref={bodyRef} className={live ? styles.thinkingBodyLive : styles.thinkingBody}>
          {text}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Collapsible "evidence" panel showing the server-computed rows and figures the
 * answer was grounded in — the same block the model was given. It lets the user
 * audit exactly what a reply was based on, and only appears when the turn
 * actually fetched evidence (row-level, aggregate, or status questions; plain
 * summary answers carry none).
 */
function EvidenceBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.evidence}>
      <button type="button" className={styles.evidenceToggle} onClick={() => setOpen((o) => !o)}>
        <ChevronRight size={12} className={open ? styles.thinkingChevronOpen : undefined} />
        <span>Evidence</span>
      </button>
      {open ? <div className={styles.evidenceBody}>{text}</div> : null}
    </div>
  );
}

/**
 * Copy / regenerate / feedback controls shown beneath a finished answer.
 * Regenerate is offered only on the latest turn. Feedback is stored on the
 * message (client-side only for now) so the thumb selection is reflected.
 */
function MessageActions({
  content,
  canRegenerate,
  feedback,
  onRegenerate,
  onFeedback,
}: {
  content: string;
  canRegenerate: boolean;
  feedback?: Feedback;
  onRegenerate: () => void;
  onFeedback: (value: Feedback) => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard may be unavailable (e.g. insecure context); fail quietly.
    }
  };

  return (
    <div className={styles.actions}>
      <button
        type="button"
        className={styles.actionBtn}
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy answer"}
        title={copied ? "Copied" : "Copy"}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
      {canRegenerate ? (
        <button
          type="button"
          className={styles.actionBtn}
          onClick={onRegenerate}
          aria-label="Regenerate answer"
          title="Regenerate"
        >
          <RotateCw size={13} />
        </button>
      ) : null}
      <button
        type="button"
        className={clsx(styles.actionBtn, feedback === "up" && styles.actionBtnActive)}
        onClick={() => onFeedback("up")}
        aria-label="Good answer"
        aria-pressed={feedback === "up"}
        title="Good answer"
      >
        <ThumbsUp size={13} />
      </button>
      <button
        type="button"
        className={clsx(styles.actionBtn, feedback === "down" && styles.actionBtnActive)}
        onClick={() => onFeedback("down")}
        aria-label="Bad answer"
        aria-pressed={feedback === "down"}
        title="Bad answer"
      >
        <ThumbsDown size={13} />
      </button>
    </div>
  );
}

export function AssistantView() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AssistantMode>("fact");
  const [elapsed, setElapsed] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Tick a seconds counter while a request is in flight. Reasoning answers can
  // take minutes on CPU, so a running clock signals the model is still working.
  // (elapsed is reset to 0 in send() before busy flips on.)
  useEffect(() => {
    if (!busy) return;
    const start = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(id);
  }, [busy]);

  const scrollToEnd = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  };

  // Stream an assistant reply for `history` (which must end with a user turn).
  // Shared by send() and regenerate().
  async function streamAssistant(history: Msg[]) {
    setError(null);
    setElapsed(0);
    setBusy(true);
    scrollToEnd();

    // Placeholder assistant message we stream tokens into.
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    try {
      // Send only role+content, dropping any empty turns (e.g. a prior
      // thinking-only reply) the server's schema would reject.
      const payload = history
        .filter((m) => m.content.trim().length > 0)
        .map((m) => ({
          role: m.role,
          content: m.content,
          ...(m.evidence ? { evidence: m.evidence } : {}),
        }));
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: payload, mode }),
      });

      if (!res.ok || !res.body) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Something went wrong talking to the model.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let contentAcc = "";
      let thinkingAcc = "";
      let evidenceAcc: string | undefined;
      let evidenceBuffer = "";
      let waitingForEvidenceFrame = true;
      // Reasoning streams interleave thinking (\x02) and answer (\x03) spans;
      // DeepSeek emits thinking first, so default the cursor to "thinking".
      let target: "thinking" | "answer" = "thinking";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        let chunk = decoder.decode(value, { stream: true });

        if (waitingForEvidenceFrame) {
          const combined = evidenceBuffer + chunk;
          if (combined.startsWith(EVIDENCE_SEP)) {
            const end = combined.indexOf("\n");
            if (end === -1) {
              evidenceBuffer = combined;
              continue;
            }
            evidenceAcc = decodeEvidenceFrame(combined.slice(1, end));
            evidenceBuffer = "";
            waitingForEvidenceFrame = false;
            chunk = combined.slice(end + 1);
          } else {
            evidenceBuffer = "";
            waitingForEvidenceFrame = false;
            chunk = combined;
          }
        }

        if (mode === "reasoning") {
          let i = 0;
          while (i < chunk.length) {
            const tIdx = chunk.indexOf(THINK_SEP, i);
            const aIdx = chunk.indexOf(ANSWER_SEP, i);
            const next = Math.min(tIdx === -1 ? Infinity : tIdx, aIdx === -1 ? Infinity : aIdx);
            if (next === Infinity) {
              if (target === "thinking") thinkingAcc += chunk.slice(i);
              else contentAcc += chunk.slice(i);
              break;
            }
            const before = chunk.slice(i, next);
            if (target === "thinking") thinkingAcc += before;
            else contentAcc += before;
            target = chunk[next] === THINK_SEP ? "thinking" : "answer";
            i = next + 1;
          }
        } else {
          contentAcc += chunk;
        }

        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = {
            role: "assistant",
            content: contentAcc,
            thinking: thinkingAcc || undefined,
            evidence: evidenceAcc,
          };
          return copy;
        });
        scrollToEnd();
      }
      if (!contentAcc) {
        // No answer text arrived. Substitute a fallback so the message never
        // carries empty content into history (which the server rejects on the
        // next turn). Keep any thinking so the user can still see what happened.
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = {
            role: "assistant",
            content: thinkingAcc
              ? "(The model produced only reasoning, no answer. Try again, or switch to Fact mode.)"
              : "(No response. Is the local model running?)",
            thinking: thinkingAcc || undefined,
            evidence: evidenceAcc,
          };
          return copy;
        });
      }
    } catch (e) {
      setMessages((m) => m.slice(0, -1)); // drop the empty assistant placeholder
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
      scrollToEnd();
    }
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const history: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(history);
    setInput("");
    await streamAssistant(history);
  }

  // Re-run the latest turn: drop the trailing assistant reply and stream a fresh
  // one from the same user message.
  function regenerate() {
    if (busy) return;
    let cut = messages.length;
    while (cut > 0 && messages[cut - 1].role === "assistant") cut--;
    const history = messages.slice(0, cut);
    if (history.length === 0 || history[history.length - 1].role !== "user") return;
    setMessages(history);
    void streamAssistant(history);
  }

  // Toggle a thumbs rating on a message. Client-side only for now — there's no
  // feedback store yet; the selection just reflects in the UI.
  function recordFeedback(index: number, value: Feedback) {
    setMessages((m) =>
      m.map((msg, i) =>
        i === index ? { ...msg, feedback: msg.feedback === value ? undefined : value } : msg
      )
    );
  }

  const empty = messages.length === 0;
  const starters = mode === "reasoning" ? REASONING_STARTER_PROMPTS : STARTER_PROMPTS;

  return (
    <div className={styles.wrap}>
      <PageHeader
        title="Assistant"
        subtitle="Ask about your money. Answers come only from your own data, computed locally."
      />

      <div className={styles.modeBar}>
        <SegmentedControl<AssistantMode>
          label="Assistant mode"
          value={mode}
          options={[
            { value: "fact", label: "Fact" },
            { value: "reasoning", label: "Reasoning" },
          ]}
          onChange={setMode}
        />
      </div>

      <div className={styles.chat}>
        <div className={styles.messages} ref={scrollRef}>
          {empty ? (
            <div className={styles.welcome}>
              <Sparkles size={20} />
              <p>Ask a question about your finances to get started.</p>
              <div className={styles.starters}>
                {starters.map((p) => (
                  <button key={p} type="button" className={styles.starter} onClick={() => send(p)}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => {
              const isActive = busy && i === messages.length - 1;
              // The model is mid-reasoning: thinking is streaming, answer hasn't
              // started. Show the live reasoning panel and hide the empty bubble.
              const liveThinking = isActive && !m.content && Boolean(m.thinking);
              return (
                <div key={i} className={m.role === "user" ? styles.userMsg : styles.assistantMsg}>
                  {m.role === "assistant" && m.thinking ? (
                    <ThinkingBlock
                      text={m.thinking}
                      live={liveThinking}
                      elapsed={liveThinking ? elapsed : undefined}
                    />
                  ) : null}
                  {m.content || !liveThinking ? (
                    <div className={styles.bubble}>
                      {m.content ? (
                        m.role === "assistant" ? (
                          <AssistantMarkdown streaming={isActive}>{m.content}</AssistantMarkdown>
                        ) : (
                          m.content
                        )
                      ) : isActive ? (
                        mode === "reasoning" ? (
                          <span className={styles.loading}>
                            Reasoning {formatElapsed(elapsed)} <TypingDots />
                          </span>
                        ) : (
                          <TypingDots />
                        )
                      ) : (
                        ""
                      )}
                    </div>
                  ) : null}
                  {m.role === "assistant" && m.evidence && m.content ? (
                    <EvidenceBlock text={m.evidence} />
                  ) : null}
                  {m.role === "assistant" && m.content && !isActive ? (
                    <MessageActions
                      content={m.content}
                      canRegenerate={i === messages.length - 1 && !busy}
                      feedback={m.feedback}
                      onRegenerate={regenerate}
                      onFeedback={(value) => recordFeedback(i, value)}
                    />
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        {error ? <div className={styles.error}>{error}</div> : null}

        <form
          className={styles.composer}
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            className={styles.field}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your spending, income, or investments…"
            disabled={busy}
            aria-label="Message"
          />
          <button
            className={styles.sendBtn}
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Send"
          >
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  );
}
