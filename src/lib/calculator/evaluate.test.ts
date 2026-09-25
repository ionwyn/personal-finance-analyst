import { describe, expect, it } from "vitest";

import { calculationWarnings, evaluateCalculation } from "./evaluate";
import type { CalculationVariable } from "./types";

const variables: CalculationVariable[] = [
  {
    id: "balance:all-current",
    label: "All tracked balances",
    value: 1000,
    description: "Current balance",
    group: "balances",
    source: "live",
  },
  {
    id: "bills:next-30",
    label: "Upcoming bills",
    value: 250,
    description: "Due in 30 days",
    group: "bills",
    source: "projected",
  },
];

describe("evaluateCalculation", () => {
  it("uses normal calculator precedence with dynamic values", () => {
    const result = evaluateCalculation(
      [
        { type: "variable", variableId: "balance:all-current" },
        { type: "operator", operator: "−" },
        { type: "number", value: 100 },
        { type: "operator", operator: "×" },
        { type: "number", value: 2 },
      ],
      variables
    );

    expect(result).toMatchObject({ value: 800, error: null });
  });

  it("explains unavailable variables and division by zero", () => {
    expect(
      evaluateCalculation([{ type: "variable", variableId: "gone" }], variables)
    ).toMatchObject({
      value: null,
      unresolvedVariableIds: ["gone"],
    });
    expect(
      evaluateCalculation(
        [
          { type: "number", value: 10 },
          { type: "operator", operator: "÷" },
          { type: "number", value: 0 },
        ],
        variables
      )
    ).toMatchObject({ value: null, error: "A calculation cannot divide by zero." });
  });

  it("flags likely bill double-counting", () => {
    expect(
      calculationWarnings([
        { type: "variable", variableId: "bills:next-30" },
        { type: "operator", operator: "−" },
        { type: "variable", variableId: "bills:subscriptions-next-30" },
      ])
    ).toHaveLength(1);
  });
});
