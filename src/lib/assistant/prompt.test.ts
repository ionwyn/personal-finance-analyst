import { describe, expect, it } from "vitest";

import { buildNarrationPrompt, buildReasoningNarrationPrompt } from "@/lib/assistant/prompt";

describe("assistant prompts", () => {
  it("includes shared grounding rules in fact narration", () => {
    const prompt = buildNarrationPrompt("AS OF: 2026-06-18", "TOP MERCHANTS: test");

    expect(prompt).toContain("CURRENT GROUNDING RULES");
    expect(prompt).toContain("today's date");
    expect(prompt).toContain("PREVIOUS ANSWER EVIDENCE");
  });

  it("includes shared grounding rules in reasoning narration", () => {
    const prompt = buildReasoningNarrationPrompt("AS OF: 2026-06-18", "TOP MERCHANTS: test");

    expect(prompt).toContain("CURRENT GROUNDING RULES");
    expect(prompt).toContain("server-computed totals");
  });
});
