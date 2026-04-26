"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useLocale } from "@/contexts/locale-context";
import { translateStage } from "@/lib/i18n/stage";
import { formatTemplate } from "@/lib/i18n/dictionary";
import { ReportView } from "@/components/report/report-view";
import type { AnalysisReport, Period, ProgressUpdate } from "@/lib/types";

interface IdleClientProps {
  platform: "github" | "huggingface";
  owner: string;
  repo: string;
  period: Period;
}

type Phase = "idle" | "running" | "error";

export function IdleClient({ platform, owner, repo, period }: IdleClientProps) {
  const router = useRouter();
  const { d, locale } = useLocale();
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const slug = `${platform}/${owner}/${repo}/${period}`;

  // non-authoritative: read client cache as visual placeholder before authoritative data arrives;
  // never used for trust decisions — only for UX continuity on repeat visits
  const [cachedReport] = useState<AnalysisReport | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem(`rpi:lastReport:${slug}`);
      return stored ? (JSON.parse(stored) as AnalysisReport) : null;
    } catch {
      return null;
    }
  });

  const url =
    platform === "github"
      ? `https://github.com/${owner}/${repo}`
      : `https://huggingface.co/${owner}/${repo}`;

  async function startAnalysis() {
    setPhase("running");
    setError(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, period }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? body.message ?? d.report.loadFailed);
        setPhase("error");
        return;
      }
      pollStatus(body.id as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : d.report.loadFailed);
      setPhase("error");
    }
  }

  function pollStatus(id: string) {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/status/${id}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? d.report.loadFailed);
        setPhase("error");
        clearInterval(interval);
        return;
      }
      const data = (await res.json()) as ProgressUpdate;
      setProgress(data);
      if (data.status === "complete" || data.status === "partial") {
        clearInterval(interval);
        router.refresh();
      } else if (data.status === "failed") {
        setError(data.stage ?? translateStage("Unknown error", locale));
        setPhase("error");
        clearInterval(interval);
      }
    }, 2000);
  }

  const repoLabel = `${platform} / ${owner} / ${repo}`;

  if (phase === "running") {
    const pos = progress?.position;
    const waitSec = pos != null && pos > 0 ? pos * 15 : null;
    return (
      <main className="flex min-h-screen items-center justify-center px-4 pt-16 sm:pt-20 pb-10">
        <div className="w-full max-w-md space-y-6 text-center">
          <h1 className="text-2xl font-bold font-display tracking-tight">
            {d.report.analyzingTitle}
          </h1>
          <p className="text-sm text-muted-foreground break-all">{repoLabel}</p>
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

  if (phase === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 pt-16 sm:pt-20 pb-10">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold font-display tracking-tight text-destructive">
            {d.report.failTitle}
          </h1>
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={() => setPhase("idle")}>
            {d.report.tryAnother}
          </Button>
        </div>
      </main>
    );
  }

  // Idle phase: show cached placeholder if available, otherwise empty state
  if (cachedReport) {
    return (
      <div className="relative">
        {/* non-authoritative: translucent last-seen report; server data will replace on refresh */}
        <div className="pointer-events-none select-none opacity-40" aria-hidden="true">
          <ReportView report={cachedReport} />
        </div>
        <div className="fixed inset-0 z-10 flex items-end justify-center pb-16 sm:pb-20 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-background/95 backdrop-blur-sm px-6 py-5 shadow-lg space-y-4 text-center">
            <p className="text-sm text-muted-foreground">{d.report.lastViewBanner}</p>
            <Button onClick={startAnalysis} className="w-full">
              Run Analysis
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 pt-16 sm:pt-20 pb-10">
      <div className="w-full max-w-md space-y-6 text-center">
        <h1 className="text-2xl font-bold font-display tracking-tight break-all">
          {repoLabel}
        </h1>
        <p className="text-muted-foreground">
          이 저장소는 아직 분석된 적이 없습니다. 분석을 시작하시겠습니까?
        </p>
        <Button onClick={startAnalysis}>Run Analysis</Button>
      </div>
    </main>
  );
}
