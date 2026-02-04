import type { DailyLog } from '../db';

export interface LogFeatures {
  stress_rolling_avg: number | null;
  sleep_rolling_avg: number | null;
  mucus_peak_day: string | null;
  pain_near_ovulation: boolean;
}

const sleepScoreMap: Record<string, number> = {
  lt6: 0,
  btw6_8: 1,
  gt8: 2
};

const stressScoreMap: Record<string, number> = {
  low: 0,
  normal: 1,
  high: 2
};

export function extractLogFeatures(logs: DailyLog[], ovulationDate?: string | null): LogFeatures {
  if (logs.length === 0) {
    return {
      stress_rolling_avg: null,
      sleep_rolling_avg: null,
      mucus_peak_day: null,
      pain_near_ovulation: false
    };
  }

  const recentLogs = [...logs].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-7);
  const stressValues = recentLogs
    .map((log) => (log.stress ? stressScoreMap[log.stress] : null))
    .filter((value): value is number => value !== null);
  const sleepValues = recentLogs
    .map((log) => (log.sleepBand ? sleepScoreMap[log.sleepBand] : null))
    .filter((value): value is number => value !== null);

  const stressAvg =
    stressValues.length > 0
      ? stressValues.reduce((a, b) => a + b, 0) / stressValues.length
      : null;
  const sleepAvg =
    sleepValues.length > 0
      ? sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length
      : null;

  const mucusPeak = recentLogs.find((log) => log.mucus === 'egg_white');

  const painNearOvulation = ovulationDate
    ? recentLogs.some((log) => {
        if (!log.pain || log.pain === 'none') return false;
        const diff = Math.abs(
          Math.round(
            (new Date(log.date).getTime() - new Date(ovulationDate).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        );
        return diff <= 2;
      })
    : false;

  return {
    stress_rolling_avg: stressAvg,
    sleep_rolling_avg: sleepAvg,
    mucus_peak_day: mucusPeak?.date ?? null,
    pain_near_ovulation: painNearOvulation
  };
}
