import type { SettingsData } from "@/lib/cycles/getSettings";

import { PayCycleSection } from "./pay-cycle-section";
import { RecurringExpensesSection } from "./recurring-expenses-section";
import { SavingsDestinationsSection } from "./savings-destinations-section";
import { SettlementPatternsSection } from "./settlement-patterns-section";

export function SettingsView({ data }: { data: SettingsData }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PayCycleSection settings={data.settings} />
      <RecurringExpensesSection expenses={data.recurringExpenses} />
      <SavingsDestinationsSection destinations={data.savingsDestinations} />
      <SettlementPatternsSection patterns={data.settlementPatterns} />
    </div>
  );
}
