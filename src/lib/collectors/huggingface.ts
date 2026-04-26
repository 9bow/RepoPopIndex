import type { CollectorResult, Period } from "@/lib/types";
import { fetchWithRetry } from "@/lib/retry";
import { waitForRateLimit } from "@/lib/rate-limiter";
import { periodToSinceDate } from "@/lib/types";

const HF_API = "https://huggingface.co/api";

function authHeaders(): Record<string, string> {
  const token = process.env.HF_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

interface HfCommitAuthor {
  user?: string;
  name?: string;
}

interface HfCommit {
  id: string;
  date?: string;
  authors?: HfCommitAuthor[];
}

interface HfDiscussion {
  type?: string;
}

interface HfModelInfo {
  likes?: number;
  downloads?: number;
  downloadsAllTime?: number;
  trendingScore?: number;
  spaces?: unknown[];
  inference?: string;
  inferenceProviderMapping?: Record<string, unknown>;
  library_name?: string;
  cardData?: {
    license?: string;
    description?: string;
    intended_use?: unknown;
    usage?: unknown;
    training_data?: unknown;
    datasets?: unknown[];
    limitations?: unknown;
    bias?: unknown;
    model_index?: unknown[];
    citation?: unknown;
    bibtex_citation?: unknown;
    co2_eq_emissions?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function computeCardScore(cardData: HfModelInfo["cardData"]): {
  score: number;
  breakdown: Record<string, boolean>;
} {
  if (!cardData) return { score: 0, breakdown: {} };

  const breakdown: Record<string, boolean> = {
    license: typeof cardData.license === "string" && cardData.license.length > 0,
    description: typeof cardData.description === "string" && cardData.description.length > 0,
    intended_use: Boolean(cardData.intended_use ?? cardData.usage),
    training_data: Boolean(cardData.training_data) || (Array.isArray(cardData.datasets) && cardData.datasets.length > 0),
    limitations: Boolean(cardData.limitations ?? cardData.bias),
    evaluation_results: Array.isArray(cardData.model_index) && cardData.model_index.length > 0,
    citation: Boolean(cardData.citation ?? cardData.bibtex_citation),
    co2_eq_emissions: Boolean(cardData.co2_eq_emissions),
  };

  const checkedCount = Object.values(breakdown).filter(Boolean).length;
  return { score: checkedCount / 8, breakdown };
}

async function fetchCommits(
  baseUrl: string,
  since: Date
): Promise<{ count: number; contributors: number; daysSinceLast: number | null }> {
  const headers = authHeaders();
  const commits: HfCommit[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < 10; page++) {
    const url = cursor
      ? `${baseUrl}/commits?limit=100&cursor=${encodeURIComponent(cursor)}`
      : `${baseUrl}/commits?limit=100`;

    await waitForRateLimit("huggingface");
    const res = await fetchWithRetry(url, { headers });
    if (!res.ok) break;

    const body = (await res.json()) as HfCommit[] | { commits?: HfCommit[]; nextCursor?: string };

    let page_commits: HfCommit[];
    let nextCursor: string | undefined;

    if (Array.isArray(body)) {
      page_commits = body;
      nextCursor = undefined;
    } else {
      page_commits = body.commits ?? [];
      nextCursor = body.nextCursor;
    }

    commits.push(...page_commits);
    if (page_commits.length < 100 || !nextCursor) break;
    cursor = nextCursor;
  }

  const sinceTime = since.getTime();
  const filtered = commits.filter((c) => {
    if (!c.date) return false;
    return new Date(c.date).getTime() >= sinceTime;
  });

  const uniqueContributors = new Set<string>();
  for (const c of commits) {
    for (const a of c.authors ?? []) {
      const id = a.user ?? a.name;
      if (id) uniqueContributors.add(id);
    }
  }

  let daysSinceLast: number | null = null;
  if (commits.length > 0 && commits[0].date) {
    const lastDate = new Date(commits[0].date);
    daysSinceLast = Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
  }

  return {
    count: filtered.length,
    contributors: uniqueContributors.size,
    daysSinceLast,
  };
}

async function fetchDiscussions(
  baseUrl: string
): Promise<{ total: number; prCount: number }> {
  const headers = authHeaders();
  await waitForRateLimit("huggingface");

  const res = await fetchWithRetry(`${baseUrl}/discussions?limit=100`, { headers });
  if (!res.ok) return { total: 0, prCount: 0 };

  const body = (await res.json()) as { discussions?: HfDiscussion[]; count?: number } | HfDiscussion[];

  let discussions: HfDiscussion[];
  let total: number;

  if (Array.isArray(body)) {
    discussions = body;
    total = body.length;
  } else {
    discussions = body.discussions ?? [];
    total = body.count ?? discussions.length;
  }

  const prCount = discussions.filter((d) => d.type === "pull_request").length;
  return { total, prCount };
}

export async function collectHuggingFace(
  owner: string,
  repo: string,
  period: Period
): Promise<CollectorResult> {
  const headers = authHeaders();
  const since = periodToSinceDate(period);

  // Step 1: detect model vs dataset
  let info: HfModelInfo | null = null;
  let baseUrl = `${HF_API}/models/${owner}/${repo}`;
  let isModel = true;

  await waitForRateLimit("huggingface");
  const modelRes = await fetchWithRetry(baseUrl, { headers });

  if (modelRes.ok) {
    info = (await modelRes.json()) as HfModelInfo;
  } else if (modelRes.status === 404) {
    const datasetUrl = `${HF_API}/datasets/${owner}/${repo}`;
    await waitForRateLimit("huggingface");
    const datasetRes = await fetchWithRetry(datasetUrl, { headers });
    if (!datasetRes.ok) {
      return {
        source: "huggingface",
        metrics: [],
        error: `Not found as model or dataset: ${owner}/${repo}`,
      };
    }
    info = (await datasetRes.json()) as HfModelInfo;
    baseUrl = datasetUrl;
    isModel = false;
  } else {
    return {
      source: "huggingface",
      metrics: [],
      error: `HuggingFace API error: ${modelRes.status}`,
    };
  }

  const likes = info.likes ?? 0;
  const downloads30d = info.downloads ?? 0;
  const downloadsAllTime = info.downloadsAllTime ?? null;
  const trendingScore = info.trendingScore ?? null;
  const spacesCount = isModel ? (info.spaces?.length ?? 0) : 0;
  const inferenceStatus = isModel ? (info.inference ?? null) : null;
  const inferenceProviderCount = isModel
    ? Object.keys(info.inferenceProviderMapping ?? {}).length
    : 0;
  const libraryName = info.library_name ?? null;
  const { score: cardScore, breakdown: cardBreakdown } = computeCardScore(info.cardData);

  // HF quality factor for likes (guard against NaN when likes=0)
  const likeDenom = Math.log(1 + likes * 100);
  const hfQualityFactor = likeDenom > 0
    ? Math.min(1.0, Math.log(1 + downloads30d) / likeDenom)
    : 1.0;
  const qualityLikeScore = likes * Math.max(0.3, hfQualityFactor);

  // Step 2: commits
  let commitData = { count: 0, contributors: 0, daysSinceLast: null as number | null };
  try {
    commitData = await fetchCommits(baseUrl, since);
  } catch {
    // non-fatal: leave zeroes
  }

  // Step 3: discussions
  let discussionData = { total: 0, prCount: 0 };
  try {
    discussionData = await fetchDiscussions(baseUrl);
  } catch {
    // non-fatal: leave zeroes
  }

  // Step 4: derived models count (for models only)
  let derivedModelsCount = 0;
  if (isModel) {
    try {
      await waitForRateLimit("huggingface");
      const derivedRes = await fetchWithRetry(
        `${HF_API}/models?filter=finetuned_from%3A${encodeURIComponent(`${owner}/${repo}`)}&limit=1`,
        { headers }
      );
      if (derivedRes.ok) {
        const totalHeader = derivedRes.headers.get("x-total-count");
        if (totalHeader) {
          derivedModelsCount = parseInt(totalHeader, 10) || 0;
        } else {
          const derivedData = await derivedRes.json() as unknown[];
          derivedModelsCount = Array.isArray(derivedData) ? derivedData.length : 0;
        }
      }
    } catch {
      // non-fatal
    }
  }

  return {
    source: "huggingface",
    metrics: [
      {
        category: "H1",
        metricKey: "likes",
        rawValue: likes,
        rawJson: { likes, qualityLikeScore, hfQualityFactor },
      },
      {
        category: "H1",
        metricKey: "downloads",
        rawValue: downloads30d,
      },
      {
        category: "H1",
        metricKey: "downloadsAllTime",
        rawValue: downloadsAllTime,
      },
      {
        category: "H1",
        metricKey: "trendingScore",
        rawValue: trendingScore,
      },
      {
        category: "H2",
        metricKey: "spaces_count",
        rawValue: spacesCount,
      },
      {
        category: "H2",
        metricKey: "inference",
        rawValue: null,
        rawJson: inferenceStatus,
      },
      {
        category: "H2",
        metricKey: "inferenceProviderCount",
        rawValue: inferenceProviderCount,
      },
      {
        category: "H2",
        metricKey: "library_name",
        rawValue: null,
        rawJson: libraryName,
      },
      {
        category: "H4",
        metricKey: "card_score",
        rawValue: cardScore,
        rawJson: { breakdown: cardBreakdown },
      },
      {
        category: "H3",
        metricKey: "commit_count",
        rawValue: commitData.count,
      },
      {
        category: "H3",
        metricKey: "unique_contributors",
        rawValue: commitData.contributors,
      },
      {
        category: "H3",
        metricKey: "days_since_last_commit",
        rawValue: commitData.daysSinceLast,
      },
      {
        category: "H4",
        metricKey: "discussion_count",
        rawValue: discussionData.total,
      },
      {
        category: "H4",
        metricKey: "pr_count",
        rawValue: discussionData.prCount,
      },
      {
        category: "H2",
        metricKey: "derived_models_count",
        rawValue: derivedModelsCount,
      },
    ],
  };
}
