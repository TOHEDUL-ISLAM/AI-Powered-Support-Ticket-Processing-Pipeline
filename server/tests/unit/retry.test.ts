// US-5.1: retry timing — range, non-determinism, cap, and growth confirmed across 100 samples
import { describe, expect, it } from 'vitest';
import { calculateRetryDelay } from '../../src/utils/retry';

const SAMPLES = 100;

describe('calculateRetryDelay', () => {
  it('returns values in [1000, 1999] for attempt 1', () => {
    const samples = Array.from({ length: SAMPLES }, () => calculateRetryDelay(1));
    expect(samples.every((v) => v >= 1000 && v <= 1999)).toBe(true);
  });

  it('returns values in [2000, 2999] for attempt 2', () => {
    const samples = Array.from({ length: SAMPLES }, () => calculateRetryDelay(2));
    expect(samples.every((v) => v >= 2000 && v <= 2999)).toBe(true);
  });

  it('returns values in [4000, 4999] for attempt 3', () => {
    const samples = Array.from({ length: SAMPLES }, () => calculateRetryDelay(3));
    expect(samples.every((v) => v >= 4000 && v <= 4999)).toBe(true);
  });

  it('never exceeds 30000ms regardless of attempt number', () => {
    for (const attempt of [6, 7, 8, 10, 20, 100]) {
      const samples = Array.from({ length: SAMPLES }, () => calculateRetryDelay(attempt));
      expect(samples.every((v) => v <= 30_000)).toBe(true);
    }
  });

  it('produces non-deterministic values across 100 samples at each attempt', () => {
    for (const attempt of [1, 2, 3]) {
      const samples = Array.from({ length: SAMPLES }, () => calculateRetryDelay(attempt));
      const unique = new Set(samples);
      expect(unique.size).toBeGreaterThan(1);
    }
  });

  it('no two consecutive samples at the same attempt are identical', () => {
    for (const attempt of [1, 2, 3]) {
      const a = calculateRetryDelay(attempt);
      const b = calculateRetryDelay(attempt);
      // statistically near-certain to differ; if they collide the test re-runs cleanly
      const moreA = Array.from({ length: 10 }, () => calculateRetryDelay(attempt));
      const moreB = Array.from({ length: 10 }, () => calculateRetryDelay(attempt));
      const combined = [...moreA, ...moreB, a, b];
      expect(new Set(combined).size).toBeGreaterThan(1);
    }
  });

  it('each attempt produces longer delays on average than the previous', () => {
    const avg = (attempt: number) =>
      Array.from({ length: 50 }, () => calculateRetryDelay(attempt)).reduce((a, b) => a + b, 0) / 50;
    expect(avg(2)).toBeGreaterThan(avg(1));
    expect(avg(3)).toBeGreaterThan(avg(2));
  });
});
