import type { CollectorResult } from "@/lib/types";
import { fetchWithRetry } from "@/lib/retry";

const GITHUB_RAW = "https://raw.githubusercontent.com";
const NPM_API = "https://api.npmjs.org/downloads/point/last-month";
const PYPI_API = "https://pypistats.org/api/packages";

async function detectNpmPackageName(owner: string, repo: string): Promise<string> {
  // 1. Try to fetch package.json from default branch
  for (const branch of ["main", "master"]) {
    try {
      const res = await fetch(
        `${GITHUB_RAW}/${owner}/${repo}/${branch}/package.json`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (res.ok) {
        const pkg = await res.json() as { name?: string };
        if (typeof pkg.name === "string" && pkg.name.trim()) {
          return pkg.name.trim();
        }
      }
    } catch {
      // continue
    }
  }
  // 2. Fallback: use repo name (works for react, vue, axios, etc.)
  return repo;
}

async function fetchNpmDownloads(packageName: string): Promise<number | null> {
  try {
    const res = await fetchWithRetry(
      `${NPM_API}/${encodeURIComponent(packageName)}`,
      {}
    );
    if (!res.ok) return null;
    const data = await res.json() as { downloads?: number; error?: string };
    if (data.error || typeof data.downloads !== "number") return null;
    return data.downloads;
  } catch {
    return null;
  }
}

async function fetchPypiDownloads(packageName: string): Promise<number | null> {
  try {
    const res = await fetchWithRetry(
      `${PYPI_API}/${encodeURIComponent(packageName)}/recent?period=month`,
      {}
    );
    if (!res.ok) return null;
    const data = await res.json() as {
      data?: { last_month?: number };
    };
    return data?.data?.last_month ?? null;
  } catch {
    return null;
  }
}

export async function collectPackageDownloads(
  owner: string,
  repo: string
): Promise<CollectorResult> {
  const pypiName = repo.replace(/_/g, "-");
  const npmName = await detectNpmPackageName(owner, repo);

  const [npmDownloads, pypiDownloads] = await Promise.all([
    fetchNpmDownloads(npmName),
    fetchPypiDownloads(pypiName),
  ]);

  return {
    source: "package-downloads",
    metrics: [
      {
        category: "G5",
        metricKey: "npm_downloads",
        rawValue: npmDownloads,
        rawJson: npmDownloads !== null ? { packageName: npmName } : null,
      },
      {
        category: "G5",
        metricKey: "pypi_downloads",
        rawValue: pypiDownloads,
        rawJson: pypiDownloads !== null ? { packageName: pypiName } : null,
      },
    ],
  };
}
