"use client";

import { Download, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useLocale } from "@/contexts/locale-context";
import type { ReportSnapshot } from "@/lib/types";

function percent(value: number | null): string {
  return value === null ? "N/A" : `${Math.round(value * 100)}%`;
}

function duration(value: number | null): string {
  if (value === null) return "N/A";
  if (value < 1) return `${Math.round(value * 60)}m`;
  if (value < 48) return `${value.toFixed(value < 10 ? 1 : 0)}h`;
  return `${(value / 24).toFixed(1)}d`;
}

function csvCell(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function SnapshotHistoryCard({
  snapshots,
  owner,
  repo,
}: {
  snapshots: ReportSnapshot[];
  owner: string;
  repo: string;
}) {
  const { d } = useLocale();
  const labels = d.snapshots;
  const first = snapshots[0];
  const latest = snapshots[snapshots.length - 1];
  const scoreChange =
    first && latest ? latest.compositeScore - first.compositeScore : 0;

  function downloadCsv() {
    const categoryKeys = [
      ...new Set(
        snapshots.flatMap((snapshot) => Object.keys(snapshot.categoryScores))
      ),
    ].sort();
    const rawMetricKeys = [
      ...new Set(snapshots.flatMap((snapshot) => Object.keys(snapshot.rawMetrics))),
    ].sort();
    const header = [
      "month",
      "captured_at",
      "status",
      "missing_sources",
      "excluded_categories",
      "composite_score",
      "active_contributors",
      "observed_new_contributors",
      "retention_rate",
      "median_human_response_hours",
      "median_maintainer_response_hours",
      ...categoryKeys.map((key) => `category:${key}`),
      ...rawMetricKeys,
    ];
    const rows = snapshots.map((snapshot) => [
      snapshot.month,
      snapshot.capturedAt,
      snapshot.status ?? "",
      (snapshot.missingSources ?? []).join("|"),
      (snapshot.excludedCategories ?? []).join("|"),
      snapshot.compositeScore,
      snapshot.activeContributors,
      snapshot.observedNewContributors,
      snapshot.retentionRate,
      snapshot.medianHumanResponseHours,
      snapshot.medianMaintainerResponseHours,
      ...categoryKeys.map((key) => snapshot.categoryScores[key] ?? null),
      ...rawMetricKeys.map((key) => snapshot.rawMetrics[key] ?? null),
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
    anchor.download = `${owner}-${repo}-monthly-snapshots.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="overflow-hidden border-border/70">
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-4 border-b border-border/70 px-5 py-5 sm:px-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <History className="size-3.5" aria-hidden />
            {labels.eyebrow}
          </div>
          <div>
            <h3 className="font-display text-xl font-semibold tracking-tight">
              {labels.title}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{labels.subtitle}</p>
          </div>
        </div>
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
      </CardHeader>
      <CardContent className="space-y-5 px-5 py-5 sm:px-6">
        <p className="rounded-lg border border-border/60 bg-muted/25 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          {labels.methodology}
        </p>
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border/70 bg-border/70">
          <div className="bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{labels.baseline}</p>
            <p className="mt-1 font-display text-xl font-semibold tabular-nums">
              {first?.compositeScore.toFixed(1) ?? "N/A"}
            </p>
          </div>
          <div className="bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{labels.latest}</p>
            <p className="mt-1 font-display text-xl font-semibold tabular-nums">
              {latest?.compositeScore.toFixed(1) ?? "N/A"}
            </p>
          </div>
          <div className="bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{labels.change}</p>
            <p className="mt-1 font-display text-xl font-semibold tabular-nums">
              {scoreChange > 0 ? "+" : ""}
              {scoreChange.toFixed(1)}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-border/70">
          <table className="w-full min-w-[740px] text-sm">
            <thead className="bg-muted/45 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5 text-left font-medium">{labels.month}</th>
                <th className="px-3 py-2.5 text-right font-medium">
                  {labels.composite}
                </th>
                <th className="px-3 py-2.5 text-right font-medium">
                  {labels.contributors}
                </th>
                <th className="px-3 py-2.5 text-right font-medium">
                  {labels.newContributors}
                </th>
                <th className="px-3 py-2.5 text-right font-medium">
                  {labels.retention}
                </th>
                <th className="px-3 py-2.5 text-right font-medium">
                  {labels.response}
                </th>
                <th className="px-3 py-2.5 text-right font-medium">
                  {labels.quality}
                </th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((snapshot) => (
                <tr key={snapshot.month} className="border-t border-border/60">
                  <td className="px-3 py-3 font-mono text-xs">{snapshot.month}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">
                    {snapshot.compositeScore.toFixed(1)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">
                    {snapshot.activeContributors ?? "N/A"}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">
                    {snapshot.observedNewContributors ?? "N/A"}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">
                    {percent(snapshot.retentionRate)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">
                    {duration(snapshot.medianHumanResponseHours)}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Badge
                      variant={snapshot.status === "complete" ? "secondary" : "outline"}
                      className="text-[0.65rem]"
                      title={
                        (snapshot.missingSources ?? []).length > 0
                          ? `${labels.missing}: ${snapshot.missingSources!.join(", ")}`
                          : undefined
                      }
                    >
                      {snapshot.status === "complete"
                        ? labels.complete
                        : snapshot.status === "partial"
                          ? labels.partial
                          : labels.unknown}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
