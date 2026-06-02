// Bottom-left footer badge showing the deployed commit hash, so the running
// build version is verifiable at a glance. Values are inlined at build time by
// next.config.ts (env). The badge is hidden when no commit is resolved.

const COMMIT_SHA = process.env.NEXT_PUBLIC_COMMIT_SHA ?? "";
const REPO_SLUG = process.env.NEXT_PUBLIC_REPO_SLUG ?? "";

const className =
  "pointer-events-auto fixed bottom-3 left-3 z-50 font-mono text-xs text-muted-foreground/70 sm:bottom-4 sm:left-5 sm:text-sm print:hidden";

export function BuildInfo() {
  if (!COMMIT_SHA) return null;

  if (REPO_SLUG) {
    return (
      <a
        href={`https://github.com/${REPO_SLUG}/commit/${COMMIT_SHA}`}
        target="_blank"
        rel="noreferrer"
        className={`${className} hover:text-foreground transition-colors`}
        title={`Build ${COMMIT_SHA}`}
      >
        {COMMIT_SHA}
      </a>
    );
  }

  return (
    <span className={className} title={`Build ${COMMIT_SHA}`}>
      {COMMIT_SHA}
    </span>
  );
}
