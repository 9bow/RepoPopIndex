import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.REDIS_URL ?? "",
      token: process.env.REDIS_TOKEN ?? "",
    });
  }
  return _redis;
}

export const redis = new Proxy({} as Redis, {
  get(_target, prop, receiver) {
    return Reflect.get(getRedis(), prop, receiver);
  },
});

interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  "github-rest": { maxRequests: 5000, windowSeconds: 3600 },
  "github-graphql": { maxRequests: 5000, windowSeconds: 3600 },
  "github-search": { maxRequests: 30, windowSeconds: 60 },
  huggingface: { maxRequests: 1000, windowSeconds: 300 },
  hackernews: { maxRequests: 10000, windowSeconds: 3600 },
};

export async function checkRateLimit(source: string): Promise<boolean> {
  const config = RATE_LIMITS[source];
  if (!config) return true;

  const key = `rpi:rate:${source}`;
  const current = await redis.incr(key);

  if (current === 1) {
    await redis.expire(key, config.windowSeconds);
  }

  return current <= config.maxRequests;
}

/**
 * Throws if the rate limit for `source` is exceeded.
 *
 * Serverless functions (Vercel/Inngest) have a hard execution timeout of
 * ~30 s, so the previous strategy of sleeping until the rolling window resets
 * (up to 3600 s) was guaranteed to timeout before the wait completed.
 * Fast-failing lets the Inngest retry scheduler reschedule the function after
 * an appropriate backoff instead.
 */
export async function waitForRateLimit(source: string): Promise<void> {
  const allowed = await checkRateLimit(source);
  if (allowed) return;

  const config = RATE_LIMITS[source];
  const key = `rpi:rate:${source}`;
  const ttl = await redis.ttl(key);

  throw new Error(
    `Rate limit exceeded for "${source}". ` +
    `Window resets in ${ttl > 0 ? `${ttl}s` : "unknown time"}. ` +
    `Limit: ${config?.maxRequests ?? "?"} req / ${config?.windowSeconds ?? "?"}s`
  );
}
