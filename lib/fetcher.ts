// Tiny fetch helper with timeout + retries + 429 backoff
const DEFAULT_TIMEOUT_MS = 8000;

function delay(ms: number) {
  return new Promise(res => setTimeout(res, ms));
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  opts: { retries?: number; timeoutMs?: number } = {}
): Promise<Response> {
  const { retries = 2, timeoutMs = DEFAULT_TIMEOUT_MS } = opts;

  let attempt = 0;
  let lastErr: unknown;

  while (attempt <= retries) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeout);

      if (res.status === 429) {
        // Basic backoff on rate limit
        const retryAfter = parseInt(res.headers.get('retry-after') || '0', 10);
        const waitMs = (retryAfter > 0 ? retryAfter : (attempt + 1) * 800) * 1_000;
        if (attempt < retries) {
          await delay(Math.min(waitMs, 5000));
          attempt++;
          continue;
        }
      }

      if (!res.ok && res.status >= 500 && attempt < retries) {
        await delay((attempt + 1) * 500);
        attempt++;
        continue;
      }

      return res;
    } catch (err) {
      clearTimeout(timeout);
      lastErr = err;
      if (attempt < retries) {
        await delay((attempt + 1) * 500);
        attempt++;
        continue;
      }
      throw lastErr;
    }
  }
  // Should not reach here
  throw lastErr ?? new Error('Unknown fetch error');
}
