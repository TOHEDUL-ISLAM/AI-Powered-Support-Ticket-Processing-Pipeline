// US-5.1: exponential backoff with full jitter for retry timing
export function calculateRetryDelay(attempt: number): number {
  const base = 1000 * Math.pow(2, attempt - 1);
  const jitter = Math.floor(Math.random() * 1000);
  return Math.min(base + jitter, 30_000);
}
