"use client";

import { useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useLocale } from "@/contexts/locale-context";
import {
  getMetricDescription,
  getMetricLabel,
} from "@/lib/i18n/metric-labels";
import { getMetricDrillDownUrl } from "@/lib/metric-links";
import type { Period, RawSourceData } from "@/lib/types";

const SOURCE_COPY: Record<
  string,
  { en: { title: string; description: string }; ko: { title: string; description: string } }
> = {
  "github-graphql": {
    en: {
      title: "Repository profile & commit history",
      description:
        "Core repository facts and default-branch commit counts returned by GitHub GraphQL.",
    },
    ko: {
      title: "저장소 기본 정보·커밋 이력",
      description:
        "GitHub GraphQL이 반환한 저장소 기본 정보와 기본 브랜치 커밋 수입니다.",
    },
  },
  "github-search": {
    en: {
      title: "Issues & pull requests",
      description:
        "Issue and pull-request counts plus response-time samples from GitHub Search and GraphQL.",
    },
    ko: {
      title: "이슈·풀 리퀘스트",
      description:
        "GitHub Search와 GraphQL에서 수집한 이슈·PR 수 및 응답시간 표본입니다.",
    },
  },
  "github-rest": {
    en: {
      title: "Activity, releases & community files",
      description:
        "Participation, code-frequency, release, tag, and community-profile values from GitHub REST.",
    },
    ko: {
      title: "활동·릴리스·커뮤니티 문서",
      description:
        "GitHub REST에서 수집한 참여, 코드 증감, 릴리스, 태그, 커뮤니티 문서 값입니다.",
    },
  },
  "github-scraper": {
    en: {
      title: "Dependent repositories",
      description:
        "Best-effort dependent-repository count read from GitHub’s public dependents page.",
    },
    ko: {
      title: "의존 저장소",
      description:
        "GitHub 공개 의존성 페이지에서 가능한 범위로 읽은 의존 저장소 수입니다.",
    },
  },
  "star-quality": {
    en: {
      title: "Recent stargazer quality sample",
      description:
        "A quality-adjusted star signal based on the 100 most recent visible stargazers.",
    },
    ko: {
      title: "최근 스타게이저 품질 표본",
      description:
        "조회 가능한 최근 스타게이저 최대 100명을 바탕으로 만든 품질 보정 별점 신호입니다.",
    },
  },
  "github-contributors": {
    en: {
      title: "Contributor activity window",
      description:
        "Aggregated commit, issue, and PR participation collected over a 24-month observation window.",
    },
    ko: {
      title: "기여자 활동 관측 구간",
      description:
        "최근 24개월 관측 구간에서 수집한 커밋·이슈·PR 참여 집계입니다.",
    },
  },
};

function formatRawValue(value: number | null): string {
  if (value === null) return "N/A";
  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

export function RawDataCard({
  sources,
  owner,
  repo,
  period,
}: {
  sources: RawSourceData[];
  owner: string;
  repo: string;
  period: Period;
}) {
  const { d, locale } = useLocale();
  const [openSources, setOpenSources] = useState<Set<string>>(new Set());

  function toggle(source: string) {
    setOpenSources((previous) => {
      const next = new Set(previous);
      if (next.has(source)) next.delete(source);
      else next.add(source);
      return next;
    });
  }

  function downloadJson() {
    const payload = JSON.stringify(
      {
        repository: `${owner}/${repo}`,
        note: d.rawData.exportNote,
        sources,
      },
      null,
      2
    );
    const url = URL.createObjectURL(
      new Blob([payload], { type: "application/json;charset=utf-8" })
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${owner}-${repo}-github-raw-data.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="overflow-hidden border-border/70">
      <CardHeader className="gap-4 border-b border-border/60 bg-muted/20 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {d.rawData.eyebrow}
          </p>
          <CardTitle className="text-base">{d.rawData.title}</CardTitle>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {d.rawData.subtitle}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 print:hidden"
          onClick={downloadJson}
        >
          <Download className="mr-2 size-4" aria-hidden />
          {d.rawData.exportJson}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 p-4 sm:p-6">
        <div className="rounded-lg border border-blue-200/70 bg-blue-50/70 px-4 py-3 text-sm leading-relaxed text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
          <p className="font-medium">{d.rawData.readingTitle}</p>
          <p className="mt-1">{d.rawData.readingGuide}</p>
        </div>

        {sources.map((source) => {
          const sourceCopy = SOURCE_COPY[source.source]?.[locale] ?? {
            title: source.source,
            description: d.rawData.unknownSource,
          };
          const isOpen = openSources.has(source.source);

          return (
            <Collapsible
              key={source.source}
              open={isOpen}
              onOpenChange={() => toggle(source.source)}
              className="rounded-xl border border-border/70"
            >
              <CollapsibleTrigger className="flex w-full items-start justify-between gap-4 p-4 text-left hover:bg-muted/40">
                <span className="space-y-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{sourceCopy.title}</span>
                    <Badge
                      variant={source.status === "complete" ? "secondary" : "outline"}
                      className="text-[0.65rem]"
                    >
                      {d.rawData.status[source.status]}
                    </Badge>
                  </span>
                  <span className="block text-xs leading-relaxed text-muted-foreground">
                    {sourceCopy.description}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                  {source.metrics.length} {d.rawData.items}
                  <ChevronDown
                    className={`size-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent className="border-t border-border/60">
                <div className="space-y-3 p-4">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      {d.rawData.collectedAt}:{" "}
                      {new Date(source.collectedAt).toLocaleString(
                        locale === "ko" ? "ko-KR" : "en-US"
                      )}
                    </span>
                    <span className="font-mono">{source.source}</span>
                  </div>
                  {source.error && (
                    <p className="rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
                      {d.rawData.error}: {source.error}
                    </p>
                  )}
                  <div className="space-y-2">
                    {source.metrics.map((metric) => {
                      const sourceUrl = getMetricDrillDownUrl(
                        metric.metricKey,
                        "github",
                        owner,
                        repo,
                        period
                      );
                      return (
                        <article
                          key={`${source.source}-${metric.metricKey}`}
                          className="rounded-lg bg-muted/35 px-3 py-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="text-sm font-medium">
                                  {getMetricLabel(metric.metricKey, locale)}
                                </h4>
                                <code className="text-[0.65rem] text-muted-foreground">
                                  {metric.metricKey}
                                </code>
                                {sourceUrl && (
                                  <a
                                    href={sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                                  >
                                    {d.rawData.openGitHub} ↗
                                  </a>
                                )}
                              </div>
                              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                {getMetricDescription(metric.metricKey, locale)}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-mono text-sm font-semibold tabular-nums">
                                {formatRawValue(metric.rawValue)}
                              </p>
                              <p className="text-[0.65rem] text-muted-foreground">
                                {d.rawData.rawValue}
                              </p>
                            </div>
                          </div>
                          {metric.rawJson !== undefined && (
                            <details className="mt-3">
                              <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
                                {d.rawData.rawJson}
                              </summary>
                              <pre className="mt-2 max-h-80 overflow-auto rounded-md border border-border/60 bg-background p-3 text-[0.7rem] leading-relaxed">
                                {JSON.stringify(metric.rawJson, null, 2)}
                              </pre>
                            </details>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}
