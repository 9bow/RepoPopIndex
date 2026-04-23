export type Platform = "github" | "huggingface";
export type Period = "1w" | "1m" | "3m" | "6m" | "1y";
export type AnalysisStatus =
  | "queued"
  | "collecting"
  | "scoring"
  | "complete"
  | "partial"
  | "failed";

export interface MetricValue {
  raw: number | null;
  normalized: number | null;
  weighted: number | null;
}

export interface CategoryScore {
  name: string;
  score: number;
  maxScore: 100;
  metrics: Record<string, MetricValue>;
  insufficient: boolean;
  reason?: string;
}

export interface AnalysisReport {
  id: string;
  platform: Platform;
  owner: string;
  repo: string;
  period: Period;
  status: AnalysisStatus;
  compositeScore: number;
  categoryScores: Record<string, CategoryScore>;
  excludedCategories: string[];
  starQuality: {
    factor: number;
    recent: number;
    historical: number;
    burstDetected: boolean;
  } | null;
  socialBuzz: {
    hn: {
      storyCount: number;
      totalPoints: number;
      totalComments: number;
      topStory: { title: string; url: string; points: number } | null;
      engagement: number;
    } | null;
  };
  createdAt: string;
  completedAt: string | null;
}

export interface CollectorResult {
  source: string;
  metrics: Array<{
    category: string;
    metricKey: string;
    rawValue: number | null;
    rawJson?: unknown;
  }>;
  error?: string;
}

export interface ProgressUpdate {
  status: AnalysisStatus;
  progress: number;
  stage: string;
  position?: number;
  estimatedWait?: string;
}

export function periodToDays(period: Period): number {
  const map: Record<Period, number> = {
    "1w": 7,
    "1m": 30,
    "3m": 90,
    "6m": 180,
    "1y": 365,
  };
  return map[period];
}

export function periodToSinceDate(period: Period): Date {
  const days = periodToDays(period);
  const since = new Date();
  since.setDate(since.getDate() - days);
  return since;
}
