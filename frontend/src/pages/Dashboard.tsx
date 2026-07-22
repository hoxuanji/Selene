import React, { useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { usePeriodStore } from '../store';
import { PredictionCard } from '../components/PredictionCard';
import { Calendar } from '../components/Calendar';
import { PhaseInsights } from '../components/PhaseInsights';
import { CycleDayCounter } from '../components/CycleDayCounter';
import { FertileWindowCard, computeFertileWindow } from '../components/FertileWindow';
import { getPhase } from '../utils/phaseEngine';
import { useConfirm } from '../components/ConfirmDialog';
import { averageCycleLength as computeAverageCycleLength, collapsePeriodStarts } from '../utils/predictor';
import { parseLocalDate, todayLocalString } from '../utils/validation';
import {
  notificationsSupported,
  getPermission,
  getNotificationPrefs,
  checkInsightNotifications,
} from '../utils/notifications';

// Alert-tuning defaults (previously user-editable knobs, now sensible constants).
const VARIATION_DAYS = 7;
const RECENT_WINDOW_DAYS = 60;
const FREQUENT_COUNT = 3;
const MIN_CYCLES_FOR_ALERTS = 3;

const daysSince = (dateStr: string): number => {
  const then = parseLocalDate(dateStr);
  const today = parseLocalDate(todayLocalString());
  if (!then || !today) return 0;
  return Math.round((today.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
};

export const Dashboard: React.FC = () => {
  const {
    periods,
    periodEntries,
    predictedRange,
    loading,
    error,
    loadPeriodsFromDB,
    addPeriodToStore,
    removePeriod,
    profile,
    dailyLogs,
    loadDailyLogsFromDB
  } = usePeriodStore();

  useEffect(() => {
    loadPeriodsFromDB();
    loadDailyLogsFromDB();
  }, []);

  /* ---- Notification prefs (read-only for insight check) ---- */
  const notifPrefs = getNotificationPrefs();

  const previousPhaseRef = useRef<string | null>(null);
  const { confirm, dialog } = useConfirm();

  const handleStartToday = async () => {
    await addPeriodToStore(todayLocalString());
  };

  const lastPeriod = useMemo(() => periods[0], [periods]);
  const lastTenDates = useMemo(() => periods.slice(0, 10), [periods]);
  const averageCycleLength = useMemo(
    () => computeAverageCycleLength(periods),
    [periods]
  );

  const todayLog = useMemo(() => {
    const today = todayLocalString();
    return dailyLogs.find((log) => log.date === today) ?? null;
  }, [dailyLogs]);

  const currentPhase = useMemo(() => {
    if (!predictedRange?.predictedOvulationDate && !todayLog && !lastPeriod) return null;
    return getPhase({
      lastPeriodDate: lastPeriod,
      predictedOvulationDate: predictedRange?.predictedOvulationDate,
      todayLog,
      averageCycleLength
    });
  }, [predictedRange, todayLog, lastPeriod, averageCycleLength]);

  const needsCheckinPrompt = useMemo(() => {
    if (!dailyLogs.length) return true;
    const latestLog = dailyLogs[0];
    return daysSince(latestLog.date) >= 3;
  }, [dailyLogs]);

  const cycleAlert = useMemo(() => {
    if (periods.length < MIN_CYCLES_FOR_ALERTS) return null;
    // Collapse bleeding days into cycle starts so day-by-day logging doesn't
    // read as a run of 1-day "cycles".
    const starts = collapsePeriodStarts(periods);
    const recentStarts = starts.filter((date) => daysSince(date) <= RECENT_WINDOW_DAYS);
    const recentCount = recentStarts.filter((date) => daysSince(date) >= 0).length;
    const baseDates = recentStarts.length >= 3 ? recentStarts : starts;

    const cycles: number[] = [];
    for (let i = 1; i < baseDates.length; i += 1) {
      const prev = parseLocalDate(baseDates[i - 1])!.getTime();
      const curr = parseLocalDate(baseDates[i])!.getTime();
      cycles.push(Math.round((curr - prev) / (1000 * 60 * 60 * 24)));
    }
    if (cycles.length < MIN_CYCLES_FOR_ALERTS - 1) return null;

    const sortedCycles = [...cycles].sort((a, b) => a - b);
    const mid = Math.floor(sortedCycles.length / 2);
    const median =
      sortedCycles.length % 2 === 0
        ? (sortedCycles[mid - 1] + sortedCycles[mid]) / 2
        : sortedCycles[mid];
    const ageVariationBoost =
      profile.ageGroup === 'under18' || profile.ageGroup === '45plus' ? 3 : 0;
    const postpartumBoost = profile.postpartum
      ? profile.postpartumMonths && profile.postpartumMonths > 0
        ? profile.postpartumMonths <= 6
          ? 6
          : profile.postpartumMonths <= 12
          ? 4
          : 2
        : 4
      : 0;
    const pcosBoost = profile.pcos ? 4 : 0;
    const thyroidBoost = profile.thyroid ? 2 : 0;
    const birthControlBoost = profile.birthControl ? 2 : 0;
    const travelBoost = profile.travelRecent ? 2 : 0;
    const sleepBoost = profile.sleepHours !== null && profile.sleepHours < 6 ? 2 : 0;

    const dynamicVariation = Math.max(
      3,
      VARIATION_DAYS +
        ageVariationBoost +
        postpartumBoost +
        pcosBoost +
        thyroidBoost +
        birthControlBoost +
        travelBoost +
        sleepBoost
    );
    const baseMin = Math.max(profile.normalMin, Math.round(median - dynamicVariation));
    const baseMax = Math.min(profile.normalMax + pcosBoost + postpartumBoost, Math.round(median + dynamicVariation));
    const dynamicMin = profile.shortestCycle ? Math.max(baseMin, profile.shortestCycle) : baseMin;
    const dynamicMax = profile.longestCycle ? Math.min(baseMax, profile.longestCycle) : baseMax;

    const latestCycle = cycles[cycles.length - 1];
    if (latestCycle < dynamicMin || latestCycle > dynamicMax) {
      return `Your latest cycle was ${latestCycle} days. Based on your recent history, your expected range is ${dynamicMin}–${dynamicMax} days.`;
    }

    const frequentThreshold =
      profile.postpartum && profile.postpartumMonths && profile.postpartumMonths <= 6
        ? FREQUENT_COUNT + 1
        : FREQUENT_COUNT;
    if (recentCount >= frequentThreshold) {
      return `You logged ${recentCount} entries in the last ${RECENT_WINDOW_DAYS} days. If this feels unusual, consider tracking symptoms or consulting a clinician.`;
    }

    return null;
  }, [periods, profile]);

  const skippedCycleWarning = useMemo(() => {
    if (periods.length < 2) return null;
    const starts = collapsePeriodStarts(periods);
    if (starts.length < 2) return null;
    const SKIPPED_THRESHOLD = 45;

    // Check historical gaps for any skipped cycles
    const skippedGaps: { from: string; to: string; days: number }[] = [];
    for (let i = 1; i < starts.length; i++) {
      const prev = parseLocalDate(starts[i - 1])!.getTime();
      const curr = parseLocalDate(starts[i])!.getTime();
      const gap = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
      if (gap > SKIPPED_THRESHOLD) {
        skippedGaps.push({ from: starts[i - 1], to: starts[i], days: gap });
      }
    }

    // Check current cycle (time since last period start)
    const daysSinceLast = daysSince(starts[starts.length - 1]);
    const currentSkipped = daysSinceLast > SKIPPED_THRESHOLD;

    if (!currentSkipped && skippedGaps.length === 0) return null;

    return { currentSkipped, daysSinceLast, skippedGaps };
  }, [periods]);

  const stressSleepWarning = useMemo(() => {
    const recent = [...dailyLogs]
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .slice(-5);
    const hasHighStress = recent.some((log) => log.stress === 'high');
    const hasPoorSleep = recent.some((log) => log.sleepBand === 'lt6');
    if (hasHighStress || hasPoorSleep) {
      return 'Recent high stress or poor sleep may affect your cycle timing.';
    }
    return null;
  }, [dailyLogs]);

  const fertileWindow = useMemo(
    () => computeFertileWindow(
      predictedRange?.predictedOvulationDate,
      lastPeriod,
      averageCycleLength
    ),
    [predictedRange?.predictedOvulationDate, lastPeriod, averageCycleLength]
  );

  const fertileWindowDates = useMemo(
    () => new Set(fertileWindow?.dates ?? []),
    [fertileWindow]
  );

  // Fire insight notifications when data changes
  useEffect(() => {
    if (!notifPrefs.enabled || !notifPrefs.insightsEnabled) return;
    if (!notificationsSupported() || getPermission() !== 'granted') return;

    const prevPhase = previousPhaseRef.current;
    previousPhaseRef.current = currentPhase;

    checkInsightNotifications({
      periods,
      predictedDate: predictedRange?.predictedDate ?? null,
      predictedOvulationDate: predictedRange?.predictedOvulationDate ?? null,
      fertileStart: fertileWindow?.start ?? null,
      fertileEnd: fertileWindow?.end ?? null,
      currentPhase: currentPhase ?? null,
      previousPhase: prevPhase,
      ovulationDetected: predictedRange?.ovulationSignal?.ovulationDetected ?? false,
      ovulationReason: predictedRange?.ovulationSignal?.reason ?? null,
      cycleAlert: cycleAlert ?? null,
      stressSleepWarning: stressSleepWarning ?? null,
    });
  }, [
    periods, predictedRange, fertileWindow, currentPhase,
    cycleAlert, stressSleepWarning, notifPrefs
  ]);

  const handleCalendarAction = async (date: string, entryId?: number) => {
    if (entryId) {
      const ok = await confirm({
        title: 'Delete this period entry?',
        description: `This removes the entry on ${date} and updates your predictions.`,
        confirmLabel: 'Delete',
        cancelLabel: 'Keep',
        danger: true,
      });
      if (ok) await removePeriod(entryId, date);
      return;
    }
    await addPeriodToStore(date);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <div className="badge">Tracking {periods.length} entries</div>
        </div>
        <button className="btn btn-primary" onClick={handleStartToday}>
          Add today’s start
        </button>
      </div>

      {error && <div className="alert alert-warn">⚠️ {error}</div>}
      {needsCheckinPrompt && (
        <div className="alert alert-info" style={{ justifyContent: 'space-between' }}>
          <span>Quick check-in? Takes 10 seconds.</span>
          <Link className="btn btn-ghost" to="/daily-log">
            Log now
          </Link>
        </div>
      )}
      {cycleAlert && <div className="alert">🧠 {cycleAlert}</div>}
      {skippedCycleWarning && (
        <div className="alert alert-danger" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
          <strong>🚨 Possible skipped cycle detected</strong>
          {skippedCycleWarning.currentSkipped && (
            <p style={{ margin: 0, fontSize: 14 }}>
              It has been <strong>{skippedCycleWarning.daysSinceLast} days</strong> since your last logged period.
              A gap longer than 45 days could indicate <strong>pregnancy</strong>, significant hormonal changes
              (e.g. PCOS, thyroid issues), or other medical conditions.
            </p>
          )}
          {skippedCycleWarning.skippedGaps.length > 0 && (
            <div style={{ fontSize: 13 }}>
              <p style={{ margin: '4px 0' }}>
                <strong>{skippedCycleWarning.skippedGaps.length} past gap{skippedCycleWarning.skippedGaps.length > 1 ? 's' : ''}</strong> longer than 45 days found in your history:
              </p>
              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                {skippedCycleWarning.skippedGaps.slice(0, 3).map((gap, i) => (
                  <li key={i}>
                    {new Date(gap.from).toLocaleDateString()} → {new Date(gap.to).toLocaleDateString()} ({gap.days} days)
                  </li>
                ))}
                {skippedCycleWarning.skippedGaps.length > 3 && (
                  <li>…and {skippedCycleWarning.skippedGaps.length - 3} more</li>
                )}
              </ul>
            </div>
          )}
          <p style={{ margin: '4px 0 0', fontSize: 13, opacity: 0.8 }}>
            If this is unexpected, consider taking a pregnancy test or consulting a healthcare provider.
          </p>
        </div>
      )}

      <div className="grid grid-2" style={{ marginTop: 20 }}>
        <CycleDayCounter
          lastPeriodDate={lastPeriod}
          averageCycleLength={averageCycleLength}
          currentPhase={currentPhase}
        />
        <PredictionCard predictedRange={predictedRange} loading={loading} />
      </div>

      <div className="grid grid-2" style={{ marginTop: 20 }}>
        <FertileWindowCard
          predictedOvulationDate={predictedRange?.predictedOvulationDate}
          lastPeriodDate={lastPeriod}
          averageCycleLength={averageCycleLength}
        />
        <div className="card">
          <p className="section-title">Latest recorded</p>
          <h2 style={{ margin: 0 }}>
            {lastPeriod ? new Date(lastPeriod).toDateString() : 'No entries yet'}
          </h2>
          <p style={{ color: 'var(--muted)', marginTop: 12 }}>
            Add more dates to improve your prediction accuracy.
          </p>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <Calendar
          periods={periods}
          periodEntries={periodEntries}
          predictedRange={predictedRange}
          dailyLogs={dailyLogs}
          predictedOvulationDate={predictedRange?.predictedOvulationDate}
          lastPeriodDate={lastPeriod}
          fertileWindowDates={fertileWindowDates}
          fertileOvulationDate={fertileWindow?.ovulationDate}
          onDateAction={handleCalendarAction}
        />
      </div>

      <div style={{ marginTop: 24 }}>
        <PhaseInsights
          phase={currentPhase}
          predictedOvulationDate={predictedRange?.predictedOvulationDate}
          ovulationSignal={predictedRange?.ovulationSignal}
          periods={periods}
          dailyLogs={dailyLogs}
        />
      </div>

      {/* Quick profile summary */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="profile-header">
          <div className="avatar-circle">
            <span className="avatar-emoji">{profile.avatar}</span>
          </div>
          <div>
            <p className="profile-label">Welcome</p>
            <h3 style={{ margin: 0 }}>Hi, {profile.userName}</h3>
          </div>
          <Link className="btn btn-ghost" to="/settings" style={{ marginLeft: 'auto' }}>
            ⚙️ Settings
          </Link>
        </div>
        <div style={{ marginTop: 16 }}>
          <p className="section-title">Last 10 period start dates</p>
          {lastTenDates.length === 0 ? (
            <div className="empty-state">No dates recorded yet.</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {lastTenDates.map((date) => (
                <span key={date} className="badge">
                  {new Date(date).toLocaleDateString()}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {dialog}
    </div>
  );
};
