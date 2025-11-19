import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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
  const settings = useSettingsStore((state) => ({
    alarmUrgentHigh: state.alarmUrgentHigh,
    alarmHigh: state.alarmHigh,
    targetTop: state.targetTop,
    targetBottom: state.targetBottom,
    alarmLow: state.alarmLow,
    alarmUrgentLow: state.alarmUrgentLow,
  }));

  // Get last 12 hours of data
  const chartData = useMemo(() => {
    const now = Date.now();
    const twelveHoursAgo = now - 12 * 60 * 60 * 1000;

    return entries
      .filter((entry) => entry.mills >= twelveHoursAgo)
      .map((entry) => ({
        time: entry.mills,
        bg: entry.sgv,
        timeFormatted: dayjs(entry.mills).format('HH:mm'),
      }))
      .reverse(); // Recharts expects chronological order
  }, [entries]);

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
    const min = Math.min(...values, settings.alarmUrgentLow);
    const max = Math.max(...values, settings.alarmUrgentHigh);
    const padding = (max - min) * 0.1;

    return [Math.max(40, min - padding), Math.min(400, max + padding)];
  }, [chartData, settings]);

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
        <p className="text-sm text-text-secondary">Last 12 hours</p>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />

          {/* Target ranges */}
          <ReferenceArea
            y1={settings.targetBottom}
            y2={settings.targetTop}
            fill="#10B981"
            fillOpacity={0.1}
            label={{ value: 'Target', position: 'insideTopRight', fill: '#10B981' }}
          />

          <ReferenceArea
            y1={settings.alarmLow}
            y2={settings.targetBottom}
            fill="#F59E0B"
            fillOpacity={0.1}
          />

          <ReferenceArea
            y1={settings.targetTop}
            y2={settings.alarmHigh}
            fill="#F59E0B"
            fillOpacity={0.1}
          />

          <ReferenceArea
            y1={yDomain[0]}
            y2={settings.alarmUrgentLow}
            fill="#EF4444"
            fillOpacity={0.1}
          />

          <ReferenceArea
            y1={settings.alarmUrgentHigh}
            y2={yDomain[1]}
            fill="#EF4444"
            fillOpacity={0.1}
          />

          {/* Reference lines */}
          <ReferenceLine y={settings.targetBottom} stroke="#10B981" strokeDasharray="3 3" />
          <ReferenceLine y={settings.targetTop} stroke="#10B981" strokeDasharray="3 3" />
          <ReferenceLine y={settings.alarmLow} stroke="#F59E0B" strokeDasharray="3 3" />
          <ReferenceLine y={settings.alarmHigh} stroke="#F59E0B" strokeDasharray="3 3" />
          <ReferenceLine y={settings.alarmUrgentLow} stroke="#EF4444" strokeDasharray="3 3" />
          <ReferenceLine y={settings.alarmUrgentHigh} stroke="#EF4444" strokeDasharray="3 3" />

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
      </ResponsiveContainer>
    </div>
  );
}
