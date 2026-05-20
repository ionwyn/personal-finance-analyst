"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp, Download, Search } from "lucide-react";

import { Button, DateRangePicker, FilterSelect } from "@/components/ui";

const BUCKET_OPTIONS = ["spending", "income", "transfer", "savings", "settlement"];
const PENDING_OPTIONS = ["pending", "posted"];

export function TransactionsToolbar({
  initialQuery,
  initialFrom,
  initialTo,
  initialCategory,
  initialAccount,
  initialBucket,
  initialPending,
  categoryOptions,
  accountOptions,
  categoryColors,
}: {
  initialQuery?: string;
  initialFrom?: string;
  initialTo?: string;
  initialCategory?: string;
  initialAccount?: string;
  initialBucket?: string;
  initialPending?: string;
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
  const [bucket, setBucket] = useState<string | null>(initialBucket ?? null);
  const [pending, setPending] = useState<string | null>(
    initialPending === "true" ? "pending" : initialPending === "false" ? "posted" : null
  );
  const [showMore, setShowMore] = useState(Boolean(initialBucket || initialPending));

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

  const extraFilterCount = [bucket, pending].filter(Boolean).length;

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

      <DateRangePicker
        from={from}
        to={to}
        onChange={(f, t) => {
          setFrom(f);
          setTo(t);
          pushParams({ from: f || null, to: t || null });
        }}
      />

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
        icon={showMore ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        style={{
          color: extraFilterCount > 0 ? "var(--accent)" : "var(--text-3)",
          fontWeight: extraFilterCount > 0 ? 600 : undefined,
        }}
        onClick={() => setShowMore((v) => !v)}
      >
        More filters
        {extraFilterCount > 0 ? (
          <span
            style={{
              marginLeft: 4,
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              background: "var(--accent)",
              color: "#fff",
              borderRadius: 9,
              padding: "1px 5px",
              lineHeight: 1.4,
            }}
          >
            {extraFilterCount}
          </span>
        ) : null}
      </Button>

      {showMore && (
        <div
          style={{
            width: "100%",
            display: "flex",
            gap: 8,
            paddingTop: 8,
            borderTop: "1px solid var(--border)",
            marginTop: 4,
          }}
        >
          <FilterSelect
            label="Type"
            value={bucket}
            options={BUCKET_OPTIONS}
            onChange={(v) => {
              setBucket(v);
              pushParams({ bucket: v });
            }}
          />
          <FilterSelect
            label="Status"
            value={pending}
            options={PENDING_OPTIONS}
            onChange={(v) => {
              setPending(v);
              pushParams({ pending: v === "pending" ? "true" : v === "posted" ? "false" : null });
            }}
          />
        </div>
      )}
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
