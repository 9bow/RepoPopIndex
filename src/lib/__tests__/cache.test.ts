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
  },
}));

// Import after mock is set up
import {
  pushRecentReport,
  getRecentReports,
  RECENT_REPORTS_KEY,
} from "@/lib/cache";

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
    completedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("pushRecentReport / getRecentReports", () => {
  beforeEach(() => {
    lists.clear();
  });

  it("dedupes: pushing same {platform,owner,repo,period} twice keeps only the latest entry", async () => {
    const base = {
      platform: "github" as const,
      owner: "facebook",
      repo: "react",
      period: "3m" as const,
      scoreVersion: "v2" as const,
      completedAt: "2026-01-01T00:00:00Z",
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
