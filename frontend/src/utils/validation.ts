export const toLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseLocalDate = (dateStr: string): Date | null => {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const todayLocalString = (): string => toLocalDateString(new Date());

export const isTodayOrPast = (dateStr: string): boolean => {
  const date = parseLocalDate(dateStr);
  if (!date) return false;
  const today = parseLocalDate(todayLocalString());
  if (!today) return false;
  return date.getTime() <= today.getTime();
};

export const isFutureDate = (dateStr: string): boolean => {
  const date = parseLocalDate(dateStr);
  if (!date) return true;
  const today = parseLocalDate(todayLocalString());
  if (!today) return true;
  return date.getTime() > today.getTime();
};

export const isWithinRange = (dateStr: string, startStr: string, endStr: string): boolean => {
  const date = parseLocalDate(dateStr);
  const start = parseLocalDate(startStr);
  const end = parseLocalDate(endStr);
  if (!date || !start || !end) return false;
  return date.getTime() >= start.getTime() && date.getTime() <= end.getTime();
};

export const getConsecutiveStreakLength = (dates: Set<string>, target: string): number => {
  if (!dates.has(target)) return 0;
  const base = parseLocalDate(target);
  if (!base) return 0;

  let length = 1;
  const backward = new Date(base);
  while (true) {
    backward.setDate(backward.getDate() - 1);
    const key = toLocalDateString(backward);
    if (!dates.has(key)) break;
    length += 1;
  }

  const forward = new Date(base);
  while (true) {
    forward.setDate(forward.getDate() + 1);
    const key = toLocalDateString(forward);
    if (!dates.has(key)) break;
    length += 1;
  }

  return length;
};