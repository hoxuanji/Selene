import { create } from 'zustand';
import {
  addPeriod,
  getAllPeriodsWithId,
  deletePeriod,
  getAllDailyLogs,
  upsertDailyLog as upsertDailyLogDB,
  DailyLog
} from './db';
import { adjustConfidence, adjustPredictionWindow } from './utils/confidenceAdjuster';
import { detectOvulationFromLogs, OvulationSignal } from './utils/ovulationSignals';
import { predictNextPeriod, type BasePrediction } from './utils/predictor';
import {
  getConsecutiveStreakLength,
  isFutureDate,
  isTodayOrPast,
  isWithinRange,
  parseLocalDate,
  toLocalDateString,
  todayLocalString
} from './utils/validation';

export interface PredictionRange {
  predictedDate: string;
  earliest: string;
  latest: string;
  confidence: number;
  baseConfidence?: number;
  adjustmentNote?: string;
  predictedOvulationDate?: string;
  ovulationSignal?: OvulationSignal;
}

export interface AlertProfile {
  userName: string;
  avatar: string;
  normalMin: number;
  normalMax: number;
  ageGroup: 'under18' | '18-24' | '25-34' | '35-44' | '45plus';
  pcos: boolean;
  thyroid: boolean;
  postpartum: boolean;
  postpartumMonths: number | null;
  birthControl: boolean;
  shortestCycle: number | null;
  longestCycle: number | null;
  travelRecent: boolean;
  sleepHours: number | null;
}

interface PeriodStore {
  periods: string[];
  periodEntries: { id: number; startDate: string }[];
  predictedRange: PredictionRange | null;
  loading: boolean;
  error: string | null;
  profile: AlertProfile;
  dailyLogs: DailyLog[];
  dailyLogsLoading: boolean;
  dailyLogsError: string | null;
  
  loadPeriodsFromDB: () => Promise<void>;
  addPeriodToStore: (date: string) => Promise<void>;
  fetchPrediction: () => Promise<void>;
  removePeriod: (id: number, date?: string) => Promise<void>;
  setPeriods: (periods: string[]) => void;
  setError: (message: string | null) => void;
  setProfile: (profile: AlertProfile) => void;
  loadDailyLogsFromDB: () => Promise<void>;
  upsertDailyLog: (log: DailyLog) => Promise<void>;
}

const DEFAULT_PROFILE: AlertProfile = {
  userName: 'Friend',
  avatar: '🌸',
  normalMin: 21,
  normalMax: 45,
  ageGroup: '25-34',
  pcos: false,
  thyroid: false,
  postpartum: false,
  postpartumMonths: null,
  birthControl: false,
  shortestCycle: null,
  longestCycle: null,
  travelRecent: false,
  sleepHours: null
};

const loadProfile = (): AlertProfile => {
  try {
    const stored = localStorage.getItem('cycle_profile');
    if (!stored) return DEFAULT_PROFILE;
    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_PROFILE;
    // Merge onto defaults so a new field never silently resets every setting.
    return { ...DEFAULT_PROFILE, ...parsed };
  } catch {
    return DEFAULT_PROFILE;
  }
};

const saveProfile = (profile: AlertProfile) => {
  try {
    localStorage.setItem('cycle_profile', JSON.stringify(profile));
  } catch {
    // ignore write failures
  }
};

export const usePeriodStore = create<PeriodStore>((set, get) => ({
  periods: [],
  periodEntries: [],
  predictedRange: null,
  loading: false,
  error: null,
  profile: loadProfile(),
  dailyLogs: [],
  dailyLogsLoading: false,
  dailyLogsError: null,

  loadPeriodsFromDB: async () => {
    try {
      const entries = await getAllPeriodsWithId();
      const sortedEntries = entries
        .filter((entry) => entry.id !== undefined)
        .sort((a, b) => (a.startDate < b.startDate ? 1 : -1))
        .map((entry) => ({ id: entry.id as number, startDate: entry.startDate }));
      const periods = sortedEntries.map((entry) => entry.startDate);
      set({ periods, periodEntries: sortedEntries, error: null });
      
      if (periods.length >= 3) {
        await get().fetchPrediction();
      }
    } catch (error) {
      console.error('Error loading periods:', error);
      set({ error: 'Unable to load saved periods.' });
    }
  },

  addPeriodToStore: async (date: string) => {
    try {
      if (!isTodayOrPast(date)) {
        set({ error: 'Period dates must be today or earlier.' });
        return;
      }

      const predictedRange = get().predictedRange;
      if (predictedRange && isFutureDate(date) && isWithinRange(date, predictedRange.earliest, predictedRange.latest)) {
        set({ error: 'Cannot add health data to predicted dates.' });
        return;
      }

      const existingDates = get().periodEntries.map((entry) => entry.startDate);
      if (existingDates.includes(date)) {
        set({ error: 'A period entry already exists for this date.' });
        return;
      }

      const dateSet = new Set([...existingDates, date]);
      const streakLength = getConsecutiveStreakLength(dateSet, date);
      if (streakLength > 10) {
        set({ error: 'Period length cannot be more than 10 days.' });
        return;
      }

      await addPeriod(date);
      await get().loadPeriodsFromDB();
      set({ error: null });
    } catch (error) {
      console.error('Error adding period:', error);
      set({ error: 'Unable to save the period date.' });
    }
  },

  fetchPrediction: async () => {
    const { periods } = get();
    if (periods.length < 3) return;

    set({ loading: true });
    try {
      const basePrediction = predictNextPeriod(periods);
      if (!basePrediction) {
        // Not enough distinct cycles yet (e.g. only one period logged).
        set({ predictedRange: null, error: null });
        return;
      }

      const enhanced = enhancePredictionWithLogs(basePrediction, get().dailyLogs, periods);

      set({
        predictedRange: enhanced,
        error: null
      });
    } catch (error) {
      console.error('Error computing prediction:', error);
      set({ predictedRange: null, error: 'Unable to compute a prediction.' });
    } finally {
      set({ loading: false });
    }
  },

  removePeriod: async (id: number, date?: string) => {
    try {
      if (date && isFutureDate(date)) {
        set({ error: 'Future period entries cannot be deleted.' });
        return;
      }
      await deletePeriod(id);
      await get().loadPeriodsFromDB();
      set({ error: null });
    } catch (error) {
      console.error('Error deleting period:', error);
      set({ error: 'Unable to delete the period date.' });
    }
  },

  setPeriods: (periods: string[]) => {
    set({ periods });
  },
  setError: (message: string | null) => {
    set({ error: message });
  },
  setProfile: (profile: AlertProfile) => {
    set({ profile });
    saveProfile(profile);
  },

  loadDailyLogsFromDB: async () => {
    set({ dailyLogsLoading: true });
    try {
      const logs = await getAllDailyLogs();
      const sorted = logs.sort((a, b) => (a.date < b.date ? 1 : -1));
      set({ dailyLogs: sorted, dailyLogsError: null });
      if (get().periods.length >= 3) {
        await get().fetchPrediction();
      }
    } catch (error) {
      console.error('Error loading daily logs:', error);
      set({ dailyLogsError: 'Unable to load daily logs.' });
    } finally {
      set({ dailyLogsLoading: false });
    }
  },

  upsertDailyLog: async (log: DailyLog) => {
    try {
      if (!isTodayOrPast(log.date)) {
        set({ dailyLogsError: 'Symptoms can only be logged for past dates or today.' });
        return;
      }

      const predictedRange = get().predictedRange;
      if (predictedRange && isFutureDate(log.date) && isWithinRange(log.date, predictedRange.earliest, predictedRange.latest)) {
        set({ dailyLogsError: 'Cannot add health data to predicted dates.' });
        return;
      }

      await upsertDailyLogDB(log);
      await get().loadDailyLogsFromDB();
      set({ dailyLogsError: null });
      // Cache today's log for the notification reminder check
      const todayStr = todayLocalString();
      if (log.date === todayStr) {
        localStorage.setItem('last_logged_date', todayStr);
      }
      if (get().periods.length >= 3) {
        await get().fetchPrediction();
      }
    } catch (error) {
      console.error('Error saving daily log:', error);
      set({ dailyLogsError: 'Unable to save the daily log.' });
    }
  }
}));

const enhancePredictionWithLogs = (
  basePrediction: BasePrediction,
  dailyLogs: DailyLog[],
  periods: string[]
): PredictionRange => {
  const predictedOvulationDate = estimateOvulationDate(basePrediction, periods);
  if (!dailyLogs.length) {
    return {
      ...basePrediction,
      predictedDate: basePrediction.predictedDate,
      predictedOvulationDate
    };
  }

  const recentLogs = [...dailyLogs].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-7);
  const ovulationSignal = detectOvulationFromLogs({
    last7DaysLogs: recentLogs,
    predictedOvulationDate
  });

  const adjustment = adjustConfidence({
    baseConfidence: basePrediction.confidence,
    recentLogs,
    ovulationSignal
  });

  const adjustedWindow = adjustPredictionWindow(
    basePrediction.earliest,
    basePrediction.latest,
    adjustment.windowShift
  );

  return {
    predictedDate: basePrediction.predictedDate,
    earliest: adjustedWindow.earliest,
    latest: adjustedWindow.latest,
    confidence: adjustment.confidence,
    baseConfidence: basePrediction.confidence,
    adjustmentNote: adjustment.note,
    predictedOvulationDate,
    ovulationSignal
  };
};

const estimateOvulationDate = (prediction: BasePrediction, periods: string[]): string | undefined => {
  const earliest = parseLocalDate(prediction.earliest);
  const latest = parseLocalDate(prediction.latest);
  if (!earliest || !latest) return undefined;
  const midpoint = new Date((earliest.getTime() + latest.getTime()) / 2);
  midpoint.setDate(midpoint.getDate() - 14);

  const lastPeriod = periods.length ? parseLocalDate(periods[0]) : null;
  if (lastPeriod && midpoint <= lastPeriod) {
    const fallback = new Date(lastPeriod);
    fallback.setDate(fallback.getDate() + 14);
    return toLocalDateString(fallback);
  }

  return toLocalDateString(midpoint);
};
