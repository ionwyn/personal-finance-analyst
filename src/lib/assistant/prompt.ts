import config from "../../../assistant-config.json";

const assistantConfig = config as typeof config & {
  groundingRules?: string[];
  adviceNarrationAddendum?: string[];
};

function appendGroundingRules(parts: string[]) {
  const rules = assistantConfig.groundingRules ?? [];
  if (rules.length === 0) return;

  parts.push("", "CURRENT GROUNDING RULES:");
  for (const rule of rules) {
    parts.push(`- ${rule}`);
  }
}

/**
 * Layers a coaching-style tone on top of the (always-applied) grounding
 * rules, gated by `evidenceKind` — the same value pipeline.ts already uses to
 * decide which evidence was fetched, so the tone-gate and the evidence-gate
 * can never disagree about which intent this answer is for.
 */
function appendAdviceAddendum(parts: string[], evidenceKind: string | undefined) {
  if (evidenceKind !== "savings_advice") return;
  const rules = assistantConfig.adviceNarrationAddendum ?? [];
  if (rules.length === 0) return;

  parts.push("", "SAVINGS ADVICE TONE:");
  for (const rule of rules) {
    parts.push(`- ${rule}`);
  }
}

export function buildPlanPrompt(asOf: string): string {
  return [config.planPrompt.systemMessage, `Today is ${asOf}.`, ...config.planPrompt.lines].join(
    "\n"
  );
}

export function buildNarrationPrompt(
  factsBlock: string,
  rowsBlock?: string,
  evidenceKind?: string
): string {
  const parts = [...config.narrationPrompt.intro, factsBlock];
  if (rowsBlock) {
    parts.push("", rowsBlock);
  }
  appendGroundingRules(parts);
  appendAdviceAddendum(parts, evidenceKind);
  parts.push(config.narrationPrompt.footer);
  return parts.join("\n");
}

export function buildReasoningNarrationPrompt(
  factsBlock: string,
  rowsBlock?: string,
  evidenceKind?: string
): string {
  const parts = [...config.reasoningNarrationPrompt.intro, factsBlock];
  if (rowsBlock) {
    parts.push("", rowsBlock);
  }
  appendGroundingRules(parts);
  appendAdviceAddendum(parts, evidenceKind);
  parts.push(config.reasoningNarrationPrompt.footer);
  return parts.join("\n");
}

export const STARTER_PROMPTS = config.starterPrompts;

export const REASONING_STARTER_PROMPTS = config.reasoningStarterPrompts;
