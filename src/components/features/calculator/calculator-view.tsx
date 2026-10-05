"use client";

import { useEffect, useMemo, useState, type DragEvent } from "react";
import { Calculator, ChevronRight, GripVertical, Plus, Save, Trash2, Undo2 } from "lucide-react";

import { Button, IconButton, PageHeader, Panel } from "@/components/ui";
import { calculationWarnings, evaluateCalculation } from "@/lib/calculator/evaluate";
import type { CalculatorData } from "@/lib/calculator/getCalculatorData";
import { formatCurrency } from "@/lib/format";
import type {
  CalculationOperator,
  CalculationToken,
  SavedCalculation,
} from "@/lib/calculator/types";

import styles from "./calculator.module.scss";

const STORAGE_KEY = "wyn-saved-calculations-v1";
const OPERATORS: CalculationOperator[] = ["+", "−", "×", "÷"];
const GROUP_LABELS = { balances: "Balances", bills: "Known bills", spending: "Spending" };

function tokenLabel(token: CalculationToken, variables: CalculatorData["variables"]): string {
  if (token.type === "operator") return token.operator;
  if (token.type === "number") return formatCurrency(token.value);
  return (
    variables.find((variable) => variable.id === token.variableId)?.label ?? "Unavailable value"
  );
}

function isSavedCalculation(value: unknown): value is SavedCalculation {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<SavedCalculation>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    Array.isArray(candidate.tokens) &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.updatedAt === "string"
  );
}

export function CalculatorView({ data }: { data: CalculatorData }) {
  const [tokens, setTokens] = useState<CalculationToken[]>([]);
  const [name, setName] = useState("My calculation");
  const [numberInput, setNumberInput] = useState("");
  const [saved, setSaved] = useState<SavedCalculation[]>([]);
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Deferring this browser-only read also keeps the server render stable.
    const frame = window.requestAnimationFrame(() => {
      try {
        const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
        if (Array.isArray(parsed)) setSaved(parsed.filter(isSavedCalculation));
      } catch {
        // A corrupt local preference should not prevent calculator use.
      } finally {
        setLoaded(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const result = useMemo(
    () => evaluateCalculation(tokens, data.variables),
    [data.variables, tokens]
  );
  const warnings = useMemo(() => calculationWarnings(tokens), [tokens]);
  const expectsValue = !tokens.length || tokens[tokens.length - 1]?.type === "operator";

  function updateTokens(next: CalculationToken[]) {
    setTokens(next);
    setNotice(null);
  }

  function addValue(token: Extract<CalculationToken, { type: "variable" | "number" }>) {
    if (!expectsValue) {
      setNotice("Choose an operator before adding another value.");
      return;
    }
    updateTokens([...tokens, token]);
  }

  function addOperator(operator: CalculationOperator) {
    if (expectsValue) {
      setNotice("Choose a value before an operator.");
      return;
    }
    updateTokens([...tokens, { type: "operator", operator }]);
  }

  function addManualNumber() {
    const value = Number(numberInput);
    if (!numberInput.trim() || !Number.isFinite(value)) {
      setNotice("Enter a valid number.");
      return;
    }
    addValue({ type: "number", value });
    setNumberInput("");
  }

  function save() {
    if (result.error) {
      setNotice(result.error);
      return;
    }
    const now = new Date().toISOString();
    const entry: SavedCalculation = {
      id: activeSavedId ?? window.crypto.randomUUID(),
      name: name.trim() || "Untitled calculation",
      tokens,
      createdAt: saved.find((calculation) => calculation.id === activeSavedId)?.createdAt ?? now,
      updatedAt: now,
    };
    const next = activeSavedId
      ? saved.map((calculation) => (calculation.id === activeSavedId ? entry : calculation))
      : [entry, ...saved];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSaved(next);
    setActiveSavedId(entry.id);
    setNotice("Saved in this browser. Its bank values will update when you reopen it.");
  }

  function load(calculation: SavedCalculation) {
    setTokens(calculation.tokens);
    setName(calculation.name);
    setActiveSavedId(calculation.id);
    setNotice(null);
  }

  function removeSaved(id: string) {
    const next = saved.filter((calculation) => calculation.id !== id);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSaved(next);
    if (activeSavedId === id) setActiveSavedId(null);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const variableId = event.dataTransfer.getData("application/x-wyn-calculation-variable");
    if (variableId) addValue({ type: "variable", variableId });
  }

  const grouped = data.variables.reduce<
    Record<keyof typeof GROUP_LABELS, CalculatorData["variables"]>
  >(
    (groups, variable) => {
      groups[variable.group].push(variable);
      return groups;
    },
    { balances: [], bills: [], spending: [] }
  );

  return (
    <>
      <PageHeader
        title="Financial calculator"
        subtitle="Build reusable questions from live banking values and your own numbers."
        actions={
          <Button
            variant="ghost"
            size="sm"
            icon={<Undo2 size={13} />}
            onClick={() => {
              updateTokens([]);
              setActiveSavedId(null);
              setNotice(null);
            }}
          >
            New calculation
          </Button>
        }
      />

      <div className={styles.layout}>
        <aside className={styles.variables} aria-label="Available financial values">
          <div className={styles.eyebrow}>Live values</div>
          <p className={styles.paletteHelp}>Drag a value into the formula, or click it to add.</p>
          {Object.entries(grouped).map(([group, variables]) =>
            variables.length ? (
              <section className={styles.variableGroup} key={group}>
                <h2>{GROUP_LABELS[group as keyof typeof GROUP_LABELS]}</h2>
                {variables.map((variable) => (
                  <button
                    className={styles.variable}
                    draggable
                    key={variable.id}
                    onClick={() => addValue({ type: "variable", variableId: variable.id })}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "copy";
                      event.dataTransfer.setData(
                        "application/x-wyn-calculation-variable",
                        variable.id
                      );
                    }}
                    type="button"
                  >
                    <GripVertical size={13} aria-hidden="true" />
                    <span className={styles.variableText}>
                      <span>{variable.label}</span>
                      <small>{variable.description}</small>
                    </span>
                    <span className={styles.variableValue}>{formatCurrency(variable.value)}</span>
                    <span className={styles.source} data-source={variable.source}>
                      {variable.source}
                    </span>
                  </button>
                ))}
              </section>
            ) : null
          )}
        </aside>

        <main className={styles.workspace}>
          <Panel title="Formula" meta="× and ÷ take precedence over + and −">
            <div
              className={styles.dropZone}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
            >
              {tokens.length ? (
                <div className={styles.tokens} aria-label="Calculation formula">
                  {tokens.map((token, index) => (
                    <span
                      className={
                        token.type === "operator" ? styles.operatorToken : styles.valueToken
                      }
                      key={`${token.type}-${index}`}
                    >
                      {tokenLabel(token, data.variables)}
                    </span>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyFormula}>
                  <Calculator size={20} />
                  <span>Drop a live value here to start a calculation.</span>
                </div>
              )}
              {tokens.length ? (
                <IconButton
                  label="Remove last formula item"
                  onClick={() => updateTokens(tokens.slice(0, -1))}
                >
                  <Undo2 size={13} />
                </IconButton>
              ) : null}
            </div>

            <div className={styles.keypad} aria-label="Calculator keypad">
              <div className={styles.numberEntry}>
                <label htmlFor="manual-number">Your number</label>
                <div>
                  <input
                    id="manual-number"
                    inputMode="decimal"
                    onChange={(event) => setNumberInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") addManualNumber();
                    }}
                    placeholder="e.g. 300"
                    value={numberInput}
                  />
                  <Button size="sm" icon={<Plus size={13} />} onClick={addManualNumber}>
                    Add
                  </Button>
                </div>
              </div>
              <div className={styles.operatorButtons}>
                {OPERATORS.map((operator) => (
                  <button key={operator} onClick={() => addOperator(operator)} type="button">
                    {operator}
                  </button>
                ))}
              </div>
            </div>
          </Panel>

          <section className={styles.result} aria-live="polite">
            <span className={styles.resultLabel}>Result</span>
            <strong
              className={result.value != null && result.value < 0 ? styles.negative : undefined}
            >
              {result.value == null ? "—" : formatCurrency(result.value)}
            </strong>
            <span>{result.error ?? "Calculated using the latest available banking data."}</span>
          </section>

          {notice ? <div className={styles.notice}>{notice}</div> : null}
          {warnings.map((warning) => (
            <div className={styles.warning} key={warning}>
              {warning}
            </div>
          ))}

          <Panel
            title="Save this calculation"
            meta="Saved formulas keep their structure; values remain dynamic."
          >
            <div className={styles.saveRow}>
              <label htmlFor="calculation-name">Name</label>
              <input
                id="calculation-name"
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
              <Button variant="primary" size="sm" icon={<Save size={13} />} onClick={save}>
                {activeSavedId ? "Update" : "Save"}
              </Button>
            </div>
            <p className={styles.storageNote}>
              For this first version, saved calculations stay private to this browser.
            </p>
          </Panel>
        </main>

        <aside className={styles.saved}>
          <div className={styles.savedHead}>
            <div>
              <div className={styles.eyebrow}>Your formulas</div>
              <h2>Saved calculations</h2>
            </div>
            <span>{loaded ? saved.length : "…"}</span>
          </div>
          {loaded && !saved.length ? (
            <p className={styles.emptySaved}>
              Save a formula to reuse it as your balances and bills change.
            </p>
          ) : null}
          {saved.map((calculation) => {
            const savedResult = evaluateCalculation(calculation.tokens, data.variables);
            return (
              <div
                className={styles.savedCard}
                data-active={calculation.id === activeSavedId || undefined}
                key={calculation.id}
              >
                <button
                  className={styles.loadSaved}
                  onClick={() => load(calculation)}
                  type="button"
                >
                  <span>{calculation.name}</span>
                  <strong>
                    {savedResult.value == null
                      ? "Needs attention"
                      : formatCurrency(savedResult.value)}
                  </strong>
                  <small>
                    {calculation.tokens.map((token) => tokenLabel(token, data.variables)).join(" ")}
                  </small>
                </button>
                <IconButton
                  label={`Delete ${calculation.name}`}
                  onClick={() => removeSaved(calculation.id)}
                >
                  <Trash2 size={12} />
                </IconButton>
                <ChevronRight className={styles.loadArrow} size={14} aria-hidden="true" />
              </div>
            );
          })}
        </aside>
      </div>

      <div className="foot-note">
        <span>
          Values generated {new Date(data.generatedAt).toLocaleString()}. Projected bills are based
          on confirmed recurring expenses.
        </span>
      </div>
    </>
  );
}
