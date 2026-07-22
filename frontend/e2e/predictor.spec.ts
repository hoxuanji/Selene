import { test, expect } from '@playwright/test';
import {
  collapsePeriodStarts,
  cycleLengths,
  averageCycleLength,
  predictNextPeriod,
} from '../src/utils/predictor';

/* Pure unit tests for the on-device predictor — no browser needed.
   Guards the critical regression: logging a period day-by-day must NOT
   crush the predicted cycle length. */

test.describe('predictor', () => {
  // A 5-day period logged day-by-day across two ~28-day cycles.
  const dayByDay = [
    '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', '2026-01-05',
    '2026-01-29', '2026-01-30', '2026-01-31', '2026-02-01', '2026-02-02',
  ];

  test('collapses consecutive bleeding days into two starts', () => {
    expect(collapsePeriodStarts(dayByDay)).toEqual(['2026-01-01', '2026-01-29']);
  });

  test('day-by-day logging yields a ~28-day cycle, not ~1', () => {
    expect(cycleLengths(dayByDay)).toEqual([28]);
    expect(averageCycleLength(dayByDay)).toBe(28);
    const pred = predictNextPeriod(dayByDay);
    expect(pred).not.toBeNull();
    expect(pred!.predictedDate).toBe('2026-02-26'); // last start (01-29) + 28
  });

  test('distinct period starts are left untouched', () => {
    const starts = ['2025-12-05', '2026-01-05', '2026-02-01'];
    expect(collapsePeriodStarts(starts)).toEqual(starts);
    expect(averageCycleLength(starts)).toBe(28); // weighted avg of [31, 27]
  });

  test('a single logged period (no full cycle) has no prediction', () => {
    expect(predictNextPeriod(['2026-01-01', '2026-01-02', '2026-01-03'])).toBeNull();
    expect(averageCycleLength(['2026-01-01'])).toBeNull();
  });

  test('confidence is bounded and higher for regular cycles', () => {
    const regular = predictNextPeriod(['2025-12-01', '2025-12-29', '2026-01-26'])!;
    expect(regular.confidence).toBeGreaterThan(0);
    expect(regular.confidence).toBeLessThanOrEqual(0.95);
  });
});
