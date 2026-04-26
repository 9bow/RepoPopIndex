import { GITHUB_METRICS, HF_METRICS } from "./config";

/**
 * Count metrics with weight > 0 across both platform metric tables.
 * Used to validate marketing copy claims (e.g. "50+ metrics").
 */
export function countActiveMetrics(): number {
  const ghCount = GITHUB_METRICS.filter((m) => m.weight > 0).length;
  const hfCount = HF_METRICS.filter((m) => m.weight > 0).length;
  return ghCount + hfCount;
}

export const ACTIVE_METRICS_COUNT = countActiveMetrics();
