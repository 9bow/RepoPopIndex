export interface MetricConfig {
  key: string;
  category: string;
  maxI: number;
  weight: number;
  cumulative: boolean;
  linear?: boolean;
  inverse?: boolean;
}

export interface CategoryConfig {
  id: string;
  name: string;
  weight: number;
  metricKeys: string[];
}

/**
 * Multiplier for `cumulative: true` metrics after log/linear normalization.
 * (Non-cumulative, period-based metrics use 1.0.)
 *
 * Previously 0.3 matched PLAN’s “all-time stock vs flow” story, but it capped
 * entire categories: e.g. Popularity (mostly cumulative weights) could not
 * exceed ~44/100 even with perfect per-metric scores, which made top-tier
 * repos look unjustly “moderate.” 0.75 keeps a discount vs flow metrics while
 * allowing strong cumulative signals (stars, adoption, etc.) to score fairly.
 */
export const RECENCY_FACTOR = 0.75;

export const GITHUB_METRICS: MetricConfig[] = [
  // G1: Fundamentals (from github-graphql)
  // maxI calibrated so top-tier OSS (linux/k8s/vscode/react with 100k–400k stars)
  // saturate gracefully near 1.0 instead of all collapsing to the same ceiling.
  { key: "stars", category: "G1", maxI: 200000, weight: 3, cumulative: true },
  { key: "forks", category: "G1", maxI: 50000, weight: 1, cumulative: true },
  { key: "watchers", category: "G1", maxI: 10000, weight: 1, cumulative: true },
  // G2: Activity (from github-rest + github-graphql)
  { key: "G2.4", category: "G2", maxI: 500, weight: 3, cumulative: false },
  { key: "G2.5", category: "G2", maxI: 2000, weight: 2, cumulative: false },
  { key: "G2.2", category: "G2", maxI: 1.0, weight: 2, cumulative: false, linear: true },
  { key: "G2.3_additions", category: "G2", maxI: 50000, weight: 1, cumulative: false },
  { key: "G2.6", category: "G2", maxI: 3.0, weight: 2, cumulative: false, linear: true },
  // G3: Issue Health (from github-search)
  { key: "G3.1", category: "G3", maxI: 200, weight: 1, cumulative: false },
  { key: "G3.2", category: "G3", maxI: 200, weight: 1, cumulative: false },
  { key: "G3.3", category: "G3", maxI: 1.0, weight: 2, cumulative: false, linear: true },
  // G4: PR Activity (from github-search)
  { key: "G4.1", category: "G4", maxI: 100, weight: 1, cumulative: false },
  { key: "G4.2", category: "G4", maxI: 100, weight: 2, cumulative: false },
  { key: "G4.3", category: "G4", maxI: 1.0, weight: 1, cumulative: false, linear: true },
  { key: "G4.4", category: "G4", maxI: 100, weight: 3, cumulative: false },
  { key: "G4.5", category: "G4", maxI: 14, weight: 1, cumulative: false, inverse: true },
  // G5: Release & Distribution (from github-rest)
  { key: "G5.1", category: "G5", maxI: 50, weight: 1, cumulative: false },
  { key: "G5.2", category: "G5", maxI: 90, weight: 1, cumulative: false, linear: true, inverse: true },
  { key: "G5.3", category: "G5", maxI: 1000000, weight: 2, cumulative: false },
  { key: "G5.4", category: "G5", maxI: 200, weight: 0, cumulative: false },
  // G6: Dependency Adoption (from github-scraper)
  // npm-scale ecosystems have 10M+ dependents (express ~60M); 100k saturated everyone.
  { key: "G6.1", category: "G6", maxI: 5000000, weight: 3, cumulative: true },
  // G7: Community Health (from github-rest)
  { key: "G7.1", category: "G7", maxI: 100, weight: 1, cumulative: true, linear: true },
  // G8: Star Quality (from star-quality)
  { key: "G8.1", category: "G8", maxI: 200000, weight: 3, cumulative: true },
  { key: "G8.2", category: "G8", maxI: 100, weight: 2, cumulative: false },
  // S1: Social Buzz (from hackernews)
  { key: "story_count", category: "S1", maxI: 50, weight: 1, cumulative: false },
  { key: "total_points", category: "S1", maxI: 2000, weight: 1, cumulative: false },
  { key: "engagement", category: "S1", maxI: 5000, weight: 1, cumulative: false },
];

export const HF_METRICS: MetricConfig[] = [
  // H1: Popularity (from huggingface)
  { key: "likes", category: "H1", maxI: 5000, weight: 2, cumulative: true },
  { key: "downloads", category: "H1", maxI: 10000000, weight: 3, cumulative: false },
  { key: "downloadsAllTime", category: "H1", maxI: 100000000, weight: 2, cumulative: true },
  { key: "trendingScore", category: "H1", maxI: 100, weight: 1, cumulative: false },
  // H2: Integration (from huggingface)
  { key: "spaces_count", category: "H2", maxI: 100, weight: 2, cumulative: true },
  { key: "inferenceProviderCount", category: "H2", maxI: 10, weight: 1, cumulative: true },
  // H3: Activity (from huggingface)
  { key: "commit_count", category: "H3", maxI: 500, weight: 2, cumulative: false },
  { key: "unique_contributors", category: "H3", maxI: 50, weight: 2, cumulative: false },
  { key: "days_since_last_commit", category: "H3", maxI: 365, weight: 1, cumulative: false, inverse: true },
  // H4: Community (from huggingface)
  { key: "discussion_count", category: "H4", maxI: 100, weight: 1, cumulative: false },
  { key: "pr_count", category: "H4", maxI: 50, weight: 1, cumulative: false },
  { key: "card_score", category: "H4", maxI: 1.0, weight: 1, cumulative: true, linear: true },
  // S1: Social Buzz (from hackernews)
  { key: "story_count", category: "S1", maxI: 50, weight: 1, cumulative: false },
  { key: "total_points", category: "S1", maxI: 2000, weight: 1, cumulative: false },
  { key: "engagement", category: "S1", maxI: 5000, weight: 1, cumulative: false },
];

export const GITHUB_CATEGORIES: CategoryConfig[] = [
  {
    id: "G-Activity",
    name: "Activity",
    weight: 20,
    metricKeys: ["G2.4", "G2.5", "G2.2", "G2.3_additions", "G2.6"],
  },
  {
    id: "G-Community",
    name: "Community",
    weight: 20,
    metricKeys: ["G3.1", "G3.2", "G3.3", "G4.1", "G4.2", "G4.3", "G4.4", "G4.5"],
  },
  {
    id: "G-Adoption",
    name: "Adoption",
    weight: 25,
    metricKeys: ["G6.1", "G5.1", "G5.2", "G5.3", "G5.4"],
  },
  {
    id: "G-Popularity",
    name: "Popularity",
    weight: 15,
    metricKeys: ["stars", "forks", "watchers", "G8.1", "G8.2"],
  },
  {
    id: "G-Health",
    name: "Health",
    weight: 5,
    metricKeys: ["G7.1"],
  },
  {
    id: "G-Social",
    name: "Social Buzz",
    weight: 15,
    metricKeys: ["story_count", "total_points", "engagement"],
  },
];

export const HF_CATEGORIES: CategoryConfig[] = [
  {
    id: "H-Downloads",
    name: "Downloads",
    weight: 25,
    metricKeys: ["downloads", "downloadsAllTime"],
  },
  {
    id: "H-Integration",
    name: "Integration",
    weight: 20,
    metricKeys: ["spaces_count", "inferenceProviderCount"],
  },
  {
    id: "H-Activity",
    name: "Activity",
    weight: 20,
    metricKeys: ["commit_count", "unique_contributors", "days_since_last_commit"],
  },
  {
    id: "H-Community",
    name: "Community",
    weight: 10,
    metricKeys: ["discussion_count", "pr_count", "card_score"],
  },
  {
    id: "H-Popularity",
    name: "Popularity",
    weight: 10,
    metricKeys: ["likes", "trendingScore"],
  },
  {
    id: "H-Social",
    name: "Social Buzz",
    weight: 15,
    metricKeys: ["story_count", "total_points", "engagement"],
  },
];
