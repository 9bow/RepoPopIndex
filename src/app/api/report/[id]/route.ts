import { NextRequest, NextResponse } from "next/server";
import { cacheGet, reportCacheKey } from "@/lib/cache";
import { getAnalysis } from "@/lib/analysis-store";
import type { AnalysisReport } from "@/lib/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const analysis = await getAnalysis(id);

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
  if (!cached) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  return NextResponse.json(cached);
}
