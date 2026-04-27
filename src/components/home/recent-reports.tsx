"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/contexts/locale-context";
import type { RecentReportEntry } from "@/lib/cache";

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-score-excellent";
  if (score >= 60) return "text-score-good";
  if (score >= 40) return "text-score-mid";
  if (score >= 20) return "text-score-low";
  return "text-score-poor";
}

interface RecentReportsProps {
  items: RecentReportEntry[];
}

export function RecentReports({ items }: RecentReportsProps) {
  const { d } = useLocale();

  if (items.length === 0) {
    return (
      <div className="mt-12 w-full max-w-xl text-center">
        <p className="text-xs text-muted-foreground">{d.recentReports.emptyState}</p>
      </div>
    );
  }

  return (
    <section className="mt-12 w-full max-w-2xl">
      <h2 className="mb-4 text-sm font-medium text-muted-foreground tracking-wide uppercase">
        {d.recentReports.title}
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => {
          const href = `/report/${item.platform}/${item.owner}/${item.repo}/${item.period}`;
          return (
            <Link
              key={item.dedupeKey}
              href={href}
              className="group flex items-center justify-between rounded-xl border border-border/60 bg-card/60 px-4 py-3 text-sm hover:border-border hover:bg-card transition-colors"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="truncate font-medium">
                  {item.owner}/{item.repo}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {item.platform === "github" ? "GH" : "HF"}
                  </Badge>
                  <span>{item.period}</span>
                  <span>·</span>
                  <span suppressHydrationWarning>{relativeTime(item.completedAt)}</span>
                </div>
              </div>
              <div className="ml-3 flex shrink-0 flex-col items-end gap-0.5">
                <span className={`text-lg font-semibold font-display tabular-nums ${scoreColor(item.score)}`}>
                  {Math.round(item.score)}
                </span>
                {item.scoreVersion && (
                  <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0">
                    {item.scoreVersion}
                  </Badge>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
