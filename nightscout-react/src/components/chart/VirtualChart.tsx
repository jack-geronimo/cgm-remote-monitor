import { useEffect, useRef, useMemo, memo, useState, useCallback } from 'react';
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

  // Drag state in refs to persist across renders
  const isDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartTimeRef = useRef(0);

  const [hoveredValue, setHoveredValue] = useState<{
    time: number;
    value: number;
    x: number;
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
  const setViewportCenter = useBgStore((state) => state.setViewportCenter);
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

  // Create chart - recreate when alarm thresholds change
  useEffect(() => {
    if (!chartRef.current || !viewport) return;

    // Destroy existing chart if thresholds changed
    if (uplotRef.current) {
      uplotRef.current.destroy();
      uplotRef.current = null;
    }

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
          stroke: '#ffffff',
          grid: { show: true, stroke: 'rgba(255, 255, 255, 0.1)' },
          ticks: { stroke: '#ffffff', width: 2 },
          font: '600 14px system-ui, sans-serif',
          labelFont: '600 14px system-ui, sans-serif',
        },
        {
          stroke: '#ffffff',
          grid: { show: true, stroke: 'rgba(255, 255, 255, 0.1)' },
          ticks: { stroke: '#ffffff', width: 2 },
          font: '600 14px system-ui, sans-serif',
          labelFont: '600 14px system-ui, sans-serif',
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
  const checkAndLoadOlderData = useCallback(async () => {
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
  }, [allEntries, viewport, prependOlderEntries]);

  // Check if we need to load newer data - PROACTIVE LOADING
  const checkAndLoadNewerData = useCallback(async () => {
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
  }, [allEntries, viewport, appendNewerEntries]);

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

      // Get chart's over canvas element for correct positioning
      // uPlot creates multiple canvas layers - we need the "over" layer for interactions
      const canvas = chart.over;
      if (!canvas) return;

      const canvasRect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - canvasRect.left;

      const bbox = chart.bbox;
      const data = chart.data;

      // Find nearest data point by PIXEL distance
      // This is more reliable than time-based distance because it directly measures
      // what the user sees on screen
      let closestIdx = -1;
      let minPixelDist = Infinity;

      // DEBUG: Log every 20th mouse move
      const shouldDebug = Math.random() < 0.05;

      for (let i = 0; i < data[0].length; i++) {
        const pointX = chart.valToPos(data[0][i], 'x');
        const pixelDist = Math.abs(pointX - mouseX);

        if (pixelDist < minPixelDist) {
          minPixelDist = pixelDist;
          closestIdx = i;
        }
      }

      if (closestIdx === -1) {
        setHoveredValue(null);
        return;
      }

      // Calculate dynamic threshold based on average spacing between data points
      // This ensures tooltip works at all zoom levels
      let avgSpacing = 50; // Default fallback
      if (data[0].length > 1) {
        // Sample first few visible points to estimate spacing
        const sampleSize = Math.min(10, data[0].length - 1);
        let totalSpacing = 0;
        let count = 0;

        for (let i = 0; i < sampleSize; i++) {
          const x1 = chart.valToPos(data[0][i], 'x');
          const x2 = chart.valToPos(data[0][i + 1], 'x');
          const spacing = Math.abs(x2 - x1);

          // Only count visible points
          if (x1 >= bbox.left && x1 <= bbox.left + bbox.width) {
            totalSpacing += spacing;
            count++;
          }
        }

        if (count > 0) {
          avgSpacing = totalSpacing / count;
        }
      }

      // Use 75% of average spacing as threshold, with a reasonable minimum and maximum
      // This allows hovering "between" data points while avoiding false positives
      const dynamicThreshold = Math.max(30, Math.min(avgSpacing * 0.75, 150));

      const closestPointX = chart.valToPos(data[0][closestIdx], 'x');
      const pixelDist = minPixelDist;

      if (shouldDebug) {
        console.log('=== CURSOR DEBUG (PIXEL-BASED) ===');
        console.log('Mouse X (px):', mouseX.toFixed(1));
        console.log('Canvas left:', canvasRect.left);
        console.log('Client X:', e.clientX);
        console.log('Bbox left:', bbox.left);
        console.log('Bbox width:', bbox.width);
        console.log('Closest index:', closestIdx);
        console.log('Closest point X:', closestPointX.toFixed(1));
        console.log('Closest data timestamp:', new Date(data[0][closestIdx] * 1000).toLocaleTimeString());
        console.log('Closest data value:', data[1][closestIdx]);
        console.log('Min pixel distance:', minPixelDist.toFixed(1));
        console.log('Average spacing:', avgSpacing.toFixed(1));
        console.log('Dynamic threshold:', dynamicThreshold.toFixed(1));
        console.log('Distance from left edge:', (closestPointX - bbox.left).toFixed(1));
        console.log('Distance from right edge:', (bbox.left + bbox.width - closestPointX).toFixed(1));

        // Show neighbors with their rendered X positions
        console.log('NEIGHBORS:');
        for (let i = Math.max(0, closestIdx - 3); i <= Math.min(data[0].length - 1, closestIdx + 3); i++) {
          const marker = i === closestIdx ? ' ← SELECTED' : '';
          const pointX = chart.valToPos(data[0][i], 'x');
          const distFromMouse = Math.abs(pointX - mouseX);
          const distFromLeft = pointX - bbox.left;
          console.log(`  [${i}]: ${new Date(data[0][i] * 1000).toLocaleTimeString()} = ${data[1][i]}, X=${pointX.toFixed(1)}px, dist=${distFromMouse.toFixed(1)}px, fromLeft=${distFromLeft.toFixed(1)}px${marker}`);
        }
        console.log('====================');
      }

      // Only show tooltip if we're close enough to a data point
      // No bbox boundary check needed - if a point is in the data array and rendered,
      // and the pixel distance is small enough, show the tooltip
      // This fixes the issue where edge points are visible but don't show tooltips
      if (pixelDist > dynamicThreshold) {
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

        setHoveredValue({
          time: exactTimestamp * 1000,
          value,
          x: dataPointXInContainer,
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

  // Handle mouse drag to pan the chart
  useEffect(() => {
    if (!chartRef.current || !viewport) return;

    const handleMouseDown = (e: MouseEvent) => {
      // Only start dragging on left mouse button
      if (e.button !== 0) return;

      isDraggingRef.current = true;
      dragStartXRef.current = e.clientX;
      dragStartTimeRef.current = viewport.center;

      // Change cursor to grabbing
      if (chartRef.current) {
        chartRef.current.style.cursor = 'grabbing';
      }

      e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !uplotRef.current || !viewport) return;

      const deltaX = e.clientX - dragStartXRef.current;

      // Convert pixel movement to time delta
      // Negative because dragging right should move chart left (back in time)
      const chart = uplotRef.current;
      const bbox = chart.bbox;
      const pixelToTime = viewport.rangeMs / bbox.width;
      const timeDelta = -deltaX * pixelToTime;

      // Calculate new center
      let newCenter = dragStartTimeRef.current + timeDelta;

      // Limit to newest data - don't scroll into the future
      const newestTimestamp = allEntries[0]?.mills || allEntries[0]?.date || Date.now();
      const oldestPossible = viewport.rangeMs / 2; // Can't go before half a range from start

      newCenter = Math.max(oldestPossible, Math.min(newCenter, newestTimestamp));

      // Set viewport center directly (more efficient than computing deltas)
      setViewportCenter(newCenter);

      // Check if we need to load more data
      checkAndLoadOlderData();
      checkAndLoadNewerData();

      e.preventDefault();
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;

        // Reset cursor
        if (chartRef.current) {
          chartRef.current.style.cursor = 'grab';
        }
      }
    };

    const handleMouseLeave = () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;

        // Reset cursor
        if (chartRef.current) {
          chartRef.current.style.cursor = 'grab';
        }
      }
    };

    const chartElement = chartRef.current;

    // Set initial cursor
    chartElement.style.cursor = 'grab';

    chartElement.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    chartElement.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      chartElement.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      chartElement.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [viewport, allEntries, setViewportCenter, checkAndLoadOlderData, checkAndLoadNewerData]);

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
