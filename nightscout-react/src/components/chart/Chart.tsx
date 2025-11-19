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
    console.log('Chart: entries.length =', entries.length);
    if (entries.length > 0) {
      console.log('Chart: first entry =', entries[0]);
      console.log('Chart: last entry =', entries[entries.length - 1]);
    }
    const data = entries
      .map((entry) => {
        // Use mills if available, otherwise fall back to date
        const timestamp = entry.mills || entry.date;
        return {
          time: timestamp,
          bg: entry.sgv,
          timeFormatted: dayjs(timestamp).format('HH:mm'),
        };
      })
      .reverse(); // Recharts expects chronological order
    console.log('Chart: chartData.length =', data.length);
    if (data.length > 0) {
      console.log('Chart: first chartData =', data[0]);
      console.log('Chart: last chartData =', data[data.length - 1]);
    }
    return data;
  }, [entries]);

  // Calculate chart width based on selected time range (zoom level)
  // selectedHours controls how much horizontal space each hour takes
  // More pixels per hour for shorter time ranges = more zoomed in
  const chartWidth = useMemo(() => {
    if (chartData.length === 0) {
      console.log('Chart: No data, using default width 1200');
      return 1200;
    }

    // Calculate pixels per hour based on zoom level (increased for better readability)
    const pixelsPerHour = selectedHours <= 3 ? 600 : selectedHours <= 6 ? 400 : selectedHours <= 12 ? 250 : 150;

    // Calculate total time span of data in hours
    const oldestTime = chartData[0]?.time || Date.now();
    const newestTime = chartData[chartData.length - 1]?.time || Date.now();
    const totalHours = (newestTime - oldestTime) / (60 * 60 * 1000);

    // Calculate total width needed
    const calculatedWidth = totalHours * pixelsPerHour;

    // Ensure minimum width
    const width = Math.max(calculatedWidth, 1200);
    console.log('Chart: width =', width, 'totalHours =', totalHours, 'pixelsPerHour =', pixelsPerHour);
    return width;
  }, [chartData, selectedHours]);

  // Auto-scroll to newest data on initial load
  useEffect(() => {
    console.log('Chart: Auto-scroll effect, hasAutoScrolled =', hasAutoScrolled.current, 'chartData.length =', chartData.length);
    if (!hasAutoScrolled.current && scrollContainerRef.current && chartData.length > 0) {
      console.log('Chart: Scheduling auto-scroll');
      // Wait for render
      setTimeout(() => {
        if (scrollContainerRef.current) {
          const scrollWidth = scrollContainerRef.current.scrollWidth;
          console.log('Chart: Auto-scrolling to', scrollWidth);
          scrollContainerRef.current.scrollLeft = scrollWidth;
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

    const values = chartData.map((d) => d.bg);
    const min = Math.min(...values, alarmUrgentLow);
    const max = Math.max(...values, alarmUrgentHigh);
    const padding = (max - min) * 0.1;

    return [Math.max(40, min - padding), Math.min(400, max + padding)];
  }, [chartData, alarmUrgentLow, alarmUrgentHigh]);

  console.log('Chart: Rendering, chartData.length =', chartData.length);

  if (chartData.length === 0) {
    console.log('Chart: Showing "No data available"');
    return (
      <div className="card flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-text-secondary">No data available</p>
          <p className="text-sm text-text-muted mt-1">Waiting for glucose readings...</p>
        </div>
      </div>
    );
  }

  console.log('Chart: Rendering chart with chartWidth =', chartWidth);

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

      {/* Scrollable chart container */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="overflow-x-auto overflow-y-hidden"
        style={{ width: '100%' }}
      >
        <LineChart
          data={chartData}
          width={chartWidth}
          height={400}
          margin={{ top: 10, right: 30, left: 10, bottom: 0 }}
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
            tickFormatter={(time) => dayjs(time).format('HH:mm')}
            stroke="rgba(255,255,255,0.5)"
            style={{ fontSize: '12px' }}
          />

          <YAxis
            domain={yDomain}
            stroke="rgba(255,255,255,0.5)"
            style={{ fontSize: '12px' }}
            tickFormatter={(value) => formatBgValue(value, units)}
          />

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
