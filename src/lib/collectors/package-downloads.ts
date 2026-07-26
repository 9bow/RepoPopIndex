import type { CollectorResult } from "@/lib/types";
import { fetchWithRetry } from "@/lib/retry";

const GITHUB_RAW = "https://raw.githubusercontent.com";
const NPM_API = "https://api.npmjs.org/downloads/point/last-month";
const PYPI_API = "https://pypistats.org/api/packages";
const PYPI_METADATA_API = "https://pypi.org/pypi";

async function detectNpmPackageName(
  owner: string,
  repo: string
): Promise<string | null> {
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
  return null;
}

export function pointsToRepository(
  values: Array<string | undefined>,
  owner: string,
  repo: string
): boolean {
  const target = `github.com/${owner}/${repo}`.toLowerCase();
  return values.some((value) => {
    const normalized = value
      ?.toLowerCase()
      .replace(/^git\+/, "")
      .replace("github.com:", "github.com/")
      .replace(/\.git(?=$|[/?#])/, "");
    if (!normalized) return false;
    const targetIndex = normalized.indexOf(target);
    if (targetIndex < 0) return false;
    const boundary = normalized[targetIndex + target.length];
    return boundary === undefined || boundary === "/" || boundary === "?" || boundary === "#";
  });
}

async function verifyPypiPackage(
  packageName: string,
  owner: string,
  repo: string
): Promise<boolean> {
  try {
    const response = await fetchWithRetry(
      `${PYPI_METADATA_API}/${encodeURIComponent(packageName)}/json`,
      {}
    );
    if (!response.ok) return false;
    const body = (await response.json()) as {
      info?: {
        home_page?: string;
        project_url?: string;
        project_urls?: Record<string, string>;
      };
    };
    const info = body.info;
    if (!info) return false;
    return pointsToRepository(
      [
        info.home_page,
        info.project_url,
        ...Object.values(info.project_urls ?? {}),
      ],
      owner,
      repo
    );
  } catch {
    return false;
  }
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
  const [npmName, pypiVerified] = await Promise.all([
    detectNpmPackageName(owner, repo),
    verifyPypiPackage(pypiName, owner, repo),
  ]);

  const [npmDownloads, pypiDownloads] = await Promise.all([
    npmName ? fetchNpmDownloads(npmName) : Promise.resolve(null),
    pypiVerified ? fetchPypiDownloads(pypiName) : Promise.resolve(null),
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
