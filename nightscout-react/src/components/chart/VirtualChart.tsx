import { useEffect, useRef, useMemo, memo, useState } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { useBgStore, useVisibleEntries } from '../../stores/bgStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { fetchOlderEntries, fetchNewerEntries } from '../../lib/api';
import { CurrentValueWindow } from './CurrentValueWindow';
import { ChartTooltip } from './ChartTooltip';
import { VerticalCursorLine } from './VerticalCursorLine';

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
  const [hoveredValue, setHoveredValue] = useState<{
    time: number;
    value: number;
    index: number; // DEBUG: Array index
    x: number; // X position for BOTH line and tooltip (snapped to data point)
    y: number;
    bbox: {
      left: number;
      top: number;
      width: number;
      height: number;
    };
  } | null>(null);

  // Store data
  const allEntries = useBgStore((state) => state.entries);
  const viewport = useBgStore((state) => state.viewport);
  const initViewport = useBgStore((state) => state.initViewport);
  const shiftViewport = useBgStore((state) => state.shiftViewport);
  const setViewportRange = useBgStore((state) => state.setViewportRange);
  const prependOlderEntries = useBgStore((state) => state.prependOlderEntries);
  const appendNewerEntries = useBgStore((state) => state.appendNewerEntries);

  // Only get visible entries
  const visibleEntries = useVisibleEntries();

  // Settings
  const alarmUrgentHigh = useSettingsStore((state) => state.alarmUrgentHigh);
  const alarmUrgentLow = useSettingsStore((state) => state.alarmUrgentLow);
  const alarmHigh = useSettingsStore((state) => state.alarmHigh);
  const alarmLow = useSettingsStore((state) => state.alarmLow);

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

    // Plugin to draw colored BG zones
    const bgZonesPlugin: uPlot.Plugin = {
      hooks: {
        draw: [
          (u) => {
            const { ctx } = u;
            const { left, top, width, height } = u.bbox;

            ctx.save();

            // Helper to convert Y value to pixel position
            const yToPixel = (val: number) => {
              const scale = u.scales.y;
              if (!scale.min || !scale.max) return 0;
              const pct = (val - scale.min) / (scale.max - scale.min);
              return top + height - (pct * height);
            };

            // Draw zones from bottom to top
            // Urgent Low zone (red)
            ctx.fillStyle = 'rgba(220, 38, 38, 0.15)'; // red-600 with opacity
            ctx.fillRect(left, yToPixel(alarmUrgentLow), width, height);

            // Low zone (yellow)
            ctx.fillStyle = 'rgba(251, 191, 36, 0.15)'; // yellow-500 with opacity
            ctx.fillRect(left, yToPixel(alarmLow), width, yToPixel(alarmUrgentLow) - yToPixel(alarmLow));

            // Normal zone (green)
            ctx.fillStyle = 'rgba(34, 197, 94, 0.15)'; // green-500 with opacity
            ctx.fillRect(left, yToPixel(alarmHigh), width, yToPixel(alarmLow) - yToPixel(alarmHigh));

            // High zone (yellow)
            ctx.fillStyle = 'rgba(251, 191, 36, 0.15)'; // yellow-500 with opacity
            ctx.fillRect(left, yToPixel(alarmUrgentHigh), width, yToPixel(alarmHigh) - yToPixel(alarmUrgentHigh));

            // Urgent High zone (red)
            ctx.fillStyle = 'rgba(220, 38, 38, 0.15)'; // red-600 with opacity
            ctx.fillRect(left, top, width, yToPixel(alarmUrgentHigh) - top);

            // Draw threshold lines
            ctx.strokeStyle = 'rgba(220, 38, 38, 0.6)'; // red for urgent
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);

            // Urgent High line
            ctx.beginPath();
            ctx.moveTo(left, yToPixel(alarmUrgentHigh));
            ctx.lineTo(left + width, yToPixel(alarmUrgentHigh));
            ctx.stroke();

            // Urgent Low line
            ctx.beginPath();
            ctx.moveTo(left, yToPixel(alarmUrgentLow));
            ctx.lineTo(left + width, yToPixel(alarmUrgentLow));
            ctx.stroke();

            // High/Low lines (yellow)
            ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
            ctx.lineWidth = 1.5;

            // High line
            ctx.beginPath();
            ctx.moveTo(left, yToPixel(alarmHigh));
            ctx.lineTo(left + width, yToPixel(alarmHigh));
            ctx.stroke();

            // Low line
            ctx.beginPath();
            ctx.moveTo(left, yToPixel(alarmLow));
            ctx.lineTo(left + width, yToPixel(alarmLow));
            ctx.stroke();

            ctx.restore();
          },
        ],
      },
    };

    const opts: uPlot.Options = {
      title: 'Blood Glucose',
      width: chartRef.current.clientWidth,
      height: 500,
      plugins: [bgZonesPlugin],
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
          stroke: '#22C55E', // Default green color for points
          width: 0, // No connecting line
          points: {
            show: true,
            size: 6,
            fill: '#22C55E',
          },
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
        show: false, // Completely disable uPlot's cursor - we handle it ourselves
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
  }, [viewport, alarmUrgentHigh, alarmUrgentLow, alarmHigh, alarmLow, chartData]); // Create only when viewport initialized

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

    // Don't scroll beyond newest available data
    const newestTimestamp = allEntries[0]?.mills || allEntries[0]?.date;
    if (!newestTimestamp) return;

    // Calculate what the new center would be
    const newCenter = viewport.center + delta;

    // Limit to newest data - don't scroll into the future
    const maxCenter = newestTimestamp;
    const limitedCenter = Math.min(newCenter, maxCenter);

    // Only shift if we're actually moving
    if (limitedCenter > viewport.center) {
      shiftViewport(limitedCenter - viewport.center);
      checkAndLoadNewerData();
    }
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

  // Check if we need to load newer data - PROACTIVE LOADING
  const checkAndLoadNewerData = async () => {
    if (isLoadingRef.current || allEntries.length === 0 || !viewport) return;

    const newestTimestamp = allEntries[0]?.mills || allEntries[0]?.date;
    if (!newestTimestamp) return;

    // Calculate right edge of viewport
    const viewportRightEdge = viewport.center + viewport.rangeMs / 2;

    // Load more data if viewport right edge is within 1.5x range of newest data
    const loadThreshold = viewport.rangeMs * 1.5;

    if (viewportRightEdge > newestTimestamp - loadThreshold) {
      console.log('Loading newer data...', {
        viewportRightEdge: new Date(viewportRightEdge),
        newestTimestamp: new Date(newestTimestamp),
        threshold: loadThreshold / 1000 / 60 / 60 + 'h',
      });

      isLoadingRef.current = true;

      try {
        // Load 3 days worth of data (864 entries at 5min intervals)
        const newerEntries = await fetchNewerEntries(newestTimestamp, 864);
        if (newerEntries.length > 0) {
          appendNewerEntries(newerEntries);
          console.log(`Loaded ${newerEntries.length} newer entries`);
        } else {
          console.log('No more newer data available');
        }
      } catch (error) {
        console.error('Failed to load newer entries:', error);
      } finally {
        isLoadingRef.current = false;
      }
    }
  };

  // Check for data loading when viewport changes (both directions)
  useEffect(() => {
    checkAndLoadOlderData();
    checkAndLoadNewerData();
  }, [viewport]);

  // Handle window resize
  useEffect(() => {
    if (!uplotRef.current || !chartRef.current) return;

    const handleResize = () => {
      if (uplotRef.current && chartRef.current) {
        uplotRef.current.setSize({
          width: chartRef.current.clientWidth,
          height: 500,
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Custom mouse tracking - completely independent from uPlot's cursor
  useEffect(() => {
    if (!chartRef.current || !uplotRef.current || chartData[0].length === 0) return;

    const handleMouseMove = (e: MouseEvent) => {
      const chart = uplotRef.current;
      if (!chart) return;

      // Get canvas element position (not container!)
      const canvas = chart.root.querySelector('canvas');
      if (!canvas) return;

      const canvasRect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - canvasRect.left;
      const mouseY = e.clientY - canvasRect.top;

      const bbox = chart.bbox;

      // Don't check bbox boundaries - data points can be rendered outside bbox!
      // We only check the 50px distance to nearest point below.

      // Convert mouse X position to timestamp using uPlot's scale
      const mouseTimestamp = chart.posToVal(mouseX, 'x');

      // Find nearest data point by TIME distance (not pixel distance!)
      const data = chart.data;
      let closestIdx = 0;
      let minTimeDist = Infinity;

      for (let i = 0; i < data[0].length; i++) {
        const timeDist = Math.abs(data[0][i] - mouseTimestamp);
        if (timeDist < minTimeDist) {
          minTimeDist = timeDist;
          closestIdx = i;
        }
      }

      // Convert time distance to pixel distance to check if we're close enough
      const closestPointX = chart.valToPos(data[0][closestIdx], 'x');
      const pixelDist = Math.abs(closestPointX - mouseX);

      // Only show if:
      // 1. We're close enough to a data point (within 50 pixels)
      // 2. The data point is actually visible within the grid (not outside viewport)
      const isWithinGrid = closestPointX >= bbox.left && closestPointX <= bbox.left + bbox.width;

      if (pixelDist > 50 || !isWithinGrid) {
        setHoveredValue(null);
        return;
      }

      const value = data[1][closestIdx];
      const exactTimestamp = data[0][closestIdx];

      if (value != null && isFinite(value)) {
        // Calculate data point pixel positions (canvas coordinates)
        const dataPointX = chart.valToPos(exactTimestamp, 'x');
        const dataPointY = chart.valToPos(value, 'y');

        // Convert canvas coordinates to container coordinates
        const containerRect = chartRef.current!.getBoundingClientRect();
        const canvasOffsetX = canvasRect.left - containerRect.left;
        const canvasOffsetY = canvasRect.top - containerRect.top;

        // BOTH line and tooltip snap to the data point position
        const dataPointXInContainer = dataPointX + canvasOffsetX;

        if (debugPositions) {
          const mouseXInContainer = mouseX + canvasOffsetX;
          console.log('FINAL POSITIONS:');
          console.log('  Mouse X (container):', mouseXInContainer.toFixed(1));
          console.log('  Data Point X (container):', dataPointXInContainer.toFixed(1));
          console.log('  Snap distance:', Math.abs(mouseXInContainer - dataPointXInContainer).toFixed(1), 'px');
        }

        setHoveredValue({
          time: exactTimestamp * 1000,
          value,
          index: closestIdx, // DEBUG: Show which index was selected
          x: dataPointXInContainer, // BOTH line and tooltip at data point
          y: dataPointY + canvasOffsetY,
          bbox: {
            left: bbox.left + canvasOffsetX,
            top: bbox.top + canvasOffsetY,
            width: bbox.width,
            height: bbox.height,
          },
        });
      }
    };

    const handleMouseLeave = () => {
      setHoveredValue(null);
    };

    const chartElement = chartRef.current;
    chartElement.addEventListener('mousemove', handleMouseMove);
    chartElement.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      chartElement.removeEventListener('mousemove', handleMouseMove);
      chartElement.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [chartData]);

  // Handle mouse wheel scrolling
  useEffect(() => {
    if (!chartRef.current || !viewport) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      // Scroll amount based on viewport range (10% of visible range per scroll)
      const scrollAmount = viewport.rangeMs * 0.1;

      if (e.deltaY > 0) {
        // Scroll down = forward in time
        const newestTimestamp = allEntries[0]?.mills || allEntries[0]?.date;
        if (newestTimestamp) {
          const newCenter = viewport.center + scrollAmount;
          const maxCenter = newestTimestamp;
          const limitedCenter = Math.min(newCenter, maxCenter);

          if (limitedCenter > viewport.center) {
            shiftViewport(limitedCenter - viewport.center);
            checkAndLoadNewerData();
          }
        }
      } else {
        // Scroll up = backward in time
        shiftViewport(-scrollAmount);
        checkAndLoadOlderData();
      }
    };

    const chartElement = chartRef.current;
    chartElement.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      chartElement.removeEventListener('wheel', handleWheel);
    };
  }, [viewport, allEntries, shiftViewport, checkAndLoadOlderData, checkAndLoadNewerData]);

  if (!viewport) {
    return (
      <div className="card">
        <div className="flex items-center justify-center h-[500px]">
          <div className="text-text-secondary">Loading chart...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <CurrentValueWindow />
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

      {/* Chart Container - relative for tooltip positioning */}
      <div className="relative w-full">
        <div ref={chartRef} className="w-full" />
        {/* Tooltip overlay - pointer-events-none so it doesn't block chart */}
        <div className="absolute inset-0 pointer-events-none">
          {hoveredValue && <VerticalCursorLine x={hoveredValue.x} bbox={hoveredValue.bbox} />}
          <ChartTooltip value={hoveredValue} />
        </div>
      </div>
      </div>
    </>
  );
});
