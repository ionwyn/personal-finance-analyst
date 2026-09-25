import type {
  CalculationOperator,
  CalculationToken,
  CalculationVariable,
  EvaluationResult,
} from "./types";

const precedence: Record<CalculationOperator, number> = {
  "+": 1,
  "−": 1,
  "×": 2,
  "÷": 2,
};

function applyOperator(operator: CalculationOperator, left: number, right: number): number | null {
  if (operator === "+") return left + right;
  if (operator === "−") return left - right;
  if (operator === "×") return left * right;
  if (right === 0) return null;
  return left / right;
}

/**
 * Evaluates a user-created formula with the same precedence as a conventional
 * calculator. Variable IDs (not their labels or values) are persisted, so a
 * saved formula stays stable while its bank-backed values update.
 */
export function evaluateCalculation(
  tokens: CalculationToken[],
  variables: CalculationVariable[]
): EvaluationResult {
  if (!tokens.length)
    return { value: null, error: "Add a value to begin.", unresolvedVariableIds: [] };

  const values = new Map(variables.map((variable) => [variable.id, variable.value]));
  const unresolvedVariableIds: string[] = [];
  const output: Array<number | CalculationOperator> = [];
  const operators: CalculationOperator[] = [];
  let wantsValue = true;

  for (const token of tokens) {
    if (token.type === "operator") {
      if (wantsValue) {
        return { value: null, error: "Choose a value before an operator.", unresolvedVariableIds };
      }
      while (
        operators.length &&
        precedence[operators[operators.length - 1]] >= precedence[token.operator]
      ) {
        output.push(operators.pop()!);
      }
      operators.push(token.operator);
      wantsValue = true;
      continue;
    }

    const value = token.type === "number" ? token.value : values.get(token.variableId);
    if (value == null || !Number.isFinite(value)) {
      if (token.type === "variable") unresolvedVariableIds.push(token.variableId);
      return {
        value: null,
        error: "One of this calculation’s values is unavailable.",
        unresolvedVariableIds,
      };
    }
    output.push(value);
    wantsValue = false;
  }

  if (wantsValue)
    return { value: null, error: "Choose a value after the last operator.", unresolvedVariableIds };
  while (operators.length) output.push(operators.pop()!);

  const stack: number[] = [];
  for (const item of output) {
    if (typeof item === "number") {
      stack.push(item);
      continue;
    }
    const right = stack.pop();
    const left = stack.pop();
    if (left == null || right == null) {
      return { value: null, error: "This calculation is incomplete.", unresolvedVariableIds };
    }
    const result = applyOperator(item, left, right);
    if (result == null)
      return { value: null, error: "A calculation cannot divide by zero.", unresolvedVariableIds };
    stack.push(result);
  }

  return stack.length === 1 && Number.isFinite(stack[0])
    ? { value: stack[0], error: null, unresolvedVariableIds }
    : { value: null, error: "This calculation is incomplete.", unresolvedVariableIds };
}

export function calculationWarnings(tokens: CalculationToken[]): string[] {
  const variableIds = tokens.flatMap((token) =>
    token.type === "variable" ? [token.variableId] : []
  );
  const warnings: string[] = [];

  if (
    variableIds.includes("balance:all-current") &&
    variableIds.some((id) => id.startsWith("account:"))
  ) {
    warnings.push(
      "This includes total balances and an individual account. Check that you are not counting an account twice."
    );
  }
  if (variableIds.includes("bills:next-30") && variableIds.includes("bills:monthly")) {
    warnings.push(
      "Bills due in 30 days are part of your known monthly bills. Using both may count some bills twice."
    );
  }
  return warnings;
}
