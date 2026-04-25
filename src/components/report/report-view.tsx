"use client";

import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScoreGauge } from "@/components/report/score-gauge";
import { CategoryRadar } from "@/components/report/category-radar";
import { CategoryCards } from "@/components/report/category-cards";
import { StarQualityCard } from "@/components/report/star-quality-card";
import { SocialBuzzCard } from "@/components/report/social-buzz-card";
import { MetricsTable } from "@/components/report/metrics-table";
import { useLocale } from "@/contexts/locale-context";
import type { AnalysisReport, Period } from "@/lib/types";

interface ReportViewProps {
  report: AnalysisReport;
}

export function ReportView({ report }: ReportViewProps) {
  const { d, locale } = useLocale();
  const periodLabel = d.report.periods[report.period as Period];
  const dateLocale = locale === "ko" ? "ko-KR" : "en-US";

  const slug = `${report.platform}/${report.owner}/${report.repo}/${report.period}`;

  // non-authoritative client cache — for next-visit placeholder only, never read for trust decisions
  useEffect(() => {
    try {
      localStorage.setItem(`rpi:lastReport:${slug}`, JSON.stringify(report));
    } catch {
      // localStorage unavailable (private browsing, storage quota, etc.)
    }
  }, [slug, report]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-8 pt-16 sm:pt-20 space-y-8 sm:space-y-12">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Badge variant="outline">
              {report.platform === "github" ? "GitHub" : "HuggingFace"}
            </Badge>
            {report.scoreVersion && (
              <Badge variant="secondary" className="text-xs font-mono">
                {report.scoreVersion}
              </Badge>
            )}
            <h1 className="text-xl sm:text-2xl font-semibold font-display tracking-tight break-all">
              <a
                href={
                  report.platform === "github"
                    ? `https://github.com/${report.owner}/${report.repo}`
                    : `https://huggingface.co/${report.owner}/${report.repo}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline"
              >
                {report.owner}/{report.repo}
              </a>
            </h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="print:hidden"
          >
            PDF 다운로드
          </Button>
        </div>

        {/* New typed partial info banner */}
        {report.partial && (
          <div className="rounded-xl border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-sm leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200">
            {d.report.partialResult} — {report.partial.reason.replace(/_/g, " ")}
            {report.partial.missingSources.length > 0 && (
              <>; {d.report.partialMissing}: {report.partial.missingSources.join(", ")}</>
            )}
          </div>
        )}

        {/* Legacy partial status banner for v1 reports without partial field */}
        {report.status === "partial" && !report.partial && (
          <div className="rounded-xl border border-amber-300/60 bg-amber-50/80 px-4 py-3 text-sm leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200">
            {d.report.partialBanner}
          </div>
        )}

        <ScoreGauge score={report.compositeScore} />
      </header>

      <section>
        <h2 className="mb-4 sm:mb-5 text-lg sm:text-xl font-semibold font-display tracking-tight">{d.report.categoryOverview}</h2>
        <CategoryRadar
          categoryScores={report.categoryScores}
          excludedCategories={report.excludedCategories}
        />
      </section>

      <section>
        <h2 className="mb-4 sm:mb-5 text-lg sm:text-xl font-semibold font-display tracking-tight">{d.report.categoryBreakdown}</h2>
        <CategoryCards categoryScores={report.categoryScores} />
      </section>

      {report.starQuality && (
        <section>
          <h2 className="mb-4 sm:mb-5 text-lg sm:text-xl font-semibold font-display tracking-tight">{d.report.starQuality}</h2>
          <StarQualityCard starQuality={report.starQuality} />
        </section>
      )}

      <section>
        <h2 className="mb-4 sm:mb-5 text-lg sm:text-xl font-semibold font-display tracking-tight">{d.report.socialBuzz}</h2>
        <SocialBuzzCard socialBuzz={report.socialBuzz} />
      </section>

      <section>
        <h2 className="mb-4 sm:mb-5 text-lg sm:text-xl font-semibold font-display tracking-tight">{d.report.detailedMetrics}</h2>
        <MetricsTable
          categoryScores={report.categoryScores}
          platform={report.platform}
          owner={report.owner}
          repo={report.repo}
          period={report.period}
        />
      </section>

      <footer className="mt-8 border-t pt-6 text-sm text-muted-foreground space-y-2">
        <p>{d.report.footerFormula}</p>
        <p className="flex flex-wrap gap-x-2 gap-y-1">
          <span>{d.report.analyzed}: {new Date(report.createdAt).toLocaleString(dateLocale)}</span>
          <span aria-hidden>·</span>
          <span>{d.report.period}: {periodLabel}</span>
        </p>
      </footer>
    </main>
  );
}
