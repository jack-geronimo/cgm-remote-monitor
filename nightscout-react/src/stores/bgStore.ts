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
  prependOlderEntries: (olderEntries: BgEntry[]) => void;
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
    // Batch all updates into a single set() call to avoid cascading re-renders
    const updates: Partial<BgState> = { entries };

    // Update current BG from latest entry
    if (entries.length > 0) {
      const latest = entries[0];
      const prev = get().currentBg;
      const delta = prev !== null ? latest.sgv - prev : null;

      updates.currentBg = latest.sgv;
      updates.direction = latest.direction;
      updates.timestamp = latest.mills || latest.date; // Use mills or date
      updates.delta = delta;
      updates.isStale = false;
    }

    set(updates);
  },

  setData: (data) => {
    // Batch all updates into a single set() call to avoid cascading re-renders
    const updates: Partial<BgState> = { data };

    // Update entries and current BG
    if (data.entries.length > 0) {
      const latest = data.entries[0];
      const prev = get().currentBg;
      const delta = prev !== null ? latest.sgv - prev : null;

      updates.entries = data.entries;
      updates.currentBg = latest.sgv;
      updates.direction = latest.direction;
      updates.timestamp = latest.mills || latest.date; // Use mills or date
      updates.delta = delta;
      updates.isStale = false;
    }

    set(updates);
  },

  updateFromSocket: (entry) => {
    const { entries, currentBg } = get();

    // Add new entry to the beginning
    const newEntries = [entry, ...entries];

    // Keep only last 288 entries (24 hours at 5min intervals)
    const trimmedEntries = newEntries.slice(0, 288);

    // Batch all updates into a single set() call to avoid cascading re-renders
    const delta = currentBg !== null ? entry.sgv - currentBg : null;

    set({
      entries: trimmedEntries,
      currentBg: entry.sgv,
      direction: entry.direction,
      timestamp: entry.mills || entry.date, // Use mills or date
      delta,
      isStale: false,
    });
  },

  prependOlderEntries: (olderEntries) => {
    const { entries } = get();

    // Filter out duplicates and merge older entries at the end
    const existingIds = new Set(entries.map(e => e._id));
    const uniqueOlderEntries = olderEntries.filter(e => !existingIds.has(e._id));

    // Append older entries to the end (since entries are sorted newest first)
    const mergedEntries = [...entries, ...uniqueOlderEntries];

    set({ entries: mergedEntries });
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
