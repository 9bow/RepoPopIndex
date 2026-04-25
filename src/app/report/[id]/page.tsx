"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScoreGauge } from "@/components/report/score-gauge";
import { CategoryRadar } from "@/components/report/category-radar";
import { CategoryCards } from "@/components/report/category-cards";
import { StarQualityCard } from "@/components/report/star-quality-card";
import { SocialBuzzCard } from "@/components/report/social-buzz-card";
import { MetricsTable } from "@/components/report/metrics-table";
import { useLocale } from "@/contexts/locale-context";
import { formatTemplate } from "@/lib/i18n/dictionary";
import { translateStage } from "@/lib/i18n/stage";
import type { AnalysisReport, Period, ProgressUpdate } from "@/lib/types";

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const { d, locale } = useLocale();
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    const res = await fetch(`/api/status/${id}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? d.report.notFound);
      return null;
    }
    return data as ProgressUpdate;
  }, [id, d.report.notFound]);

  const fetchReport = useCallback(async () => {
    const res = await fetch(`/api/report/${id}`);
    if (res.status === 202) return null;
    if (!res.ok) {
      setError(d.report.loadFailed);
      return null;
    }
    return (await res.json()) as AnalysisReport;
  }, [id, d.report.loadFailed]);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function poll() {
      const status = await fetchStatus();
      if (!status) return;

      setProgress(status);

      if (status.status === "complete" || status.status === "partial") {
        const r = await fetchReport();
        if (r) {
          setReport(r);
          if (intervalId) clearInterval(intervalId);
        }
      } else if (status.status === "failed") {
        setError(status.stage ?? translateStage("Unknown error", locale));
        if (intervalId) clearInterval(intervalId);
      }
    }

    void poll();
    intervalId = setInterval(poll, 2000);
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [fetchStatus, fetchReport, locale]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 pt-16">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">
            {d.report.failTitle}
          </h1>
          <p className="text-muted-foreground">{error}</p>
          <Link href="/" className="inline-block text-sm underline">
            {d.report.tryAnother}
          </Link>
        </div>
      </main>
    );
  }

  if (!report) {
    const pos = progress?.position;
    const waitSec = pos != null && pos > 0 ? pos * 15 : null;
    return (
      <main className="flex min-h-screen items-center justify-center px-4 pt-16">
        <div className="w-full max-w-md space-y-6 text-center">
          <h1 className="text-2xl font-bold">{d.report.analyzingTitle}</h1>
          <Progress value={progress?.progress ?? 0} className="h-3" />
          <p className="text-sm text-muted-foreground">
            {progress?.stage
              ? translateStage(progress.stage, locale)
              : d.common.loading}
          </p>
          {progress?.status === "queued" && pos != null && (
            <p className="text-sm text-muted-foreground">
              {formatTemplate(d.report.queuePosition, { n: pos })}
              {waitSec != null
                ? ` ${formatTemplate(d.report.estimatedWait, { n: waitSec })}`
                : ""}
            </p>
          )}
        </div>
      </main>
    );
  }

  const periodLabel = d.report.periods[report.period as Period];
  const dateLocale = locale === "ko" ? "ko-KR" : "en-US";

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 pt-20 space-y-8">
      <header className="space-y-4">
        <div className="flex items-center gap-3">
          <Badge variant="outline">
            {report.platform === "github" ? "GitHub" : "HuggingFace"}
          </Badge>
          <h1 className="text-2xl font-bold">
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
        {report.status === "partial" && (
          <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200">
            {d.report.partialBanner}
          </div>
        )}
        <ScoreGauge score={report.compositeScore} />
      </header>

      <section>
        <h2 className="mb-4 text-lg font-semibold">{d.report.categoryOverview}</h2>
        <CategoryRadar
          categoryScores={report.categoryScores}
          excludedCategories={report.excludedCategories}
        />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">{d.report.categoryBreakdown}</h2>
        <CategoryCards categoryScores={report.categoryScores} />
      </section>

      {report.starQuality && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">{d.report.starQuality}</h2>
          <StarQualityCard starQuality={report.starQuality} />
        </section>
      )}

      <section>
        <h2 className="mb-4 text-lg font-semibold">{d.report.socialBuzz}</h2>
        <SocialBuzzCard socialBuzz={report.socialBuzz} />
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">{d.report.detailedMetrics}</h2>
        <MetricsTable
          categoryScores={report.categoryScores}
          platform={report.platform}
          owner={report.owner}
          repo={report.repo}
          period={report.period}
        />
      </section>

      <footer className="border-t pt-6 text-sm text-muted-foreground space-y-2">
        <p>{d.report.footerFormula}</p>
        <p>
          {d.report.analyzed}:{" "}
          {new Date(report.createdAt).toLocaleString(dateLocale)} | {d.report.period}
          : {periodLabel}
        </p>
      </footer>
    </main>
  );
}
