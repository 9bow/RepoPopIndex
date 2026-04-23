import { NextRequest, NextResponse } from "next/server";
import { cacheGet, progressCacheKey } from "@/lib/cache";
import { getQueuePosition } from "@/lib/queue";
import { db } from "@/db";
import { analyses } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { ProgressUpdate } from "@/lib/types";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const progress = await cacheGet<ProgressUpdate>(progressCacheKey(id));

  if (progress) {
    if (progress.status === "queued") {
      const position = await getQueuePosition(id);
      return NextResponse.json({
        ...progress,
        position: position ?? 0,
        estimatedWait: position ? `~${position * 15}s` : undefined,
      });
    }
    return NextResponse.json(progress);
  }

  const [analysis] = await db
    .select()
    .from(analyses)
    .where(eq(analyses.id, id))
    .limit(1);

  if (!analysis) {
    return NextResponse.json({ error: "Analysis not found" }, { status: 404 });
  }

  return NextResponse.json({
    status: analysis.status,
    progress: analysis.status === "complete" || analysis.status === "partial" ? 100 : 0,
    stage: analysis.status === "failed" ? analysis.error ?? "Unknown error" : analysis.status,
  });
}
