import { describe, expect, it } from "vitest";
import { buildStargazerDistribution } from "@/lib/admin/stargazer-sync";
import type { StargazerProfile } from "@/lib/admin/types";

describe("buildStargazerDistribution", () => {
  it("groups account age and reports young-account ratios", () => {
    const profiles: StargazerProfile[] = [
      {
        id: "one",
        nodeId: "U_one",
        databaseId: 1,
        login: "one",
        avatarUrl: null,
        profileUrl: "https://github.com/one",
        accountCreatedAt: "2026-07-01T00:00:00Z",
        starredAt: "2026-07-05T00:00:00Z",
        accountAgeDaysAtStar: 4,
      },
      {
        id: "two",
        nodeId: "U_two",
        databaseId: 2,
        login: "two",
        avatarUrl: null,
        profileUrl: "https://github.com/two",
        accountCreatedAt: "2024-01-01T00:00:00Z",
        starredAt: "2026-07-05T00:00:00Z",
        accountAgeDaysAtStar: 916,
      },
    ];

    const result = buildStargazerDistribution(profiles, 20, true);
    expect(result.status).toBe("partial");
    expect(result.sampledCount).toBe(2);
    expect(result.ageBuckets[0].count).toBe(1);
    expect(result.ageBuckets.at(-1)?.count).toBe(1);
    expect(result.youngAccountRatios.under7Days).toBe(0.5);
  });

  it("keeps an empty repository sample at zero without NaN ratios", () => {
    const result = buildStargazerDistribution([], 0, false);

    expect(result.status).toBe("complete");
    expect(result.sampledCount).toBe(0);
    expect(result.youngAccountRatios).toEqual({
      under7Days: 0,
      under30Days: 0,
      under90Days: 0,
    });
  });
});
