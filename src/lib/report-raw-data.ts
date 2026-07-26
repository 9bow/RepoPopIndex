import type { CollectorResult, RawSourceData } from "./types";

const GITHUB_RAW_SOURCES = new Set([
  "github-graphql",
  "github-search",
  "github-rest",
  "github-scraper",
  "star-quality",
  "github-contributors",
]);

/**
 * Retain collected or derived pre-normalization values from GitHub responses
 * without storing request headers, tokens, or full (potentially large) bodies.
 */
export function buildGitHubRawSources(
  collectorResults: CollectorResult[],
  collectedAt: string
): RawSourceData[] {
  return collectorResults
    .filter((result) => GITHUB_RAW_SOURCES.has(result.source))
    .map((result) => {
      const contributorDataQuality = result.metrics.find(
        (metric) => metric.metricKey === "contributor_insights"
      )?.rawJson as { dataQuality?: { status?: string } } | undefined;
      const samplingLimited =
        contributorDataQuality?.dataQuality?.status === "partial";

      return {
        source: result.source,
        collectedAt,
        status: result.error
          ? result.metrics.length > 0
            ? "partial"
            : "failed"
          : samplingLimited
            ? "partial"
            : "complete",
        ...(result.error ? { error: result.error } : {}),
        metrics: result.metrics.map((metric) => ({
          category: metric.category,
          metricKey: metric.metricKey,
          rawValue: metric.rawValue,
          ...(metric.rawJson !== undefined ? { rawJson: metric.rawJson } : {}),
        })),
      };
    });
}
