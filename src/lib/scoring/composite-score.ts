import type { CategoryScore, CollectorResult, MetricValue } from "@/lib/types";
import type { Platform } from "@/lib/types";
import { GITHUB_CATEGORIES, GITHUB_METRICS, HF_CATEGORIES, HF_METRICS, RECENCY_FACTOR } from "./config";
import { applyRecencyFactor, normalizeMetric } from "./normalizer";
import { computeCategoryScores } from "./category-scores";

interface StarQuality {
  factor: number;
  recent: number;
  historical: number;
  burstDetected: boolean;
}

interface ScoreResult {
  compositeScore: number;
  categoryScores: Record<string, CategoryScore>;
  metricScores: Record<string, MetricValue>;
  excludedCategories: string[];
  starQuality: StarQuality | null;
}

export function computeScores(
  collectorResults: CollectorResult[],
  platform: Platform
): ScoreResult {
  const categoryScores = computeCategoryScores(collectorResults, platform);

  const categoryConfigs = platform === "github" ? GITHUB_CATEGORIES : HF_CATEGORIES;
  const metricConfigs = platform === "github" ? GITHUB_METRICS : HF_METRICS;

  const excludedCategories: string[] = [];
  let weightedSum = 0;
  let totalWeight = 0;

  for (const category of categoryConfigs) {
    const score = categoryScores[category.id];
    if (!score) continue;
    if (score.insufficient) {
      excludedCategories.push(category.id);
      continue;
    }
    weightedSum += category.weight * score.score;
    totalWeight += category.weight;
  }

  const compositeScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

  const rawLookup = new Map<string, { rawValue: number | null; rawJson?: unknown }>();
  for (const result of collectorResults) {
    for (const m of result.metrics) {
      rawLookup.set(m.metricKey, { rawValue: m.rawValue, rawJson: m.rawJson });
    }
  }

  const metricScores: Record<string, MetricValue> = {};
  for (const config of metricConfigs) {
    const entry = rawLookup.get(config.key);
    const rawValue = entry?.rawValue ?? null;
    const normalized = normalizeMetric(rawValue, config);
    const recencyAdjusted = normalized !== null
      ? applyRecencyFactor(normalized, config, RECENCY_FACTOR)
      : null;
    const weighted = recencyAdjusted !== null && config.weight > 0
      ? recencyAdjusted * config.weight
      : null;
    metricScores[config.key] = { raw: rawValue, normalized, weighted };
  }

  let starQuality: StarQuality | null = null;
  const g8Entry = rawLookup.get("G8.1");
  if (g8Entry?.rawJson && typeof g8Entry.rawJson === "object" && g8Entry.rawJson !== null) {
    const json = g8Entry.rawJson as Record<string, unknown>;
    if (
      typeof json.avgUqs === "number" &&
      typeof json.avgUqsRecent === "number" &&
      typeof json.avgUqsHistorical === "number" &&
      typeof json.burstDetected === "boolean"
    ) {
      starQuality = {
        factor: json.avgUqs,
        recent: json.avgUqsRecent,
        historical: json.avgUqsHistorical,
        burstDetected: json.burstDetected,
      };
    }
  }

  return {
    compositeScore,
    categoryScores,
    metricScores,
    excludedCategories,
    starQuality,
  };
}
