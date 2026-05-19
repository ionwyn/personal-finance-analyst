"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Calendar, ChevronRight, Download, Filter, Search } from "lucide-react";

import { Button, FilterSelect } from "@/components/ui";

import styles from "./transactions-toolbar.module.scss";

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

      <label className={styles.daterange} aria-label="Date range">
        <Calendar size={12} />
        <input
          type="date"
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            pushParams({ from: e.target.value || null });
          }}
        />
        <span className={styles.sep}>→</span>
        <input
          type="date"
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            pushParams({ to: e.target.value || null });
          }}
        />
      </label>

      <FilterSelect
        label="Category"
        value={category}
        options={categoryOptions}
        dotMap={categoryColors}
        onChange={(v) => {
          setCategory(v);
          pushParams({ category: v });
        }}
      />
      <FilterSelect
        label="Account"
        value={account}
        options={accountOptions}
        onChange={(v) => {
          setAccount(v);
          pushParams({ account: v });
        }}
      />

      <span style={{ flex: 1 }} />
      <Button
        variant="ghost"
        size="sm"
        disabled
        icon={<Filter size={12} />}
        style={{ color: "var(--text-3)" }}
      >
        More filters
        <ChevronRight size={12} style={{ opacity: 0.5 }} />
      </Button>
    </div>
  );
}

export function ExportCsvButton() {
  return (
    <Button disabled icon={<Download size={12} />} title="CSV export coming soon">
      Export CSV
    </Button>
  );
}
