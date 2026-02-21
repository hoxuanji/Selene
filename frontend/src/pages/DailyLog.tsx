import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DailyCheckinCard } from '../components/DailyCheckinCard';
import { usePeriodStore } from '../store';
import type { DailyLog as DailyLogEntry } from '../db';

export const DailyLog: React.FC = () => {
  const {
    periods,
    periodEntries,
    dailyLogs,
    dailyLogsError,
    loadPeriodsFromDB,
    loadDailyLogsFromDB,
    upsertDailyLog,
    addPeriodToStore,
    removePeriod
  } = usePeriodStore();
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
    loadPeriodsFromDB();
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
    let nextLog: DailyLogEntry = {
      ...draftLog,
      [field]: value
    };
    // When period starts, clear mucus — not observable during bleeding
    if (field === 'flow' && value && value !== 'none' && nextLog.mucus) {
      nextLog = { ...nextLog, mucus: undefined };
    }
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
    const todayStr = toLocalDateString(new Date());
    const newDateStr = toLocalDateString(date);
    // Don't allow navigating to future dates
    if (newDateStr > todayStr) return;
    setSelectedDate(newDateStr);
  };

  const isToday = selectedDate === toLocalDateString(new Date());

  // Calendar ↔ Daily log period sync
  const isCalendarPeriod = useMemo(
    () => periods.includes(selectedDate),
    [periods, selectedDate]
  );

  const handlePeriodSync = useCallback(async (active: boolean) => {
    if (active && !periods.includes(selectedDate)) {
      // Add to calendar
      await addPeriodToStore(selectedDate);
    } else if (!active && periods.includes(selectedDate)) {
      // Remove from calendar
      const entry = periodEntries.find(e => e.startDate === selectedDate);
      if (entry) {
        await removePeriod(entry.id, selectedDate);
      }
    }
  }, [selectedDate, periods, periodEntries, addPeriodToStore, removePeriod]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Daily Log</h1>
          <div className="badge">🌸 Quick tap check-in</div>
        </div>
        <div className="date-switch">
          <button className="btn btn-ghost" onClick={() => handleShiftDay(-1)}>
            ← Previous
          </button>
          <button className="btn btn-ghost" onClick={() => setSelectedDate(toLocalDateString(new Date()))}>
            Today
          </button>
          <button className="btn btn-ghost" onClick={() => handleShiftDay(1)} disabled={isToday} style={isToday ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}>
            Next →
          </button>
        </div>
      </div>

      <DailyCheckinCard
        dateLabel={dateLabel}
        log={draftLog}
        onSelect={handleUpdate}
        isCalendarPeriod={isCalendarPeriod}
        onPeriodSync={handlePeriodSync}
      />

      {dailyLogsError && <div className="alert">⚠️ {dailyLogsError}</div>}

      <div className="card" style={{ marginTop: 24 }}>
        <p className="section-title">💡 Why it matters</p>
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          Logging symptoms helps confirm ovulation, refine phase labels, and boost
          prediction confidence without disrupting your existing flow.
        </p>
      </div>
    </div>
  );
};
