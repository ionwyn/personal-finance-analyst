// ─── Sources: tax dates (Tax) ───────────────────────────────────────────────
// Three sources over the same statutory rules (CA deadlines, US deadlines,
// document-availability windows). Computed per year touched by the window, so
// they carry no confirmedThrough — the formulas hold for any year.

import { buildTaxEvents, TAX_ITEMS, type TaxEvent, type TaxGroup } from "@/lib/calendar/rules/tax";
import type { CalendarEvent, CalendarRange, CalendarSource } from "@/lib/calendar/types";

function yearsInRange(range: CalendarRange): number[] {
  const startYear = Number(range.start.slice(0, 4));
  const endYear = Number(range.end.slice(0, 4));
  const years: number[] = [];
  for (let y = startYear; y <= endYear; y += 1) years.push(y);
  return years;
}

/** Window-aware overlap: window events count if their span intersects the range. */
function intersectsRange(event: TaxEvent, range: CalendarRange): boolean {
  const end = event.endDate ?? event.date;
  return event.date <= range.end && end >= range.start;
}

function makeTaxSource(
  group: TaxGroup,
  id: string,
  label: string,
  attribution: string
): CalendarSource {
  return {
    id,
    category: "tax",
    label,

    async getEvents({ range }): Promise<CalendarEvent[]> {
      return yearsInRange(range)
        .flatMap((year) => buildTaxEvents(year))
        .filter((e) => e.group === group && intersectsRange(e, range))
        .map((e) => ({
          id: `${e.itemKey}:${e.date}`,
          date: e.date,
          endDate: e.endDate,
          category: "tax",
          type: e.type,
          title: e.title,
          confidence: e.confidence,
          isPast: false,
          source: attribution,
        }));
    },

    async listItems() {
      return TAX_ITEMS[group];
    },
  };
}

export const taxCaSource = makeTaxSource("ca", "tax-ca", "Tax · Canada", "CRA rules");
export const taxUsSource = makeTaxSource("us", "tax-us", "Tax · US", "IRS rules");
export const taxSlipsSource = makeTaxSource(
  "slips",
  "tax-slips",
  "Tax slips & forms",
  "Issuer deadlines"
);
