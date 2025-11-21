import { useEffect, useRef, useMemo, memo, useState, useCallback } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { useBgStore, useVisibleEntries } from '../../stores/bgStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { fetchOlderEntries, fetchNewerEntries, fetchOlderTreatments, fetchNewerTreatments } from '../../lib/api';
import { ChartTooltip } from './ChartTooltip';
import { VerticalCursorLine } from './VerticalCursorLine';
import type { Treatment } from '../../types';

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
    seriesIdx?: number; // Which series is hovered (1=BG, 2=Insulin, 3=Carbs)
    treatment?: Treatment; // Treatment data if hovering treatment
  } | null>(null);

  // Series visibility state
  const [seriesVisible, setSeriesVisible] = useState({
    bg: true,
    insulin: true,
    carbs: true,
  });

  // Store data
  const allEntries = useBgStore((state) => state.entries);
  const allTreatments = useBgStore((state) => state.treatments);
  const viewport = useBgStore((state) => state.viewport);
  const initViewport = useBgStore((state) => state.initViewport);
  const shiftViewport = useBgStore((state) => state.shiftViewport);
  const setViewportCenter = useBgStore((state) => state.setViewportCenter);
  const setViewportRange = useBgStore((state) => state.setViewportRange);
  const prependOlderEntries = useBgStore((state) => state.prependOlderEntries);
  const appendNewerEntries = useBgStore((state) => state.appendNewerEntries);
  const prependOlderTreatments = useBgStore((state) => state.prependOlderTreatments);
  const appendNewerTreatments = useBgStore((state) => state.appendNewerTreatments);

  // Only get visible entries
  const visibleEntries = useVisibleEntries();

  // Filter visible treatments based on viewport
  const visibleTreatments = useMemo(() => {
    if (!viewport || !allTreatments.length) {
      return [];
    }

    const viewportStart = viewport.center - viewport.rangeMs / 2;
    const viewportEnd = viewport.center + viewport.rangeMs / 2;

    const filtered = allTreatments.filter(treatment => {
      const timestamp = treatment.mills;
      return timestamp >= viewportStart && timestamp <= viewportEnd;
    });

    return filtered;
  }, [allTreatments, viewport]);

  // Settings
  const alarmUrgentHigh = useSettingsStore((state) => state.alarmUrgentHigh);
  const alarmUrgentLow = useSettingsStore((state) => state.alarmUrgentLow);
  const alarmHigh = useSettingsStore((state) => state.alarmHigh);
  const alarmLow = useSettingsStore((state) => state.alarmLow);
  const timezone = useSettingsStore((state) => state.timezone);
  const locale = useSettingsStore((state) => state.locale);
  const timeFormat = useSettingsStore((state) => state.timeFormat);

  // Initialize viewport on mount - START WITH NEWEST DATA FROM DB
  useEffect(() => {
    if (!viewport && allEntries.length > 0) {
      // Use the newest entry's timestamp, not Date.now()!
      const newestTimestamp = allEntries[0]?.mills || allEntries[0]?.date || Date.now();
      const rangeMs = TIME_RANGES[defaultRange];

      // Position newest data at 85% from left (show 85% history, 15% future/buffer)
      // center - halfRange = left edge, so: newestTimestamp - 0.35*rangeMs - 0.5*rangeMs = newestTimestamp - 0.85*rangeMs
      const center = newestTimestamp - (rangeMs * 0.35);

      initViewport(center, rangeMs);
    }
  }, [viewport, allEntries, defaultRange, initViewport]);

  // Helper to find closest BG value at a given time
  const findClosestBgValue = (treatmentTime: number, entries: typeof visibleEntries): number => {
    let closestEntry = entries[0];
    let minDiff = Math.abs((entries[0]?.mills || entries[0]?.date || 0) - treatmentTime);

    for (const entry of entries) {
      const entryTime = entry.mills || entry.date;
      const diff = Math.abs(entryTime - treatmentTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestEntry = entry;
      }
    }

    return closestEntry?.sgv || 100;
  };

  // Store treatment lookup map for tooltip
  const treatmentMapRef = useRef<Map<number, Treatment>>(new Map());

  // Convert entries + treatments to uPlot multi-series format - MEMOIZED
  const chartData = useMemo(() => {
    if (visibleEntries.length === 0) {
      return [[], [], [], []];
    }

    // Clear and rebuild treatment map
    treatmentMapRef.current.clear();

    // Collect all unique timestamps from BG entries and treatments
    const timestampMap = new Map<number, {
      bg?: number;
      insulin?: { amount: number; treatment: Treatment };
      carbs?: { amount: number; treatment: Treatment };
    }>();

    // Add BG entries
    visibleEntries.forEach(entry => {
      const timestamp = entry.mills || entry.date;
      if (timestamp && isFinite(entry.sgv)) {
        timestampMap.set(timestamp / 1000, {
          bg: entry.sgv,
        });
      }
    });

    // Add treatments
    visibleTreatments.forEach(treatment => {
      const timestamp = treatment.mills / 1000;
      const bgValue = findClosestBgValue(treatment.mills, visibleEntries);

      const existing = timestampMap.get(timestamp) || {};

      if (treatment.insulin && treatment.insulin > 0) {
        existing.insulin = { amount: treatment.insulin, treatment };
        // Store in treatment map for tooltip lookup
        treatmentMapRef.current.set(timestamp, treatment);
      }

      if (treatment.carbs && treatment.carbs > 0) {
        existing.carbs = { amount: treatment.carbs, treatment };
        // Store in treatment map for tooltip lookup
        treatmentMapRef.current.set(timestamp, treatment);
      }

      // Store BG value at treatment time if not already there
      if (!existing.bg) {
        existing.bg = bgValue;
      }

      timestampMap.set(timestamp, existing);
    });

    // Sort timestamps
    const sortedTimestamps = Array.from(timestampMap.keys()).sort((a, b) => a - b);

    // Create series arrays
    const timestamps: number[] = [];
    const bgValues: (number | null)[] = [];
    const insulinValues: (number | null)[] = [];
    const carbsValues: (number | null)[] = [];

    sortedTimestamps.forEach(ts => {
      const data = timestampMap.get(ts)!;

      timestamps.push(ts);
      bgValues.push(data.bg || null);
      insulinValues.push(data.insulin ? data.bg! : null);
      carbsValues.push(data.carbs ? data.bg! : null);
    });

    return [timestamps, bgValues, insulinValues, carbsValues];
  }, [visibleEntries, visibleTreatments]);

  // Calculate dynamic Y-axis range (Hybrid approach) - MEMOIZED
  const yAxisRange = useMemo((): [number, number] => {
    // Default range based on alarm thresholds
    const defaultMin = Math.max(40, alarmUrgentLow - 20);
    const defaultMax = Math.min(400, alarmUrgentHigh + 20);

    // If no data, use default
    if (chartData[1].length === 0) {
      return [defaultMin, defaultMax];
    }

    // Find min/max of visible data
    const dataValues = chartData[1];
    const dataMin = Math.min(...dataValues);
    const dataMax = Math.max(...dataValues);

    // Calculate dynamic range with padding (10% of data range or minimum 20 mg/dL)
    const dataRange = dataMax - dataMin;
    const padding = Math.max(dataRange * 0.1, 20);

    let minY = dataMin - padding;
    let maxY = dataMax + padding;

    // Ensure alarm thresholds are always visible
    minY = Math.min(minY, alarmUrgentLow - 10);
    maxY = Math.max(maxY, alarmUrgentHigh + 10);

    // Apply absolute bounds (40-400 mg/dL)
    minY = Math.max(40, minY);
    maxY = Math.min(400, maxY);

    // Ensure minimum range of 60 mg/dL for readability
    const finalRange = maxY - minY;
    if (finalRange < 60) {
      const expansion = (60 - finalRange) / 2;
      minY = Math.max(40, minY - expansion);
      maxY = Math.min(400, maxY + expansion);
    }

    return [Math.round(minY), Math.round(maxY)];
  }, [chartData, alarmUrgentHigh, alarmUrgentLow]);

  // Create chart - recreate when alarm thresholds change
  useEffect(() => {
    if (!chartRef.current || !viewport) return;

    // Destroy existing chart if thresholds changed
    if (uplotRef.current) {
      uplotRef.current.destroy();
      uplotRef.current = null;
    }

    // Helper function to get color based on BG value
    const getColorForValue = (val: number) => {
      if (val >= alarmUrgentHigh || val <= alarmUrgentLow) {
        return 'rgb(239, 68, 68)'; // red-500
      }
      if (val >= alarmHigh || val <= alarmLow) {
        return 'rgb(249, 115, 22)'; // orange-500
      }
      return 'rgb(34, 197, 94)'; // green-500
    };

    // Plugin to draw colored BG zones
    const bgZonesPlugin: uPlot.Plugin = {
      hooks: {
        draw: [
          (u) => {
            const { ctx } = u;
            const { left, top, width, height } = u.bbox;

            ctx.save();

            // Clip to the chart's bbox to prevent drawing outside the chart area
            ctx.beginPath();
            ctx.rect(left, top, width, height);
            ctx.clip();

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

    // Plugin to draw all series with custom shapes
    const coloredPointsPlugin: uPlot.Plugin = {
      hooks: {
        drawSeries: [
          (u, seriesIdx) => {
            const { ctx } = u;
            const xData = u.data[0];
            const yData = u.data[seriesIdx];

            if (!xData || !yData) return;

            ctx.save();

            // Clip to the chart's bbox to prevent drawing outside the chart area
            const { left, top, width, height } = u.bbox;
            ctx.beginPath();
            ctx.rect(left, top, width, height);
            ctx.clip();

            // Draw based on series type
            if (seriesIdx === 1 && seriesVisible.bg) {
              // Series 1: BG Values (colored circles)
              for (let i = 0; i < xData.length; i++) {
                const xVal = xData[i];
                const yVal = yData[i];

                if (xVal == null || yVal == null) continue;

                const cx = u.valToPos(xVal, 'x', true);
                const cy = u.valToPos(yVal, 'y', true);
                const color = getColorForValue(yVal);

                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(cx, cy, 3, 0, 2 * Math.PI);
                ctx.fill();
              }
            } else if (seriesIdx === 2 && seriesVisible.insulin) {
              // Series 2: Insulin (blue triangles)
              for (let i = 0; i < xData.length; i++) {
                const xVal = xData[i];
                const yVal = yData[i];

                if (xVal == null || yVal == null) continue;

                const cx = u.valToPos(xVal, 'x', true);
                const cy = u.valToPos(yVal, 'y', true);

                // Draw triangle pointing down
                const size = 8;
                ctx.fillStyle = '#3b82f6';
                ctx.strokeStyle = '#1e40af';
                ctx.lineWidth = 2;

                ctx.beginPath();
                ctx.moveTo(cx, cy + size); // Bottom point
                ctx.lineTo(cx - size, cy - size); // Top left
                ctx.lineTo(cx + size, cy - size); // Top right
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
              }
            } else if (seriesIdx === 3 && seriesVisible.carbs) {
              // Series 3: Carbs (orange circles)
              for (let i = 0; i < xData.length; i++) {
                const xVal = xData[i];
                const yVal = yData[i];

                if (xVal == null || yVal == null) continue;

                const cx = u.valToPos(xVal, 'x', true);
                const cy = u.valToPos(yVal, 'y', true);

                // Draw filled circle
                const radius = 7;
                ctx.fillStyle = '#f59e0b';
                ctx.strokeStyle = '#d97706';
                ctx.lineWidth = 2;

                ctx.beginPath();
                ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
              }
            }

            ctx.restore();
          },
        ],
      },
    };

    const opts: uPlot.Options = {
      width: chartRef.current.clientWidth,
      height: 500,
      plugins: [bgZonesPlugin, coloredPointsPlugin],
      scales: {
        x: {
          time: true,
          range: [
            (viewport.center - viewport.rangeMs / 2) / 1000,
            (viewport.center + viewport.rangeMs / 2) / 1000,
          ],
        },
        y: {
          range: yAxisRange, // Use dynamic hybrid range
        },
      },
      series: [
        {}, // X-axis (time)
        {
          // Series 1: BG Values
          label: 'BG',
          stroke: 'transparent',
          width: 0,
          points: {
            show: false, // Custom rendering via plugin
          },
          show: seriesVisible.bg,
        },
        {
          // Series 2: Insulin Treatments
          label: 'Insulin',
          stroke: 'transparent',
          width: 0,
          points: {
            show: false, // Custom rendering via plugin
          },
          show: seriesVisible.insulin,
        },
        {
          // Series 3: Carbs Treatments
          label: 'Carbs',
          stroke: 'transparent',
          width: 0,
          points: {
            show: false, // Custom rendering via plugin
          },
          show: seriesVisible.carbs,
        },
      ],
      axes: [
        {
          stroke: '#ffffff',
          grid: { show: true, stroke: 'rgba(255, 255, 255, 0.1)' },
          ticks: { stroke: '#ffffff', width: 2 },
          font: '600 14px system-ui, sans-serif',
          labelFont: '600 14px system-ui, sans-serif',
          // Custom time formatting for X-axis
          values: (_u: uPlot, vals: number[]) => {
            return vals.map((v, i) => {
              try {
                const date = new Date(v * 1000);
                const timeStr = date.toLocaleTimeString(locale, {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: timeFormat === 12,
                  timeZone: timezone,
                });

                // Show date if:
                // 1. It's the first label, OR
                // 2. The date changed from the previous label
                let showDate = false;
                if (i === 0) {
                  showDate = true;
                } else if (i > 0) {
                  const prevDate = new Date(vals[i - 1] * 1000);
                  const currDate = date;

                  // Check if day changed
                  const dayChanged = prevDate.getDate() !== currDate.getDate() ||
                                    prevDate.getMonth() !== currDate.getMonth() ||
                                    prevDate.getFullYear() !== currDate.getFullYear();

                  showDate = dayChanged;
                }

                if (showDate) {
                  const dateStr = date.toLocaleDateString(locale, {
                    day: 'numeric',
                    month: 'short',
                    timeZone: timezone,
                  });
                  return `${dateStr}\n${timeStr}`;
                }

                return timeStr;
              } catch (error) {
                // Fallback to default formatting
                return new Date(v * 1000).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: timeFormat === 12,
                });
              }
            });
          },
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

    const chart = new uPlot(opts, chartData as uPlot.AlignedData, chartRef.current);
    uplotRef.current = chart;

    // Cleanup on unmount
    return () => {
      if (uplotRef.current) {
        uplotRef.current.destroy();
        uplotRef.current = null;
      }
    };
  }, [viewport, alarmUrgentHigh, alarmUrgentLow, alarmHigh, alarmLow, seriesVisible, timezone, locale, timeFormat]); // Create only when viewport initialized or settings change (chartData updates handled separately)

  // Update chart data when visibleEntries change - NO DESTROY/CREATE!
  useEffect(() => {
    if (!uplotRef.current) return;

    // Update data without destroying chart
    uplotRef.current.setData(chartData as uPlot.AlignedData);
  }, [chartData]);

  // Update X-axis range when viewport changes
  useEffect(() => {
    if (!uplotRef.current || !viewport) return;

    const minX = (viewport.center - viewport.rangeMs / 2) / 1000;
    const maxX = (viewport.center + viewport.rangeMs / 2) / 1000;

    uplotRef.current.setScale('x', { min: minX, max: maxX });
  }, [viewport]);

  // Update Y-axis range when yAxisRange changes (hybrid dynamic scaling)
  useEffect(() => {
    if (!uplotRef.current) return;

    uplotRef.current.setScale('y', { min: yAxisRange[0], max: yAxisRange[1] });
  }, [yAxisRange]);

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

  // Handle jump to now (most recent data)
  const handleJumpToNow = () => {
    if (!viewport || allEntries.length === 0) return;

    const newestTimestamp = allEntries[0]?.mills || allEntries[0]?.date;
    if (!newestTimestamp) return;

    // Position newest data at 85% from left (show 85% history, 15% future/buffer)
    // Same logic as initialization
    const center = newestTimestamp - (viewport.rangeMs * 0.35);

    console.log('🎯 Jumping to now:', {
      newestEntry: new Date(newestTimestamp).toLocaleString(),
      newCenter: new Date(center).toLocaleString(),
    });

    // Set viewport center directly
    setViewportCenter(center);

    // Load newer data if needed
    checkAndLoadNewerData();
  };

  // Check if we need to load older data - PROACTIVE LOADING
  const checkAndLoadOlderData = useCallback(async () => {
    if (isLoadingRef.current || allEntries.length === 0 || !viewport) return;

    // Always use Entry timestamp for triggering, but load treatments separately
    const oldestEntryTimestamp = allEntries[allEntries.length - 1]?.mills || allEntries[allEntries.length - 1]?.date;
    if (!oldestEntryTimestamp) return;

    // Calculate left edge of viewport
    const viewportLeftEdge = viewport.center - viewport.rangeMs / 2;

    // Load more data if viewport left edge is within 1.5x range of oldest entries
    // This ensures we always have data to scroll to
    const loadThreshold = viewport.rangeMs * 1.5;

    if (viewportLeftEdge < oldestEntryTimestamp + loadThreshold) {
      // Get oldest treatment timestamp for loading treatments
      const oldestTreatmentTimestamp = allTreatments.length > 0
        ? allTreatments[allTreatments.length - 1]?.mills
        : oldestEntryTimestamp;

      console.log('Loading older data...', {
        viewportLeftEdge: new Date(viewportLeftEdge),
        oldestEntry: new Date(oldestEntryTimestamp),
        oldestTreatment: oldestTreatmentTimestamp ? new Date(oldestTreatmentTimestamp) : 'none',
        threshold: loadThreshold / 1000 / 60 / 60 + 'h',
      });

      isLoadingRef.current = true;

      try {
        // Load 3 days worth of data (864 entries at 5min intervals)
        // Always load both entries AND treatments when scrolling back
        const [olderEntries, olderTreatments] = await Promise.all([
          fetchOlderEntries(oldestEntryTimestamp, 864),
          fetchOlderTreatments(oldestTreatmentTimestamp || oldestEntryTimestamp, 200)
        ]);

        if (olderEntries.length > 0) {
          prependOlderEntries(olderEntries);
          console.log(`Loaded ${olderEntries.length} older entries`);
        } else {
          console.log('No more older entries available');
        }

        if (olderTreatments.length > 0) {
          prependOlderTreatments(olderTreatments);
          console.log(`Loaded ${olderTreatments.length} older treatments`);
        } else {
          console.log('No more older treatments available');
        }
      } catch (error) {
        console.error('Failed to load older data:', error);
      } finally {
        isLoadingRef.current = false;
      }
    }
  }, [allEntries, allTreatments, viewport, prependOlderEntries, prependOlderTreatments]);

  // Check if we need to load newer data - PROACTIVE LOADING
  const checkAndLoadNewerData = useCallback(async () => {
    if (isLoadingRef.current || allEntries.length === 0 || !viewport) return;

    // Always use Entry timestamp for triggering, but load treatments separately
    const newestEntryTimestamp = allEntries[0]?.mills || allEntries[0]?.date;
    if (!newestEntryTimestamp) return;

    // Calculate right edge of viewport
    const viewportRightEdge = viewport.center + viewport.rangeMs / 2;

    // Load more data if viewport right edge is within 1.5x range of newest entries
    const loadThreshold = viewport.rangeMs * 1.5;

    if (viewportRightEdge > newestEntryTimestamp - loadThreshold) {
      // Get newest treatment timestamp for loading treatments
      const newestTreatmentTimestamp = allTreatments.length > 0
        ? allTreatments[0]?.mills
        : newestEntryTimestamp;

      console.log('Loading newer data...', {
        viewportRightEdge: new Date(viewportRightEdge),
        newestEntry: new Date(newestEntryTimestamp),
        newestTreatment: newestTreatmentTimestamp ? new Date(newestTreatmentTimestamp) : 'none',
        threshold: loadThreshold / 1000 / 60 / 60 + 'h',
      });

      isLoadingRef.current = true;

      try {
        // Load 3 days worth of data (864 entries at 5min intervals)
        // Always load both entries AND treatments when scrolling forward
        const [newerEntries, newerTreatments] = await Promise.all([
          fetchNewerEntries(newestEntryTimestamp, 864),
          fetchNewerTreatments(newestTreatmentTimestamp || newestEntryTimestamp, 200)
        ]);

        if (newerEntries.length > 0) {
          appendNewerEntries(newerEntries);
          console.log(`Loaded ${newerEntries.length} newer entries`);
        } else {
          console.log('No more newer entries available');
        }

        if (newerTreatments.length > 0) {
          appendNewerTreatments(newerTreatments);
          console.log(`Loaded ${newerTreatments.length} newer treatments`);
        } else {
          console.log('No more newer treatments available');
        }
      } catch (error) {
        console.error('Failed to load newer data:', error);
      } finally {
        isLoadingRef.current = false;
      }
    }
  }, [allEntries, allTreatments, viewport, appendNewerEntries, appendNewerTreatments]);

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

      // Only show tooltip if we're close enough to a data point
      // No bbox boundary check needed - if a point is in the data array and rendered,
      // and the pixel distance is small enough, show the tooltip
      // This fixes the issue where edge points are visible but don't show tooltips
      if (pixelDist > dynamicThreshold) {
        setHoveredValue(null);
        return;
      }

      const exactTimestamp = data[0][closestIdx];

      // Determine which series has a value at this index
      // Priority: Insulin > Carbs > BG (so treatments are preferred when hovering)
      let seriesIdx = 1; // Default to BG
      let value = data[1][closestIdx]; // BG value
      let treatment: Treatment | undefined;

      // Check insulin series (series 2)
      if (data[2] && data[2][closestIdx] != null && seriesVisible.insulin) {
        seriesIdx = 2;
        value = data[2][closestIdx];
        treatment = treatmentMapRef.current.get(exactTimestamp);
      }
      // Check carbs series (series 3) if no insulin
      else if (data[3] && data[3][closestIdx] != null && seriesVisible.carbs) {
        seriesIdx = 3;
        value = data[3][closestIdx];
        treatment = treatmentMapRef.current.get(exactTimestamp);
      }
      // Otherwise use BG series (series 1)
      else if (data[1] && data[1][closestIdx] != null && seriesVisible.bg) {
        seriesIdx = 1;
        value = data[1][closestIdx];
      }

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
          seriesIdx,
          treatment,
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
      <div className="card">
        {/* Controls */}
        <div className="flex justify-between items-center mb-4 gap-4 flex-wrap">
          {/* Pan buttons */}
          <div className="flex gap-2">
            <button
              onClick={handlePanLeft}
              className="px-4 py-2 rounded-lg font-semibold text-sm bg-surface-2 text-text-secondary hover:bg-surface-3 border-2 border-surface-3 transition-all"
            >
              ← Back
            </button>
            <button
              onClick={handlePanRight}
              className="px-4 py-2 rounded-lg font-semibold text-sm bg-surface-2 text-text-secondary hover:bg-surface-3 border-2 border-surface-3 transition-all"
            >
              Forward →
            </button>
            <button
              onClick={handleJumpToNow}
              className="px-4 py-2 rounded-lg font-semibold text-sm bg-surface-2 text-text-secondary hover:bg-surface-3 border-2 border-surface-3 transition-all"
              title="Jump to most recent data"
            >
              ⟳ Now
            </button>
          </div>

          {/* Zoom buttons */}
          <div className="flex gap-2">
            {(Object.keys(TIME_RANGES) as Array<keyof typeof TIME_RANGES>).map(range => (
              <button
                key={range}
                onClick={() => handleZoomChange(range)}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                  viewport.rangeMs === TIME_RANGES[range]
                    ? 'bg-bg-info text-white scale-105 border-2 border-bg-info'
                    : 'bg-surface-2 text-text-secondary hover:bg-surface-3 border-2 border-surface-3'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Series toggle buttons */}
          <div className="flex gap-2 border-l-2 border-surface-3 pl-4">
            <button
              onClick={() => setSeriesVisible(prev => ({ ...prev, bg: !prev.bg }))}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                seriesVisible.bg
                  ? 'bg-green-600 text-white border-2 border-green-700'
                  : 'bg-surface-2 text-text-secondary hover:bg-surface-3 border-2 border-surface-3 opacity-50'
              }`}
            >
              ● BG
            </button>
            <button
              onClick={() => setSeriesVisible(prev => ({ ...prev, insulin: !prev.insulin }))}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                seriesVisible.insulin
                  ? 'bg-blue-600 text-white border-2 border-blue-700'
                  : 'bg-surface-2 text-text-secondary hover:bg-surface-3 border-2 border-surface-3 opacity-50'
              }`}
            >
              ▼ Insulin
            </button>
            <button
              onClick={() => setSeriesVisible(prev => ({ ...prev, carbs: !prev.carbs }))}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
                seriesVisible.carbs
                  ? 'bg-orange-600 text-white border-2 border-orange-700'
                  : 'bg-surface-2 text-text-secondary hover:bg-surface-3 border-2 border-surface-3 opacity-50'
              }`}
            >
              ● Carbs
            </button>
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
