import type { DailyLog } from '../db';
import { parseLocalDate } from './validation';

export type Phase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';

interface PhaseInput {
  lastPeriodDate?: string | null;
  predictedOvulationDate?: string | null;
  todayLog?: DailyLog | null;
  referenceDate?: string | Date;
  averageCycleLength?: number | null;
}

/** Normalize any accepted date input to a local-midnight Date (or null). */
const toLocalMidnight = (value?: string | Date | null): Date | null => {
  if (!value) return null;
  if (value instanceof Date) {
    const d = new Date(value);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return parseLocalDate(value);
};

export function getPhase({
  lastPeriodDate,
  predictedOvulationDate,
  todayLog,
  referenceDate,
  averageCycleLength
}: PhaseInput): Phase {
  const reference = toLocalMidnight(referenceDate) ?? toLocalMidnight(new Date())!;

  if (todayLog?.flow && todayLog.flow !== 'none') return 'menstrual';
  if (todayLog?.mucus === 'egg_white') return 'ovulation';

  const lastPeriod = toLocalMidnight(lastPeriodDate);
  const dayIndex = lastPeriod
    ? Math.floor(
        (reference.getTime() - lastPeriod.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1
    : null;

  const cycleLength = averageCycleLength && averageCycleLength > 10 ? averageCycleLength : 28;
  const estimatedOvulation = lastPeriod
    ? new Date(lastPeriod.getTime())
    : null;
  if (estimatedOvulation) {
    estimatedOvulation.setDate(estimatedOvulation.getDate() + Math.round(cycleLength - 14));
  }

  const ovulationDate = toLocalMidnight(predictedOvulationDate) ?? estimatedOvulation;

  if (ovulationDate) {
    const ovulationDiff = Math.round(
      (reference.getTime() - ovulationDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (Math.abs(ovulationDiff) <= 1) return 'ovulation';
    if (ovulationDiff < 0) {
      if (dayIndex !== null && dayIndex <= 5) return 'menstrual';
      return 'follicular';
    }
    return 'luteal';
  }

  if (dayIndex !== null) {
    if (dayIndex <= 5) return 'menstrual';
    if (dayIndex <= 13) return 'follicular';
    if (dayIndex <= 15) return 'ovulation';
    return 'luteal';
  }

  return 'luteal';
}
