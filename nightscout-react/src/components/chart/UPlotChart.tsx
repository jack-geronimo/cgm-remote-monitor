import { useEffect, useRef, useState } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { useBgStore } from '../../stores/bgStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { cn } from '../../lib/utils';

const TIME_RANGES = [
  { hours: 2, label: '2h' },
  { hours: 3, label: '3h' },
  { hours: 4, label: '4h' },
  { hours: 6, label: '6h' },
  { hours: 12, label: '12h' },
  { hours: 24, label: '24h' },
];

export function UPlotChart() {
  const entries = useBgStore((state) => state.entries);
  const units = useSettingsStore((state) => state.units);
  const alarmUrgentHigh = useSettingsStore((state) => state.alarmUrgentHigh);
  const alarmHigh = useSettingsStore((state) => state.alarmHigh);
  const targetTop = useSettingsStore((state) => state.targetTop);
  const targetBottom = useSettingsStore((state) => state.targetBottom);
  const alarmLow = useSettingsStore((state) => state.alarmLow);
  const alarmUrgentLow = useSettingsStore((state) => state.alarmUrgentLow);

  const chartRef = useRef<HTMLDivElement>(null);
  const uplotRef = useRef<uPlot | null>(null);
  const [selectedHours, setSelectedHours] = useState(3);

  useEffect(() => {
    if (!chartRef.current || entries.length === 0) return;

    // Prepare data for uPlot
    // uPlot expects: [timestamps[], values[]]
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

    // Calculate initial view range based on selectedHours
    const now = Date.now() / 1000;
    const hoursAgo = selectedHours * 60 * 60;
    const minX = now - hoursAgo;
    const maxX = now;

    // Create or update chart
    if (!uplotRef.current) {
      const opts: uPlot.Options = {
        title: 'Blood Glucose',
        width: chartRef.current.clientWidth,
        height: 400,
        scales: {
          x: {
            time: true,
            range: [minX, maxX],
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
            x: true,
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
    } else {
      // Update existing chart
      uplotRef.current.setData(data);
      uplotRef.current.setScale('x', { min: minX, max: maxX });
    }

    // Cleanup
    return () => {
      if (uplotRef.current) {
        uplotRef.current.destroy();
        uplotRef.current = null;
      }
    };
  }, [entries, selectedHours, targetTop, targetBottom, alarmHigh, alarmLow, alarmUrgentHigh, alarmUrgentLow]);

  // Handle window resize
  useEffect(() => {
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

  return (
    <div className="card">
      {/* Header with time range selector */}
      <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">Glucose Chart</h2>
          <p className="text-sm text-text-secondary">
            Canvas-based rendering for high performance
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

      {/* Chart container */}
      <div ref={chartRef} className="w-full" />
    </div>
  );
}
