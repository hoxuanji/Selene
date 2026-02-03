import Dexie, { Table } from 'dexie';

interface Period {
  id?: number;
  startDate: string;
}

export class PeriodDB extends Dexie {
  periods!: Table<Period>;

  constructor() {
    super('periodDB');
    this.version(1).stores({
      periods: '++id, startDate'
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
