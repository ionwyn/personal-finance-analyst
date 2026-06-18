import config from "../../../assistant-config.json";

const assistantConfig = config as typeof config & {
  groundingRules?: string[];
};

function appendGroundingRules(parts: string[]) {
  const rules = assistantConfig.groundingRules ?? [];
  if (rules.length === 0) return;

  parts.push("", "CURRENT GROUNDING RULES:");
  for (const rule of rules) {
    parts.push(`- ${rule}`);
  }
}

export function buildPlanPrompt(asOf: string): string {
  return [config.planPrompt.systemMessage, `Today is ${asOf}.`, ...config.planPrompt.lines].join(
    "\n"
  );
}

export function buildNarrationPrompt(factsBlock: string, rowsBlock?: string): string {
  const parts = [...config.narrationPrompt.intro, factsBlock];
  if (rowsBlock) {
    parts.push("", rowsBlock);
  }
  appendGroundingRules(parts);
  parts.push(config.narrationPrompt.footer);
  return parts.join("\n");
}

export function buildReasoningNarrationPrompt(factsBlock: string, rowsBlock?: string): string {
  const parts = [...config.reasoningNarrationPrompt.intro, factsBlock];
  if (rowsBlock) {
    parts.push("", rowsBlock);
  }
  appendGroundingRules(parts);
  parts.push(config.reasoningNarrationPrompt.footer);
  return parts.join("\n");
}

export const STARTER_PROMPTS = config.starterPrompts;

export const REASONING_STARTER_PROMPTS = config.reasoningStarterPrompts;
