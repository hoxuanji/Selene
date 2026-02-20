import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { usePeriodStore } from '../store';
import { PredictionCard } from '../components/PredictionCard';
import { Calendar } from '../components/Calendar';
import { PhaseInsights } from '../components/PhaseInsights';
import { CycleDayCounter } from '../components/CycleDayCounter';
import { FertileWindowCard, computeFertileWindow } from '../components/FertileWindow';
import { getPhase } from '../utils/phaseEngine';
import {
  notificationsSupported,
  getPermission,
  requestPermission,
  getNotificationPrefs,
  saveNotificationPrefs,
  checkInsightNotifications,
  type NotificationPrefs,
} from '../utils/notifications';

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
    setProfile,
    dailyLogs,
    loadDailyLogsFromDB
  } = usePeriodStore();

  useEffect(() => {
    loadPeriodsFromDB();
    loadDailyLogsFromDB();
  }, []);

  /* ---- Notification settings ---- */
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(getNotificationPrefs);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(getPermission);

  const handleToggleNotifications = useCallback(async () => {
    if (!notificationsSupported()) return;

    if (!notifPrefs.enabled) {
      // Turning ON → request permission first
      const perm = await requestPermission();
      setNotifPermission(perm);
      if (perm !== 'granted') return;
    }

    const next: NotificationPrefs = { ...notifPrefs, enabled: !notifPrefs.enabled };
    saveNotificationPrefs(next);
    setNotifPrefs(next);
  }, [notifPrefs]);

  const handleReminderHourChange = useCallback(
    (hour: number) => {
      const next: NotificationPrefs = { ...notifPrefs, reminderHour: hour };
      saveNotificationPrefs(next);
      setNotifPrefs(next);
    },
    [notifPrefs]
  );

  const handleToggleInsights = useCallback(() => {
    const next: NotificationPrefs = { ...notifPrefs, insightsEnabled: !notifPrefs.insightsEnabled };
    saveNotificationPrefs(next);
    setNotifPrefs(next);
  }, [notifPrefs]);

  const previousPhaseRef = useRef<string | null>(null);

  const toLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleStartToday = async () => {
    const today = toLocalDateString(new Date());
    await addPeriodToStore(today);
  };

  const lastPeriod = useMemo(() => periods[0], [periods]);
  const lastTenDates = useMemo(() => periods.slice(0, 10), [periods]);
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

  const todayLog = useMemo(() => {
    const today = toLocalDateString(new Date());
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
    const diffDays = Math.round(
      (Date.now() - new Date(latestLog.date).getTime()) / (1000 * 60 * 60 * 24)
    );
    return diffDays >= 3;
  }, [dailyLogs]);

  const cycleAlert = useMemo(() => {
    if (periods.length < profile.minCyclesForAlerts) return null;
    const sorted = [...periods].sort();
    const recentDates = sorted.filter((date) => {
      const daysAgo = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24);
      return daysAgo <= profile.recentWindowDays;
    });
    const baseDates = recentDates.length >= 3 ? recentDates : sorted;

    const cycles: number[] = [];
    for (let i = 1; i < baseDates.length; i += 1) {
      const prev = new Date(baseDates[i - 1]).getTime();
      const curr = new Date(baseDates[i]).getTime();
      const diff = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
      cycles.push(diff);
    }
    if (cycles.length < profile.minCyclesForAlerts - 1) return null;

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
      profile.variationDays +
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
        ? profile.frequentCount + 1
        : profile.frequentCount;
    if (recentDates.length >= frequentThreshold) {
      return `You logged ${recentDates.length} entries in the last ${profile.recentWindowDays} days. If this feels unusual, consider tracking symptoms or consulting a clinician.`;
    }

    return null;
  }, [periods, profile]);

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
      if (window.confirm(`Delete period entry on ${date}?`)) {
        await removePeriod(entryId, date);
      }
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

      {error && <div className="alert">⚠️ {error}</div>}
      {needsCheckinPrompt && (
        <div className="alert" style={{ justifyContent: 'space-between' }}>
          <span>Quick check-in? Takes 10 seconds.</span>
          <Link className="btn btn-ghost" to="/daily-log">
            Log now
          </Link>
        </div>
      )}
      {cycleAlert && <div className="alert">🧠 {cycleAlert}</div>}

      {/* ===== Notification Settings ===== */}
      <div className="card" style={{ marginTop: 16 }}>
        <p className="section-title">🔔 Reminder Notifications</p>
        {!notificationsSupported() ? (
          <p style={{ color: '#6a6b76' }}>
            Your browser does not support notifications.
          </p>
        ) : (
          <>
            <div className="notif-row">
              <div>
                <strong>
                  {notifPrefs.enabled ? 'Reminders are on' : 'Reminders are off'}
                </strong>
                <p className="notif-desc">
                  {notifPrefs.enabled
                    ? `You'll get a gentle nudge if you haven't logged by ${formatHour(notifPrefs.reminderHour)}.`
                    : 'Enable to receive a daily check-in reminder through your browser.'}
                </p>
              </div>
              <button
                className={`btn ${notifPrefs.enabled ? 'btn-ghost' : 'btn-primary'}`}
                onClick={handleToggleNotifications}
              >
                {notifPrefs.enabled ? 'Turn off' : 'Turn on'}
              </button>
            </div>

            {notifPermission === 'denied' && (
              <div className="alert" style={{ marginTop: 12 }}>
                ⚠️ Notifications are blocked by your browser. Please allow them
                in your browser settings to enable reminders.
              </div>
            )}

            {notifPrefs.enabled && notifPermission === 'granted' && (
              <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                <label className="form-field" style={{ maxWidth: 220 }}>
                  <span className="label-icon">⏰</span> Reminder time
                  <select
                    className="input"
                    value={notifPrefs.reminderHour}
                    onChange={(e) => handleReminderHourChange(Number(e.target.value))}
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>
                        {formatHour(h)}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="notif-row" style={{ flex: 1, minWidth: 200 }}>
                  <div>
                    <strong>Cycle insights</strong>
                    <p className="notif-desc">
                      {notifPrefs.insightsEnabled
                        ? 'Notify about period approaching, fertile window, ovulation signals, and more.'
                        : 'Insight notifications are off.'}
                    </p>
                  </div>
                  <button
                    className={`btn ${notifPrefs.insightsEnabled ? 'btn-ghost' : 'btn-primary'}`}
                    style={{ whiteSpace: 'nowrap' }}
                    onClick={handleToggleInsights}
                  >
                    {notifPrefs.insightsEnabled ? 'Turn off' : 'Turn on'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

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
          <p style={{ color: '#6a6b76', marginTop: 12 }}>
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

      <div className="card" style={{ marginTop: 24 }}>
        <p className="section-title">Personalization</p>
        <div className="profile-header">
          <div className="avatar-circle">
            <span className="avatar-emoji">{profile.avatar}</span>
          </div>
          <div>
            <p className="profile-label">Welcome</p>
            <h3 style={{ margin: 0 }}>Hi, {profile.userName}</h3>
          </div>
          <div className="profile-actions">
            <select
              className="input"
              value={profile.avatar}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  avatar: e.target.value
                })
              }
            >
              <option value="🌸">🌸</option>
              <option value="🌼">🌼</option>
              <option value="🌙">🌙</option>
              <option value="⭐">⭐</option>
              <option value="🫶">🫶</option>
            </select>
          </div>
        </div>

        <div className="form-grid roomy">
          <label className="form-field">
            <span className="label-icon">📝</span> Name
            <input
              className="input"
              type="text"
              value={profile.userName}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  userName: e.target.value
                })
              }
            />
          </label>
          <label className="form-field">
            <span className="label-icon">🎂</span> Age group
            <select
              className="input"
              value={profile.ageGroup}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  ageGroup: e.target.value as typeof profile.ageGroup
                })
              }
            >
              <option value="under18">Under 18</option>
              <option value="18-24">18–24</option>
              <option value="25-34">25–34</option>
              <option value="35-44">35–44</option>
              <option value="45plus">45+</option>
            </select>
          </label>
          <label className="form-field">
            <span className="label-icon">🧬</span> PCOS
            <select
              className="input"
              value={profile.pcos ? 'yes' : 'no'}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  pcos: e.target.value === 'yes'
                })
              }
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>
          <label className="form-field">
            <span className="label-icon">🧪</span> Thyroid
            <select
              className="input"
              value={profile.thyroid ? 'yes' : 'no'}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  thyroid: e.target.value === 'yes'
                })
              }
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>
          <label className="form-field">
            <span className="label-icon">💊</span> Birth control
            <select
              className="input"
              value={profile.birthControl ? 'yes' : 'no'}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  birthControl: e.target.value === 'yes'
                })
              }
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>
          <label className="form-field">
            <span className="label-icon">👶</span> Postpartum
            <select
              className="input"
              value={profile.postpartum ? 'yes' : 'no'}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  postpartum: e.target.value === 'yes'
                })
              }
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>
          <label className="form-field">
            <span className="label-icon">🗓️</span> Postpartum (months)
            <input
              className="input"
              type="number"
              min={0}
              max={24}
              value={profile.postpartumMonths ?? ''}
              placeholder="0"
              onChange={(e) =>
                setProfile({
                  ...profile,
                  postpartumMonths: e.target.value ? Number(e.target.value) : null
                })
              }
            />
          </label>
          <label className="form-field">
            <span className="label-icon">📉</span> Shortest cycle you remember
            <input
              className="input"
              type="number"
              min={10}
              max={45}
              value={profile.shortestCycle ?? ''}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  shortestCycle: e.target.value ? Number(e.target.value) : null
                })
              }
            />
          </label>
          <label className="form-field">
            <span className="label-icon">📈</span> Longest cycle you remember
            <input
              className="input"
              type="number"
              min={20}
              max={80}
              value={profile.longestCycle ?? ''}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  longestCycle: e.target.value ? Number(e.target.value) : null
                })
              }
            />
          </label>
          <label className="form-field">
            <span className="label-icon">🩸</span> Typical period length (days)
            <input
              className="input"
              type="number"
              min={2}
              max={10}
              value={profile.typicalPeriodLength ?? ''}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  typicalPeriodLength: e.target.value ? Number(e.target.value) : null
                })
              }
            />
          </label>
          <label className="form-field">
            <span className="label-icon">✈️</span> Travel / timezone changes
            <select
              className="input"
              value={profile.travelRecent ? 'yes' : 'no'}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  travelRecent: e.target.value === 'yes'
                })
              }
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </label>
          <label className="form-field">
            <span className="label-icon">😴</span> Sleep (avg hours)
            <input
              className="input"
              type="number"
              min={3}
              max={12}
              value={profile.sleepHours ?? ''}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  sleepHours: e.target.value ? Number(e.target.value) : null
                })
              }
            />
          </label>
          <label className="form-field">
            <span className="label-icon">➖</span> Typical cycle min
            <input
              className="input"
              type="number"
              min={15}
              max={40}
              value={profile.normalMin}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  normalMin: Number(e.target.value)
                })
              }
            />
          </label>
          <label className="form-field">
            <span className="label-icon">➕</span> Typical cycle max
            <input
              className="input"
              type="number"
              min={21}
              max={50}
              value={profile.normalMax}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  normalMax: Number(e.target.value)
                })
              }
            />
          </label>
          <label className="form-field">
            <span className="label-icon">🎯</span> Variation allowance (days)
            <input
              className="input"
              type="number"
              min={3}
              max={14}
              value={profile.variationDays}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  variationDays: Number(e.target.value)
                })
              }
            />
          </label>
          <label className="form-field">
            <span className="label-icon">⏱️</span> Recent window (days)
            <input
              className="input"
              type="number"
              min={30}
              max={120}
              value={profile.recentWindowDays}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  recentWindowDays: Number(e.target.value)
                })
              }
            />
          </label>
          <label className="form-field">
            <span className="label-icon">🔔</span> Frequent entries alert (count)
            <input
              className="input"
              type="number"
              min={2}
              max={6}
              value={profile.frequentCount}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  frequentCount: Number(e.target.value)
                })
              }
            />
          </label>
          <label className="form-field">
            <span className="label-icon">🧭</span> Minimum cycles for alerts
            <input
              className="input"
              type="number"
              min={2}
              max={8}
              value={profile.minCyclesForAlerts}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  minCyclesForAlerts: Number(e.target.value)
                })
              }
            />
          </label>
        </div>
        <p style={{ color: '#6a6b76', marginTop: 12 }}>
          These settings update alerts dynamically based on your recent history.
        </p>
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

    </div>
  );
};

function formatHour(h: number): string {
  const suffix = h >= 12 ? 'PM' : 'AM';
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:00 ${suffix}`;
}
