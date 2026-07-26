import { describe, expect, it } from "vitest";
import { buildGitHubRawSources } from "@/lib/report-raw-data";
import type { CollectorResult } from "@/lib/types";

describe("buildGitHubRawSources", () => {
  it("retains GitHub calculation inputs and excludes unrelated sources", () => {
    const results: CollectorResult[] = [
      {
        source: "github-graphql",
        metrics: [
          {
            category: "G1",
            metricKey: "stars",
            rawValue: 123,
            rawJson: { sample: true },
          },
        ],
      },
      {
        source: "hackernews",
        metrics: [
          { category: "S1", metricKey: "story_count", rawValue: 2 },
        ],
      },
    ];

    expect(
      buildGitHubRawSources(results, "2026-07-25T00:00:00.000Z")
    ).toEqual([
      {
        source: "github-graphql",
        collectedAt: "2026-07-25T00:00:00.000Z",
        status: "complete",
        metrics: [
          {
            category: "G1",
            metricKey: "stars",
            rawValue: 123,
            rawJson: { sample: true },
          },
        ],
      },
    ]);
  });

  it("marks a collector with an error and fallback values as partial", () => {
    const sources = buildGitHubRawSources(
      [
        {
          source: "github-rest",
          metrics: [{ category: "G5", metricKey: "G5.1", rawValue: null }],
          error: "rate limited",
        },
      ],
      "2026-07-25T00:00:00.000Z"
    );

    expect(sources[0].status).toBe("partial");
    expect(sources[0].error).toBe("rate limited");
  });

  it("marks contributor sampling limits as partial without inventing an error", () => {
    const sources = buildGitHubRawSources(
      [
        {
          source: "github-contributors",
          metrics: [
            {
              category: "G10",
              metricKey: "contributor_insights",
              rawValue: 100,
              rawJson: {
                dataQuality: {
                  status: "partial",
                  truncatedSources: ["commits"],
                },
              },
            },
          ],
        },
      ],
      "2026-07-25T00:00:00.000Z"
    );

    expect(sources[0].status).toBe("partial");
    expect(sources[0].error).toBeUndefined();
  });
});
