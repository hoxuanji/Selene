import type { DailyLog } from '../db';
import type { OvulationSignal } from './ovulationSignals';

interface ConfidenceInput {
  baseConfidence: number;
  recentLogs: DailyLog[];
  ovulationSignal: OvulationSignal;
}

export interface ConfidenceAdjustment {
  confidence: number;
  windowShift: number;
  note?: string;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function adjustConfidence({
  baseConfidence,
  recentLogs,
  ovulationSignal
}: ConfidenceInput): ConfidenceAdjustment {
  let confidence = baseConfidence;
  let windowShift = 0;
  const notes: string[] = [];

  const logsSorted = [...recentLogs].sort((a, b) => (a.date < b.date ? -1 : 1));
  const lastFive = logsSorted.slice(-5);

  const hasHighStress = lastFive.some((log) => log.stress === 'high');
  const hasPoorSleep = lastFive.some((log) => log.sleepBand === 'lt6');
  const consistentLogs = recentLogs.length >= 5;

  if (ovulationSignal.ovulationDetected) {
    confidence = Math.max(confidence, 0.97);
    notes.push('Ovulation confirmed from logs');
  }

  if (hasHighStress || hasPoorSleep) {
    confidence = clamp(confidence - 0.03, 0.5, 0.99);
    windowShift += 1;
    notes.push('Sleep or stress may shift timing');
  }

  if (consistentLogs) {
    confidence = clamp(confidence + 0.02, 0.5, 0.99);
    windowShift -= 1;
    notes.push('Consistent logging tightened window');
  }

  return {
    confidence,
    windowShift,
    note: notes[0]
  };
}

export function adjustPredictionWindow(
  earliest: string,
  latest: string,
  windowShift: number
): { earliest: string; latest: string } {
  if (!windowShift) {
    return { earliest, latest };
  }

  const start = new Date(earliest);
  const end = new Date(latest);
  start.setDate(start.getDate() - windowShift);
  end.setDate(end.getDate() + windowShift);

  return {
    earliest: start.toISOString().split('T')[0],
    latest: end.toISOString().split('T')[0]
  };
}
