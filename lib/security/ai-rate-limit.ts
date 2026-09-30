const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 5;

type RateLimitEntry = {
  count: number;
  windowStart: number;
};

const requests = new Map<string, RateLimitEntry>();

export function checkAiRateLimit(userId: string) {
  const now = Date.now();
  const existing = requests.get(userId);

  if (!existing || now - existing.windowStart >= WINDOW_MS) {
    requests.set(userId, {
      count: 1,
      windowStart: now,
    });

    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }

  if (existing.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(
        (WINDOW_MS - (now - existing.windowStart)) / 1000
      )
    );

    return {
      allowed: false,
      retryAfterSeconds,
    };
  }

  existing.count += 1;

  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}

export function cleanupAiRateLimitEntries() {
  const now = Date.now();

  for (const [userId, entry] of requests.entries()) {
    if (now - entry.windowStart >= WINDOW_MS) {
      requests.delete(userId);
    }
  }
}
