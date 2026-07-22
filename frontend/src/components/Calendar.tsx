import React, { useMemo, useState } from 'react';
import type { DailyLog } from '../db';
import { getPhase } from '../utils/phaseEngine';
import { parseLocalDate, toLocalDateString } from '../utils/validation';
import { averageCycleLength as computeAverageCycleLength } from '../utils/predictor';

interface CalendarProps {
  periods: string[];
  periodEntries?: { id: number; startDate: string }[];
  predictedRange?: { earliest: string; latest: string } | null;
  dailyLogs?: DailyLog[];
  predictedOvulationDate?: string | null;
  lastPeriodDate?: string | null;
  fertileWindowDates?: Set<string>;
  fertileOvulationDate?: string | null;
  onDateAction?: (date: string, entryId?: number) => void;
}

export const Calendar: React.FC<CalendarProps> = ({
  periods,
  periodEntries = [],
  predictedRange,
  dailyLogs = [],
  predictedOvulationDate,
  lastPeriodDate,
  fertileWindowDates = new Set(),
  fertileOvulationDate,
  onDateAction
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  // Stored dates are local YYYY-MM-DD, and each calendar cell is keyed by the
  // same local string — so highlights and clicks land on the correct day in
  // every timezone (previously new Date(str) parsed as UTC and drifted a day).
  const periodDates = new Set(periods);
  const periodIdMap = new Map(
    periodEntries.map(entry => [entry.startDate, entry.id])
  );

  const dailyLogMap = useMemo(
    () => new Map(dailyLogs.map((log) => [log.date, log])),
    [dailyLogs]
  );

  const predictedDates = new Set<string>();
  if (predictedRange) {
    const start = parseLocalDate(predictedRange.earliest);
    const end = parseLocalDate(predictedRange.latest);
    if (start && end) {
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        predictedDates.add(toLocalDateString(d));
      }
    }
  }

  const averageCycleLength = useMemo(
    () => computeAverageCycleLength(periods),
    [periods]
  );

  const cycleWindow = useMemo(() => {
    const start = parseLocalDate(lastPeriodDate ?? '');
    if (!start) return null;
    let end: Date | null = parseLocalDate(predictedRange?.latest ?? '');
    if (!end && averageCycleLength) {
      end = new Date(start);
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
    const dateISO = toLocalDateString(date);
    const isPeriod = periodDates.has(dateISO);
    const isPredicted = predictedDates.has(dateISO);
    const logForDate = dailyLogMap.get(dateISO);
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

    const entryId = periodIdMap.get(dateISO);
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const cellDate = new Date(date);
    cellDate.setHours(0, 0, 0, 0);
    const isToday = date.toDateString() === new Date().toDateString();
    const isFutureDate = cellDate > todayDate;
    const isFertile = fertileWindowDates.has(dateISO);
    const isFertileOvulation = dateISO === fertileOvulationDate;
    const ovulationTooltip =
      isFertileOvulation
        ? 'Estimated Ovulation Day'
        : logForDate?.mucus === 'egg_white'
        ? 'Likely Ovulation Day (from mucus log)'
        : '';

    cells.push(
      <button
        key={day}
        type="button"
        aria-label={`calendar-day-${toLocalDateString(date)}`}
        onClick={() => {
          if (isFutureDate && !entryId) return;
          onDateAction?.(toLocalDateString(date), entryId);
        }}
        disabled={isFutureDate && !entryId}
        className={[
          'calendar-cell',
          'calendar-button',
          'calendar-day',
          phase ? `phase-${phase}` : '',
          isPeriod ? 'period' : '',
          !isPeriod && isPredicted ? 'predicted' : '',
          !isPeriod && !isPredicted && isFertileOvulation ? 'fertile-ovulation' : '',
          !isPeriod && !isPredicted && isFertile && !isFertileOvulation ? 'fertile' : '',
          isToday ? 'today' : '',
          isFutureDate && !entryId ? 'disabled' : ''
        ].join(' ')}
        title={
          isFutureDate && !entryId
            ? 'Cannot add entries for future dates'
            : isPeriod
            ? 'Remove period entry'
            : ovulationTooltip || (isFertile ? 'Fertile window' : 'Add period entry')
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
          <span className="legend-swatch" style={{ background: 'color-mix(in srgb, var(--primary) 30%, var(--card))' }}></span>
          Period date
        </span>
        <span>
          <span className="legend-swatch" style={{ background: 'var(--card)', boxShadow: 'inset 0 0 0 2px color-mix(in srgb, var(--primary) 40%, transparent)' }}></span>
          Predicted range
        </span>
        <span>
          <span className="legend-swatch" style={{ background: 'color-mix(in srgb, var(--phase-menstrual) 30%, var(--card))' }}></span>
          Menstrual
        </span>
        <span>
          <span className="legend-swatch" style={{ background: 'color-mix(in srgb, var(--phase-follicular) 30%, var(--card))' }}></span>
          Follicular
        </span>
        <span>
          <span className="legend-swatch" style={{ background: 'color-mix(in srgb, var(--phase-ovulation) 30%, var(--card))' }}></span>
          Ovulation phase
        </span>
        <span>
          <span className="legend-swatch" style={{ background: 'color-mix(in srgb, var(--phase-luteal) 30%, var(--card))' }}></span>
          Luteal
        </span>
        <span>
          <span className="legend-swatch" style={{ background: 'var(--phase-ovulation-bg)', boxShadow: 'inset 0 0 0 2px color-mix(in srgb, var(--phase-ovulation) 45%, transparent)' }}></span>
          Fertile days
        </span>
        <span>
          <span className="legend-swatch" style={{ background: 'var(--phase-ovulation)' }}></span>
          Estimated ovulation day
        </span>
        <span>Click a date to add or remove an entry</span>
      </div>
    </div>
  );
};
