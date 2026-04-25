/**
 * Tests for S1 (Social Buzz) proportional re-normalization.
 *
 * When a sub-source (e.g. Reddit) is absent, its metrics have rawValue === null
 * and are excluded from both the numerator (weightedSum) and denominator
 * (availableCeiling) — effectively re-normalizing the score over available
 * sub-sources only.
 */
import { describe, it, expect } from "vitest";
import { computeCategoryScores } from "@/lib/scoring/category-scores";
import type { CollectorResult } from "@/lib/types";

/** Helper: build a CollectorResult with all listed metrics at their maxI value. */
function buildResult(
  source: string,
  entries: Array<{ category: string; metricKey: string; rawValue: number }>
): CollectorResult {
  return {
    source,
    metrics: entries.map((e) => ({ ...e, rawJson: undefined })),
  };
}

// Sub-source metric definitions at their maxI — these produce normalized = 1.0
const HN_METRICS = [
  { category: "S1", metricKey: "story_count", rawValue: 50 },       // maxI: 50
  { category: "S1", metricKey: "total_points", rawValue: 2000 },    // maxI: 2000
  { category: "S1", metricKey: "engagement", rawValue: 5000 },      // maxI: 5000
];

const REDDIT_METRICS = [
  { category: "S1", metricKey: "reddit_post_count", rawValue: 20 },   // maxI: 20
  { category: "S1", metricKey: "reddit_score_sum", rawValue: 2000 },  // maxI: 2000
  { category: "S1", metricKey: "reddit_comment_sum", rawValue: 2000 },// maxI: 2000
];

const SO_METRICS = [
  { category: "S1", metricKey: "so_question_count", rawValue: 50 },    // maxI: 50
  { category: "S1", metricKey: "so_answered_ratio", rawValue: 1.0 },   // maxI: 1.0 (linear)
  { category: "S1", metricKey: "so_score_sum", rawValue: 200 },        // maxI: 200
];

const YT_METRICS = [
  { category: "S1", metricKey: "youtube_video_count", rawValue: 20 },      // maxI: 20
  { category: "S1", metricKey: "youtube_view_sum", rawValue: 1_000_000 },  // maxI: 1_000_000
  { category: "S1", metricKey: "youtube_like_sum", rawValue: 20_000 },     // maxI: 20_000
];

describe("computeCategoryScores — S1 proportional re-normalization", () => {
  it("scores ~100 when all 4 sub-sources are at their maxI", () => {
    const results: CollectorResult[] = [
      buildResult("hackernews", HN_METRICS),
      buildResult("reddit", REDDIT_METRICS),
      buildResult("stackoverflow", SO_METRICS),
      buildResult("youtube", YT_METRICS),
    ];
    const scores = computeCategoryScores(results, "github");
    expect(scores["G-Social"].insufficient).toBe(false);
    expect(scores["G-Social"].score).toBeCloseTo(100, 0);
  });

  it("scores ~100 when only HN+SO+YT are present (reddit absent) — re-normalization", () => {
    // Reddit missing: 9/12 metrics available = 75% > MIN_AVAILABLE_RATIO(30%) → not insufficient
    const results: CollectorResult[] = [
      buildResult("hackernews", HN_METRICS),
      buildResult("stackoverflow", SO_METRICS),
      buildResult("youtube", YT_METRICS),
    ];
    const scores = computeCategoryScores(results, "github");
    expect(scores["G-Social"].insufficient).toBe(false);
    // All available metrics at maxI → re-normalized score should still be ~100
    expect(scores["G-Social"].score).toBeCloseTo(100, 0);
  });

  it("marks G-Social insufficient when fewer than 30% of metrics have data", () => {
    // Only 3 HN metrics out of 12 S1 metrics = 25% < MIN_AVAILABLE_RATIO(30%)
    const results: CollectorResult[] = [
      buildResult("hackernews", HN_METRICS),
    ];
    const scores = computeCategoryScores(results, "github");
    expect(scores["G-Social"].insufficient).toBe(true);
  });

  it("score increases when more sub-sources provide data at non-zero values", () => {
    // HN at ~50% max — reddit/SO/YT absent
    const hnHalf: CollectorResult[] = [
      buildResult("hackernews", [
        { category: "S1", metricKey: "story_count", rawValue: 25 },
        { category: "S1", metricKey: "total_points", rawValue: 1000 },
        { category: "S1", metricKey: "engagement", rawValue: 2500 },
      ]),
      buildResult("stackoverflow", SO_METRICS),
      buildResult("youtube", YT_METRICS),
    ];

    // HN at ~50% max + reddit at max
    const withReddit: CollectorResult[] = [
      ...hnHalf,
      buildResult("reddit", REDDIT_METRICS),
    ];

    const scoreWithout = computeCategoryScores(hnHalf, "github")["G-Social"].score;
    const scoreWith = computeCategoryScores(withReddit, "github")["G-Social"].score;

    // Adding reddit (at max) while HN is at half-max should increase overall score
    expect(scoreWith).toBeGreaterThan(scoreWithout);
    expect(scoreWithout).toBeGreaterThan(0);
    expect(scoreWithout).toBeLessThan(100);
  });
});
