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

export type ContributorAssociation =
  | "affiliated"
  | "external"
  | "unknown";

export interface MonthlyContributorActivity {
  month: string;
  commits: number;
  pullRequests: number;
  issues: number;
  activeContributors: number;
  observedNewContributors: number;
  firstTimeContributorSignals: number;
  returningContributors: number;
  retentionRate: number | null;
  affiliatedContributors: number;
  externalContributors: number;
  unknownAssociationContributors: number;
  partialMonth: boolean;
}

export interface FirstResponseSummary {
  sampledIssues: number;
  humanResponses: number;
  maintainerResponses: number;
  unansweredByHuman: number;
  unansweredByMaintainer: number;
  medianHumanResponseHours: number | null;
  medianMaintainerResponseHours: number | null;
  excludedSelfComments: number;
  excludedBotComments: number;
  commentsTruncated: boolean;
}

export interface ContributorInsights {
  windowMonths: number;
  observationMonths: number;
  generatedAt: string;
  activeContributors: number;
  observedNewContributors: number;
  firstTimeContributorSignals: number;
  affiliatedContributors: number;
  externalContributors: number;
  unknownAssociationContributors: number;
  verifiedInternalContributors?: number;
  verifiedOtherContributors?: number;
  verifiedClassificationUpdatedAt?: string;
  latestCompleteMonthRetentionRate: number | null;
  monthly: MonthlyContributorActivity[];
  dataQuality: {
    status: "complete" | "partial";
    truncatedSources: string[];
    limitations: string[];
  };
}

export interface ReportSnapshot {
  month: string;
  capturedAt: string;
  status?: "complete" | "partial";
  missingSources?: string[];
  excludedCategories?: string[];
  compositeScore: number;
  categoryScores: Record<string, number | null>;
  rawMetrics: Record<string, number | null>;
  activeContributors: number | null;
  observedNewContributors: number | null;
  retentionRate: number | null;
  medianHumanResponseHours: number | null;
  medianMaintainerResponseHours: number | null;
}

export interface RawMetricDatum {
  category: string;
  metricKey: string;
  rawValue: number | null;
  rawJson?: unknown;
}

export interface RawSourceData {
  source: string;
  collectedAt: string;
  status: "complete" | "partial" | "failed";
  error?: string;
  metrics: RawMetricDatum[];
}

export interface GitHubContributorIdentity {
  nodeId: string | null;
  databaseId: number | null;
  login: string;
  avatarUrl: string | null;
  profileUrl: string;
  source: "commits" | "issues" | "pull_requests";
  occurredAt: string;
  contributions?: number | null;
  accountType?: string;
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
  contributorInsights?: ContributorInsights | null;
  firstResponse?: FirstResponseSummary | null;
  snapshots?: ReportSnapshot[];
  rawSources?: RawSourceData[];
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
  contributors?: GitHubContributorIdentity[];
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
