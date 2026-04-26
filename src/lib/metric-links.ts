import type { Period, Platform } from "./types";
import { periodToSinceDate } from "./types";

function sinceISODate(period: Period): string {
  return periodToSinceDate(period).toISOString().slice(0, 10);
}

/**
 * Build a drill-down URL for a metric so users can inspect the underlying
 * Issues / PRs / commits / stargazers on GitHub (or the relevant external
 * source for HN / HF). Returns null when no meaningful link exists.
 */
export function getMetricDrillDownUrl(
  metricKey: string,
  platform: Platform,
  owner: string,
  repo: string,
  period: Period
): string | null {
  if (platform === "github") {
    const base = `https://github.com/${owner}/${repo}`;
    const since = sinceISODate(period);
    const enc = (q: string) => encodeURIComponent(q);

    switch (metricKey) {
      case "stars":
      case "G8.1":
      case "G8.2":
      case "G8.3":
        return `${base}/stargazers`;
      case "forks":
        return `${base}/network/members`;
      case "watchers":
        return `${base}/watchers`;

      case "G2.1":
      case "G2.5":
        return `${base}/commits`;
      case "G2.2":
      case "G2.4":
        return `${base}/graphs/contributors`;
      case "G2.3_additions":
      case "G2.3_deletions":
        return `${base}/graphs/code-frequency`;
      case "G2.6":
        return `${base}/pulse`;

      case "G3.1":
        return `${base}/issues?q=${enc(`is:issue created:>${since}`)}`;
      case "G3.2":
        return `${base}/issues?q=${enc(`is:issue closed:>${since}`)}`;
      case "G3.3":
        return `${base}/issues?q=${enc(`is:issue created:>${since}`)}`;

      case "G4.1":
        return `${base}/pulls?q=${enc(`is:pr created:>${since}`)}`;
      case "G4.2":
      case "G4.4":
      case "G4.5":
        return `${base}/pulls?q=${enc(`is:pr merged:>${since}`)}`;
      case "G4.3":
        return `${base}/pulls?q=${enc(`is:pr created:>${since}`)}`;

      case "G5.1":
      case "G5.2":
      case "G5.3":
        return `${base}/releases`;
      case "G5.4":
        return `${base}/tags`;

      case "G6.1":
        return `${base}/network/dependents`;

      case "G7.1":
      case "G7.2":
      case "G7.3":
      case "G7.4":
        return `${base}/community`;

      // Social / HN
      case "story_count":
      case "total_points":
      case "total_comments":
      case "engagement":
      case "top_story":
        return `https://hn.algolia.com/?q=${enc(`${owner}/${repo}`)}`;

      default:
        return null;
    }
  }

  if (platform === "huggingface") {
    const base = `https://huggingface.co/${owner}/${repo}`;
    switch (metricKey) {
      case "likes":
      case "trendingScore":
        return base;
      case "downloads":
      case "downloadsAllTime":
        return base;
      case "spaces_count":
        return `https://huggingface.co/spaces?search=${encodeURIComponent(`${owner}/${repo}`)}`;
      case "inferenceProviderCount":
        return base;
      case "commit_count":
      case "unique_contributors":
      case "days_since_last_commit":
        return `${base}/commits`;
      case "discussion_count":
        return `${base}/discussions`;
      case "pr_count":
        return `${base}/discussions?type=pull_request`;
      case "card_score":
      case "library_name":
        return `${base}/blob/main/README.md`;
      case "story_count":
      case "total_points":
      case "total_comments":
      case "engagement":
      case "top_story":
        return `https://hn.algolia.com/?q=${encodeURIComponent(`${owner}/${repo}`)}`;
      default:
        return null;
    }
  }

  return null;
}
