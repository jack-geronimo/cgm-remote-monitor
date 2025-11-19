import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { useBgStore } from '../../stores/bgStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { cn } from '../../lib/utils';
import { fetchOlderEntries } from '../../lib/api';

const TIME_RANGES = [
  { hours: 2, label: '2h' },
  { hours: 3, label: '3h' },
  { hours: 4, label: '4h' },
  { hours: 6, label: '6h' },
  { hours: 12, label: '12h' },
  { hours: 24, label: '24h' },
];

// Pixels per hour for each zoom level
const PIXELS_PER_HOUR: Record<number, number> = {
  2: 800,
  3: 600,
  4: 500,
  6: 400,
  12: 250,
  24: 150,
};

export function UPlotChart() {
  const entries = useBgStore((state) => state.entries);
  const prependOlderEntries = useBgStore((state) => state.prependOlderEntries);
  const units = useSettingsStore((state) => state.units);
  const alarmUrgentHigh = useSettingsStore((state) => state.alarmUrgentHigh);
  const alarmHigh = useSettingsStore((state) => state.alarmHigh);
  const targetTop = useSettingsStore((state) => state.targetTop);
  const targetBottom = useSettingsStore((state) => state.targetBottom);
  const alarmLow = useSettingsStore((state) => state.alarmLow);
  const alarmUrgentLow = useSettingsStore((state) => state.alarmUrgentLow);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const uplotRef = useRef<uPlot | null>(null);
  const [selectedHours, setSelectedHours] = useState(3);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMoreData, setHasMoreData] = useState(true);
  const isLoadingRef = useRef(false);
  const previousScrollLeft = useRef<number | null>(null);

  // Calculate chart width based on data and zoom level
  const chartWidth = useRef(0);

  useEffect(() => {
    if (entries.length === 0) return;

    // Calculate total time span in hours
    const oldestTimestamp = entries[entries.length - 1]?.mills || entries[entries.length - 1]?.date;
    const newestTimestamp = entries[0]?.mills || entries[0]?.date;

    if (!oldestTimestamp || !newestTimestamp) return;

    const totalHours = (newestTimestamp - oldestTimestamp) / (1000 * 60 * 60);
    const pixelsPerHour = PIXELS_PER_HOUR[selectedHours] || 400;

    // Calculate width: total hours × pixels per hour
    chartWidth.current = Math.max(800, totalHours * pixelsPerHour);
  }, [entries, selectedHours]);

  // Render chart with uPlot
  useEffect(() => {
    if (!chartRef.current || entries.length === 0) return;

    // Prepare data for uPlot
    const timestamps: number[] = [];
    const values: number[] = [];

    // Sort by time (oldest first) and convert to seconds
    const sortedEntries = [...entries].reverse();
    sortedEntries.forEach(entry => {
      const timestamp = entry.mills || entry.date;
      if (timestamp && isFinite(entry.sgv)) {
        timestamps.push(timestamp / 1000); // uPlot uses seconds
        values.push(entry.sgv);
      }
    });

    const data = [timestamps, values];

    // Destroy existing chart before creating new one
    if (uplotRef.current) {
      uplotRef.current.destroy();
      uplotRef.current = null;
    }

    const opts: uPlot.Options = {
      title: 'Blood Glucose',
      width: chartWidth.current,
      height: 400,
      scales: {
        x: {
          time: true,
        },
        y: {
          range: [
            Math.max(40, alarmUrgentLow - 20),
            Math.min(400, alarmUrgentHigh + 20),
          ],
        },
      },
      series: [
        {},
        {
          label: 'BG',
          stroke: '#3B82F6',
          width: 2,
          points: { show: false },
        },
      ],
      axes: [
        {
          stroke: 'rgba(255,255,255,0.5)',
          grid: { stroke: 'rgba(255,255,255,0.1)' },
        },
        {
          stroke: 'rgba(255,255,255,0.5)',
          grid: { stroke: 'rgba(255,255,255,0.1)' },
          values: (u, vals) => vals.map(v => `${Math.round(v)}`),
        },
      ],
      cursor: {
        drag: {
          x: false,
          y: false,
        },
      },
      plugins: [
        // Draw target ranges as background
        {
          hooks: {
            draw: (u) => {
              const { ctx } = u;
              const { left, top, width, height } = u.bbox;

              ctx.save();

              // Target range (green)
              const targetTopY = u.valToPos(targetTop, 'y', true);
              const targetBottomY = u.valToPos(targetBottom, 'y', true);
              ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
              ctx.fillRect(left, targetTopY, width, targetBottomY - targetTopY);

              // High warning (orange)
              const alarmHighY = u.valToPos(alarmHigh, 'y', true);
              ctx.fillStyle = 'rgba(245, 158, 11, 0.1)';
              ctx.fillRect(left, alarmHighY, width, targetTopY - alarmHighY);

              // Low warning (orange)
              const alarmLowY = u.valToPos(alarmLow, 'y', true);
              ctx.fillStyle = 'rgba(245, 158, 11, 0.1)';
              ctx.fillRect(left, alarmLowY, width, targetBottomY - alarmLowY);

              // Urgent high (red)
              const urgentHighY = u.valToPos(alarmUrgentHigh, 'y', true);
              ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
              ctx.fillRect(left, top, width, urgentHighY - top);

              // Urgent low (red)
              const urgentLowY = u.valToPos(alarmUrgentLow, 'y', true);
              ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
              ctx.fillRect(left, urgentLowY, width, height - urgentLowY);

              ctx.restore();
            },
          },
        },
      ],
    };

    uplotRef.current = new uPlot(opts, data, chartRef.current);

    // Cleanup
    return () => {
      if (uplotRef.current) {
        uplotRef.current.destroy();
        uplotRef.current = null;
      }
    };
  }, [entries, selectedHours, targetTop, targetBottom, alarmHigh, alarmLow, alarmUrgentHigh, alarmUrgentLow]);

  // Preserve scroll position after loading new data
  useLayoutEffect(() => {
    if (containerRef.current && previousScrollLeft.current !== null) {
      const container = containerRef.current;
      const newScrollLeft = container.scrollWidth - previousScrollLeft.current;
      container.scrollLeft = newScrollLeft;
      previousScrollLeft.current = null;
    }
  }, [entries]);

  // Scroll to right (most recent) on initial load
  useLayoutEffect(() => {
    if (containerRef.current && entries.length > 0) {
      const container = containerRef.current;
      container.scrollLeft = container.scrollWidth;
    }
  }, []);

  // Handle scroll to load older data
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = async () => {
      if (isLoadingRef.current || !hasMoreData) {
        console.log('Scroll: skipping load', {
          isLoading: isLoadingRef.current,
          hasMoreData
        });
        return;
      }

      const scrollLeft = container.scrollLeft;
      const scrollWidth = container.scrollWidth;
      const clientWidth = container.clientWidth;
      const threshold = 400; // Increased threshold

      console.log('Scroll event:', {
        scrollLeft,
        scrollWidth,
        clientWidth,
        threshold,
        shouldLoad: scrollLeft < threshold
      });

      // Load more when scrolling near the left edge
      if (scrollLeft < threshold) {
        const oldestEntry = entries[entries.length - 1];
        if (!oldestEntry) {
          console.log('No oldest entry found');
          return;
        }

        const oldestTimestamp = oldestEntry.mills || oldestEntry.date;
        if (!oldestTimestamp) {
          console.log('No oldest timestamp found');
          return;
        }

        console.log('Loading older entries before:', new Date(oldestTimestamp).toLocaleString());

        isLoadingRef.current = true;
        setIsLoading(true);

        try {
          // Store scroll position before loading
          previousScrollLeft.current = container.scrollWidth - scrollLeft;

          const olderEntries = await fetchOlderEntries(oldestTimestamp, 500);

          console.log('Loaded older entries:', olderEntries.length);

          if (olderEntries.length === 0) {
            console.log('No more data available from API');
            setHasMoreData(false);
          } else {
            console.log('Adding entries, oldest:',
              olderEntries.length > 0
                ? new Date(olderEntries[olderEntries.length - 1].mills || olderEntries[olderEntries.length - 1].date).toLocaleString()
                : 'none'
            );
            prependOlderEntries(olderEntries);
          }
        } catch (error) {
          console.error('Failed to load older entries:', error);
        } finally {
          isLoadingRef.current = false;
          setIsLoading(false);
        }
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [entries, hasMoreData, prependOlderEntries]);

  return (
    <div className="card">
      {/* Header with time range selector */}
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Glucose Chart</h2>
          <p className="text-sm text-text-secondary">
            Canvas-based rendering • Scroll horizontally to view history
          </p>
        </div>

        {/* Time range buttons */}
        <div className="flex gap-2">
          {TIME_RANGES.map(({ hours, label }) => (
            <button
              key={hours}
              onClick={() => setSelectedHours(hours)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                selectedHours === hours
                  ? 'bg-bg-info text-white'
                  : 'bg-surface-2 text-text-secondary hover:bg-surface-3'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable chart container */}
      <div
        ref={containerRef}
        className="w-full overflow-x-auto relative"
        style={{ maxHeight: '450px' }}
      >
        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute top-2 left-2 z-10 bg-surface-2 px-3 py-1.5 rounded-lg text-sm text-text-secondary">
            Loading older data...
          </div>
        )}

        {/* No more data indicator */}
        {!hasMoreData && (
          <div className="absolute top-2 left-2 z-10 bg-surface-2 px-3 py-1.5 rounded-lg text-sm text-text-muted">
            No more data available
          </div>
        )}

        {/* Chart */}
        <div ref={chartRef} style={{ minWidth: '100%' }} />
      </div>
    </div>
  );
}
