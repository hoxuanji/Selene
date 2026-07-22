import React, { useCallback, useState } from 'react';
import { usePeriodStore } from '../store';
import {
  notificationsSupported,
  getPermission,
  requestPermission,
  getNotificationPrefs,
  saveNotificationPrefs,
  type NotificationPrefs,
} from '../utils/notifications';
import { getAllPeriods, getAllDailyLogs, bulkAddPeriods, upsertDailyLog } from '../db';
import { Toggle } from '../components/Toggle';

export const Settings: React.FC = () => {
  const { profile, setProfile, periods, dailyLogs } = usePeriodStore();

  /* ---- Collapse states ---- */
  const [showProfile, setShowProfile] = useState(false);
  const [showMedical, setShowMedical] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showData, setShowData] = useState(false);

  /* ---- Notification settings ---- */
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(getNotificationPrefs);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(getPermission);

  const handleToggleNotifications = useCallback(async () => {
    if (!notificationsSupported()) return;
    if (!notifPrefs.enabled) {
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

  /* ---- Data Export ---- */
  const handleExportJSON = async () => {
    const allPeriods = await getAllPeriods();
    const allLogs = await getAllDailyLogs();
    const data = {
      exportedAt: new Date().toISOString(),
      app: 'Selene',
      profile,
      periods: allPeriods,
      dailyLogs: allLogs,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `selene-backup-${todayStr()}.json`);
  };

  const handleExportCSV = async () => {
    const allPeriods = await getAllPeriods();
    const allLogs = await getAllDailyLogs();

    let csv = 'Type,Date,Mood,Energy,Pain,Mucus,Sleep,Stress,Flow,Notes\n';
    for (const p of allPeriods) {
      const log = allLogs.find(l => l.date === p);
      csv += `period,${p},${log?.mood || ''},${log?.energy || ''},${log?.pain || ''},${log?.mucus || ''},${log?.sleepBand || ''},${log?.stress || ''},${log?.flow || ''},${(log as any)?.notes ? '"' + (log as any).notes.replace(/"/g, '""') + '"' : ''}\n`;
    }
    for (const log of allLogs) {
      if (allPeriods.includes(log.date)) continue;
      csv += `log,${log.date},${log.mood || ''},${log.energy || ''},${log.pain || ''},${log.mucus || ''},${log.sleepBand || ''},${log.stress || ''},${log.flow || ''},${(log as any)?.notes ? '"' + (log as any).notes.replace(/"/g, '""') + '"' : ''}\n`;
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    downloadBlob(blob, `selene-export-${todayStr()}.csv`);
  };

  const handleImportJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.periods || !Array.isArray(data.periods)) {
          alert('Invalid backup file: missing periods array.');
          return;
        }
        const { setProfile: sp, loadPeriodsFromDB, loadDailyLogsFromDB } = usePeriodStore.getState();
        if (data.profile) sp(data.profile);
        // Bulk-write directly so a restore never loses entries or fires a
        // prediction per date (dedupes against anything already stored).
        const addedPeriods = await bulkAddPeriods(data.periods);
        let addedLogs = 0;
        if (Array.isArray(data.dailyLogs)) {
          for (const log of data.dailyLogs) {
            await upsertDailyLog(log);
            addedLogs += 1;
          }
        }
        await loadPeriodsFromDB();
        await loadDailyLogsFromDB();
        alert(
          `Imported ${addedPeriods} period entr${addedPeriods === 1 ? 'y' : 'ies'} and ${addedLogs} daily log${addedLogs === 1 ? '' : 's'}.`
        );
      } catch {
        alert('Failed to read the backup file. Make sure it is a valid Selene JSON export.');
      }
    };
    input.click();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <div className="badge">Customize your experience</div>
        </div>
      </div>

      {/* ===== Profile ===== */}
      <div className="card settings-section" style={{ marginBottom: 16 }}>
        <button className="settings-toggle" aria-expanded={showProfile} onClick={() => setShowProfile(!showProfile)}>
          <span>👤 Profile &amp; Personalization</span>
          <span className="toggle-arrow" aria-hidden="true">{showProfile ? '▲' : '▼'}</span>
        </button>
        {showProfile && (
          <div className="settings-body">
            <div className="profile-header" style={{ marginBottom: 16 }}>
              <div className="avatar-circle">
                <span className="avatar-emoji">{profile.avatar}</span>
              </div>
              <div>
                <p className="profile-label">Welcome</p>
                <h3 style={{ margin: 0 }}>Hi, {profile.userName}</h3>
              </div>
            </div>
            <div className="form-grid roomy">
              <label className="form-field">
                <span className="label-icon">📝</span> Name
                <input className="input" type="text" value={profile.userName}
                  onChange={(e) => setProfile({ ...profile, userName: e.target.value })} />
              </label>
              <label className="form-field">
                <span className="label-icon">🎨</span> Avatar
                <select className="input" value={profile.avatar}
                  onChange={(e) => setProfile({ ...profile, avatar: e.target.value })}>
                  <option value="🌸">🌸</option>
                  <option value="🌼">🌼</option>
                  <option value="🌙">🌙</option>
                  <option value="⭐">⭐</option>
                  <option value="🫶">🫶</option>
                </select>
              </label>
              <label className="form-field">
                <span className="label-icon">🎂</span> Age group
                <select className="input" value={profile.ageGroup}
                  onChange={(e) => setProfile({ ...profile, ageGroup: e.target.value as typeof profile.ageGroup })}>
                  <option value="under18">Under 18</option>
                  <option value="18-24">18–24</option>
                  <option value="25-34">25–34</option>
                  <option value="35-44">35–44</option>
                  <option value="45plus">45+</option>
                </select>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* ===== Medical ===== */}
      <div className="card settings-section" style={{ marginBottom: 16 }}>
        <button className="settings-toggle" aria-expanded={showMedical} onClick={() => setShowMedical(!showMedical)}>
          <span>🩺 Medical &amp; Conditions</span>
          <span className="toggle-arrow" aria-hidden="true">{showMedical ? '▲' : '▼'}</span>
        </button>
        {showMedical && (
          <div className="settings-body">
            <div className="form-grid roomy">
              <div className="toggle-field">
                <span><span className="label-icon" aria-hidden="true">🧬</span> PCOS</span>
                <Toggle checked={profile.pcos} label="PCOS" onChange={(v) => setProfile({ ...profile, pcos: v })} />
              </div>
              <div className="toggle-field">
                <span><span className="label-icon" aria-hidden="true">🧪</span> Thyroid</span>
                <Toggle checked={profile.thyroid} label="Thyroid condition" onChange={(v) => setProfile({ ...profile, thyroid: v })} />
              </div>
              <div className="toggle-field">
                <span><span className="label-icon" aria-hidden="true">💊</span> Birth control</span>
                <Toggle checked={profile.birthControl} label="Birth control" onChange={(v) => setProfile({ ...profile, birthControl: v })} />
              </div>
              <div className="toggle-field">
                <span><span className="label-icon" aria-hidden="true">👶</span> Postpartum</span>
                <Toggle checked={profile.postpartum} label="Postpartum" onChange={(v) => setProfile({ ...profile, postpartum: v })} />
              </div>
              {profile.postpartum && (
                <label className="form-field">
                  <span className="label-icon">🗓️</span> Postpartum (months)
                  <input className="input" type="number" min={0} max={24}
                    value={profile.postpartumMonths ?? ''}
                    placeholder="0"
                    onChange={(e) => setProfile({ ...profile, postpartumMonths: e.target.value ? Number(e.target.value) : null })} />
                </label>
              )}
              <div className="toggle-field">
                <span><span className="label-icon" aria-hidden="true">✈️</span> Travel / timezone changes</span>
                <Toggle checked={profile.travelRecent} label="Recent travel or timezone changes" onChange={(v) => setProfile({ ...profile, travelRecent: v })} />
              </div>
              <label className="form-field">
                <span className="label-icon">😴</span> Sleep (avg hours)
                <input className="input" type="number" min={3} max={12}
                  value={profile.sleepHours ?? ''} placeholder="7"
                  onChange={(e) => setProfile({ ...profile, sleepHours: e.target.value ? Number(e.target.value) : null })} />
              </label>
            </div>
          </div>
        )}
      </div>

      {/* ===== Cycle Bounds ===== */}
      <div className="card settings-section" style={{ marginBottom: 16 }}>
        <button className="settings-toggle" aria-expanded={showAlerts} onClick={() => setShowAlerts(!showAlerts)}>
          <span>🎯 Cycle Bounds</span>
          <span className="toggle-arrow" aria-hidden="true">{showAlerts ? '▲' : '▼'}</span>
        </button>
        {showAlerts && (
          <div className="settings-body">
            <div className="form-grid roomy">
              <label className="form-field">
                <span className="label-icon">📉</span> Shortest cycle
                <input className="input" type="number" min={10} max={45}
                  value={profile.shortestCycle ?? ''}
                  onChange={(e) => setProfile({ ...profile, shortestCycle: e.target.value ? Number(e.target.value) : null })} />
              </label>
              <label className="form-field">
                <span className="label-icon">📈</span> Longest cycle
                <input className="input" type="number" min={20} max={80}
                  value={profile.longestCycle ?? ''}
                  onChange={(e) => setProfile({ ...profile, longestCycle: e.target.value ? Number(e.target.value) : null })} />
              </label>
              <label className="form-field">
                <span className="label-icon">➖</span> Typical cycle min
                <input className="input" type="number" min={15} max={40}
                  value={profile.normalMin}
                  onChange={(e) => setProfile({ ...profile, normalMin: Number(e.target.value) })} />
              </label>
              <label className="form-field">
                <span className="label-icon">➕</span> Typical cycle max
                <input className="input" type="number" min={21} max={50}
                  value={profile.normalMax}
                  onChange={(e) => setProfile({ ...profile, normalMax: Number(e.target.value) })} />
              </label>
            </div>
            <p style={{ color: 'var(--muted)', marginTop: 12, fontSize: 13 }}>
              These bounds tune the “unusual cycle” alerts against your recent history.
            </p>
          </div>
        )}
      </div>

      {/* ===== Notifications ===== */}
      <div className="card settings-section" style={{ marginBottom: 16 }}>
        <button className="settings-toggle" aria-expanded={showNotifs} onClick={() => setShowNotifs(!showNotifs)}>
          <span>🔔 Reminder Notifications</span>
          <span className="toggle-arrow" aria-hidden="true">{showNotifs ? '▲' : '▼'}</span>
        </button>
        {showNotifs && (
          <div className="settings-body">
            {!notificationsSupported() ? (
              <p style={{ color: 'var(--muted)' }}>Your browser does not support notifications.</p>
            ) : (
              <>
                <div className="notif-row">
                  <div>
                    <strong>{notifPrefs.enabled ? 'Reminders are on' : 'Reminders are off'}</strong>
                    <p className="notif-desc">
                      {notifPrefs.enabled
                        ? `You'll get a gentle nudge if you haven't logged by ${formatHour(notifPrefs.reminderHour)}.`
                        : 'Enable to receive a daily check-in reminder.'}
                    </p>
                  </div>
                  <button className={`btn ${notifPrefs.enabled ? 'btn-ghost' : 'btn-primary'}`}
                    onClick={handleToggleNotifications}>
                    {notifPrefs.enabled ? 'Turn off' : 'Turn on'}
                  </button>
                </div>
                {notifPermission === 'denied' && (
                  <div className="alert" style={{ marginTop: 12 }}>
                    ⚠️ Notifications are blocked. Please allow them in your browser settings.
                  </div>
                )}
                {notifPrefs.enabled && notifPermission === 'granted' && (
                  <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                    <label className="form-field" style={{ maxWidth: 220 }}>
                      <span className="label-icon">⏰</span> Reminder time
                      <select className="input" value={notifPrefs.reminderHour}
                        onChange={(e) => handleReminderHourChange(Number(e.target.value))}>
                        {Array.from({ length: 24 }, (_, h) => (
                          <option key={h} value={h}>{formatHour(h)}</option>
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
                      <button className={`btn ${notifPrefs.insightsEnabled ? 'btn-ghost' : 'btn-primary'}`}
                        style={{ whiteSpace: 'nowrap' }} onClick={handleToggleInsights}>
                        {notifPrefs.insightsEnabled ? 'Turn off' : 'Turn on'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ===== Data Export / Import ===== */}
      <div className="card settings-section" style={{ marginBottom: 16 }}>
        <button className="settings-toggle" aria-expanded={showData} onClick={() => setShowData(!showData)}>
          <span>💾 Data &amp; Backup</span>
          <span className="toggle-arrow" aria-hidden="true">{showData ? '▲' : '▼'}</span>
        </button>
        {showData && (
          <div className="settings-body">
            <p style={{ color: 'var(--muted)', margin: '0 0 16px', fontSize: 14 }}>
              Your data stays on this device. Export a backup to keep it safe or transfer to another device.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              <button className="btn btn-primary" onClick={handleExportJSON}>
                📥 Export JSON
              </button>
              <button className="btn btn-primary" onClick={handleExportCSV}>
                📊 Export CSV
              </button>
              <button className="btn btn-ghost" onClick={handleImportJSON}>
                📤 Import Backup
              </button>
            </div>
            <p style={{ color: 'var(--muted)', marginTop: 12, fontSize: 12 }}>
              {periods.length} period entries · {dailyLogs.length} daily logs
            </p>
          </div>
        )}
      </div>

      {/* ===== Appearance ===== */}
      <div className="card settings-section" style={{ marginBottom: 16 }}>
        <div className="settings-toggle" style={{ cursor: 'default' }}>
          <span>🎨 Appearance</span>
          <ThemeToggle />
        </div>
      </div>

      {/* ===== Medical disclaimer ===== */}
      <p className="medical-disclaimer">
        Selene is for general wellness tracking only. Predictions and fertile-window
        estimates are informational, not a form of contraception or medical advice,
        and can be inaccurate. Consult a healthcare provider for medical concerns.
      </p>
    </div>
  );
};

/* ---- Theme toggle component ---- */
const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('selene-theme') as any) || 'system';
  });

  const apply = (t: 'light' | 'dark' | 'system') => {
    setTheme(t);
    localStorage.setItem('selene-theme', t);
    const root = document.documentElement;
    if (t === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', t);
    }
  };

  return (
    <div className="theme-toggle">
      {(['light', 'system', 'dark'] as const).map((t) => (
        <button
          key={t}
          className={`theme-btn ${theme === t ? 'theme-btn-active' : ''}`}
          onClick={() => apply(t)}
        >
          {t === 'light' ? '☀️' : t === 'dark' ? '🌙' : '💻'} {t.charAt(0).toUpperCase() + t.slice(1)}
        </button>
      ))}
    </div>
  );
};

/* ---- Helpers ---- */
function formatHour(h: number): string {
  const suffix = h >= 12 ? 'PM' : 'AM';
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:00 ${suffix}`;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
