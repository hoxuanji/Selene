import React, { useMemo } from 'react';
import type { Phase } from '../utils/phaseEngine';
import { parseLocalDate, todayLocalString } from '../utils/validation';

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
    const last = parseLocalDate(lastPeriodDate);
    const today = parseLocalDate(todayLocalString());
    if (!last || !today) return null;
    const diff = Math.floor(
      (today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)
    );
    return diff + 1; // Day 1 = period start date
  }, [lastPeriodDate]);

  const cycleLength = averageCycleLength ?? 28;
  // 4–45 day gaps between periods are within normal range.
  // Beyond 45 days suggests a skipped cycle → possible pregnancy or medical concern.
  const NORMAL_MAX_CYCLE_DAY = 45;
  const isCycleOverdue = cycleDay !== null && cycleDay > cycleLength && cycleDay <= NORMAL_MAX_CYCLE_DAY;
  const isSkippedCycle = cycleDay !== null && cycleDay > NORMAL_MAX_CYCLE_DAY;

  if (!cycleDay || cycleDay < 1) {
    return (
      <div className="card card-muted">
        <p className="section-title">Cycle day</p>
        <p style={{ color: 'var(--muted)', margin: 0 }}>
          Add a period start date to begin tracking.
        </p>
      </div>
    );
  }

  const progress = Math.min(100, Math.round((Math.min(cycleDay, NORMAL_MAX_CYCLE_DAY) / cycleLength) * 100));
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
      {isSkippedCycle ? (
        <div className="alert alert-danger" style={{ margin: '8px 0', fontSize: 13, alignItems: 'flex-start' }}>
          <span>
            🚨 <strong>Possible skipped cycle:</strong> It has been {cycleDay} days since your last period.
            A gap of more than 45 days may indicate pregnancy, significant hormonal changes, or other
            medical conditions. If this is unexpected, please consider consulting a healthcare provider.
          </span>
        </div>
      ) : isCycleOverdue ? (
        <div className="alert alert-warn" style={{ margin: '8px 0', fontSize: 13, alignItems: 'flex-start' }}>
          <span>
            📌 Day {cycleDay} is past your usual ~{cycleLength}-day cycle.
            This can be a normal delay (cycles of 4–45 days are common).
            Your period may be arriving soon — or log a new start date if it already has.
          </span>
        </div>
      ) : null}
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
