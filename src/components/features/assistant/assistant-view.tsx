"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronRight, Send, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { PageHeader, SegmentedControl } from "@/components/ui";
import { REASONING_STARTER_PROMPTS, STARTER_PROMPTS } from "@/lib/assistant/prompt";

import styles from "./assistant-view.module.scss";

type ChatRole = "user" | "assistant";
type AssistantMode = "fact" | "reasoning";
type Msg = { role: ChatRole; content: string; thinking?: string; evidence?: string };

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

/**
 * Render an assistant answer as Markdown. The model is prompted to use Markdown
 * (bold, bullets, GitHub-flavoured tables) for structured replies; `remark-gfm`
 * adds table/strikethrough/autolink support on top of CommonMark. Raw HTML is not
 * enabled, so model output can't inject markup.
 */
function AssistantMarkdown({ children }: { children: string }) {
  return (
    <div className={styles.markdown}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
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

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setError(null);

    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setElapsed(0);
    setBusy(true);
    scrollToEnd();

    // Placeholder assistant message we stream tokens into.
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    try {
      // Send only role+content, dropping any empty turns (e.g. a prior
      // thinking-only reply) the server's schema would reject.
      const payload = next
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
                          <AssistantMarkdown>{m.content}</AssistantMarkdown>
                        ) : (
                          m.content
                        )
                      ) : isActive ? (
                        mode === "reasoning" ? (
                          `Reasoning… ${formatElapsed(elapsed)}`
                        ) : (
                          "…"
                        )
                      ) : (
                        ""
                      )}
                    </div>
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
