/**
 * Tests for fetchWithRetry: x-ratelimit-reset header parsing,
 * 60s cap enforcement, exponential fallback, and 403 secondary rate limit.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchWithRetry } from "@/lib/retry";

function makeResponse(
  status: number,
  headers: Record<string, string> = {}
): Response {
  return new Response(null, { status, headers: new Headers(headers) });
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("fetchWithRetry — rate-limit header parsing", () => {
  it("returns immediately for non-retryable status (200)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(200));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchWithRetry("https://api.github.com/test");
    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries on 429 and uses x-ratelimit-reset header delay (within 60s cap)", async () => {
    vi.useFakeTimers();
    const resetEpochSec = Math.floor(Date.now() / 1000) + 30; // 30s → within cap

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeResponse(429, { "x-ratelimit-reset": String(resetEpochSec) })
      )
      .mockResolvedValueOnce(makeResponse(200));
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchWithRetry("https://api.github.com/test");

    // After only 1ms the retry delay (~30 000ms) hasn't elapsed — still 1 call
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // After the full header-driven delay the second fetch should fire
    await vi.advanceTimersByTimeAsync(30_001);
    const result = await promise;
    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to exponential backoff when x-ratelimit-reset exceeds 60s cap", async () => {
    vi.useFakeTimers();
    const resetEpochSec = Math.floor(Date.now() / 1000) + 120; // 120s > 60s cap

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeResponse(429, { "x-ratelimit-reset": String(resetEpochSec) })
      )
      .mockResolvedValueOnce(makeResponse(200));
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchWithRetry("https://api.github.com/test");

    // Exponential backoff baseDelay = 2000ms (not 120 000ms header)
    // After 2001ms the retry should have fired
    await vi.advanceTimersByTimeAsync(2_001);
    const result = await promise;
    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries on 403 secondary rate-limit (remaining:0 + reset header) using header delay", async () => {
    vi.useFakeTimers();
    const resetEpochSec = Math.floor(Date.now() / 1000) + 20; // 20s

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeResponse(403, {
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": String(resetEpochSec),
        })
      )
      .mockResolvedValueOnce(makeResponse(200));
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchWithRetry("https://api.github.com/test");

    // Not yet retried after 1ms
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Retried after ~20s header delay
    await vi.advanceTimersByTimeAsync(20_001);
    const result = await promise;
    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not treat 403 as secondary rate-limit when remaining is not 0", async () => {
    vi.useFakeTimers();
    const resetEpochSec = Math.floor(Date.now() / 1000) + 20;

    // remaining = 5 (not 0) — should still retry (403 is retryable) but
    // without header-driven delay (falls to exponential 2000ms)
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        makeResponse(403, {
          "x-ratelimit-remaining": "5",
          "x-ratelimit-reset": String(resetEpochSec),
        })
      )
      .mockResolvedValueOnce(makeResponse(200));
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchWithRetry("https://api.github.com/test");

    // Exponential fallback: 2001ms should be enough
    await vi.advanceTimersByTimeAsync(2_001);
    const result = await promise;
    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to Retry-After header on 429 when x-ratelimit-reset is absent", async () => {
    vi.useFakeTimers();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(429, { "Retry-After": "15" }))
      .mockResolvedValueOnce(makeResponse(200));
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchWithRetry("https://api.github.com/test");

    // Still waiting after 14 999ms
    await vi.advanceTimersByTimeAsync(14_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Done after 15 000ms
    await vi.advanceTimersByTimeAsync(2);
    const result = await promise;
    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
