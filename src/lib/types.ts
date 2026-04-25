export type Platform = "github" | "huggingface";
export type Period = "1w" | "1m" | "3m" | "6m" | "1y";
export type AnalysisStatus =
  | "queued"
  | "collecting"
  | "scoring"
  | "complete"
  | "partial"
  | "failed";

export type ScoreVersion = "v1" | "v2";

export type PartialReason =
  | "rate_limit"
  | "collector_error"
  | "served_from_backup";

export interface PartialInfo {
  reason: PartialReason;
  missingSources: string[];
}

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

export interface SocialBuzzHN {
  storyCount: number;
  totalPoints: number;
  totalComments: number;
  topStory: { title: string; url: string; points: number } | null;
  engagement: number;
}

export interface SocialBuzzReddit {
  post_count?: number;
  score_sum?: number;
  comment_sum?: number;
}

export interface SocialBuzzStackOverflow {
  answer_count?: number;
  score_sum?: number;
  view_sum?: number;
}

export interface SocialBuzzYouTube {
  video_count?: number;
  view_sum?: number;
  like_sum?: number;
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
    hn: SocialBuzzHN | null;
    reddit: SocialBuzzReddit | null;
    stackoverflow: SocialBuzzStackOverflow | null;
    youtube: SocialBuzzYouTube | null;
  };
  // Optional: absent on legacy reports (treat as "v1"). New reports stamp "v2".
  scoreVersion?: ScoreVersion;
  // Replaces legacy boolean `partial`. null when the report is fully complete;
  // absent on legacy v1 reports cached before this field existed.
  partial?: PartialInfo | null;
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
