import { parseLocalDate, toLocalDateString } from './validation';

/**
 * Client-side period predictor. Runs entirely on-device — no data leaves the
 * browser. Ported from the old serverless weighted-average endpoint.
 */

// A logged period spans consecutive (or near-consecutive) bleeding days. Only
// period-to-period gaps are real cycles, so runs of dates closer than this are
// collapsed into a single cycle start before any cycle-length math.
// ponytail: fixed 10-day threshold — the shortest plausible cycle (~20d) is
// well clear of the longest bleed the app allows (10d). Widen if that changes.
const MIN_CYCLE_GAP_DAYS = 10;
const MIN_CYCLE = 20;
const MAX_CYCLE = 40;
const DEFAULT_CYCLE = 28;

const daysBetween = (a: Date, b: Date) =>
  Math.round((b.getTime() - a.getTime()) / 86_400_000);

/** Collapse consecutive bleeding days into period-start dates (sorted ascending). */
export function collapsePeriodStarts(dates: string[]): string[] {
  const parsed = dates
    .map(parseLocalDate)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  const starts: Date[] = [];
  let prev: Date | null = null;
  for (const d of parsed) {
    if (!prev || daysBetween(prev, d) >= MIN_CYCLE_GAP_DAYS) starts.push(d);
    prev = d;
  }
  return starts.map(toLocalDateString);
}

/** Cycle lengths (start-to-start) in days. */
export function cycleLengths(dates: string[]): number[] {
  const starts = collapsePeriodStarts(dates)
    .map(parseLocalDate)
    .filter((d): d is Date => d !== null);
  const out: number[] = [];
  for (let i = 1; i < starts.length; i += 1) out.push(daysBetween(starts[i - 1], starts[i]));
  return out;
}

function weightedAverage(cycles: number[]): number {
  if (!cycles.length) return DEFAULT_CYCLE;
  // More weight to recent cycles (oldest→newest), matching the prior server logic.
  let weightedSum = 0;
  let weightTotal = 0;
  cycles.forEach((c, i) => {
    const w = i + 1;
    weightedSum += c * w;
    weightTotal += w;
  });
  return weightedSum / weightTotal;
}

function stdDev(cycles: number[], mean: number): number {
  if (cycles.length < 2) return 0;
  const variance = cycles.reduce((s, c) => s + (c - mean) ** 2, 0) / cycles.length;
  return Math.sqrt(variance);
}

/** Rounded average cycle length, weighted toward recent cycles. null if <1 full cycle. */
export function averageCycleLength(dates: string[]): number | null {
  const cycles = cycleLengths(dates);
  if (!cycles.length) return null;
  return Math.round(weightedAverage(cycles));
}

export interface BasePrediction {
  predictedDate: string;
  earliest: string;
  latest: string;
  confidence: number;
}

/** Predict the next period. Returns null when there isn't at least one full cycle. */
export function predictNextPeriod(dates: string[]): BasePrediction | null {
  const starts = collapsePeriodStarts(dates);
  const cycles = cycleLengths(dates);
  if (!cycles.length) return null;

  const avg = weightedAverage(cycles);
  const predictedDays = Math.max(MIN_CYCLE, Math.min(MAX_CYCLE, Math.round(avg)));

  const lastStart = parseLocalDate(starts[starts.length - 1]);
  if (!lastStart) return null;

  const predicted = new Date(lastStart);
  predicted.setDate(predicted.getDate() + predictedDays);
  const earliest = new Date(predicted);
  earliest.setDate(earliest.getDate() - 1);
  const latest = new Date(predicted);
  latest.setDate(latest.getDate() + 1);

  const sd = stdDev(cycles, avg);
  const cv = avg > 0 && sd > 0 ? sd / avg : 0;
  const confidence = avg > 0 ? Math.min(0.95, 1 - Math.min(0.5, cv / 2)) : 0;

  return {
    predictedDate: toLocalDateString(predicted),
    earliest: toLocalDateString(earliest),
    latest: toLocalDateString(latest),
    confidence,
  };
}
