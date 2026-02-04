import Dexie, { Table } from 'dexie';

interface Period {
  id?: number;
  startDate: string;
}

export type Mood = 'very_low' | 'low' | 'neutral' | 'good' | 'great';
export type Energy = 'low' | 'medium' | 'high';
export type Pain = 'none' | 'mild' | 'high';
export type Mucus = 'dry' | 'sticky' | 'creamy' | 'egg_white' | null;
export type SleepBand = 'lt6' | 'btw6_8' | 'gt8';
export type Stress = 'low' | 'normal' | 'high';
export type Flow = 'none' | 'light' | 'medium' | 'heavy';

export interface DailyLog {
  id?: number;
  userId: string;
  date: string;
  mood?: Mood;
  energy?: Energy;
  pain?: Pain;
  mucus?: Mucus;
  sleepBand?: SleepBand;
  stress?: Stress;
  flow?: Flow;
  createdAt: string;
}

export class PeriodDB extends Dexie {
  periods!: Table<Period>;
  daily_logs!: Table<DailyLog>;

  constructor() {
    super('periodDB');
    this.version(1).stores({
      periods: '++id, startDate'
    });
    this.version(2).stores({
      periods: '++id, startDate',
      daily_logs: '++id, date, userId'
    });
  }
}

export const db = new PeriodDB();

export async function addPeriod(date: string): Promise<number> {
  return db.periods.add({ startDate: date });
}

export async function getAllPeriods(): Promise<string[]> {
  const periods = await db.periods.toArray();
  return periods
    .map(p => p.startDate)
    .sort()
    .reverse();
}

export async function deletePeriod(id: number): Promise<void> {
  await db.periods.delete(id);
}

export async function getPeriodById(id: number): Promise<Period | undefined> {
  return db.periods.get(id);
}

export async function getAllPeriodsWithId(): Promise<Period[]> {
  return db.periods.toArray();
}

const DEFAULT_USER_ID = 'local-user';

export async function upsertDailyLog(log: Omit<DailyLog, 'id' | 'userId' | 'createdAt'> & Partial<Pick<DailyLog, 'id'>>): Promise<number> {
  const existing = await db.daily_logs.where('date').equals(log.date).first();
  const payload: DailyLog = {
    id: existing?.id ?? log.id,
    userId: DEFAULT_USER_ID,
    date: log.date,
    mood: log.mood,
    energy: log.energy,
    pain: log.pain,
    mucus: log.mucus ?? null,
    sleepBand: log.sleepBand,
    stress: log.stress,
    flow: log.flow ?? 'none',
    createdAt: existing?.createdAt ?? new Date().toISOString()
  };

  return db.daily_logs.put(payload);
}

export async function getDailyLogByDate(date: string): Promise<DailyLog | undefined> {
  return db.daily_logs.where('date').equals(date).first();
}

export async function getAllDailyLogs(): Promise<DailyLog[]> {
  return db.daily_logs.toArray();
}

export async function getRecentDailyLogs(days: number): Promise<DailyLog[]> {
  const since = new Date();
  since.setDate(since.getDate() - days + 1);
  const sinceDate = since.toISOString().split('T')[0];
  return db.daily_logs.where('date').aboveOrEqual(sinceDate).toArray();
}
