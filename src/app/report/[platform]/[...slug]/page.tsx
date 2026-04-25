import { notFound } from "next/navigation";
import { cacheGet, reportCacheKey } from "@/lib/cache";
import { ReportView } from "@/components/report/report-view";
import { IdleClient } from "./idle-client";
import type { AnalysisReport, Period, Platform } from "@/lib/types";

const PLATFORMS: Platform[] = ["github", "huggingface"];
const PERIODS: Period[] = ["1w", "1m", "3m", "6m", "1y"];

interface PageProps {
  params: Promise<{ platform: string; slug: string[] }>;
}

export default async function ReportRoutePage({ params }: PageProps) {
  const { platform, slug } = await params;

  if (!PLATFORMS.includes(platform as Platform)) notFound();
  if (!slug || slug.length < 3) notFound();

  const period = slug[slug.length - 1];
  const repo = slug[slug.length - 2];
  const owner = slug.slice(0, slug.length - 2).join("/");

  if (!PERIODS.includes(period as Period)) notFound();

  const typedPlatform = platform as Platform;
  const typedPeriod = period as Period;

  const report = await cacheGet<AnalysisReport>(
    reportCacheKey(typedPlatform, owner, repo, typedPeriod)
  );

  if (!report) {
    return (
      <IdleClient
        platform={typedPlatform}
        owner={owner}
        repo={repo}
        period={typedPeriod}
      />
    );
  }

  return <ReportView report={report} />;
}
