"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScoreGauge } from "@/components/report/score-gauge";
import { CategoryRadar } from "@/components/report/category-radar";
import { CategoryCards } from "@/components/report/category-cards";
import { StarQualityCard } from "@/components/report/star-quality-card";
import { SocialBuzzCard } from "@/components/report/social-buzz-card";
import { MetricsTable } from "@/components/report/metrics-table";
import type { AnalysisReport, ProgressUpdate } from "@/lib/types";

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    const res = await fetch(`/api/status/${id}`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Analysis not found");
      return null;
    }
    return data as ProgressUpdate;
  }, [id]);

  const fetchReport = useCallback(async () => {
    const res = await fetch(`/api/report/${id}`);
    if (res.status === 202) return null;
    if (!res.ok) {
      setError("Failed to load report");
      return null;
    }
    return (await res.json()) as AnalysisReport;
  }, [id]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    async function poll() {
      const status = await fetchStatus();
      if (!status) return;

      setProgress(status);

      if (status.status === "complete" || status.status === "partial") {
        const r = await fetchReport();
        if (r) {
          setReport(r);
          clearInterval(timer);
        }
      } else if (status.status === "failed") {
        setError(status.stage ?? "Analysis failed");
        clearInterval(timer);
      }
    }

    poll();
    timer = setInterval(poll, 2000);
    return () => clearInterval(timer);
  }, [fetchStatus, fetchReport]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-destructive">Analysis Failed</h1>
          <p className="text-muted-foreground">{error}</p>
          <a href="/" className="inline-block text-sm underline">
            Try another repository
          </a>
        </div>
      </main>
    );
  }

  if (!report) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="w-full max-w-md space-y-6 text-center">
          <h1 className="text-2xl font-bold">Analyzing Repository...</h1>
          <Progress value={progress?.progress ?? 0} className="h-3" />
          <p className="text-sm text-muted-foreground">
            {progress?.stage ?? "Preparing..."}
          </p>
          {progress?.status === "queued" && progress.position != null && (
            <p className="text-sm text-muted-foreground">
              Queue position: #{progress.position}
              {progress.estimatedWait && ` — ${progress.estimatedWait}`}
            </p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
      {/* Section A: Header */}
      <header className="space-y-4">
        <div className="flex items-center gap-3">
          <Badge variant="outline">
            {report.platform === "github" ? "GitHub" : "HuggingFace"}
          </Badge>
          <h1 className="text-2xl font-bold">
            {report.owner}/{report.repo}
          </h1>
        </div>
        {report.status === "partial" && (
          <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200">
            Some data sources were unavailable — score based on available data.
          </div>
        )}
        <ScoreGauge score={report.compositeScore} />
      </header>

      {/* Section B: Radar Chart */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Category Overview</h2>
        <CategoryRadar
          categoryScores={report.categoryScores}
          excludedCategories={report.excludedCategories}
        />
      </section>

      {/* Section C: Category Breakdown */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Category Breakdown</h2>
        <CategoryCards categoryScores={report.categoryScores} />
      </section>

      {/* Section D: Star Quality */}
      {report.starQuality && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">Star Quality Analysis</h2>
          <StarQualityCard starQuality={report.starQuality} />
        </section>
      )}

      {/* Section E: Social Buzz */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Social Buzz</h2>
        <SocialBuzzCard socialBuzz={report.socialBuzz} />
      </section>

      {/* Section F: Detailed Metrics */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Detailed Metrics</h2>
        <MetricsTable categoryScores={report.categoryScores} />
      </section>

      {/* Section G: Footer */}
      <footer className="border-t pt-6 text-sm text-muted-foreground space-y-2">
        <p>
          Score formula: S_i = log(1 + raw) / log(1 + max). Categories weighted
          and averaged. Missing data excluded proportionally.
        </p>
        <p>
          Analyzed: {new Date(report.createdAt).toLocaleString()} | Period: {report.period}
        </p>
      </footer>
    </main>
  );
}
