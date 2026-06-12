"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Search, X } from "lucide-react";

import { Sparkline } from "@/components/shared/sparkline";
import type { WatchlistRow } from "@/lib/investments/markets-loader";
import type { SymbolSearchResult } from "@/lib/market-data";

// ─── Watchlist — monitor any symbol, held or not ───────────────────────────

export function WatchlistPanel({ rows, canEdit }: { rows: WatchlistRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SymbolSearchResult[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced typeahead against /api/symbols/search.
  useEffect(() => {
    const q = query.trim();
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      if (q.length < 2) {
        setResults([]);
        return;
      }
      try {
        const res = await fetch(`/api/symbols/search?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        if (!res.ok) return;
        const body = (await res.json()) as { results: SymbolSearchResult[] };
        setResults(body.results);
      } catch {
        /* aborted or offline — keep previous results */
      }
    }, 250);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query]);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const add = async (r: SymbolSearchResult) => {
    setBusy(r.symbol);
    setError(null);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: r.symbol, name: r.name, exchange: r.exchange }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Could not add symbol");
        return;
      }
      setQuery("");
      setResults([]);
      setAdding(false);
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  const remove = async (symbol: string) => {
    setBusy(symbol);
    try {
      await fetch(`/api/watchlist/${encodeURIComponent(symbol)}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="panel mkt-watch">
      <div className="panel-head">
        <div className="panel-title">Watchlist · {rows.length}</div>
        <div className="panel-meta">
          {canEdit ? (
            <button
              type="button"
              className="mkt-watch-add-btn"
              onClick={() => {
                setAdding((v) => !v);
                setError(null);
              }}
            >
              {adding ? <X size={11} /> : <Plus size={11} />}
              {adding ? "CLOSE" : "ADD SYMBOL"}
            </button>
          ) : (
            "SIGN IN TO EDIT"
          )}
        </div>
      </div>

      {adding && (
        <div className="mkt-watch-search">
          <div className="search">
            <Search size={13} color="var(--text-3)" />
            <input
              ref={inputRef}
              placeholder="Search ticker or company…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {error && <div className="mkt-watch-error">{error}</div>}
          {results.length > 0 && (
            <div className="mkt-watch-results">
              {results.map((r) => (
                <button
                  type="button"
                  key={r.symbol}
                  className="mkt-watch-result"
                  disabled={busy === r.symbol}
                  onClick={() => add(r)}
                >
                  <span className="sym">{r.symbol}</span>
                  <span className="nm">{r.name ?? "—"}</span>
                  <span className="ex">{r.exchange ?? ""}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="panel-body flush">
        {rows.length === 0 ? (
          <div className="mkt-empty" style={{ padding: "18px 14px" }}>
            {canEdit
              ? "Track any ticker — indexes, ETFs, names you're researching — without holding it."
              : "No symbols on the demo watchlist."}
          </div>
        ) : (
          <div className="mkt-watch-list">
            {rows.map((r) => {
              const dir = r.changePct == null ? "flat" : r.changePct >= 0 ? "pos" : "neg";
              return (
                <div key={r.symbol} className="mkt-watch-row">
                  <Link
                    href={`/app/investments/${encodeURIComponent(r.symbol)}` as never}
                    className="mkt-watch-main"
                  >
                    <div className="mkt-watch-id">
                      <span className="sym">
                        {r.symbol}
                        {r.held && <span className="held">HELD</span>}
                      </span>
                      <span className="nm">{r.name ?? r.exchange ?? ""}</span>
                    </div>
                    <div className="mkt-watch-spark">
                      {r.spark.length > 1 && (
                        <Sparkline
                          data={r.spark}
                          color={dir === "neg" ? "var(--neg)" : "var(--pos)"}
                          width={72}
                          height={20}
                        />
                      )}
                    </div>
                    <div className="mkt-watch-px">
                      <span className="px">
                        {r.price == null
                          ? "—"
                          : "$" +
                            r.price.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                      </span>
                      <span className={"chg " + dir}>
                        {r.changePct == null
                          ? ""
                          : (r.changePct >= 0 ? "+" : "−") + Math.abs(r.changePct).toFixed(2) + "%"}
                      </span>
                    </div>
                  </Link>
                  {canEdit && (
                    <button
                      type="button"
                      className="mkt-watch-del"
                      aria-label={`Remove ${r.symbol} from watchlist`}
                      disabled={busy === r.symbol}
                      onClick={() => remove(r.symbol)}
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
