import React, { useMemo, useState } from 'react';
import type { DailyLog } from '../db';
import { getPhase } from '../utils/phaseEngine';

interface CalendarProps {
  periods: string[];
  periodEntries?: { id: number; startDate: string }[];
  predictedRange?: { earliest: string; latest: string } | null;
  dailyLogs?: DailyLog[];
  predictedOvulationDate?: string | null;
  lastPeriodDate?: string | null;
  onDateAction?: (date: string, entryId?: number) => void;
}

export const Calendar: React.FC<CalendarProps> = ({
  periods,
  periodEntries = [],
  predictedRange,
  dailyLogs = [],
  predictedOvulationDate,
  lastPeriodDate,
  onDateAction
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const toLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const periodDates = new Set(
    periods.map(p => new Date(p).toDateString())
  );
  const periodIdMap = new Map(
    periodEntries.map(entry => [new Date(entry.startDate).toDateString(), entry.id])
  );

  const dailyLogMap = useMemo(
    () => new Map(dailyLogs.map((log) => [new Date(log.date).toDateString(), log])),
    [dailyLogs]
  );

  const predictedDates = new Set<string>();
  if (predictedRange) {
    const start = new Date(predictedRange.earliest);
    const end = new Date(predictedRange.latest);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      predictedDates.add(new Date(d).toDateString());
    }
  }

  const averageCycleLength = useMemo(() => {
    if (periods.length < 2) return null;
    const sorted = [...periods].sort();
    const cycles: number[] = [];
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = new Date(sorted[i - 1]).getTime();
      const curr = new Date(sorted[i]).getTime();
      cycles.push(Math.round((curr - prev) / (1000 * 60 * 60 * 24)));
    }
    if (!cycles.length) return null;
    return Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length);
  }, [periods]);

  const cycleWindow = useMemo(() => {
    if (!lastPeriodDate) return null;
    const start = new Date(lastPeriodDate);
    const end = predictedRange?.latest
      ? new Date(predictedRange.latest)
      : averageCycleLength
      ? new Date(new Date(lastPeriodDate).getTime())
      : null;
    if (end && averageCycleLength && !predictedRange?.latest) {
      end.setDate(start.getDate() + averageCycleLength);
    }
    return end ? { start, end } : null;
  }, [lastPeriodDate, predictedRange?.latest, averageCycleLength]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const cells = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    cells.push(<div key={`empty-${i}`} className="calendar-cell empty"></div>);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateString = date.toDateString();
    const isPeriod = periodDates.has(dateString);
    const isPredicted = predictedDates.has(dateString);
    const logForDate = dailyLogMap.get(dateString);
    const inCycleWindow =
      cycleWindow && date >= cycleWindow.start && date <= cycleWindow.end;
    const phase = inCycleWindow
      ? getPhase({
          lastPeriodDate,
          predictedOvulationDate,
          todayLog: logForDate,
          referenceDate: date,
          averageCycleLength
        })
      : null;

    const entryId = periodIdMap.get(dateString);
    const isToday = date.toDateString() === new Date().toDateString();
    const ovulationTooltip =
      logForDate?.mucus === 'egg_white'
        ? 'Likely Ovulation Day (from mucus log)'
        : '';

    cells.push(
      <button
        key={day}
        type="button"
        aria-label={`calendar-day-${toLocalDateString(date)}`}
        onClick={() => onDateAction?.(toLocalDateString(date), entryId)}
        className={[
          'calendar-cell',
          'calendar-button',
          'calendar-day',
          phase ? `phase-${phase}` : '',
          isPeriod ? 'period' : '',
          !isPeriod && isPredicted ? 'predicted' : '',
          isToday ? 'today' : ''
        ].join(' ')}
        title={
          isPeriod
            ? 'Remove period entry'
            : ovulationTooltip || 'Add period entry'
        }
      >
        {day}
      </button>
    );
  }

  return (
    <div className="card">
      <div className="calendar-header">
        <button onClick={handlePrevMonth} className="btn btn-ghost">
          ← Previous
        </button>
        <h3 style={{ margin: 0 }}>
          {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </h3>
        <button onClick={handleNextMonth} className="btn btn-ghost">
          Next →
        </button>
      </div>

      <div className="calendar">
        <div className="calendar-grid">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="calendar-cell head">
              {day}
            </div>
          ))}
          {cells}
        </div>
      </div>

      <div className="legend" style={{ marginTop: 16 }}>
        <span>
          <span className="legend-swatch" style={{ background: '#ffe2ea' }}></span>
          Period Date
        </span>
        <span>
          <span className="legend-swatch" style={{ background: '#fff0f5' }}></span>
          Predicted Range
        </span>
        <span>
          <span className="legend-swatch" style={{ background: '#ffd6e3' }}></span>
          Menstrual
        </span>
        <span>
          <span className="legend-swatch" style={{ background: '#dfe9ff' }}></span>
          Follicular
        </span>
        <span>
          <span className="legend-swatch" style={{ background: '#dff7e3' }}></span>
          Ovulation
        </span>
        <span>
          <span className="legend-swatch" style={{ background: '#efe1ff' }}></span>
          Luteal
        </span>
        <span>Click a date to add or remove an entry</span>
      </div>
    </div>
  );
};
