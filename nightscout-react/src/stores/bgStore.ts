import { create } from 'zustand';
import type { BgEntry, Direction, NightscoutData, Treatment, DeviceStatus, Profile } from '../types';

interface BgState {
  // Current BG data
  currentBg: number | null;
  direction: Direction | null;
  timestamp: number | null;
  delta: number | null;

  // Historical data
  entries: BgEntry[];
  treatments: Treatment[];
  devicestatus: DeviceStatus[];
  profile: Profile | null;
  isStale: boolean;

  // All Nightscout data (deprecated - use individual fields above)
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
  appendNewerEntries: (newerEntries: BgEntry[]) => void;
  prependOlderTreatments: (olderTreatments: Treatment[]) => void;
  appendNewerTreatments: (newerTreatments: Treatment[]) => void;

  // Viewport actions
  initViewport: (center: number, rangeMs: number) => void;
  shiftViewport: (deltaMs: number) => void;
  setViewportCenter: (center: number) => void;
  setViewportRange: (rangeMs: number) => void;
}

export const useBgStore = create<BgState>((set, get) => ({
  currentBg: null,
  direction: null,
  timestamp: null,
  delta: null,
  entries: [],
  treatments: [],
  devicestatus: [],
  profile: null,
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
      // Calculate delta from the two most recent entries (not from previous currentBg)
      const delta = entries.length >= 2
        ? entries[0].sgv - entries[1].sgv
        : null;

      updates.currentBg = latest.sgv;
      updates.direction = latest.direction;
      updates.timestamp = latest.mills || latest.date; // Use mills or date
      updates.delta = delta;
      updates.isStale = false;
    }

    set(updates);
  },

  setData: (data) => {
    // Sort entries by timestamp descending (newest first)
    const sortedEntries = [...data.entries].sort((a, b) => {
      const timeA = a.mills || a.date;
      const timeB = b.mills || b.date;
      return timeB - timeA; // Descending order (newest first)
    });

    // Batch all updates into a single set() call to avoid cascading re-renders
    // Use existing references if data is undefined to avoid unnecessary re-renders
    const current = get();
    const updates: Partial<BgState> = {
      data,
      entries: sortedEntries,
      treatments: data.treatments !== undefined ? data.treatments : current.treatments,
      devicestatus: data.devicestatus !== undefined ? data.devicestatus : current.devicestatus,
      profile: data.profile !== undefined ? data.profile : current.profile,
    };

    // Update current BG from latest entry
    if (sortedEntries.length > 0) {
      const latest = sortedEntries[0];
      // Calculate delta from the two most recent entries (not from previous currentBg)
      // This ensures delta is stable and doesn't reset to 0 when setData is called without new entries
      const delta = sortedEntries.length >= 2
        ? sortedEntries[0].sgv - sortedEntries[1].sgv
        : null;

      updates.currentBg = latest.sgv;
      updates.direction = latest.direction;
      updates.timestamp = latest.mills || latest.date; // Use mills or date
      updates.delta = delta;
      updates.isStale = false;
    }

    set(updates);
  },

  updateFromSocket: (entry) => {
    const { entries } = get();

    // Add new entry to the beginning
    const newEntries = [entry, ...entries];

    // Keep only last 288 entries (24 hours at 5min intervals)
    const trimmedEntries = newEntries.slice(0, 288);

    // Calculate delta from the two most recent entries (consistent with setData/setEntries)
    const delta = trimmedEntries.length >= 2
      ? trimmedEntries[0].sgv - trimmedEntries[1].sgv
      : null;

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
    const { entries, viewport } = get();

    // Filter out duplicates and merge older entries at the end
    const existingIds = new Set(entries.map(e => e._id));
    const uniqueOlderEntries = olderEntries.filter(e => !existingIds.has(e._id));

    // Append older entries to the end (since entries are sorted newest first)
    let mergedEntries = [...entries, ...uniqueOlderEntries];

    // Symmetric sliding window: trim data far from viewport center
    if (viewport && mergedEntries.length > 15000) {
      const keepWindow = 30 * 24 * 60 * 60 * 1000; // ±30 days
      const minKeepTime = viewport.center - keepWindow;
      const maxKeepTime = viewport.center + keepWindow;

      const beforeTrim = mergedEntries.length;
      mergedEntries = mergedEntries.filter(entry => {
        const timestamp = entry.mills || entry.date;
        return timestamp >= minKeepTime && timestamp <= maxKeepTime;
      });

      if (beforeTrim !== mergedEntries.length) {
        console.log(`Trimmed entries from ${beforeTrim} to ${mergedEntries.length} (viewport-based ±30 days)`);
      }
    } else if (mergedEntries.length > 25000) {
      // Fallback: Hard limit - keep newest 25000
      const beforeTrim = mergedEntries.length;
      mergedEntries = mergedEntries.slice(0, 25000);
      console.log(`Hard trimmed entries from ${beforeTrim} to 25000`);
    }

    set({ entries: mergedEntries });
  },

  appendNewerEntries: (newerEntries) => {
    const { entries, viewport, currentBg } = get();

    // Filter out duplicates and merge newer entries at the beginning
    const existingIds = new Set(entries.map(e => e._id));
    const uniqueNewerEntries = newerEntries.filter(e => !existingIds.has(e._id));

    // Prepend newer entries to the beginning (entries are sorted newest first)
    let mergedEntries = [...uniqueNewerEntries, ...entries];

    // Symmetric sliding window: trim data far from viewport center
    if (viewport && mergedEntries.length > 15000) {
      const keepWindow = 30 * 24 * 60 * 60 * 1000; // ±30 days
      const minKeepTime = viewport.center - keepWindow;
      const maxKeepTime = viewport.center + keepWindow;

      const beforeTrim = mergedEntries.length;
      mergedEntries = mergedEntries.filter(entry => {
        const timestamp = entry.mills || entry.date;
        return timestamp >= minKeepTime && timestamp <= maxKeepTime;
      });

      if (beforeTrim !== mergedEntries.length) {
        console.log(`Trimmed entries from ${beforeTrim} to ${mergedEntries.length} (viewport-based ±30 days)`);
      }
    } else if (mergedEntries.length > 25000) {
      // Fallback: Hard limit - keep newest 25000
      const beforeTrim = mergedEntries.length;
      mergedEntries = mergedEntries.slice(0, 25000);
      console.log(`Hard trimmed entries from ${beforeTrim} to 25000`);
    }

    // Update current BG info if we have new entries
    const updates: any = { entries: mergedEntries };

    if (uniqueNewerEntries.length > 0) {
      const latestEntry = mergedEntries[0];
      const delta = currentBg !== null ? latestEntry.sgv - currentBg : null;

      updates.currentBg = latestEntry.sgv;
      updates.direction = latestEntry.direction;
      updates.timestamp = latestEntry.mills || latestEntry.date;
      updates.delta = delta;
      updates.isStale = false;
    }

    set(updates);
  },

  prependOlderTreatments: (olderTreatments) => {
    const { treatments } = get();

    // Filter out duplicates and merge older treatments at the end
    const existingIds = new Set(treatments.map(t => t._id));
    const uniqueOlderTreatments = olderTreatments.filter(t => !existingIds.has(t._id));

    // Append older treatments to the end (treatments sorted by date descending)
    const mergedTreatments = [...treatments, ...uniqueOlderTreatments];

    set({ treatments: mergedTreatments });
    console.log(`Prepended ${uniqueOlderTreatments.length} older treatments (total: ${mergedTreatments.length})`);
  },

  appendNewerTreatments: (newerTreatments) => {
    const { treatments } = get();

    // Filter out duplicates and merge newer treatments at the beginning
    const existingIds = new Set(treatments.map(t => t._id));
    const uniqueNewerTreatments = newerTreatments.filter(t => !existingIds.has(t._id));

    // Prepend newer treatments to the beginning (treatments sorted by date descending)
    const mergedTreatments = [...uniqueNewerTreatments, ...treatments];

    set({ treatments: mergedTreatments });
    console.log(`Appended ${uniqueNewerTreatments.length} newer treatments (total: ${mergedTreatments.length})`);
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

  // Set viewport center directly (for dragging)
  setViewportCenter: (center) => {
    const { viewport } = get();
    if (!viewport) return;

    set({
      viewport: {
        ...viewport,
        center,
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
