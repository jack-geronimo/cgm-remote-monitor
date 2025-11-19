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

  // Virtual Viewport for efficient rendering
  viewport: {
    center: number;      // Timestamp at center of visible area
    rangeMs: number;     // How much time to show (e.g., 12h = 43200000ms)
  } | null;

  // Actions
  setCurrentBg: (bg: number, direction: Direction, timestamp: number) => void;
  setEntries: (entries: BgEntry[]) => void;
  setData: (data: NightscoutData) => void;
  updateFromSocket: (entry: BgEntry) => void;
  prependOlderEntries: (olderEntries: BgEntry[]) => void;

  // Viewport actions
  initViewport: (center: number, rangeMs: number) => void;
  shiftViewport: (deltaMs: number) => void;
  setViewportRange: (rangeMs: number) => void;
}

// Sliding window: keep ±7 days around viewport center
const VIEWPORT_BUFFER_DAYS = 7;
const VIEWPORT_BUFFER_MS = VIEWPORT_BUFFER_DAYS * 24 * 60 * 60 * 1000;

export const useBgStore = create<BgState>((set, get) => ({
  currentBg: null,
  direction: null,
  timestamp: null,
  delta: null,
  entries: [],
  isStale: false,
  data: null,
  viewport: null,

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
    let mergedEntries = [...entries, ...uniqueOlderEntries];

    // Limit to reasonable size (14 days of data = ~4000 entries at 5min intervals)
    if (mergedEntries.length > 4000) {
      mergedEntries = mergedEntries.slice(0, 4000);
    }

    set({ entries: mergedEntries });
  },

  // Initialize viewport with center and range
  initViewport: (center, rangeMs) => {
    set({ viewport: { center, rangeMs } });
  },

  // Shift viewport by delta milliseconds (for panning)
  shiftViewport: (deltaMs) => {
    const { viewport } = get();
    if (!viewport) return;

    set({
      viewport: {
        ...viewport,
        center: viewport.center + deltaMs,
      },
    });
  },

  // Change viewport range (for zoom)
  setViewportRange: (rangeMs) => {
    const { viewport } = get();
    if (!viewport) return;

    set({
      viewport: {
        ...viewport,
        rangeMs,
      },
    });
  },
}));

// Computed selector for visible entries in viewport + buffer
export const useVisibleEntries = () => {
  const entries = useBgStore((state) => state.entries);
  const viewport = useBgStore((state) => state.viewport);

  if (!viewport) return entries;

  // Add buffer (±2 hours) around visible range
  const BUFFER_MS = 2 * 60 * 60 * 1000; // 2 hours
  const halfRange = viewport.rangeMs / 2;
  const minTime = viewport.center - halfRange - BUFFER_MS;
  const maxTime = viewport.center + halfRange + BUFFER_MS;

  return entries.filter(entry => {
    const timestamp = entry.mills || entry.date;
    return timestamp >= minTime && timestamp <= maxTime;
  });
};

// Computed selector for stale data (>15 minutes old)
export const useIsStale = () => {
  const timestamp = useBgStore((state) => state.timestamp);

  if (!timestamp) return true;

  const now = Date.now();
  const diff = now - timestamp;
  const minutes = diff / 60000;

  return minutes > 15;
};
