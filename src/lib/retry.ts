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

    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      delay = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : cfg.baseDelay * Math.pow(cfg.backoffMultiplier, attempt);
    } else {
      delay = cfg.baseDelay * Math.pow(cfg.backoffMultiplier, attempt);
    }

    delay = Math.min(delay, cfg.maxDelay);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw new Error(`fetchWithRetry: exhausted ${cfg.maxRetries} retries for ${url}`);
}
