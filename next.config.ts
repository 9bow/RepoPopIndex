import type { NextConfig } from "next";
import { execSync } from "node:child_process";

// Resolve the deployed commit at build time so the footer can surface the
// running build version. On Vercel, VERCEL_GIT_COMMIT_SHA is injected during
// the build; locally we fall back to git. Empty string hides the badge.
function resolveCommitSha(): string {
  const fromCi = process.env.VERCEL_GIT_COMMIT_SHA;
  if (fromCi) return fromCi.slice(0, 7);
  try {
    return execSync("git rev-parse --short=7 HEAD").toString().trim();
  } catch {
    return "";
  }
}

function resolveRepoSlug(): string {
  const owner = process.env.VERCEL_GIT_REPO_OWNER;
  const slug = process.env.VERCEL_GIT_REPO_SLUG;
  if (owner && slug) return `${owner}/${slug}`;
  try {
    const url = execSync("git config --get remote.origin.url").toString().trim();
    const match = url.match(/github\.com[:/](.+?)(?:\.git)?$/);
    return match ? match[1] : "";
  } catch {
    return "";
  }
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_COMMIT_SHA: resolveCommitSha(),
    NEXT_PUBLIC_REPO_SLUG: resolveRepoSlug(),
  },
  async rewrites() {
    return [
      { source: "/report/github.com/:path*", destination: "/report/github/:path*" },
      { source: "/report/huggingface.co/:path*", destination: "/report/huggingface/:path*" },
    ];
  },
};

export default nextConfig;
