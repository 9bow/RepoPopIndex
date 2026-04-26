"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useLocale } from "@/contexts/locale-context";
import { MetricName } from "@/components/metric-name";
import { getMetricDrillDownUrl } from "@/lib/metric-links";
import type { CategoryScore, Period, Platform } from "@/lib/types";

export function MetricsTable({
  categoryScores,
  platform,
  owner,
  repo,
  period,
}: {
  categoryScores: Record<string, CategoryScore>;
  platform: Platform;
  owner: string;
  repo: string;
  period: Period;
}) {
  const { d } = useLocale();
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());

  function toggle(key: string) {
    setOpenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const entries = Object.entries(categoryScores);

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{d.metricsTable.none}</p>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map(([key, cat]) => (
        <Collapsible
          key={key}
          open={openCategories.has(key)}
          onOpenChange={() => toggle(key)}
        >
          <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border border-border/70 px-4 py-3 text-left hover:bg-muted/50">
            <span className="text-sm font-medium">{cat.name || key}</span>
            <span className="flex items-center gap-3">
              <span className="text-sm font-mono tabular-nums text-muted-foreground">
                {cat.insufficient
                  ? d.metricsTable.insufficient
                  : `${Math.round(cat.score)}/100`}
              </span>
              <ChevronDown
                className={`size-4 text-muted-foreground transition-transform ${openCategories.has(key) ? "rotate-180" : ""}`}
                aria-hidden
              />
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="-mx-4 sm:mx-0 overflow-x-auto">
              <div className="min-w-[36rem] px-4 sm:min-w-0 sm:px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{d.metricsTable.metric}</TableHead>
                      <TableHead className="text-right">{d.metricsTable.raw}</TableHead>
                      <TableHead className="text-right hidden md:table-cell">
                        {d.metricsTable.normalized}
                      </TableHead>
                      <TableHead className="text-right hidden sm:table-cell">{d.metricsTable.weight}</TableHead>
                      <TableHead className="text-right">
                        {d.metricsTable.contribution}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(cat.metrics).map(([name, m]) => {
                      const drillUrl = getMetricDrillDownUrl(name, platform, owner, repo, period);
                      return (
                        <TableRow key={name}>
                          <TableCell className="text-sm max-w-[10rem] sm:max-w-[14rem]">
                            <span className="inline-flex items-center gap-1">
                              <MetricName metricKey={name} />
                              {drillUrl && (
                                <a
                                  href={drillUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                                  title={d.metricsTable.openSource}
                                  aria-label={d.metricsTable.openSource}
                                >
                                  ↗
                                </a>
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-sm">
                            {m.raw !== null ? m.raw.toLocaleString() : "N/A"}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-sm hidden md:table-cell">
                            {m.normalized !== null ? m.normalized.toFixed(3) : "N/A"}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-sm hidden sm:table-cell">
                            {m.weighted !== null ? m.weighted.toFixed(3) : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums text-sm">
                            {m.weighted !== null
                              ? (m.weighted * 100).toFixed(1)
                              : "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}
