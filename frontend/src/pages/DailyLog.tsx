import React, { useEffect, useMemo, useState } from 'react';
import { DailyCheckinCard } from '../components/DailyCheckinCard';
import { usePeriodStore } from '../store';
import type { DailyLog as DailyLogEntry } from '../db';

export const DailyLog: React.FC = () => {
  const { dailyLogs, loadDailyLogsFromDB, upsertDailyLog } = usePeriodStore();
  const toLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const [selectedDate, setSelectedDate] = useState(() =>
    toLocalDateString(new Date())
  );
  const [draftLog, setDraftLog] = useState<DailyLogEntry | null>(null);

  useEffect(() => {
    loadDailyLogsFromDB();
  }, []);

  const selectedLog = useMemo(
    () => dailyLogs.find((log) => log.date === selectedDate) ?? null,
    [dailyLogs, selectedDate]
  );

  useEffect(() => {
    setDraftLog(
      selectedLog ?? {
        date: selectedDate,
        userId: 'local-user',
        createdAt: new Date().toISOString(),
        flow: 'none'
      }
    );
  }, [selectedLog, selectedDate]);

  const handleUpdate = async (
    field: keyof DailyLogEntry,
    value: DailyLogEntry[keyof DailyLogEntry]
  ) => {
    if (!draftLog) return;
    const nextLog: DailyLogEntry = {
      ...draftLog,
      [field]: value
    };
    setDraftLog(nextLog);
    await upsertDailyLog(nextLog);
  };

  const dateLabel = new Date(selectedDate).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });

  const handleShiftDay = (offset: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + offset);
    setSelectedDate(toLocalDateString(date));
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Daily Log</h1>
          <div className="badge">Fast, tap-only check-in</div>
        </div>
        <div className="date-switch">
          <button className="btn btn-ghost" onClick={() => handleShiftDay(-1)}>
            ← Previous
          </button>
          <button className="btn btn-ghost" onClick={() => setSelectedDate(toLocalDateString(new Date()))}>
            Today
          </button>
          <button className="btn btn-ghost" onClick={() => handleShiftDay(1)}>
            Next →
          </button>
        </div>
      </div>

      <DailyCheckinCard
        dateLabel={dateLabel}
        log={draftLog}
        onSelect={handleUpdate}
      />

      <div className="card" style={{ marginTop: 24 }}>
        <p className="section-title">Why it matters</p>
        <p style={{ margin: 0, color: '#6a6b76' }}>
          Logging symptoms helps confirm ovulation, refine phase labels, and boost
          prediction confidence without disrupting your existing flow.
        </p>
      </div>
    </div>
  );
};
