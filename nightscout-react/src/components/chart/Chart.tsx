import { useMemo, useRef, useEffect, useLayoutEffect, useState, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import { useBgStore } from '../../stores/bgStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { formatBgValue, getBgColor } from '../../lib/utils';
import { fetchOlderEntries } from '../../lib/api';
import dayjs from 'dayjs';
import { cn } from '../../lib/utils';

const TIME_RANGES = [
  { hours: 2, label: '2h' },
  { hours: 3, label: '3h' },
  { hours: 4, label: '4h' },
  { hours: 6, label: '6h' },
  { hours: 12, label: '12h' },
  { hours: 24, label: '24h' },
];

export function Chart() {
  const entries = useBgStore((state) => state.entries);
  const prependOlderEntries = useBgStore((state) => state.prependOlderEntries);
  const units = useSettingsStore((state) => state.units);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [selectedHours, setSelectedHours] = useState(3); // Default 3 hours
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreData, setHasMoreData] = useState(true);
  const hasAutoScrolled = useRef(false);
  const savedScrollInfo = useRef<{ scrollLeft: number; scrollWidth: number } | null>(null);

  // Use individual selectors to avoid recreating selector function on every render
  const alarmUrgentHigh = useSettingsStore((state) => state.alarmUrgentHigh);
  const alarmHigh = useSettingsStore((state) => state.alarmHigh);
  const targetTop = useSettingsStore((state) => state.targetTop);
  const targetBottom = useSettingsStore((state) => state.targetBottom);
  const alarmLow = useSettingsStore((state) => state.alarmLow);
  const alarmUrgentLow = useSettingsStore((state) => state.alarmUrgentLow);

  // Prepare all available data for charting
  const chartData = useMemo(() => {
    try {
      let data = entries
        .map((entry) => {
          // Use mills if available, otherwise fall back to date
          const timestamp = entry.mills || entry.date;

          // Skip invalid entries
          if (!timestamp || !isFinite(entry.sgv)) {
            return null;
          }

          return {
            time: timestamp,
            bg: entry.sgv,
            timeFormatted: dayjs(timestamp).format('HH:mm'),
          };
        })
        .filter(Boolean) // Remove null entries
        .reverse(); // Recharts expects chronological order

      // Performance optimization: Limit rendered points to 1000 max
      // This prevents browser crashes with huge datasets
      if (data.length > 1000) {
        // Sample every nth point to get ~1000 points
        const step = Math.ceil(data.length / 1000);
        data = data.filter((_, index) => index % step === 0);
      }

      return data;
    } catch (error) {
      console.error('Error preparing chart data:', error);
      return [];
    }
  }, [entries]);

  // Calculate chart width based on selected time range
  // Like old Nightscout: selectedHours controls the "density" of data display
  const chartWidth = useMemo(() => {
    if (chartData.length === 0) return 1200;

    // Calculate total time span of ALL data
    const oldestTime = chartData[0]?.time || Date.now();
    const newestTime = chartData[chartData.length - 1]?.time || Date.now();
    const totalHours = (newestTime - oldestTime) / (60 * 60 * 1000);

    // Pixels per hour based on selectedHours - this determines "zoom level"
    // Lower selectedHours = more zoomed in = more pixels per hour
    // Higher selectedHours = more zoomed out = fewer pixels per hour
    const pixelsPerHour = selectedHours <= 3 ? 300 : selectedHours <= 6 ? 200 : selectedHours <= 12 ? 120 : 70;

    // Total chart width for ALL data
    const totalWidth = totalHours * pixelsPerHour;

    return Math.max(totalWidth, 1200);
  }, [chartData, selectedHours]);

  // Calculate dynamic tick count based on visible hours
  const xAxisTickCount = useMemo(() => {
    // Ticks based on how many hours are visible
    if (selectedHours <= 3) return 13; // ~every 15 min
    if (selectedHours <= 6) return 13; // ~every 30 min
    if (selectedHours <= 12) return 13; // ~every hour
    return 25; // ~every hour for 24h
  }, [selectedHours]);

  // Auto-scroll to newest data on initial load
  useEffect(() => {
    if (!hasAutoScrolled.current && scrollContainerRef.current && chartData.length > 0) {
      // Wait for render
      setTimeout(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
          hasAutoScrolled.current = true;
        }
      }, 100);
    }
  }, [chartData]);

  // Restore scroll position after loading older data (synchronous to prevent flicker)
  useLayoutEffect(() => {
    if (savedScrollInfo.current && scrollContainerRef.current) {
      const { scrollLeft, scrollWidth } = savedScrollInfo.current;
      const newScrollWidth = scrollContainerRef.current.scrollWidth;
      const scrollWidthDiff = newScrollWidth - scrollWidth;

      // Restore position maintaining visual location
      scrollContainerRef.current.scrollLeft = scrollLeft + scrollWidthDiff;

      // Clear saved info
      savedScrollInfo.current = null;
    }
  }, [chartData]);

  // Handle loading more data when scrolling left
  const handleScroll = useCallback(async () => {
    if (!scrollContainerRef.current || isLoadingMore || !hasMoreData) return;

    const { scrollLeft } = scrollContainerRef.current;

    // If scrolled near the left edge (within 300px), load more data
    if (scrollLeft < 300) {
      setIsLoadingMore(true);

      // Get oldest entry timestamp
      const oldestEntry = entries[entries.length - 1];
      if (oldestEntry) {
        try {
          // Save current scroll position for restoration
          savedScrollInfo.current = {
            scrollLeft: scrollContainerRef.current.scrollLeft,
            scrollWidth: scrollContainerRef.current.scrollWidth,
          };

          // Fetch older data (2 days worth for smoother scrolling)
          const oldestTimestamp = oldestEntry.mills || oldestEntry.date;
          const olderEntries = await fetchOlderEntries(oldestTimestamp, 576);

          if (olderEntries.length > 0) {
            // Add older entries to store
            // The scroll position will be restored by useLayoutEffect
            prependOlderEntries(olderEntries);
          } else {
            // No more data available
            setHasMoreData(false);
            savedScrollInfo.current = null;
          }
        } catch (error) {
          console.error('Error loading more data:', error);
          savedScrollInfo.current = null;
        }
      }

      setIsLoadingMore(false);
    }
  }, [entries, isLoadingMore, hasMoreData, prependOlderEntries]);

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const bgColor = getBgColor(data.bg);

      return (
        <div className="bg-surface-1 border border-surface-3 rounded-lg p-3 shadow-xl">
          <p className="text-xs text-text-secondary mb-1">{data.timeFormatted}</p>
          <p className={cn('text-lg font-bold', bgColor)}>
            {formatBgValue(data.bg, units)} {units === 'mg/dl' ? 'mg/dL' : 'mmol/L'}
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom dot for current BG
  const CustomDot = (props: any) => {
    const { cx, cy, index } = props;
    const isLast = index === chartData.length - 1;

    if (!isLast) return null;

    return (
      <g>
        <circle cx={cx} cy={cy} r={6} fill="currentColor" className="text-bg-info" />
        <circle cx={cx} cy={cy} r={3} fill="white" />
      </g>
    );
  };

  // Calculate Y-axis domain with padding
  const yDomain = useMemo(() => {
    if (chartData.length === 0) return [40, 400];

    try {
      const values = chartData.map((d) => d.bg).filter(v => isFinite(v));

      if (values.length === 0) return [40, 400];

      // Use reduce instead of spread for large arrays to avoid stack overflow
      const min = Math.min(
        values.reduce((a, b) => Math.min(a, b), Infinity),
        alarmUrgentLow || 40
      );
      const max = Math.max(
        values.reduce((a, b) => Math.max(a, b), -Infinity),
        alarmUrgentHigh || 400
      );

      if (!isFinite(min) || !isFinite(max) || min >= max) {
        return [40, 400];
      }

      const padding = (max - min) * 0.1;
      return [Math.max(40, min - padding), Math.min(400, max + padding)];
    } catch (error) {
      console.error('Error calculating yDomain:', error);
      return [40, 400];
    }
  }, [chartData, alarmUrgentLow, alarmUrgentHigh]);

  if (chartData.length === 0) {
    return (
      <div className="card flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-text-secondary">No data available</p>
          <p className="text-sm text-text-muted mt-1">Waiting for glucose readings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      {/* Header with time range selector */}
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Glucose Chart</h2>
          <p className="text-sm text-text-secondary">Zoom level - scroll horizontally to navigate through all data</p>
        </div>

        {/* Time range buttons (zoom level) */}
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

      {/* Chart area with fixed Y-axis */}
      <div className="flex">
        {/* Fixed Y-axis on the left */}
        <div className="flex-shrink-0" style={{ width: '60px' }}>
          <svg width="60" height="400">
            <g transform="translate(0, 10)">
              {/* Y-axis labels */}
              {(() => {
                try {
                  // Safety check for yDomain
                  if (!yDomain || yDomain.length !== 2 ||
                      !isFinite(yDomain[0]) || !isFinite(yDomain[1]) ||
                      yDomain[0] >= yDomain[1]) {
                    return null;
                  }

                  return Array.from({ length: 9 }, (_, i) => {
                    const value = yDomain[0] + (yDomain[1] - yDomain[0]) * (8 - i) / 8;
                    const y = (380 * i) / 8;

                    if (!isFinite(value)) return null;

                    return (
                      <g key={i}>
                        <line
                          x1="50"
                          y1={y}
                          x2="60"
                          y2={y}
                          stroke="rgba(255,255,255,0.5)"
                          strokeWidth="1"
                        />
                        <text
                          x="45"
                          y={y}
                          textAnchor="end"
                          dominantBaseline="middle"
                          fill="rgba(255,255,255,0.5)"
                          fontSize="12"
                        >
                          {formatBgValue(Math.round(value), units)}
                        </text>
                      </g>
                    );
                  });
                } catch (error) {
                  console.error('Error rendering Y-axis:', error);
                  return null;
                }
              })()}
            </g>
          </svg>
        </div>

        {/* Scrollable chart container */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="overflow-x-auto overflow-y-hidden flex-1"
        >
          <LineChart
            data={chartData}
            width={chartWidth}
            height={400}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />

          {/* Target ranges */}
          <ReferenceArea
            y1={targetBottom}
            y2={targetTop}
            fill="#10B981"
            fillOpacity={0.1}
            label={{ value: 'Target', position: 'insideTopRight', fill: '#10B981' }}
          />

          <ReferenceArea
            y1={alarmLow}
            y2={targetBottom}
            fill="#F59E0B"
            fillOpacity={0.1}
          />

          <ReferenceArea
            y1={targetTop}
            y2={alarmHigh}
            fill="#F59E0B"
            fillOpacity={0.1}
          />

          <ReferenceArea
            y1={yDomain[0]}
            y2={alarmUrgentLow}
            fill="#EF4444"
            fillOpacity={0.1}
          />

          <ReferenceArea
            y1={alarmUrgentHigh}
            y2={yDomain[1]}
            fill="#EF4444"
            fillOpacity={0.1}
          />

          {/* Reference lines */}
          <ReferenceLine y={targetBottom} stroke="#10B981" strokeDasharray="3 3" />
          <ReferenceLine y={targetTop} stroke="#10B981" strokeDasharray="3 3" />
          <ReferenceLine y={alarmLow} stroke="#F59E0B" strokeDasharray="3 3" />
          <ReferenceLine y={alarmHigh} stroke="#F59E0B" strokeDasharray="3 3" />
          <ReferenceLine y={alarmUrgentLow} stroke="#EF4444" strokeDasharray="3 3" />
          <ReferenceLine y={alarmUrgentHigh} stroke="#EF4444" strokeDasharray="3 3" />

          <XAxis
            dataKey="time"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickCount={xAxisTickCount}
            tickFormatter={(time) => {
              const date = dayjs(time);
              // Show date + time for better context
              return date.format('DD.MM HH:mm');
            }}
            stroke="rgba(255,255,255,0.5)"
            style={{ fontSize: '11px' }}
            height={50}
          />

          {/* Y-axis is rendered separately on the left, not here */}
          <YAxis hide domain={yDomain} />

          <Tooltip content={<CustomTooltip />} />

          <Line
            type="monotone"
            dataKey="bg"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={<CustomDot />}
            activeDot={{ r: 6 }}
            animationDuration={300}
          />
        </LineChart>
        </div>
      </div>

      {/* Loading indicator */}
      {isLoadingMore && (
        <div className="mt-2 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-2">
            <div className="w-4 h-4 border-2 border-bg-info border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm text-text-secondary">Loading older data...</span>
          </div>
        </div>
      )}

      {/* No more data indicator */}
      {!hasMoreData && (
        <div className="mt-2 text-center text-xs text-text-muted">
          No more data available
        </div>
      )}
    </div>
  );
}
