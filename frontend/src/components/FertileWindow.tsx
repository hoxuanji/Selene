import React, { useMemo } from 'react';

interface FertileWindowProps {
  predictedOvulationDate?: string | null;
  lastPeriodDate?: string | null;
  averageCycleLength?: number | null;
}

export interface FertileWindowRange {
  start: string;
  end: string;
  ovulationDate: string;
  /** Dates in the fertile window as ISO strings */
  dates: string[];
}

/**
 * Calculate the fertile window: 5 days before ovulation + ovulation day itself.
 */
export function computeFertileWindow(
  predictedOvulationDate?: string | null,
  lastPeriodDate?: string | null,
  averageCycleLength?: number | null
): FertileWindowRange | null {
  let ovDate: Date | null = null;

  if (predictedOvulationDate) {
    ovDate = new Date(predictedOvulationDate);
  } else if (lastPeriodDate) {
    const cycle = averageCycleLength && averageCycleLength > 10 ? averageCycleLength : 28;
    ovDate = new Date(lastPeriodDate);
    ovDate.setDate(ovDate.getDate() + (cycle - 14));
  }

  if (!ovDate || isNaN(ovDate.getTime())) return null;

  const fertileStart = new Date(ovDate);
  fertileStart.setDate(fertileStart.getDate() - 5);

  const dates: string[] = [];
  for (let i = 0; i <= 5; i++) {
    const d = new Date(fertileStart);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }

  return {
    start: fertileStart.toISOString().split('T')[0],
    end: ovDate.toISOString().split('T')[0],
    ovulationDate: ovDate.toISOString().split('T')[0],
    dates
  };
}

export const FertileWindowCard: React.FC<FertileWindowProps> = ({
  predictedOvulationDate,
  lastPeriodDate,
  averageCycleLength
}) => {
  const fertile = useMemo(
    () => computeFertileWindow(predictedOvulationDate, lastPeriodDate, averageCycleLength),
    [predictedOvulationDate, lastPeriodDate, averageCycleLength]
  );

  const daysUntilFertile = useMemo(() => {
    if (!fertile) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(fertile.start);
    const end = new Date(fertile.end);
    const diffToStart = Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const diffToEnd = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffToStart > 0) return { status: 'upcoming' as const, days: diffToStart };
    if (diffToEnd >= 0) return { status: 'active' as const, days: 0 };
    return { status: 'passed' as const, days: Math.abs(diffToEnd) };
  }, [fertile]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (!fertile) {
    return (
      <div className="card card-muted">
        <p className="section-title">Fertile window</p>
        <p style={{ color: '#6a6b76', margin: 0 }}>
          More data needed to estimate fertile window.
        </p>
      </div>
    );
  }

  const statusBadge = daysUntilFertile?.status === 'active'
    ? { text: 'Fertile now', className: 'fertile-badge-active' }
    : daysUntilFertile?.status === 'upcoming'
    ? { text: `In ${daysUntilFertile.days} day${daysUntilFertile.days === 1 ? '' : 's'}`, className: 'fertile-badge-upcoming' }
    : { text: 'Passed', className: 'fertile-badge-passed' };

  return (
    <div className={`card fertile-card ${daysUntilFertile?.status === 'active' ? 'fertile-card-active' : ''}`}>
      <div className="fertile-header">
        <p className="section-title">Fertile window</p>
        <span className={`fertile-badge ${statusBadge.className}`}>
          {statusBadge.text}
        </span>
      </div>
      <div className="fertile-dates">
        <span className="fertile-range">
          {formatDate(fertile.start)} – {formatDate(fertile.end)}
        </span>
      </div>
      <div className="fertile-day-row">
        {fertile.dates.map((date, i) => {
          const isOvulation = date === fertile.ovulationDate;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const isToday = date === today.toISOString().split('T')[0];
          return (
            <div
              key={date}
              className={[
                'fertile-day-pip',
                isOvulation ? 'fertile-day-ovulation' : '',
                isToday ? 'fertile-day-today' : ''
              ].join(' ')}
              title={`${formatDate(date)}${isOvulation ? ' (Ovulation)' : ''}${isToday ? ' (Today)' : ''}`}
            >
              <span className="fertile-pip-dot" />
              <span className="fertile-pip-label">
                {isOvulation ? '🥚' : `D${i + 1}`}
              </span>
            </div>
          );
        })}
      </div>
      <p className="fertile-note">
        🌿 The 6-day window includes 5 days before ovulation and ovulation day itself.
      </p>
    </div>
  );
};
