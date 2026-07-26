"use client";

import { Download, Gauge, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useLocale } from "@/contexts/locale-context";
import type {
  ContributorInsights,
  FirstResponseSummary,
} from "@/lib/types";

function formatPercent(value: number | null): string {
  return value === null ? "N/A" : `${Math.round(value * 100)}%`;
}

function formatDuration(hours: number | null): string {
  if (hours === null) return "N/A";
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 48) return `${hours.toFixed(hours < 10 ? 1 : 0)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

function csvCell(value: string | number | boolean | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function ContributorInsightsCard({
  insights,
  firstResponse,
  owner,
  repo,
}: {
  insights: ContributorInsights;
  firstResponse: FirstResponseSummary | null;
  owner: string;
  repo: string;
}) {
  const { d } = useLocale();
  const labels = d.contributors;
  const maxActivity = Math.max(
    1,
    ...insights.monthly.map(
      (month) => month.commits + month.pullRequests + month.issues
    )
  );

  function downloadCsv() {
    const header = [
      "month",
      "commits",
      "pull_requests",
      "issues",
      "active_contributors",
      "observed_new_contributors",
      "github_first_time_signals",
      "returning_contributors",
      "retention_rate",
      "affiliated_contributors",
      "external_contributors",
      "unknown_association_contributors",
      "partial_month",
    ];
    const rows = insights.monthly.map((month) => [
      month.month,
      month.commits,
      month.pullRequests,
      month.issues,
      month.activeContributors,
      month.observedNewContributors,
      month.firstTimeContributorSignals,
      month.returningContributors,
      month.retentionRate,
      month.affiliatedContributors,
      month.externalContributors,
      month.unknownAssociationContributors,
      month.partialMonth,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((value) => csvCell(value)).join(","))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${owner}-${repo}-contributor-flow.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const responseCoverage =
    firstResponse && firstResponse.sampledIssues > 0
      ? firstResponse.humanResponses / firstResponse.sampledIssues
      : null;
  const maintainerResponseCoverage =
    firstResponse && firstResponse.sampledIssues > 0
      ? firstResponse.maintainerResponses / firstResponse.sampledIssues
      : null;

  const summary = [
    {
      label: labels.active,
      value: insights.activeContributors.toLocaleString(),
      help: labels.activeHelp,
    },
    {
      label: labels.observedNew,
      value: insights.observedNewContributors.toLocaleString(),
      help: labels.observedNewHelp,
    },
    {
      label: labels.firstTimeSignals,
      value: insights.firstTimeContributorSignals.toLocaleString(),
      help: labels.firstTimeSignalsHelp,
    },
    {
      label: labels.retention,
      value: formatPercent(insights.latestCompleteMonthRetentionRate),
      help: labels.retentionHelp,
    },
  ];

  return (
    <Card className="overflow-hidden border-border/70 bg-card">
      <CardHeader className="border-b border-border/70 bg-[linear-gradient(120deg,color-mix(in_oklab,var(--muted)_55%,transparent),transparent_58%)] px-5 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <UsersRound className="size-3.5" aria-hidden />
              {labels.eyebrow}
            </div>
            <div>
              <h3 className="font-display text-xl font-semibold tracking-tight">
                {labels.title}
              </h3>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {labels.subtitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                insights.dataQuality.status === "complete"
                  ? "outline"
                  : "secondary"
              }
            >
              {insights.dataQuality.status === "complete"
                ? labels.completeData
                : labels.partialData}
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={downloadCsv}
              className="print:hidden"
            >
              <Download className="size-3.5" aria-hidden />
              {labels.exportCsv}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 px-5 py-5 sm:px-6">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/70 bg-border/70 lg:grid-cols-4">
          {summary.map((item) => (
            <div key={item.label} className="bg-card px-4 py-4">
              <p className="text-xs leading-snug text-muted-foreground">
                {item.label}
              </p>
              <p className="mt-2 font-display text-2xl font-semibold tabular-nums tracking-tight">
                {item.value}
              </p>
              <p className="mt-2 text-[0.7rem] leading-relaxed text-muted-foreground">
                {item.help}
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="overflow-x-auto rounded-xl border border-border/70">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/45 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 font-medium">{labels.month}</th>
                  <th className="px-3 py-2.5 font-medium">{labels.activity}</th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    {labels.contributors}
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium">{labels.new}</th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    {labels.returning}
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    {labels.retentionShort}
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    {labels.association}
                  </th>
                </tr>
              </thead>
              <tbody>
                {insights.monthly.map((month) => {
                  const activity = month.commits + month.pullRequests + month.issues;
                  const width = `${Math.max(3, (activity / maxActivity) * 100)}%`;
                  return (
                    <tr
                      key={month.month}
                      className="border-t border-border/60 align-middle"
                    >
                      <td className="whitespace-nowrap px-3 py-3 font-mono text-xs">
                        {month.month}
                        {month.partialMonth && (
                          <span className="ml-2 text-[10px] text-muted-foreground">
                            {labels.partialMonth}
                          </span>
                        )}
                      </td>
                      <td className="w-[220px] px-3 py-3">
                        <div className="space-y-1.5">
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-foreground/75"
                              style={{ width }}
                            />
                          </div>
                          <p className="whitespace-nowrap text-[10px] text-muted-foreground">
                            {month.commits} {labels.commits} · {month.pullRequests}{" "}
                            {labels.pullRequests} · {month.issues} {labels.issues}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">
                        {month.activeContributors}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">
                        {month.observedNewContributors}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">
                        {month.returningContributors}
                      </td>
                      <td className="px-3 py-3 text-right font-mono tabular-nums">
                        {formatPercent(month.retentionRate)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-mono text-xs tabular-nums">
                        {month.affiliatedContributors}/
                        {month.externalContributors}/
                        {month.unknownAssociationContributors}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                <Gauge className="size-3.5" aria-hidden />
                {labels.responseTitle}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {labels.humanMedian}
                  </p>
                  <p className="mt-1 font-display text-xl font-semibold tabular-nums">
                    {formatDuration(
                      firstResponse?.medianHumanResponseHours ?? null
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {labels.maintainerMedian}
                  </p>
                  <p className="mt-1 font-display text-xl font-semibold tabular-nums">
                    {formatDuration(
                      firstResponse?.medianMaintainerResponseHours ?? null
                    )}
                  </p>
                </div>
              </div>
              <div className="mt-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                <div className="grid grid-cols-2 gap-3">
                  <p>
                    {labels.responseCoverage}:{" "}
                    <span className="font-mono text-foreground">
                      {formatPercent(responseCoverage)}
                    </span>
                  </p>
                  <p>
                    {labels.maintainerCoverage}:{" "}
                    <span className="font-mono text-foreground">
                      {formatPercent(maintainerResponseCoverage)}
                    </span>
                  </p>
                </div>
                {firstResponse && (
                  <div className="mt-1 grid grid-cols-2 gap-3">
                    <p>
                      {firstResponse.unansweredByHuman} {labels.unanswered} ·{" "}
                      {firstResponse.sampledIssues} {labels.sample}
                    </p>
                    <p>
                      {firstResponse.unansweredByMaintainer} {labels.unanswered} ·{" "}
                      {firstResponse.sampledIssues} {labels.sample}
                    </p>
                  </div>
                )}
                <p className="mt-2 leading-relaxed">
                  {labels.responseMethodology}
                </p>
                {firstResponse?.commentsTruncated && (
                  <p className="mt-2 font-medium leading-relaxed text-amber-700 dark:text-amber-300">
                    {labels.responsePartial}
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-border/70 p-4 text-xs leading-relaxed text-muted-foreground">
              <p>{labels.methodology}</p>
              {insights.dataQuality.truncatedSources.length > 0 && (
                <p className="mt-2 font-medium text-amber-700 dark:text-amber-300">
                  {labels.partialData}:{" "}
                  {insights.dataQuality.truncatedSources.join(", ")}
                </p>
              )}
              {insights.verifiedInternalContributors !== undefined &&
                insights.verifiedOtherContributors !== undefined && (
                  <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 p-3">
                    <p className="font-medium text-foreground">
                      {labels.verifiedTitle}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <div>
                        <p className="font-mono text-base text-foreground">
                          {insights.verifiedInternalContributors}
                        </p>
                        <p>{labels.verifiedInternal}</p>
                      </div>
                      <div>
                        <p className="font-mono text-base text-foreground">
                          {insights.verifiedOtherContributors}
                        </p>
                        <p>{labels.verifiedOther}</p>
                      </div>
                    </div>
                    <p className="mt-2 leading-relaxed">
                      {labels.verifiedHelp}
                    </p>
                  </div>
                )}
              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-center">
                <div>
                  <p className="font-mono text-base text-foreground">
                    {insights.affiliatedContributors}
                  </p>
                  <p className="mt-0.5">{labels.affiliated}</p>
                </div>
                <div>
                  <p className="font-mono text-base text-foreground">
                    {insights.externalContributors}
                  </p>
                  <p className="mt-0.5">{labels.external}</p>
                </div>
                <div>
                  <p className="font-mono text-base text-foreground">
                    {insights.unknownAssociationContributors}
                  </p>
                  <p className="mt-0.5">{labels.unknown}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
