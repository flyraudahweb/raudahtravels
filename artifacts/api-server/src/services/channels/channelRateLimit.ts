/**
 * Per-user throttle for inbound channel messages.
 *
 * Deliberately a separate module rather than reusing the `rateLimit` helper
 * in `routes/index.ts`: that router imports the webhook routers, so pulling the
 * helper out of it would create a circular import. Keep this scoped to channels.
 *
 * Returns false when the caller has exceeded the window. Rejected messages are
 * simply dropped (no reply) so a spam loop cannot be answered.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Default: 20 messages per minute per channel user — generous for a human
// answering a step-by-step flow, tight enough to stop a runaway loop.
const DEFAULT_MAX = Number(process.env.AI_REGISTRATION_RATE_LIMIT_PER_MIN || 20);
const WINDOW_MS = 60_000;

export function allowChannelMessage(channel: string, channelUserId: string, max = DEFAULT_MAX): boolean {
  const key = `${channel}:${channelUserId}`;
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (bucket.count >= max) return false;
  bucket.count++;
  return true;
}

// Drop expired buckets periodically so the map cannot grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now > bucket.resetAt) buckets.delete(key);
  }
}, 5 * 60 * 1000).unref();
