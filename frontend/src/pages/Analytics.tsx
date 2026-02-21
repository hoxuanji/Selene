import React, { useEffect, useMemo } from 'react';
import { usePeriodStore } from '../store';
import type { DailyLog } from '../db';

export const Analytics: React.FC = () => {
  const { periods, dailyLogs, loadPeriodsFromDB, loadDailyLogsFromDB } = usePeriodStore();

  useEffect(() => {
    loadPeriodsFromDB();
    loadDailyLogsFromDB();
  }, []);

  /* ---- Cycle lengths ---- */
  const cycleLengths = useMemo(() => {
    if (periods.length < 2) return [];
    const sorted = [...periods].sort();
    const lengths: { from: string; to: string; days: number }[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1]).getTime();
      const curr = new Date(sorted[i]).getTime();
      const days = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
      if (days >= 4) { // filter out consecutive period days
        lengths.push({ from: sorted[i - 1], to: sorted[i], days });
      }
    }
    return lengths;
  }, [periods]);

  const avgCycle = useMemo(() => {
    if (!cycleLengths.length) return null;
    return Math.round(cycleLengths.reduce((s, c) => s + c.days, 0) / cycleLengths.length);
  }, [cycleLengths]);

  const shortestCycle = useMemo(() =>
    cycleLengths.length ? Math.min(...cycleLengths.map(c => c.days)) : null, [cycleLengths]);

  const longestCycle = useMemo(() =>
    cycleLengths.length ? Math.max(...cycleLengths.map(c => c.days)) : null, [cycleLengths]);

  /* ---- Logging streak ---- */
  const streak = useMemo(() => {
    if (!dailyLogs.length) return 0;
    const sorted = [...dailyLogs].map(l => l.date).sort().reverse();
    const unique = [...new Set(sorted)];
    const today = toLocal(new Date());
    if (unique[0] !== today) return 0;
    let count = 1;
    for (let i = 1; i < unique.length; i++) {
      const prev = new Date(unique[i - 1]);
      prev.setDate(prev.getDate() - 1);
      if (toLocal(prev) === unique[i]) {
        count++;
      } else break;
    }
    return count;
  }, [dailyLogs]);

  /* ---- Symptom patterns by phase ---- */
  const symptomPatterns = useMemo(() => {
    if (dailyLogs.length < 5 || periods.length < 2) return null;
    const sorted = [...periods].sort();

    // Assign each log to a phase based on cycle day
    const phaseMap: Record<string, { moods: string[]; energy: string[]; pain: string[]; stress: string[] }> = {
      menstrual: { moods: [], energy: [], pain: [], stress: [] },
      follicular: { moods: [], energy: [], pain: [], stress: [] },
      ovulation: { moods: [], energy: [], pain: [], stress: [] },
      luteal: { moods: [], energy: [], pain: [], stress: [] },
    };

    for (const log of dailyLogs) {
      const logDate = new Date(log.date).getTime();
      // Find which cycle this log belongs to
      let cycleStart: string | null = null;
      let cycleLength = 28;
      for (let i = 0; i < sorted.length; i++) {
        const start = new Date(sorted[i]).getTime();
        if (start <= logDate) {
          cycleStart = sorted[i];
          if (i + 1 < sorted.length) {
            cycleLength = Math.round((new Date(sorted[i + 1]).getTime() - start) / (1000 * 60 * 60 * 24));
          }
        }
      }
      if (!cycleStart) continue;
      const cycleDay = Math.round((logDate - new Date(cycleStart).getTime()) / (1000 * 60 * 60 * 24)) + 1;

      let phase: string;
      if (cycleDay <= 5) phase = 'menstrual';
      else if (cycleDay <= Math.round(cycleLength * 0.45)) phase = 'follicular';
      else if (cycleDay <= Math.round(cycleLength * 0.55)) phase = 'ovulation';
      else phase = 'luteal';

      if (log.mood) phaseMap[phase].moods.push(log.mood);
      if (log.energy) phaseMap[phase].energy.push(log.energy);
      if (log.pain) phaseMap[phase].pain.push(log.pain);
      if (log.stress) phaseMap[phase].stress.push(log.stress);
    }

    // Find dominant values
    const dominant = (arr: string[]): string | null => {
      if (!arr.length) return null;
      const freq: Record<string, number> = {};
      arr.forEach(v => { freq[v] = (freq[v] || 0) + 1; });
      return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
    };

    return Object.entries(phaseMap).map(([phase, data]) => ({
      phase,
      mood: dominant(data.moods),
      energy: dominant(data.energy),
      pain: dominant(data.pain),
      stress: dominant(data.stress),
      logCount: data.moods.length + data.energy.length,
    }));
  }, [dailyLogs, periods]);

  /* ---- Mood trend (last 14 logs) ---- */
  const moodTrend = useMemo(() => {
    const withMood = dailyLogs.filter(l => l.mood).sort((a, b) => a.date < b.date ? -1 : 1).slice(-14);
    const moodScore: Record<string, number> = { very_low: 1, low: 2, neutral: 3, good: 4, great: 5 };
    return withMood.map(l => ({
      date: l.date,
      score: moodScore[l.mood!] || 3,
      label: l.mood!,
    }));
  }, [dailyLogs]);

  const chartMax = cycleLengths.length ? Math.max(...cycleLengths.map(c => c.days), 40) : 40;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <div className="badge">Your cycle insights</div>
        </div>
      </div>

      {/* ===== Streak ===== */}
      <div className="analytics-streak-card card" style={{ marginBottom: 20 }}>
        <div className="streak-hero">
          <span className="streak-flame">{streak > 0 ? '🔥' : '💤'}</span>
          <div>
            <div className="streak-number">{streak}</div>
            <div className="streak-label">day logging streak</div>
          </div>
        </div>
        {streak >= 7 && <div className="streak-badge">🏆 Amazing consistency!</div>}
        {streak >= 3 && streak < 7 && <div className="streak-badge">⭐ Keep it up!</div>}
        {streak === 0 && <div className="streak-badge" style={{ background: '#fff3e0', color: '#e65100' }}>Log today to start a streak</div>}
      </div>

      {/* ===== Summary Cards ===== */}
      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card analytics-stat">
          <div className="analytics-stat-label">Average Cycle</div>
          <div className="analytics-stat-value">{avgCycle ? `${avgCycle} days` : '—'}</div>
        </div>
        <div className="card analytics-stat">
          <div className="analytics-stat-label">Cycles Tracked</div>
          <div className="analytics-stat-value">{cycleLengths.length || '—'}</div>
        </div>
        <div className="card analytics-stat">
          <div className="analytics-stat-label">Shortest</div>
          <div className="analytics-stat-value">{shortestCycle ? `${shortestCycle} days` : '—'}</div>
        </div>
        <div className="card analytics-stat">
          <div className="analytics-stat-label">Longest</div>
          <div className="analytics-stat-value">{longestCycle ? `${longestCycle} days` : '—'}</div>
        </div>
      </div>

      {/* ===== Cycle Length Chart ===== */}
      <div className="card" style={{ marginBottom: 20 }}>
        <p className="section-title">📊 Cycle Length Trend</p>
        {cycleLengths.length < 2 ? (
          <div className="empty-state">Add more period dates to see your cycle trend chart.</div>
        ) : (
          <div className="cycle-chart">
            <div className="chart-avg-line" style={{ bottom: `${((avgCycle || 28) / chartMax) * 100}%` }}>
              <span className="chart-avg-label">avg {avgCycle}d</span>
            </div>
            <div className="chart-bars">
              {cycleLengths.map((c, i) => (
                <div key={i} className="chart-bar-col">
                  <div
                    className={`chart-bar ${c.days < 21 || c.days > 45 ? 'chart-bar-warn' : ''}`}
                    style={{ height: `${(c.days / chartMax) * 100}%` }}
                  >
                    <span className="chart-bar-value">{c.days}</span>
                  </div>
                  <span className="chart-bar-label">
                    {new Date(c.to).toLocaleDateString('en-US', { month: 'short' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ===== Mood Trend ===== */}
      <div className="card" style={{ marginBottom: 20 }}>
        <p className="section-title">😊 Mood Trend (Last 14 Logs)</p>
        {moodTrend.length < 3 ? (
          <div className="empty-state">Log more daily check-ins to see your mood trend.</div>
        ) : (
          <div className="mood-chart">
            <div className="mood-chart-labels">
              <span>😄</span><span>🙂</span><span>😐</span><span>😕</span><span>😞</span>
            </div>
            <div className="mood-chart-area">
              <svg viewBox={`0 0 ${moodTrend.length * 40} 100`} className="mood-svg" preserveAspectRatio="none">
                <polyline
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={moodTrend.map((m, i) => `${i * 40 + 20},${100 - ((m.score - 1) / 4) * 80 - 10}`).join(' ')}
                />
                {moodTrend.map((m, i) => (
                  <circle
                    key={i}
                    cx={i * 40 + 20}
                    cy={100 - ((m.score - 1) / 4) * 80 - 10}
                    r="4"
                    fill="var(--primary)"
                  />
                ))}
              </svg>
              <div className="mood-chart-dates">
                {moodTrend.map((m, i) => (
                  <span key={i}>{new Date(m.date).getDate()}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== Symptom Patterns by Phase ===== */}
      <div className="card" style={{ marginBottom: 20 }}>
        <p className="section-title">🧠 Symptom Patterns by Phase</p>
        {!symptomPatterns || symptomPatterns.every(p => p.logCount === 0) ? (
          <div className="empty-state">Log daily check-ins across a full cycle to see patterns.</div>
        ) : (
          <div className="pattern-grid">
            {symptomPatterns.map((p) => (
              <div key={p.phase} className={`pattern-card pattern-${p.phase}`}>
                <div className="pattern-phase">
                  {phaseEmoji(p.phase)} {p.phase.charAt(0).toUpperCase() + p.phase.slice(1)}
                </div>
                <div className="pattern-items">
                  {p.mood && <span className="pattern-chip">Mood: {formatValue(p.mood)}</span>}
                  {p.energy && <span className="pattern-chip">Energy: {formatValue(p.energy)}</span>}
                  {p.pain && <span className="pattern-chip">Pain: {formatValue(p.pain)}</span>}
                  {p.stress && <span className="pattern-chip">Stress: {formatValue(p.stress)}</span>}
                  {!p.mood && !p.energy && !p.pain && !p.stress && (
                    <span className="pattern-chip" style={{ opacity: 0.5 }}>No data yet</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== Cycle History Table ===== */}
      <div className="card">
        <p className="section-title">📋 Cycle History</p>
        {cycleLengths.length === 0 ? (
          <div className="empty-state">Need at least 2 period entries to compute cycles.</div>
        ) : (
          <div className="cycle-table-wrap">
            <table className="cycle-table">
              <thead>
                <tr>
                  <th>Cycle</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Length</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {cycleLengths.map((c, i) => (
                  <tr key={i}>
                    <td>#{cycleLengths.length - i}</td>
                    <td>{fmtDate(c.from)}</td>
                    <td>{fmtDate(c.to)}</td>
                    <td><strong>{c.days}d</strong></td>
                    <td>
                      {c.days >= 21 && c.days <= 35 ? (
                        <span className="status-badge status-normal">Normal</span>
                      ) : c.days > 35 && c.days <= 45 ? (
                        <span className="status-badge status-long">Long</span>
                      ) : c.days > 45 ? (
                        <span className="status-badge status-warn">Skipped?</span>
                      ) : (
                        <span className="status-badge status-short">Short</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

/* ---- Helpers ---- */
function toLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

function phaseEmoji(phase: string) {
  const map: Record<string, string> = { menstrual: '🔴', follicular: '🔵', ovulation: '🟢', luteal: '🟣' };
  return map[phase] || '⚪';
}

function formatValue(v: string) {
  return v.replace(/_/g, ' ').replace(/\blt(\d)/g, '<$1').replace(/\bbtw/g, '').replace(/\bgt(\d)/g, '>$1');
}
