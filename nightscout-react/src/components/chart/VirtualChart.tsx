import { useEffect, useRef, useMemo, memo, useState } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { useBgStore, useVisibleEntries } from '../../stores/bgStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { fetchOlderEntries } from '../../lib/api';
import { CurrentValueWindow } from './CurrentValueWindow';

// Time range presets in milliseconds
const TIME_RANGES = {
  '2h': 2 * 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
};

interface VirtualChartProps {
  defaultRange?: keyof typeof TIME_RANGES;
}

export const VirtualChart = memo(function VirtualChart({ defaultRange = '12h' }: VirtualChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const uplotRef = useRef<uPlot | null>(null);
  const isLoadingRef = useRef(false);
  const [hoveredValue, setHoveredValue] = useState<{ time: number; value: number } | null>(null);

  // Store data
  const allEntries = useBgStore((state) => state.entries);
  const viewport = useBgStore((state) => state.viewport);
  const initViewport = useBgStore((state) => state.initViewport);
  const shiftViewport = useBgStore((state) => state.shiftViewport);
  const setViewportRange = useBgStore((state) => state.setViewportRange);
  const prependOlderEntries = useBgStore((state) => state.prependOlderEntries);

  // Only get visible entries
  const visibleEntries = useVisibleEntries();

  // Settings
  const alarmUrgentHigh = useSettingsStore((state) => state.alarmUrgentHigh);
  const alarmUrgentLow = useSettingsStore((state) => state.alarmUrgentLow);

  // Initialize viewport on mount - START WITH NEWEST DATA FROM DB
  useEffect(() => {
    if (!viewport && allEntries.length > 0) {
      // Use the newest entry's timestamp, not Date.now()!
      const newestTimestamp = allEntries[0]?.mills || allEntries[0]?.date || Date.now();
      const rangeMs = TIME_RANGES[defaultRange];

      // Center viewport on the newest data
      initViewport(newestTimestamp, rangeMs);
    }
  }, [viewport, allEntries, defaultRange, initViewport]);

  // Convert entries to uPlot format - MEMOIZED
  const chartData = useMemo(() => {
    if (visibleEntries.length === 0) {
      return [[], []];
    }

    const timestamps: number[] = [];
    const values: number[] = [];

    // Sort by time (oldest first) and convert to seconds
    const sortedEntries = [...visibleEntries].sort((a, b) => {
      const timeA = a.mills || a.date;
      const timeB = b.mills || b.date;
      return timeA - timeB;
    });

    sortedEntries.forEach(entry => {
      const timestamp = entry.mills || entry.date;
      if (timestamp && isFinite(entry.sgv)) {
        timestamps.push(timestamp / 1000); // uPlot uses seconds
        values.push(entry.sgv);
      }
    });

    return [timestamps, values];
  }, [visibleEntries]);

  // Create chart ONCE
  useEffect(() => {
    if (!chartRef.current || !viewport) return;

    // Don't create if already exists
    if (uplotRef.current) return;

    const opts: uPlot.Options = {
      title: 'Blood Glucose',
      width: chartRef.current.clientWidth,
      height: 400,
      scales: {
        x: {
          time: true,
          range: [
            (viewport.center - viewport.rangeMs / 2) / 1000,
            (viewport.center + viewport.rangeMs / 2) / 1000,
          ],
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
          grid: { show: true, stroke: 'rgba(255, 255, 255, 0.1)' },
        },
        {
          grid: { show: true, stroke: 'rgba(255, 255, 255, 0.1)' },
        },
      ],
      cursor: {
        drag: {
          x: true,
          y: false,
        },
        sync: {
          key: 'bg-chart',
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
    };

    const chart = new uPlot(opts, chartData, chartRef.current);
    uplotRef.current = chart;

    // Cleanup on unmount
    return () => {
      if (uplotRef.current) {
        uplotRef.current.destroy();
        uplotRef.current = null;
      }
    };
  }, [viewport, alarmUrgentHigh, alarmUrgentLow]); // Create only when viewport initialized

  // Update chart data when visibleEntries change - NO DESTROY/CREATE!
  useEffect(() => {
    if (!uplotRef.current) return;

    // Update data without destroying chart
    uplotRef.current.setData(chartData);
  }, [chartData]);

  // Update X-axis range when viewport changes
  useEffect(() => {
    if (!uplotRef.current || !viewport) return;

    const minX = (viewport.center - viewport.rangeMs / 2) / 1000;
    const maxX = (viewport.center + viewport.rangeMs / 2) / 1000;

    uplotRef.current.setScale('x', { min: minX, max: maxX });
  }, [viewport]);

  // Handle zoom change
  const handleZoomChange = (range: keyof typeof TIME_RANGES) => {
    setViewportRange(TIME_RANGES[range]);
  };

  // Handle pan left (go back in time)
  const handlePanLeft = () => {
    if (!viewport) return;
    const delta = -viewport.rangeMs * 0.5; // Move by 50% of range
    shiftViewport(delta);
    checkAndLoadOlderData();
  };

  // Handle pan right (go forward in time)
  const handlePanRight = () => {
    if (!viewport || allEntries.length === 0) return;

    const delta = viewport.rangeMs * 0.5; // Move by 50% of range

    // Don't go beyond newest data
    const newestTimestamp = allEntries[0]?.mills || allEntries[0]?.date || Date.now();
    const newCenter = Math.min(viewport.center + delta, newestTimestamp);

    shiftViewport(newCenter - viewport.center);
  };

  // Check if we need to load older data - PROACTIVE LOADING
  const checkAndLoadOlderData = async () => {
    if (isLoadingRef.current || allEntries.length === 0 || !viewport) return;

    const oldestTimestamp = allEntries[allEntries.length - 1]?.mills || allEntries[allEntries.length - 1]?.date;
    if (!oldestTimestamp) return;

    // Calculate left edge of viewport
    const viewportLeftEdge = viewport.center - viewport.rangeMs / 2;

    // Load more data if viewport left edge is within 1.5x range of oldest data
    // This ensures we always have data to scroll to
    const loadThreshold = viewport.rangeMs * 1.5;

    if (viewportLeftEdge < oldestTimestamp + loadThreshold) {
      console.log('Loading older data...', {
        viewportLeftEdge: new Date(viewportLeftEdge),
        oldestTimestamp: new Date(oldestTimestamp),
        threshold: loadThreshold / 1000 / 60 / 60 + 'h',
      });

      isLoadingRef.current = true;

      try {
        // Load 3 days worth of data (864 entries at 5min intervals)
        const olderEntries = await fetchOlderEntries(oldestTimestamp, 864);
        if (olderEntries.length > 0) {
          prependOlderEntries(olderEntries);
          console.log(`Loaded ${olderEntries.length} older entries`);
        } else {
          console.log('No more older data available');
        }
      } catch (error) {
        console.error('Failed to load older entries:', error);
      } finally {
        isLoadingRef.current = false;
      }
    }
  };

  // Check for data loading when viewport changes
  useEffect(() => {
    checkAndLoadOlderData();
  }, [viewport]);

  // Handle window resize
  useEffect(() => {
    if (!uplotRef.current || !chartRef.current) return;

    const handleResize = () => {
      if (uplotRef.current && chartRef.current) {
        uplotRef.current.setSize({
          width: chartRef.current.clientWidth,
          height: 400,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!viewport) {
    return (
      <div className="card">
        <div className="flex items-center justify-center h-[400px]">
          <div className="text-text-secondary">Loading chart...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <CurrentValueWindow hoveredValue={hoveredValue} />
      <div className="card">
        {/* Controls */}
        <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <button onClick={handlePanLeft} className="btn-secondary">← Back</button>
          <button onClick={handlePanRight} className="btn-secondary">Forward →</button>
        </div>

        <div className="flex gap-2">
          {(Object.keys(TIME_RANGES) as Array<keyof typeof TIME_RANGES>).map(range => (
            <button
              key={range}
              onClick={() => handleZoomChange(range)}
              className={`btn-secondary ${viewport.rangeMs === TIME_RANGES[range] ? 'bg-primary' : ''}`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div ref={chartRef} className="w-full" />
      </div>
    </>
  );
});
