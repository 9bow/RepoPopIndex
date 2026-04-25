/**
 * Tests for computeScores partial-failure handling.
 *
 * When a social-buzz collector fails (error field set), computeScores surfaces
 * a PartialInfo with the correct reason and lists the missing source.
 */
import { describe, it, expect } from "vitest";
import { computeScores } from "@/lib/scoring/composite-score";
import type { CollectorResult } from "@/lib/types";

const GITHUB_RESULT: CollectorResult = {
  source: "github_graphql",
  metrics: [
    { category: "G1", metricKey: "stars", rawValue: 50_000 },
    { category: "G1", metricKey: "forks", rawValue: 5_000 },
    { category: "G1", metricKey: "watchers", rawValue: 1_000 },
  ],
};

const HN_RESULT: CollectorResult = {
  source: "hackernews",
  metrics: [
    { category: "S1", metricKey: "story_count", rawValue: 10 },
    { category: "S1", metricKey: "total_points", rawValue: 500 },
    { category: "S1", metricKey: "engagement", rawValue: 750 },
  ],
};

describe("computeScores — partial failure detection", () => {
  it("returns partial=null when no social source has an error", () => {
    const results: CollectorResult[] = [GITHUB_RESULT, HN_RESULT];
    const { partial } = computeScores(results, "github");
    expect(partial).toBeNull();
  });

  it("returns reason='rate_limit' when a social source reports rate_limit error", () => {
    const redditFailed: CollectorResult = {
      source: "reddit",
      metrics: [],
      error: "rate_limit",
    };
    const results: CollectorResult[] = [GITHUB_RESULT, HN_RESULT, redditFailed];
    const { partial } = computeScores(results, "github");

    expect(partial).not.toBeNull();
    expect(partial?.reason).toBe("rate_limit");
    expect(partial?.missingSources).toContain("reddit");
  });

  it("returns reason='rate_limit' for 'rate_limited' error string variant", () => {
    const soFailed: CollectorResult = {
      source: "stackoverflow",
      metrics: [],
      error: "rate_limited",
    };
    const results: CollectorResult[] = [GITHUB_RESULT, HN_RESULT, soFailed];
    const { partial } = computeScores(results, "github");

    expect(partial?.reason).toBe("rate_limit");
    expect(partial?.missingSources).toContain("stackoverflow");
  });

  it("returns reason='collector_error' for non-rate-limit social errors", () => {
    const ytFailed: CollectorResult = {
      source: "youtube",
      metrics: [],
      error: "timeout",
    };
    const results: CollectorResult[] = [GITHUB_RESULT, HN_RESULT, ytFailed];
    const { partial } = computeScores(results, "github");

    expect(partial?.reason).toBe("collector_error");
    expect(partial?.missingSources).toContain("youtube");
  });

  it("rate_limit reason takes priority when mixed errors occur", () => {
    const redditFailed: CollectorResult = {
      source: "reddit",
      metrics: [],
      error: "timeout",
    };
    const soFailed: CollectorResult = {
      source: "stackoverflow",
      metrics: [],
      error: "rate_limit",
    };
    const results: CollectorResult[] = [GITHUB_RESULT, HN_RESULT, redditFailed, soFailed];
    const { partial } = computeScores(results, "github");

    expect(partial?.reason).toBe("rate_limit");
    expect(partial?.missingSources).toContain("reddit");
    expect(partial?.missingSources).toContain("stackoverflow");
  });

  it("does not add non-social sources to missingSources even if they have errors", () => {
    const ghFailed: CollectorResult = {
      source: "github_graphql",
      metrics: [],
      error: "rate_limit",
    };
    const results: CollectorResult[] = [ghFailed, HN_RESULT];
    const { partial } = computeScores(results, "github");

    // github_graphql is not in SOCIAL_SOURCES — should not be in missingSources
    expect(partial).toBeNull();
  });
});
