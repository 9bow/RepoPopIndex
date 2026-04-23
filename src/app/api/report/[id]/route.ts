import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { analyses, scores, rawMetrics } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cacheGet, cacheSet, reportCacheKey, REPORT_TTL } from "@/lib/cache";
import type { AnalysisReport } from "@/lib/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const [analysis] = await db
    .select()
    .from(analyses)
    .where(eq(analyses.id, id))
    .limit(1);

  if (!analysis) {
    return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
  }

  if (analysis.status !== "complete" && analysis.status !== "partial") {
    return NextResponse.json(
      { error: "Analysis not ready", status: analysis.status },
      { status: 202 }
    );
  }

  const cacheKey = reportCacheKey(
    analysis.platform,
    analysis.owner,
    analysis.repo,
    analysis.period
  );
  const cached = await cacheGet<AnalysisReport>(cacheKey);
  if (cached) {
    return NextResponse.json(cached);
  }

  const [score] = await db
    .select()
    .from(scores)
    .where(eq(scores.analysisId, id))
    .limit(1);

  const metrics = await db
    .select()
    .from(rawMetrics)
    .where(eq(rawMetrics.analysisId, id));

  const hnMetrics = metrics.filter((m) => m.category === "S1");
  const hnData = hnMetrics.length > 0 ? {
    storyCount: hnMetrics.find((m) => m.metricKey === "story_count")?.rawValue ?? 0,
    totalPoints: hnMetrics.find((m) => m.metricKey === "total_points")?.rawValue ?? 0,
    totalComments: hnMetrics.find((m) => m.metricKey === "total_comments")?.rawValue ?? 0,
    topStory: hnMetrics.find((m) => m.metricKey === "top_story")?.rawJson as {
      title: string;
      url: string;
      points: number;
    } | null ?? null,
    engagement: hnMetrics.find((m) => m.metricKey === "engagement")?.rawValue ?? 0,
  } : null;

  const report: AnalysisReport = {
    id: analysis.id,
    platform: analysis.platform,
    owner: analysis.owner,
    repo: analysis.repo,
    period: analysis.period,
    status: analysis.status,
    compositeScore: score?.compositeScore ?? 0,
    categoryScores: (score?.categoryScores as Record<string, never>) ?? {},
    excludedCategories: (score?.excludedCategories as string[]) ?? [],
    starQuality: score
      ? {
          factor: score.starQualityFactor ?? 0,
          recent: score.starQualityRecent ?? 0,
          historical: score.starQualityHistorical ?? 0,
          burstDetected: (score.starBurstDetected ?? 0) === 1,
        }
      : null,
    socialBuzz: { hn: hnData },
    createdAt: analysis.createdAt.toISOString(),
    completedAt: analysis.completedAt?.toISOString() ?? null,
  };

  await cacheSet(cacheKey, report, REPORT_TTL);

  return NextResponse.json(report);
}
