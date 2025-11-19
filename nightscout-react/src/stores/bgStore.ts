import { create } from 'zustand';
import type { BgEntry, Direction, NightscoutData } from '../types';

interface BgState {
  // Current BG data
  currentBg: number | null;
  direction: Direction | null;
  timestamp: number | null;
  delta: number | null;

  // Historical data
  entries: BgEntry[];
  isStale: boolean;

  // All Nightscout data
  data: NightscoutData | null;

  // Actions
  setCurrentBg: (bg: number, direction: Direction, timestamp: number) => void;
  setEntries: (entries: BgEntry[]) => void;
  setData: (data: NightscoutData) => void;
  updateFromSocket: (entry: BgEntry) => void;
}

export const useBgStore = create<BgState>((set, get) => ({
  currentBg: null,
  direction: null,
  timestamp: null,
  delta: null,
  entries: [],
  isStale: false,
  data: null,

  setCurrentBg: (bg, direction, timestamp) => {
    const prev = get().currentBg;
    const delta = prev !== null ? bg - prev : null;

    set({
      currentBg: bg,
      direction,
      timestamp,
      delta,
      isStale: false,
    });
  },

  setEntries: (entries) => {
    set({ entries });

    // Update current BG from latest entry
    if (entries.length > 0) {
      const latest = entries[0];
      get().setCurrentBg(latest.sgv, latest.direction, latest.mills);
    }
  },

  setData: (data) => {
    set({ data });

    // Update entries and current BG
    if (data.entries.length > 0) {
      get().setEntries(data.entries);
    }
  },

  updateFromSocket: (entry) => {
    const { entries } = get();

    // Add new entry to the beginning
    const newEntries = [entry, ...entries];

    // Keep only last 288 entries (24 hours at 5min intervals)
    const trimmedEntries = newEntries.slice(0, 288);

    set({ entries: trimmedEntries });
    get().setCurrentBg(entry.sgv, entry.direction, entry.mills);
  },
}));

// Computed selector for stale data (>15 minutes old)
export const useIsStale = () => {
  const timestamp = useBgStore((state) => state.timestamp);

  if (!timestamp) return true;

  const now = Date.now();
  const diff = now - timestamp;
  const minutes = diff / 60000;

  return minutes > 15;
};
