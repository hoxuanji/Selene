/**
 * Web Notifications API helper for daily check-in reminders.
 *
 * Uses the browser Notification API and a periodic check via
 * setInterval / visibilitychange to nudge the user when they
 * haven't logged today.
 */

const STORAGE_KEY = 'notification_prefs';
const LAST_NOTIFIED_KEY = 'last_notification_date';

export interface NotificationPrefs {
  enabled: boolean;
  /** 24-h hour to send the reminder (default 20 = 8 PM) */
  reminderHour: number;
}

const DEFAULT_PREFS: NotificationPrefs = {
  enabled: false,
  reminderHour: 20,
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
