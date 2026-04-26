import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { parseRepoUrl } from "@/lib/parsers/url-parser";
import { createAnalysis } from "@/lib/analysis-store";
import { inngest } from "@/inngest/client";
import { canEnqueue, enqueue, getQueueDepth, MAX_QUEUE_DEPTH } from "@/lib/queue";

const AnalyzeBodySchema = z.object({
  url: z.string().min(1),
  period: z.enum(["1w", "1m", "3m", "6m", "1y"]).default("3m"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = AnalyzeBodySchema.parse(body);

    const repo = parseRepoUrl(parsed.url);

    const queueOk = await canEnqueue();
    if (!queueOk) {
      const depth = await getQueueDepth();
      return NextResponse.json(
        {
          error: "Service busy",
          message: `Queue full (${depth}/${MAX_QUEUE_DEPTH}). Try again later.`,
        },
        {
          status: 503,
          headers: { "Retry-After": "30" },
        }
      );
    }

    const id = await createAnalysis({
      platform: repo.platform,
      owner: repo.owner,
      repo: repo.repo,
      period: parsed.period,
      inputUrl: parsed.url,
    });

    await enqueue(id);

    await inngest.send({
      name: "analysis/run",
      data: {
        analysisId: id,
        platform: repo.platform,
        owner: repo.owner,
        repo: repo.repo,
        period: parsed.period,
      },
    });

    return NextResponse.json({
      id,
      status: "queued",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
