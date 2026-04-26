import type { CollectorResult } from "@/lib/types";

export async function collectGitHubDependents(
  owner: string,
  repo: string
): Promise<CollectorResult> {
  const url = `https://github.com/${owner}/${repo}/network/dependents`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    let html: string;
    try {
      const res = await fetch(url, { signal: controller.signal });
      html = await res.text();
    } finally {
      clearTimeout(timer);
    }

    const match = html.match(/(\d[\d,]*)\s*Repositories/);
    const rawValue = match ? parseInt(match[1].replace(/,/g, ""), 10) : null;

    return {
      source: "github-scraper",
      metrics: [{ category: "G6", metricKey: "G6.1", rawValue }],
    };
  } catch {
    return {
      source: "github-scraper",
      metrics: [{ category: "G6", metricKey: "G6.1", rawValue: null }],
    };
  }
}
