import { create } from 'zustand';
import {
  addPeriod,
  getAllPeriodsWithId,
  deletePeriod,
  getAllDailyLogs,
  upsertDailyLog as upsertDailyLogDB,
  DailyLog
} from './db';
import axios from 'axios';
import { API_BASE_URL } from './api';
import { adjustConfidence, adjustPredictionWindow } from './utils/confidenceAdjuster';
import { detectOvulationFromLogs, OvulationSignal } from './utils/ovulationSignals';

export interface PredictionRange {
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
  variationDays: number;
  recentWindowDays: number;
  frequentCount: number;
  minCyclesForAlerts: number;
  ageGroup: 'under18' | '18-24' | '25-34' | '35-44' | '45plus';
  pcos: boolean;
  thyroid: boolean;
  postpartum: boolean;
  postpartumMonths: number | null;
  birthControl: boolean;
  shortestCycle: number | null;
  longestCycle: number | null;
  typicalPeriodLength: number | null;
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
  removePeriod: (id: number) => Promise<void>;
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
  normalMax: 35,
  variationDays: 7,
  recentWindowDays: 60,
  frequentCount: 3,
  minCyclesForAlerts: 3,
  ageGroup: '25-34',
  pcos: false,
  thyroid: false,
  postpartum: false,
  postpartumMonths: null,
  birthControl: false,
  shortestCycle: null,
  longestCycle: null,
  typicalPeriodLength: null,
  travelRecent: false,
  sleepHours: null
};

const loadProfile = (): AlertProfile => {
  try {
    const stored = localStorage.getItem('cycle_profile');
    if (!stored) return DEFAULT_PROFILE;
    const parsed = JSON.parse(stored) as AlertProfile;
    if (
      typeof parsed.userName !== 'string' ||
      typeof parsed.avatar !== 'string' ||
      typeof parsed.normalMin !== 'number' ||
      typeof parsed.normalMax !== 'number' ||
      typeof parsed.variationDays !== 'number' ||
      typeof parsed.recentWindowDays !== 'number' ||
      typeof parsed.frequentCount !== 'number' ||
      typeof parsed.minCyclesForAlerts !== 'number' ||
      typeof parsed.ageGroup !== 'string' ||
      typeof parsed.pcos !== 'boolean' ||
      typeof parsed.thyroid !== 'boolean' ||
      typeof parsed.postpartum !== 'boolean' ||
      (parsed.postpartumMonths !== null && typeof parsed.postpartumMonths !== 'number') ||
      typeof parsed.birthControl !== 'boolean' ||
      (parsed.shortestCycle !== null && typeof parsed.shortestCycle !== 'number') ||
      (parsed.longestCycle !== null && typeof parsed.longestCycle !== 'number') ||
      (parsed.typicalPeriodLength !== null && typeof parsed.typicalPeriodLength !== 'number') ||
      typeof parsed.travelRecent !== 'boolean' ||
      (parsed.sleepHours !== null && typeof parsed.sleepHours !== 'number')
    ) {
      return DEFAULT_PROFILE;
    }
    return parsed;
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
      const response = await axios.post(
        `${API_BASE_URL}/predict`,
        { dates: periods }
      );
      const basePrediction: PredictionRange = {
        earliest: response.data.earliest,
        latest: response.data.latest,
        confidence: response.data.confidence
      };

      const enhanced = enhancePredictionWithLogs(basePrediction, get().dailyLogs, periods);

      set({
        predictedRange: enhanced,
        error: null
      });
    } catch (error) {
      console.error('Error fetching prediction:', error);
      set({
        predictedRange: null,
        error: 'Prediction service is unavailable. We will keep tracking locally.'
      });
    } finally {
      set({ loading: false });
    }
  },

  removePeriod: async (id: number) => {
    try {
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
      await upsertDailyLogDB(log);
      await get().loadDailyLogsFromDB();
      set({ dailyLogsError: null });
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
  basePrediction: PredictionRange,
  dailyLogs: DailyLog[],
  periods: string[]
): PredictionRange => {
  const predictedOvulationDate = estimateOvulationDate(basePrediction, periods);
  if (!dailyLogs.length) {
    return {
      ...basePrediction,
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
    earliest: adjustedWindow.earliest,
    latest: adjustedWindow.latest,
    confidence: adjustment.confidence,
    baseConfidence: basePrediction.confidence,
    adjustmentNote: adjustment.note,
    predictedOvulationDate,
    ovulationSignal
  };
};

const estimateOvulationDate = (prediction: PredictionRange, periods: string[]): string | undefined => {
  if (!prediction?.earliest) return undefined;
  const earliest = new Date(prediction.earliest);
  const latest = new Date(prediction.latest);
  const midpoint = new Date((earliest.getTime() + latest.getTime()) / 2);
  midpoint.setDate(midpoint.getDate() - 14);

  if (periods.length === 0) {
    return midpoint.toISOString().split('T')[0];
  }

  const lastPeriod = new Date(periods[0]);
  if (midpoint <= lastPeriod) {
    const fallback = new Date(lastPeriod);
    fallback.setDate(fallback.getDate() + 14);
    return fallback.toISOString().split('T')[0];
  }

  return midpoint.toISOString().split('T')[0];
};
