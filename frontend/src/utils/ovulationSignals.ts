import type { DailyLog } from '../db';

export interface OvulationSignal {
  ovulationDetected: boolean;
  ovulationDate?: string;
  reason?: 'mucus' | 'pain';
}

interface OvulationSignalInput {
  last7DaysLogs: DailyLog[];
  predictedOvulationDate?: string | null;
}

export function detectOvulationFromLogs({
  last7DaysLogs,
  predictedOvulationDate
}: OvulationSignalInput): OvulationSignal {
  const sortedLogs = [...last7DaysLogs].sort((a, b) => (a.date < b.date ? -1 : 1));

  const mucusMatch = sortedLogs.find((log) => log.mucus === 'egg_white');
  if (mucusMatch) {
    return {
      ovulationDetected: true,
      ovulationDate: mucusMatch.date,
      reason: 'mucus'
    };
  }

  if (predictedOvulationDate) {
    const predicted = new Date(predictedOvulationDate);
    const painMatch = sortedLogs.find((log) => {
      if (!log.pain || log.pain === 'none') return false;
      const logDate = new Date(log.date);
      const diffDays = Math.abs(
        Math.round((logDate.getTime() - predicted.getTime()) / (1000 * 60 * 60 * 24))
      );
      return diffDays <= 2;
    });

    if (painMatch) {
      return {
        ovulationDetected: true,
        ovulationDate: painMatch.date,
        reason: 'pain'
      };
    }
  }

  return { ovulationDetected: false };
}
