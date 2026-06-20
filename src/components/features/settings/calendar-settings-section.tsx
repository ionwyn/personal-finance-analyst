"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Panel, Switch } from "@/components/ui";
import type { CalendarSettingsData } from "@/lib/calendar/get-calendar-settings";
import type { CalendarCategory } from "@/lib/calendar/types";

import { ErrorLine, postJSON } from "./settings-form";

export function CalendarSettingsSection({ data }: { data: CalendarSettingsData }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(body: unknown) {
    setBusy(true);
    setError(null);
    try {
      await postJSON("/api/settings/calendar", "PATCH", body);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update calendar settings.");
    } finally {
      setBusy(false);
    }
  }

  function toggleCategory(category: CalendarCategory, enabled: boolean) {
    return patch({ action: "setCategory", category, enabled });
  }

  function toggleItem(key: string, hidden: boolean) {
    return patch({ action: "setItem", key, hidden });
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <ErrorLine error={error} />
      </div>

      {data.categories.map((cat) => (
        <Panel
          key={cat.category}
          title={cat.label}
          meta={cat.disabled ? "HIDDEN" : `${cat.items.length} ITEMS`}
          actions={
            <Switch
              isSelected={!cat.disabled}
              onChange={(on) => toggleCategory(cat.category, on)}
            >
              {cat.disabled ? "Off" : "On"}
            </Switch>
          }
        >
          {cat.disabled ? (
            <div style={{ fontSize: 12, color: "var(--text-3)" }}>
              This category is hidden from the calendar and its filter. Turn it on to manage
              individual items.
            </div>
          ) : cat.items.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--text-3)" }}>
              No items in the current window.
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th style={{ width: 90 }}>Shown</th>
                </tr>
              </thead>
              <tbody>
                {cat.items.map((item) => (
                  <tr key={item.key} style={{ opacity: item.hidden ? 0.5 : 1 }}>
                    <td>{item.label}</td>
                    <td>
                      <Switch
                        isSelected={!item.hidden}
                        onChange={(on) => toggleItem(item.key, !on)}
                      >
                        {item.hidden ? "Hidden" : "Shown"}
                      </Switch>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      ))}

      <p style={{ fontSize: 11, color: "var(--text-4)", marginTop: 4 }} aria-hidden={busy}>
        Removing a category hides it entirely; hiding an item removes just that item from the
        calendar. The calendar window is fixed at 3 months back and 6 months forward.
      </p>
    </div>
  );
}
