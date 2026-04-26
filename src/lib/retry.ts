interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableStatuses: number[];
}

const DEFAULT_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelay: 2000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  // 403 covers GitHub's secondary rate limit (returned as 403, not 429).
  // 408 covers transient request timeouts.
  retryableStatuses: [202, 403, 408, 429, 500, 502, 503, 504],
};

// Hard ceiling on header-driven sleeps so we never block a request lane for
// minutes. Falls back to exponential backoff if the suggested wait exceeds it.
const HEADER_WAIT_CAP_MS = 60_000;

function parseRateLimitResetMs(response: Response): number | null {
  const reset = response.headers.get("x-ratelimit-reset");
  if (!reset) return null;
  const epochSec = parseInt(reset, 10);
  if (!Number.isFinite(epochSec) || epochSec <= 0) return null;
  const waitMs = epochSec * 1000 - Date.now();
  return waitMs > 0 ? waitMs : 0;
}

function computeRateLimitDelay(response: Response): number | null {
  // GitHub secondary rate limit returns 403 with x-ratelimit-remaining: 0 and
  // x-ratelimit-reset (Unix epoch seconds). Honor it for both 403 and 429.
  const remaining = response.headers.get("x-ratelimit-remaining");
  const isSecondary =
    response.status === 429 ||
    (response.status === 403 && remaining !== null && parseInt(remaining, 10) === 0);

  if (!isSecondary) return null;

  const resetMs = parseRateLimitResetMs(response);
  if (resetMs !== null) return resetMs;

  // 429 may also use Retry-After (delta seconds).
  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter) {
    const sec = parseInt(retryAfter, 10);
    if (Number.isFinite(sec) && sec > 0) return sec * 1000;
  }
  return null;
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  config: Partial<RetryConfig> = {}
): Promise<Response> {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    const response = await fetch(url, options);

    if (!cfg.retryableStatuses.includes(response.status)) {
      return response;
    }

    if (attempt === cfg.maxRetries) {
      return response;
    }

    let delay: number;
    const headerDelay = computeRateLimitDelay(response);

    if (headerDelay !== null && headerDelay <= HEADER_WAIT_CAP_MS) {
      delay = headerDelay;
    } else {
      delay = cfg.baseDelay * Math.pow(cfg.backoffMultiplier, attempt);
    }

    delay = Math.min(delay, cfg.maxDelay);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw new Error(`fetchWithRetry: exhausted ${cfg.maxRetries} retries for ${url}`);
}
