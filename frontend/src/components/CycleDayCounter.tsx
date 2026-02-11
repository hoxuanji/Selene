import React, { useMemo } from 'react';
import type { Phase } from '../utils/phaseEngine';

interface CycleDayCounterProps {
  lastPeriodDate: string | null;
  averageCycleLength: number | null;
  currentPhase: Phase | null;
}

const phaseEmoji: Record<string, string> = {
  menstrual: '🩸',
  follicular: '🌱',
  ovulation: '🥚',
  luteal: '🌙'
};

const phaseLabel: Record<string, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulation: 'Ovulation',
  luteal: 'Luteal'
};

export const CycleDayCounter: React.FC<CycleDayCounterProps> = ({
  lastPeriodDate,
  averageCycleLength,
  currentPhase
}) => {
  const cycleDay = useMemo(() => {
    if (!lastPeriodDate) return null;
    const last = new Date(lastPeriodDate);
    const today = new Date();
    const diff = Math.floor(
      (today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)
    );
    return diff + 1; // Day 1 = period start date
  }, [lastPeriodDate]);

  const cycleLength = averageCycleLength ?? 28;

  if (!cycleDay || cycleDay < 1) {
    return (
      <div className="card card-muted">
        <p className="section-title">Cycle day</p>
        <p style={{ color: '#6a6b76', margin: 0 }}>
          Add a period start date to begin tracking.
        </p>
      </div>
    );
  }

  const progress = Math.min(100, Math.round((cycleDay / cycleLength) * 100));
  const emoji = currentPhase ? phaseEmoji[currentPhase] ?? '📅' : '📅';
  const label = currentPhase ? phaseLabel[currentPhase] ?? '' : '';

  return (
    <div className="card cycle-day-card">
      <p className="section-title">Cycle day</p>
      <div className="cycle-day-hero">
        <span className="cycle-day-number">
          Day {cycleDay}
        </span>
        <span className="cycle-day-total">
          of ~{cycleLength}
        </span>
      </div>
      <div className="cycle-day-phase">
        <span>{emoji}</span>
        <span>{label} phase</span>
      </div>
      <div className="cycle-progress-track">
        <div
          className="cycle-progress-fill"
          style={{ width: `${progress}%` }}
        />
        <div className="cycle-progress-markers">
          <span className="cycle-marker" style={{ left: '0%' }} title="Period" />
          <span className="cycle-marker" style={{ left: `${Math.round(((cycleLength - 14) / cycleLength) * 100)}%` }} title="Ovulation" />
          <span className="cycle-marker" style={{ left: '100%' }} title="Next period" />
        </div>
      </div>
      <div className="cycle-progress-labels">
        <span>🩸 Day 1</span>
        <span>🥚 ~Day {cycleLength - 14}</span>
        <span>🔄 ~Day {cycleLength}</span>
      </div>
    </div>
  );
};
