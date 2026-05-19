"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Calendar, ChevronRight, Download, Filter, Plus, Search, X } from "lucide-react";

type FilterDropdownProps = {
  label: string;
  value: string | null;
  options: string[];
  dotMap?: Record<string, string>;
  onChange: (value: string | null) => void;
};

function FilterDropdown({ label, value, options, dotMap, onChange }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        className={`filter-pill ${value ? "active" : ""}`}
        type="button"
        onClick={() => setOpen((o) => !o)}
      >
        <Plus size={12} />
        {label}
        {value ? (
          <>
            <span style={{ color: "var(--text-4)" }}>:</span>
            <span style={{ color: "var(--text)" }}>{value}</span>
            <span
              className="x"
              role="button"
              aria-label="Clear filter"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
            >
              <X size={12} />
            </span>
          </>
        ) : null}
      </button>
      {open ? (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            zIndex: 20,
            background: "var(--surface)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius)",
            padding: 4,
            minWidth: 200,
            maxHeight: 280,
            overflowY: "auto",
            boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
          }}
        >
          {options.length === 0 ? (
            <div
              style={{
                padding: "6px 8px",
                fontSize: 12,
                color: "var(--text-4)",
                fontFamily: "var(--font-mono)",
              }}
            >
              No options
            </div>
          ) : null}
          {options.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => {
                onChange(o);
                setOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "6px 8px",
                borderRadius: 3,
                fontSize: 12,
                color: "var(--text-2)",
                textAlign: "left",
                background: value === o ? "var(--surface-3)" : "transparent",
              }}
            >
              {dotMap?.[o] ? (
                <i style={{ width: 8, height: 8, borderRadius: "50%", background: dotMap[o] }} />
              ) : null}
              {o}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function TransactionsToolbar({
  initialQuery,
  initialFrom,
  initialTo,
  initialCategory,
  initialAccount,
  categoryOptions,
  accountOptions,
  categoryColors,
}: {
  initialQuery?: string;
  initialFrom?: string;
  initialTo?: string;
  initialCategory?: string;
  initialAccount?: string;
  categoryOptions: string[];
  accountOptions: string[];
  categoryColors: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [query, setQuery] = useState(initialQuery ?? "");
  const [from, setFrom] = useState(initialFrom ?? "");
  const [to, setTo] = useState(initialTo ?? "");
  const [category, setCategory] = useState<string | null>(initialCategory ?? null);
  const [account, setAccount] = useState<string | null>(initialAccount ?? null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function pushParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    for (const [k, v] of Object.entries(next)) {
      if (v == null || v === "") params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    startTransition(() => {
      router.replace(`${pathname}${qs ? `?${qs}` : ""}` as never, { scroll: false });
    });
  }

  function onQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushParams({ q: value || null }), 250);
  }

  return (
    <div className="tx-toolbar">
      <div className="search">
        <Search size={13} style={{ color: "var(--text-3)" }} />
        <input
          placeholder="Search merchant, category, account…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        <span className="kbd">⌘F</span>
      </div>

      <label className="daterange" aria-label="Date range">
        <Calendar size={12} />
        <input
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            pushParams({ from: e.target.value || null });
          }}
        />
        <span className="sep">→</span>
        <input
          type="date"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            pushParams({ to: e.target.value || null });
          }}
        />
      </label>

      <FilterDropdown
        label="Category"
        value={category}
        options={categoryOptions}
        dotMap={categoryColors}
        onChange={(v) => {
          setCategory(v);
          pushParams({ category: v });
        }}
      />
      <FilterDropdown
        label="Account"
        value={account}
        options={accountOptions}
        onChange={(v) => {
          setAccount(v);
          pushParams({ account: v });
        }}
      />

      <span style={{ flex: 1 }} />
      <button
        className="btn btn-ghost btn-sm"
        type="button"
        disabled
        style={{ color: "var(--text-3)" }}
      >
        <Filter size={12} />
        More filters
        <ChevronRight size={12} style={{ opacity: 0.5 }} />
      </button>
    </div>
  );
}

export function ExportCsvButton() {
  return (
    <button className="btn" type="button" disabled title="CSV export coming soon">
      <Download size={12} />
      Export CSV
    </button>
  );
}
