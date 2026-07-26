import { describe, expect, it } from "vitest";
import {
  aggregateContributorInsights,
  type ContributorActivityEvent,
} from "@/lib/contributor-insights";

describe("aggregateContributorInsights", () => {
  it("builds monthly newcomer, retention, and affiliation summaries", () => {
    const events: ContributorActivityEvent[] = [
      {
        actor: "alice",
        occurredAt: "2024-08-10T00:00:00Z",
        kind: "commit",
      },
      {
        actor: "alice",
        occurredAt: "2026-05-10T00:00:00Z",
        kind: "commit",
      },
      {
        actor: "alice",
        occurredAt: "2026-06-10T00:00:00Z",
        kind: "commit",
      },
      {
        actor: "bob",
        occurredAt: "2026-06-12T00:00:00Z",
        kind: "issue",
        association: "FIRST_TIME_CONTRIBUTOR",
      },
      {
        actor: "carol",
        occurredAt: "2026-07-02T00:00:00Z",
        kind: "pull_request",
        association: "MEMBER",
      },
      {
        actor: "dependabot[bot]",
        occurredAt: "2026-07-03T00:00:00Z",
        kind: "pull_request",
        association: "CONTRIBUTOR",
      },
    ];

    const result = aggregateContributorInsights(events, {
      now: new Date("2026-07-25T00:00:00Z"),
      truncatedSources: ["commits"],
    });

    expect(result.activeContributors).toBe(3);
    expect(result.observedNewContributors).toBe(2);
    expect(result.firstTimeContributorSignals).toBe(1);
    expect(result.affiliatedContributors).toBe(1);
    expect(result.externalContributors).toBe(1);
    expect(result.unknownAssociationContributors).toBe(1);
    expect(result.latestCompleteMonthRetentionRate).toBe(1);
    expect(result.dataQuality.status).toBe("partial");

    const june = result.monthly.find((month) => month.month === "2026-06");
    expect(june).toMatchObject({
      activeContributors: 2,
      observedNewContributors: 1,
      returningContributors: 1,
      retentionRate: 1,
      commits: 1,
      issues: 1,
    });

    const july = result.monthly.find((month) => month.month === "2026-07");
    expect(july).toMatchObject({
      activeContributors: 1,
      observedNewContributors: 1,
      affiliatedContributors: 1,
      partialMonth: true,
    });
  });

  it("does not apply a later repository association to an earlier month", () => {
    const result = aggregateContributorInsights(
      [
        {
          actor: "alice",
          occurredAt: "2026-05-10T00:00:00Z",
          kind: "issue",
          association: "CONTRIBUTOR",
        },
        {
          actor: "alice",
          occurredAt: "2026-06-10T00:00:00Z",
          kind: "issue",
          association: "MEMBER",
        },
      ],
      { now: new Date("2026-07-25T00:00:00Z") }
    );

    expect(result.monthly.find((month) => month.month === "2026-05")).toMatchObject({
      affiliatedContributors: 0,
      externalContributors: 1,
    });
    expect(result.monthly.find((month) => month.month === "2026-06")).toMatchObject({
      affiliatedContributors: 1,
      externalContributors: 0,
    });
  });
});
