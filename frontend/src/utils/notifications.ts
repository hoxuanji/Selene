/**
 * Web Notifications API helper for daily check-in reminders
 * and cycle-insight notifications.
 *
 * Uses the browser Notification API and a periodic check via
 * setInterval / visibilitychange to nudge the user when they
 * haven't logged today.
 */

const STORAGE_KEY = 'notification_prefs';
const LAST_NOTIFIED_KEY = 'last_notification_date';
const INSIGHT_NOTIFIED_KEY = 'insight_notifications_sent';

export interface NotificationPrefs {
  enabled: boolean;
  /** 24-h hour to send the reminder (default 20 = 8 PM) */
  reminderHour: number;
  /** Also send insight-based notifications (period approaching, fertile window, etc.) */
  insightsEnabled: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  enabled: false,
  reminderHour: 20,
  insightsEnabled: true,
};

/* ---------- preference persistence ---------- */

export function getNotificationPrefs(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function saveNotificationPrefs(prefs: NotificationPrefs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

/* ---------- permission ---------- */

export function notificationsSupported(): boolean {
  return 'Notification' in window;
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied';
  return Notification.requestPermission();
}

export function getPermission(): NotificationPermission {
  if (!notificationsSupported()) return 'denied';
  return Notification.permission;
}

/* ---------- sending ---------- */

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function alreadyNotifiedToday(): boolean {
  return localStorage.getItem(LAST_NOTIFIED_KEY) === todayString();
}

function markNotifiedToday(): void {
  localStorage.setItem(LAST_NOTIFIED_KEY, todayString());
}

export function sendCheckinReminder(): void {
  if (!notificationsSupported()) return;
  if (Notification.permission !== 'granted') return;
  if (alreadyNotifiedToday()) return;

  const prefs = getNotificationPrefs();
  if (!prefs.enabled) return;

  const now = new Date();
  if (now.getHours() < prefs.reminderHour) return;

  new Notification('🌙 Selene — Daily check-in', {
    body: "Take 10 seconds to log how you're feeling today.",
    icon: '/favicon.ico',
    tag: 'daily-checkin', // prevents duplicate notifications
  });

  markNotifiedToday();
}

/* ---------- auto-check loop ---------- */

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Starts a lightweight interval (every 15 min) that fires a
 * notification if the user hasn't logged today and the preferred
 * hour has passed.  Also hooks into `visibilitychange` so we
 * check when the user returns to the tab.
 *
 * Call `hasLoggedToday` to tell the checker whether today already
 * has a daily-log entry — if so, no notification is sent.
 */
export function startReminderCheck(hasLoggedToday: () => boolean): () => void {
  const check = () => {
    if (hasLoggedToday()) return;
    sendCheckinReminder();
  };

  // initial check
  check();

  // periodic check every 15 minutes
  intervalId = setInterval(check, 15 * 60 * 1000);

  // also check when the tab becomes visible again
  const onVisibility = () => {
    if (document.visibilityState === 'visible') check();
  };
  document.addEventListener('visibilitychange', onVisibility);

  // cleanup function
  return () => {
    if (intervalId) clearInterval(intervalId);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

/* ========== Insight notifications ========== */

export type InsightType =
  | 'period-approaching'
  | 'period-today'
  | 'fertile-window-starting'
  | 'fertile-window-active'
  | 'ovulation-detected'
  | 'cycle-alert'
  | 'phase-change'
  | 'stress-sleep-warning';

interface InsightSentMap {
  /** Keys are `${InsightType}:${YYYY-MM-DD}` */
  [key: string]: true;
}

function getInsightsSent(): InsightSentMap {
  try {
    const raw = localStorage.getItem(INSIGHT_NOTIFIED_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function markInsightSent(type: InsightType, dateKey?: string): void {
  const key = `${type}:${dateKey ?? todayString()}`;
  const map = getInsightsSent();
  map[key] = true;

  // Prune entries older than 7 days to prevent unbounded growth
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  for (const k of Object.keys(map)) {
    const d = k.split(':').pop() ?? '';
    if (d < cutoffStr) delete map[k];
  }

  localStorage.setItem(INSIGHT_NOTIFIED_KEY, JSON.stringify(map));
}

function wasInsightSent(type: InsightType, dateKey?: string): boolean {
  const key = `${type}:${dateKey ?? todayString()}`;
  return getInsightsSent()[key] === true;
}

function sendInsight(type: InsightType, title: string, body: string, dateKey?: string): void {
  if (!notificationsSupported()) return;
  if (Notification.permission !== 'granted') return;

  const prefs = getNotificationPrefs();
  if (!prefs.enabled || !prefs.insightsEnabled) return;
  if (wasInsightSent(type, dateKey)) return;

  new Notification(title, {
    body,
    icon: '/favicon.ico',
    tag: `insight-${type}`,
  });

  markInsightSent(type, dateKey);
}

export interface InsightCheckInput {
  /** Sorted descending period start dates */
  periods: string[];
  predictedDate?: string | null;
  predictedOvulationDate?: string | null;
  fertileStart?: string | null;
  fertileEnd?: string | null;
  currentPhase?: string | null;
  previousPhase?: string | null;
  ovulationDetected?: boolean;
  ovulationReason?: string | null;
  cycleAlert?: string | null;
  stressSleepWarning?: string | null;
}

/**
 * Evaluate the current cycle data and fire any applicable insight
 * notifications. Safe to call frequently — each insight is sent at
 * most once per relevant date.
 */
export function checkInsightNotifications(input: InsightCheckInput): void {
  const prefs = getNotificationPrefs();
  if (!prefs.enabled || !prefs.insightsEnabled) return;
  if (!notificationsSupported() || Notification.permission !== 'granted') return;

  const today = todayString();

  // 1. Period predicted today
  if (input.predictedDate === today) {
    sendInsight(
      'period-today',
      '🩸 Period may start today',
      'Your predicted period start date is today. Be prepared!',
      today
    );
  }

  // 2. Period approaching (1–3 days away)
  if (input.predictedDate && input.predictedDate > today) {
    const daysUntil = daysBetween(today, input.predictedDate);
    if (daysUntil > 0 && daysUntil <= 3) {
      sendInsight(
        'period-approaching',
        '📅 Period approaching',
        `Your period is predicted in ${daysUntil} day${daysUntil > 1 ? 's' : ''}. Time to prepare!`,
        today
      );
    }
  }

  // 3. Fertile window starting tomorrow or today
  if (input.fertileStart) {
    const daysToFertile = daysBetween(today, input.fertileStart);
    if (daysToFertile === 1) {
      sendInsight(
        'fertile-window-starting',
        '🌿 Fertile window starts tomorrow',
        'Your estimated fertile window begins tomorrow.',
        input.fertileStart
      );
    } else if (daysToFertile === 0) {
      sendInsight(
        'fertile-window-active',
        '🌿 Fertile window is active',
        'You are in your estimated fertile window today.',
        input.fertileStart
      );
    }
  }

  // 4. Ovulation signal detected
  if (input.ovulationDetected) {
    const reason = input.ovulationReason === 'mucus'
      ? 'egg-white cervical mucus'
      : input.ovulationReason === 'pain'
      ? 'mid-cycle pain near your predicted date'
      : 'your logged symptoms';
    sendInsight(
      'ovulation-detected',
      '🥚 Ovulation signal detected',
      `Possible ovulation based on ${reason}.`,
      today
    );
  }

  // 5. Cycle irregularity alert
  if (input.cycleAlert) {
    sendInsight(
      'cycle-alert',
      '🧠 Cycle insight',
      input.cycleAlert,
      today
    );
  }

  // 6. Phase change
  if (input.currentPhase && input.previousPhase && input.currentPhase !== input.previousPhase) {
    const phaseLabels: Record<string, string> = {
      menstrual: 'Menstrual',
      follicular: 'Follicular',
      ovulation: 'Ovulation',
      luteal: 'Luteal',
    };
    const label = phaseLabels[input.currentPhase] ?? input.currentPhase;
    sendInsight(
      'phase-change',
      `🌙 Phase shift → ${label}`,
      `You've entered the ${label.toLowerCase()} phase of your cycle.`,
      today
    );
  }

  // 7. Stress / sleep warning
  if (input.stressSleepWarning) {
    sendInsight(
      'stress-sleep-warning',
      '💤 Lifestyle heads-up',
      input.stressSleepWarning,
      today
    );
  }
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a);
  const db = new Date(b);
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}
