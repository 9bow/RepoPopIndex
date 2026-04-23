import type { MetricConfig } from "./config";
import { RECENCY_FACTOR } from "./config";

export function normalizeMetric(rawValue: number | null, config: MetricConfig): number | null {
  if (rawValue === null) return null;

  let value = rawValue;

  if (config.inverse) {
    value = Math.max(0, config.maxI - rawValue);
  }

  let normalized: number;
  if (config.linear) {
    normalized = Math.min(1, value / config.maxI);
  } else {
    normalized = Math.min(1, Math.log(1 + value) / Math.log(1 + config.maxI));
  }

  return Math.max(0, Math.min(1, normalized));
}

export function applyRecencyFactor(
  normalized: number,
  config: MetricConfig,
  recencyFactor: number = RECENCY_FACTOR
): number {
  if (config.cumulative) {
    return normalized * recencyFactor;
  }
  return normalized;
}
