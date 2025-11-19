import { useEffect, useRef, useState, useLayoutEffect } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { useBgStore } from '../../stores/bgStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { cn } from '../../lib/utils';
import { fetchOlderEntries } from '../../lib/api';
import { CurrentValueWindow } from './CurrentValueWindow';

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
  const setViewportCenter = useBgStore((state) => state.setViewportCenter);
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
  const [selectedHours, setSelectedHours] = useState(12); // Start with 12h view
  const [isLoading, setIsLoading] = useState(false);
  const [hasMoreData, setHasMoreData] = useState(true);
  const [hoveredValue, setHoveredValue] = useState<{ time: number; value: number } | null>(null);
  const isLoadingRef = useRef(false);
  const previousScrollLeft = useRef<number | null>(null);
  const updateViewportTimeout = useRef<NodeJS.Timeout | null>(null);

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
          show: false, // Hide Y-axis since we have a separate fixed axis
          stroke: 'rgba(255,255,255,0.5)',
          grid: { stroke: 'rgba(255,255,255,0.1)' },
        },
      ],
      cursor: {
        drag: {
          x: false,
          y: false,
        },
      },
      hooks: {
        setCursor: [
          (u) => {
            const idx = u.cursor.idx;
            if (idx != null && idx >= 0) {
              const timestamp = u.data[0][idx];
              const value = u.data[1][idx];
              if (timestamp && value) {
                setHoveredValue({ time: timestamp * 1000, value });
              }
            } else {
              setHoveredValue(null);
            }
          },
        ],
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

  // Scroll to right (most recent) on initial load and set initial viewport
  useLayoutEffect(() => {
    if (containerRef.current && entries.length > 0) {
      const container = containerRef.current;
      container.scrollLeft = container.scrollWidth;

      // Set initial viewport to current time
      const newestTimestamp = entries[0]?.mills || entries[0]?.date;
      if (newestTimestamp) {
        setViewportCenter(newestTimestamp);
      }
    }
  }, []);

  // Update viewport center when scrolling (debounced)
  const updateViewportFromScroll = () => {
    const container = containerRef.current;
    if (!container || entries.length === 0) return;

    const scrollLeft = container.scrollLeft;
    const scrollWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;

    // Calculate which timestamp is at the center of the visible area
    const scrollPercent = (scrollLeft + clientWidth / 2) / scrollWidth;

    if (entries.length > 0) {
      const oldestTimestamp = entries[entries.length - 1]?.mills || entries[entries.length - 1]?.date;
      const newestTimestamp = entries[0]?.mills || entries[0]?.date;

      if (oldestTimestamp && newestTimestamp) {
        const totalTimeSpan = newestTimestamp - oldestTimestamp;
        const centerTimestamp = newestTimestamp - (totalTimeSpan * scrollPercent);

        setViewportCenter(centerTimestamp);
      }
    }
  };

  // Handle scroll to load older data and update viewport
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = async () => {
      // Debounce viewport update
      if (updateViewportTimeout.current) {
        clearTimeout(updateViewportTimeout.current);
      }
      updateViewportTimeout.current = setTimeout(() => {
        updateViewportFromScroll();
      }, 500);

      // Load more data if needed
      if (isLoadingRef.current || !hasMoreData) {
        return;
      }

      const scrollLeft = container.scrollLeft;
      const threshold = 400;

      // Load more when scrolling near the left edge
      if (scrollLeft < threshold) {
        const oldestEntry = entries[entries.length - 1];
        if (!oldestEntry) return;

        const oldestTimestamp = oldestEntry.mills || oldestEntry.date;
        if (!oldestTimestamp) return;

        isLoadingRef.current = true;
        setIsLoading(true);

        try {
          // Store scroll position before loading
          previousScrollLeft.current = container.scrollWidth - scrollLeft;

          const olderEntries = await fetchOlderEntries(oldestTimestamp, 500);

          if (olderEntries.length === 0) {
            setHasMoreData(false);
          } else {
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
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (updateViewportTimeout.current) {
        clearTimeout(updateViewportTimeout.current);
      }
    };
  }, [entries, hasMoreData, prependOlderEntries, setViewportCenter]);

  // Calculate Y-axis values for fixed axis
  const yAxisValues = [40, 80, 120, 160, 200, 240, 280, 320, 360, 400];
  const chartHeight = 400;
  const yMin = Math.max(40, alarmUrgentLow - 20);
  const yMax = Math.min(400, alarmUrgentHigh + 20);

  return (
    <>
      {/* Current Value Window */}
      <CurrentValueWindow hoveredValue={hoveredValue} />

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

      {/* Chart with fixed Y-axis */}
      <div className="flex gap-0">
        {/* Fixed Y-axis */}
        <div className="flex-shrink-0" style={{ width: '50px', height: `${chartHeight}px` }}>
          <svg width="50" height={chartHeight} className="overflow-visible">
            {/* Y-axis line */}
            <line
              x1="45"
              y1="0"
              x2="45"
              y2={chartHeight}
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="1"
            />

            {/* Y-axis labels and grid lines */}
            {yAxisValues.map((value) => {
              // Map value to Y position
              const yPos = chartHeight - ((value - yMin) / (yMax - yMin)) * chartHeight;

              if (yPos < 0 || yPos > chartHeight) return null;

              return (
                <g key={value}>
                  {/* Label */}
                  <text
                    x="40"
                    y={yPos + 4}
                    textAnchor="end"
                    fill="rgba(255,255,255,0.7)"
                    fontSize="12"
                  >
                    {value}
                  </text>
                  {/* Tick mark */}
                  <line
                    x1="42"
                    y1={yPos}
                    x2="45"
                    y2={yPos}
                    stroke="rgba(255,255,255,0.5)"
                    strokeWidth="1"
                  />
                </g>
              );
            })}
          </svg>
        </div>

        {/* Scrollable chart container */}
        <div
          ref={containerRef}
          className="flex-1 overflow-x-auto relative"
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
    </div>
    </>
  );
}
