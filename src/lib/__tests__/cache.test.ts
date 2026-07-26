/**
 * Tests for pushRecentReport / getRecentReports:
 *  - dedupe: same {platform,owner,repo,period} replaces the prior entry
 *  - LTRIM: server-side list capped at 20 entries
 *  - cap: getRecentReports never returns more than 12 entries
 *
 * Uses an in-memory fake for the Upstash Redis client — no network required.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { vi } from "vitest";

// ---------------------------------------------------------------------------
// In-memory Redis fake (hoisted so vi.mock factory can access it)
// ---------------------------------------------------------------------------
const lists = vi.hoisted(() => new Map<string, unknown[]>());
const hashes = vi.hoisted(
  () => new Map<string, Record<string, unknown>>()
);

vi.mock("@/lib/rate-limiter", () => ({
  redis: {
    lrange: async (key: string, start: number, end: number) =>
      (lists.get(key) ?? []).slice(start, end + 1),

    lrem: async (_key: string, _count: number, value: unknown) => {
      // Match by dedupeKey since Upstash serializes objects
      for (const [k, list] of lists.entries()) {
        const dedupeKey =
          typeof value === "object" && value !== null
            ? (value as Record<string, unknown>).dedupeKey
            : null;
        if (dedupeKey !== null) {
          lists.set(
            k,
            list.filter(
              (item) =>
                (item as Record<string, unknown>).dedupeKey !== dedupeKey
            )
          );
        } else {
          lists.set(
            k,
            list.filter((item) => JSON.stringify(item) !== JSON.stringify(value))
          );
        }
      }
    },

    lpush: async (key: string, value: unknown) => {
      const next = [value, ...(lists.get(key) ?? [])];
      lists.set(key, next);
      return next.length;
    },

    ltrim: async (key: string, start: number, end: number) => {
      lists.set(key, (lists.get(key) ?? []).slice(start, end + 1));
    },

    get: async () => null,
    set: async () => "OK",
    hset: async (key: string, values: Record<string, unknown>) => {
      hashes.set(key, { ...(hashes.get(key) ?? {}), ...values });
      return Object.keys(values).length;
    },
    hgetall: async (key: string) => hashes.get(key) ?? null,
  },
}));

// Import after mock is set up
import {
  pushRecentReport,
  getRecentReports,
  RECENT_REPORTS_KEY,
  saveMonthlyReportSnapshot,
} from "@/lib/cache";
import type { AnalysisReport } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeEntry(
  i: number,
  overrides: Partial<{
    platform: "github" | "huggingface";
    owner: string;
    repo: string;
    period: "1w" | "1m" | "3m" | "6m" | "1y";
    score: number;
  }> = {}
) {
  return {
    platform: "github" as const,
    owner: "org",
    repo: `repo${i}`,
    period: "1m" as const,
    score: i * 10,
    scoreVersion: "v2" as const,
    completedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("pushRecentReport / getRecentReports", () => {
  beforeEach(() => {
    lists.clear();
    hashes.clear();
  });

  it("stores one replaceable snapshot per calendar month", async () => {
    const report = (completedAt: string, compositeScore: number): AnalysisReport => ({
      id: completedAt,
      platform: "github",
      owner: "org",
      repo: "repo",
      period: "3m",
      status: "complete",
      compositeScore,
      categoryScores: {
        "G-Activity": {
          name: "Activity",
          score: compositeScore,
          maxScore: 100,
          insufficient: false,
          metrics: {
            "G2.5": {
              raw: 10,
              normalized: 0.5,
              weighted: 0.5,
            },
          },
        },
      },
      excludedCategories: [],
      starQuality: null,
      socialBuzz: {
        hn: null,
        reddit: null,
        stackoverflow: null,
        youtube: null,
      },
      createdAt: completedAt,
      completedAt,
    });

    await saveMonthlyReportSnapshot(report("2026-06-10T00:00:00Z", 40));
    await saveMonthlyReportSnapshot(report("2026-06-20T00:00:00Z", 45));
    const snapshots = await saveMonthlyReportSnapshot(
      report("2026-07-10T00:00:00Z", 50)
    );

    expect(snapshots).toHaveLength(2);
    expect(snapshots.map((snapshot) => snapshot.month)).toEqual([
      "2026-06",
      "2026-07",
    ]);
    expect(snapshots[0].compositeScore).toBe(45);
    expect(snapshots[0].status).toBe("complete");
    expect(snapshots[0].missingSources).toEqual([]);

    const samplingLimitedReport = report("2026-08-10T00:00:00Z", 55);
    samplingLimitedReport.contributorInsights = {
      windowMonths: 12,
      observationMonths: 24,
      generatedAt: "2026-08-10T00:00:00Z",
      activeContributors: 100,
      observedNewContributors: 80,
      firstTimeContributorSignals: 0,
      affiliatedContributors: 5,
      externalContributors: 90,
      unknownAssociationContributors: 5,
      latestCompleteMonthRetentionRate: 0.2,
      monthly: [],
      dataQuality: {
        status: "partial",
        truncatedSources: ["commits"],
        limitations: [],
      },
    };
    const snapshotsWithSamplingLimit = await saveMonthlyReportSnapshot(
      samplingLimitedReport
    );
    expect(snapshotsWithSamplingLimit.at(-1)?.status).toBe("partial");
    expect(snapshotsWithSamplingLimit.at(-1)?.missingSources).toEqual([
      "github-contributors:commits",
    ]);
  });

  it("dedupes: pushing same {platform,owner,repo,period} twice keeps only the latest entry", async () => {
    const base = {
      platform: "github" as const,
      owner: "facebook",
      repo: "react",
      period: "3m" as const,
      scoreVersion: "v2" as const,
      completedAt: new Date().toISOString(),
    };

    await pushRecentReport({ ...base, score: 75 });
    await pushRecentReport({ ...base, score: 80 }); // re-run, updated score

    const results = await getRecentReports(12);
    const matches = results.filter(
      (r) =>
        r.platform === "github" &&
        r.owner === "facebook" &&
        r.repo === "react" &&
        r.period === "3m"
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].score).toBe(80); // latest value wins
  });

  it("LTRIM keeps at most 20 entries server-side after pushing 25 unique repos", async () => {
    for (let i = 0; i < 25; i++) {
      await pushRecentReport(makeEntry(i));
    }

    const raw = lists.get(RECENT_REPORTS_KEY) ?? [];
    expect(raw.length).toBeLessThanOrEqual(20);
  });

  it("getRecentReports caps return at 12 even when limit > 12 is passed", async () => {
    for (let i = 0; i < 20; i++) {
      await pushRecentReport(makeEntry(i));
    }

    const results = await getRecentReports(100); // ask for 100
    expect(results.length).toBeLessThanOrEqual(12);
  });

  it("getRecentReports returns at most `limit` entries when limit < 12", async () => {
    for (let i = 0; i < 10; i++) {
      await pushRecentReport(makeEntry(i));
    }

    const results = await getRecentReports(5);
    expect(results.length).toBeLessThanOrEqual(5);
  });

  it("getRecentReports returns 0 entries when limit is 0", async () => {
    await pushRecentReport(makeEntry(1));
    const results = await getRecentReports(0);
    expect(results).toHaveLength(0);
  });
});
