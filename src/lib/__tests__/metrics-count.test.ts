import { describe, it, expect } from "vitest";
import { ACTIVE_METRICS_COUNT, countActiveMetrics } from "@/lib/scoring/metrics-count";
import { GITHUB_METRICS, HF_METRICS } from "@/lib/scoring/config";

describe("ACTIVE_METRICS_COUNT", () => {
  it("equals 59 (35 GitHub + 24 HuggingFace active metrics)", () => {
    expect(ACTIVE_METRICS_COUNT).toBe(59);
  });

  it("satisfies the 50+ metrics marketing claim", () => {
    expect(countActiveMetrics()).toBeGreaterThan(50);
  });

  it("excludes metrics with weight === 0", () => {
    const zeroWeightGH = GITHUB_METRICS.filter((m) => m.weight === 0);
    const zeroWeightHF = HF_METRICS.filter((m) => m.weight === 0);
    // G5.4 is the only weight-0 metric; verify it is excluded from the count
    expect(zeroWeightGH.length + zeroWeightHF.length).toBeGreaterThan(0);
    const manualCount =
      GITHUB_METRICS.filter((m) => m.weight > 0).length +
      HF_METRICS.filter((m) => m.weight > 0).length;
    expect(ACTIVE_METRICS_COUNT).toBe(manualCount);
  });
});
