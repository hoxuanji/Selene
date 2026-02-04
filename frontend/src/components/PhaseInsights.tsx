import React, { useMemo } from 'react';
import type { DailyLog } from '../db';
import type { Phase } from '../utils/phaseEngine';
import type { OvulationSignal } from '../utils/ovulationSignals';

interface PhaseInsightsProps {
  phase: Phase | null;
  predictedOvulationDate?: string | null;
  ovulationSignal?: OvulationSignal | null;
  periods: string[];
  dailyLogs: DailyLog[];
}

export const PhaseInsights: React.FC<PhaseInsightsProps> = ({
  phase,
  predictedOvulationDate,
  ovulationSignal,
  periods,
  dailyLogs
}) => {
  const daysUntilOvulation = useMemo(() => {
    if (!predictedOvulationDate) return null;
    const today = new Date();
    const target = new Date(predictedOvulationDate);
    return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }, [predictedOvulationDate]);

  const lutealAverage = useMemo(() => {
    if (periods.length < 2) return null;
    const sorted = [...periods].sort();
    const cycles = sorted.slice(1).map((date, index) => {
      const prev = new Date(sorted[index]).getTime();
      const curr = new Date(date).getTime();
      return Math.round((curr - prev) / (1000 * 60 * 60 * 24));
    });
    const avgCycle = cycles.reduce((a, b) => a + b, 0) / cycles.length;
    return Math.max(8, Math.round(avgCycle - 14));
  }, [periods]);

  const stressSleepNote = useMemo(() => {
    const recent = [...dailyLogs]
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .slice(-5);
    const hasHighStress = recent.some((log) => log.stress === 'high');
    const hasPoorSleep = recent.some((log) => log.sleepBand === 'lt6');
    if (hasHighStress || hasPoorSleep) {
      return 'Sleep & stress may delay this cycle';
    }
    return null;
  }, [dailyLogs]);

  const phaseLabel = phase
    ? phase.charAt(0).toUpperCase() + phase.slice(1)
    : 'Unknown';

  return (
    <div className="card">
      <p className="section-title">Phase insights</p>
      <div className="insight-grid">
        <div>
          <div className="insight-label">Current phase</div>
          <div className="insight-value">{phaseLabel}</div>
        </div>
        <div>
          <div className="insight-label">Ovulation timing</div>
          <div className="insight-value">
            {ovulationSignal?.ovulationDetected && ovulationSignal.ovulationDate
              ? `Likely ovulation on ${new Date(ovulationSignal.ovulationDate).toLocaleDateString()}`
              : daysUntilOvulation !== null
              ? daysUntilOvulation >= 0
                ? `Ovulation expected in ${daysUntilOvulation} days`
                : `Ovulation was ${Math.abs(daysUntilOvulation)} days ago`
              : 'Tracking more data'}
          </div>
        </div>
        <div>
          <div className="insight-label">Luteal average</div>
          <div className="insight-value">
            {lutealAverage ? `${lutealAverage} days` : 'Add more cycles'}
          </div>
        </div>
      </div>
      {stressSleepNote && <div className="insight-note">{stressSleepNote}</div>}
    </div>
  );
};
