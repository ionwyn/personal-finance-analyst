export const UNCATEGORIZED = "Uncategorized";

/** Turn a Plaid primary category like `FOOD_AND_DRINK` into `Food And Drink`. */
export function formatCategoryName(raw: string | null | undefined): string {
  if (!raw) return UNCATEGORIZED;
  return raw
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
