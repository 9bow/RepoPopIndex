import type { CategoryScore, CollectorResult, MetricValue } from "@/lib/types";
import type { Platform } from "@/lib/types";
import { GITHUB_CATEGORIES, GITHUB_METRICS, HF_CATEGORIES, HF_METRICS, RECENCY_FACTOR } from "./config";
import { applyRecencyFactor, normalizeMetric } from "./normalizer";

export function computeCategoryScores(
  metrics: CollectorResult[],
  platform: Platform
): Record<string, CategoryScore> {
  const rawLookup = new Map<string, { rawValue: number | null; rawJson?: unknown }>();
  for (const result of metrics) {
    for (const m of result.metrics) {
      rawLookup.set(m.metricKey, { rawValue: m.rawValue, rawJson: m.rawJson });
    }
  }

  const categoryConfigs = platform === "github" ? GITHUB_CATEGORIES : HF_CATEGORIES;
  const metricConfigs = platform === "github" ? GITHUB_METRICS : HF_METRICS;
  const metricConfigMap = new Map(metricConfigs.map((m) => [m.key, m]));

  const result: Record<string, CategoryScore> = {};

  for (const category of categoryConfigs) {
    const metricValues: Record<string, MetricValue> = {};
    let weightedSum = 0;
    let totalWeight = 0;
    let availableCount = 0;

    for (const key of category.metricKeys) {
      const config = metricConfigMap.get(key);
      const entry = rawLookup.get(key);
      const rawValue = entry?.rawValue ?? null;

      if (!config) {
        metricValues[key] = { raw: rawValue, normalized: null, weighted: null };
        continue;
      }

      const normalized = normalizeMetric(rawValue, config);
      const recencyAdjusted = normalized !== null
        ? applyRecencyFactor(normalized, config, RECENCY_FACTOR)
        : null;

      const weighted = recencyAdjusted !== null && config.weight > 0
        ? recencyAdjusted * config.weight
        : null;

      metricValues[key] = { raw: rawValue, normalized, weighted };

      if (rawValue !== null && normalized !== null && config.weight > 0) {
        weightedSum += recencyAdjusted! * config.weight;
        totalWeight += config.weight;
        availableCount++;
      }
    }

    const countableKeys = category.metricKeys.filter((key) => {
      const config = metricConfigMap.get(key);
      return config && config.weight > 0;
    });
    const countableTotal = countableKeys.length;
    const insufficient = countableTotal > 0 && availableCount < countableTotal * 0.5;

    const score = !insufficient && totalWeight > 0
      ? 100 * weightedSum / totalWeight
      : 0;

    result[category.id] = {
      name: category.name,
      score,
      maxScore: 100,
      metrics: metricValues,
      insufficient,
      reason: insufficient ? "Insufficient data" : undefined,
    };
  }

  return result;
}
