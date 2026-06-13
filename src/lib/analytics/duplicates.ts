// Heuristic detection of Plaid accounts that likely duplicate a brokerage account
// already tracked via SnapTrade. SnapTrade only covers investment/brokerage
// accounts, so the only cross-provider overlap is a Plaid investment-type account
// at an institution the tenant also connects through SnapTrade. This only *warns* —
// the user decides whether to untrack one side. Keeping both double-counts the
// account's balance in net worth and every total.

function normalizeInstitutionName(name: string | null | undefined): string {
  return (name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isInvestmentAccountType(type: string, subtype: string | null): boolean {
  const t = `${type} ${subtype ?? ""}`.toLowerCase();
  return t.includes("investment") || t.includes("brokerage") || t.includes("retirement");
}

type PlaidItemForDuplicates = {
  institutionName: string | null;
  accounts: { id: string; type: string; subtype: string | null }[];
};

export function findDuplicatePlaidAccountIds(
  plaidItems: PlaidItemForDuplicates[],
  snapTradeInstitutionNames: (string | null | undefined)[]
): Set<string> {
  const duplicates = new Set<string>();
  const snapNames = snapTradeInstitutionNames.map(normalizeInstitutionName).filter(Boolean);
  if (snapNames.length === 0) return duplicates;

  for (const item of plaidItems) {
    const inst = normalizeInstitutionName(item.institutionName);
    if (!inst) continue;
    const institutionMatches = snapNames.some(
      (name) => name === inst || name.includes(inst) || inst.includes(name)
    );
    if (!institutionMatches) continue;
    for (const account of item.accounts) {
      if (isInvestmentAccountType(account.type, account.subtype)) {
        duplicates.add(account.id);
      }
    }
  }

  return duplicates;
}
