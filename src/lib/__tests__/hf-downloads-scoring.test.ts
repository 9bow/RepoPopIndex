import { describe, expect, it } from "vitest";
import { computeCategoryScores } from "@/lib/scoring/category-scores";
import { computeScores } from "@/lib/scoring/composite-score";
import type { CollectorResult } from "@/lib/types";

const HF_DOWNLOADS_AT_CEILING: CollectorResult = {
  source: "huggingface",
  metrics: [
    { category: "H1", metricKey: "downloads", rawValue: 10_000_000 },
    { category: "H1", metricKey: "downloadsAllTime", rawValue: 100_000_000 },
  ],
};

describe("Hugging Face download scoring", () => {
  it("keeps HF Hub download stats in the H-Downloads category", () => {
    const scores = computeCategoryScores([HF_DOWNLOADS_AT_CEILING], "huggingface");

    expect(scores["H-Downloads"].insufficient).toBe(false);
    expect(Object.keys(scores["H-Downloads"].metrics)).toEqual([
      "downloads",
      "downloadsAllTime",
    ]);
    expect(scores["H-Downloads"].score).toBeCloseTo(100, 0);
  });

  it("includes H-Downloads in the Hugging Face composite when available", () => {
    const result = computeScores([HF_DOWNLOADS_AT_CEILING], "huggingface");

    expect(result.excludedCategories).not.toContain("H-Downloads");
    expect(result.compositeScore).toBeCloseTo(100, 0);
  });
});
