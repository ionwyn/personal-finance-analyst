export type CalculationOperator = "+" | "−" | "×" | "÷";

export type CalculationVariable = {
  id: string;
  label: string;
  value: number;
  description: string;
  group: "balances" | "bills" | "spending";
  /** Lets the UI communicate that a value is projected rather than bank-posted. */
  source: "live" | "projected";
};

export type CalculationToken =
  | { type: "variable"; variableId: string }
  | { type: "number"; value: number }
  | { type: "operator"; operator: CalculationOperator };

export type SavedCalculation = {
  id: string;
  name: string;
  tokens: CalculationToken[];
  createdAt: string;
  updatedAt: string;
};

export type EvaluationResult = {
  value: number | null;
  error: string | null;
  /** Variable references not available in the current account data. */
  unresolvedVariableIds: string[];
};
