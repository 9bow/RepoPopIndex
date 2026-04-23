import { redis } from "./rate-limiter";

const QUEUE_KEY = "rpi:queue";
const MAX_QUEUE_DEPTH = 20;

export async function getQueueDepth(): Promise<number> {
  return await redis.zcard(QUEUE_KEY);
}

export async function canEnqueue(): Promise<boolean> {
  const depth = await getQueueDepth();
  return depth < MAX_QUEUE_DEPTH;
}

export async function enqueue(analysisId: string): Promise<number> {
  const score = Date.now();
  await redis.zadd(QUEUE_KEY, { score, member: analysisId });
  const rank = await redis.zrank(QUEUE_KEY, analysisId);
  return rank ?? 0;
}

export async function dequeue(analysisId: string): Promise<void> {
  await redis.zrem(QUEUE_KEY, analysisId);
}

export async function getQueuePosition(
  analysisId: string
): Promise<number | null> {
  const rank = await redis.zrank(QUEUE_KEY, analysisId);
  return rank;
}

export { MAX_QUEUE_DEPTH };
