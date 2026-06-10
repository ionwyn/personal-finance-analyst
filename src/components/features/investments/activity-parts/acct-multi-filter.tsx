import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

import type { ActivityAccountOption } from "@/lib/investments/activities-loader";

export function AcctMultiFilter({
  selected,
  onChange,
  options,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
  options: ActivityAccountOption[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const f = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", f);
    return () => document.removeEventListener("mousedown", f);
  }, []);
  const all = selected.length === 0 || selected.length === options.length;
  const label =
    all || options.length === 0
      ? "All accounts"
      : selected.length === 1
        ? (options.find((o) => o.id === selected[0])?.label ?? "1 account")
        : `${selected.length} accounts`;
  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  };
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className={"filter-pill " + (!all ? "active" : "")}
        onClick={() => setOpen((o) => !o)}
        disabled={options.length === 0}
      >
        {label}
        <ChevronDown size={10} style={{ opacity: 0.6, marginLeft: 4 }} />
      </button>
      {open && options.length > 0 ? (
        <div className="dd-panel">
          {options.map((o) => {
            const on = selected.length === 0 || selected.includes(o.id);
            return (
              <button
                type="button"
                key={o.id}
                className={"dd-item " + (on ? "on" : "")}
                onClick={() => toggle(o.id)}
              >
                <span className="cb">{on ? "✓" : ""}</span>
                <span className="nm">{o.institution}</span>
                <span className="reg">· {o.label}</span>
              </button>
            );
          })}
          <div className="dd-foot">
            <button type="button" onClick={() => onChange([])}>
              All
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
