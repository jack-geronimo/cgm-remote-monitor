import { useMemo, useRef, useEffect } from 'react';
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
import dayjs from 'dayjs';
import { cn } from '../../lib/utils';

export function Chart() {
  const entries = useBgStore((state) => state.entries);
  const units = useSettingsStore((state) => state.units);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Use individual selectors to avoid recreating selector function on every render
  const alarmUrgentHigh = useSettingsStore((state) => state.alarmUrgentHigh);
  const alarmHigh = useSettingsStore((state) => state.alarmHigh);
  const targetTop = useSettingsStore((state) => state.targetTop);
  const targetBottom = useSettingsStore((state) => state.targetBottom);
  const alarmLow = useSettingsStore((state) => state.alarmLow);
  const alarmUrgentLow = useSettingsStore((state) => state.alarmUrgentLow);

  // Get all available data (up to 24 hours / 288 entries)
  const chartData = useMemo(() => {
    return entries
      .map((entry) => ({
        time: entry.mills,
        bg: entry.sgv,
        timeFormatted: dayjs(entry.mills).format('HH:mm'),
      }))
      .reverse(); // Recharts expects chronological order
  }, [entries]);

  // Calculate chart width based on number of data points (5 pixels per entry for good spacing)
  const chartWidth = useMemo(() => {
    return Math.max(chartData.length * 5, 800); // Minimum 800px
  }, [chartData.length]);

  // Auto-scroll to the right (newest data) when data updates
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
    }
  }, [chartData]);

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
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-text-primary">Glucose Chart</h2>
        <p className="text-sm text-text-secondary">Last 24 hours (scroll left to see history)</p>
      </div>

      <div
        ref={scrollContainerRef}
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
    </div>
  );
}
