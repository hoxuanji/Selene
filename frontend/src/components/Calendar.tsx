import React, { useState } from 'react';

interface CalendarProps {
  periods: string[];
  periodEntries?: { id: number; startDate: string }[];
  predictedRange?: { earliest: string; latest: string } | null;
  onDateAction?: (date: string, entryId?: number) => void;
}

export const Calendar: React.FC<CalendarProps> = ({
  periods,
  periodEntries = [],
  predictedRange,
  onDateAction
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

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

  const predictedDates = new Set<string>();
  if (predictedRange) {
    const start = new Date(predictedRange.earliest);
    const end = new Date(predictedRange.latest);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      predictedDates.add(new Date(d).toDateString());
    }
  }

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

    const entryId = periodIdMap.get(dateString);
    const isToday = date.toDateString() === new Date().toDateString();

    cells.push(
      <button
        key={day}
        type="button"
        onClick={() => onDateAction?.(date.toISOString().split('T')[0], entryId)}
        className={[
          'calendar-cell',
          'calendar-button',
          'calendar-day',
          isPeriod ? 'period' : '',
          !isPeriod && isPredicted ? 'predicted' : '',
          isToday ? 'today' : ''
        ].join(' ')}
        title={
          isPeriod
            ? 'Remove period entry'
            : 'Add period entry'
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
        <span>Click a date to add or remove an entry</span>
      </div>
    </div>
  );
};
