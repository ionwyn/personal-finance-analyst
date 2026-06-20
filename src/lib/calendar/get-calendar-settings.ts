// ─── Calendar settings data ─────────────────────────────────────────────────
// Enumerates the manageable items per category (real bills/goals/holdings for
// app-owned sources; fixed event-types for rule/config sources) and overlays
// the tenant's current preferences. Powers the Calendar settings section.

import { CALENDAR_SOURCES } from "@/lib/calendar/sources/registry";
import {
  CALENDAR_CATEGORIES,
  CATEGORY_META,
  type CalendarCategory,
} from "@/lib/calendar/types";
import { getCalendarWindow } from "@/lib/calendar/window";
import { prisma } from "@/lib/prisma";

export type CalendarSettingsCategory = {
  category: CalendarCategory;
  label: string;
  disabled: boolean;
  items: { key: string; label: string; hidden: boolean }[];
};

export type CalendarSettingsData = {
  categories: CalendarSettingsCategory[];
};

export async function getCalendarSettings(
  tenantId: string,
  now: Date = new Date()
): Promise<CalendarSettingsData> {
  const prefs = await prisma.calendarPreference.findUnique({ where: { tenantId } });
  const disabled = new Set(prefs?.disabledCategories ?? []);
  const hidden = new Set(prefs?.hiddenKeys ?? []);

  const ctx = { tenantId, range: getCalendarWindow(now), now };

  // Collect items per source (deduped by key within a category).
  const itemsByCategory = new Map<CalendarCategory, Map<string, string>>();
  await Promise.all(
    CALENDAR_SOURCES.map(async (source) => {
      if (!source.listItems) return;
      const items = await source.listItems(ctx).catch(() => []);
      const bucket = itemsByCategory.get(source.category) ?? new Map<string, string>();
      for (const item of items) {
        if (!bucket.has(item.key)) bucket.set(item.key, item.label);
      }
      itemsByCategory.set(source.category, bucket);
    })
  );

  const categories: CalendarSettingsCategory[] = CALENDAR_CATEGORIES.map((category) => {
    const bucket = itemsByCategory.get(category) ?? new Map<string, string>();
    return {
      category,
      label: CATEGORY_META[category].label,
      disabled: disabled.has(category),
      items: [...bucket.entries()].map(([key, label]) => ({
        key,
        label,
        hidden: hidden.has(key),
      })),
    };
  });

  return { categories };
}
