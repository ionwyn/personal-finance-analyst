type InsiderTransactionLike = {
  change: number | null;
  txPrice: number | null;
  txCode: string | null;
  txDate: string | null;
  isDerivative: boolean;
};

export function isOpenMarketInsiderTransaction(transaction: InsiderTransactionLike): boolean {
  return (
    !transaction.isDerivative &&
    transaction.txDate != null &&
    (transaction.txCode === "P" || transaction.txCode === "S")
  );
}

export function openMarketInsiderValue(transaction: InsiderTransactionLike): number | null {
  if (
    !isOpenMarketInsiderTransaction(transaction) ||
    transaction.change == null ||
    transaction.txPrice == null ||
    transaction.txPrice <= 0
  ) {
    return null;
  }

  const value = Math.abs(transaction.change * transaction.txPrice);
  return transaction.txCode === "P" ? value : -value;
}
