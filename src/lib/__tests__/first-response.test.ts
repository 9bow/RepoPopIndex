import { describe, expect, it } from "vitest";
import { computeFirstResponseSummary } from "@/lib/collectors/github-search";

describe("computeFirstResponseSummary", () => {
  it("excludes self and bot comments and separates maintainer response", () => {
    const result = computeFirstResponseSummary([
      {
        node: {
          createdAt: "2026-07-01T00:00:00Z",
          author: { login: "reporter" },
          comments: {
            totalCount: 4,
            nodes: [
              {
                createdAt: "2026-07-01T01:00:00Z",
                author: { login: "reporter", __typename: "User" },
                authorAssociation: "NONE",
              },
              {
                createdAt: "2026-07-01T02:00:00Z",
                author: { login: "triage-bot", __typename: "Bot" },
                authorAssociation: "COLLABORATOR",
              },
              {
                createdAt: "2026-07-01T03:00:00Z",
                author: { login: "contributor", __typename: "User" },
                authorAssociation: "CONTRIBUTOR",
              },
              {
                createdAt: "2026-07-01T05:00:00Z",
                author: { login: "maintainer", __typename: "User" },
                authorAssociation: "MEMBER",
              },
            ],
          },
        },
      },
      {
        node: {
          createdAt: "2026-07-02T00:00:00Z",
          author: { login: "another" },
          comments: { totalCount: 0, nodes: [] },
        },
      },
    ]);

    expect(result.sampledIssues).toBe(2);
    expect(result.medianHumanResponseHours).toBe(3);
    expect(result.medianMaintainerResponseHours).toBe(5);
    expect(result.unansweredByHuman).toBe(1);
    expect(result.unansweredByMaintainer).toBe(1);
    expect(result.excludedSelfComments).toBe(1);
    expect(result.excludedBotComments).toBe(1);
  });
});
