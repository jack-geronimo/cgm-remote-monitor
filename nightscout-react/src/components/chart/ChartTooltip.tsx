import { useSettingsStore } from '../../stores/settingsStore';
import { formatTime, formatDate } from '../../lib/utils';
import type { Treatment } from '../../types';

interface ChartTooltipProps {
  value: {
    time: number;
    value: number;
    x: number;
    y: number;
    seriesIdx?: number; // Which series (1=BG, 2=Insulin, 3=Carbs)
    treatment?: Treatment; // Treatment data if hovering treatment
  } | null;
}

export function ChartTooltip({ value }: ChartTooltipProps) {
  if (!value) return null;

  const units = useSettingsStore((state) => state.units);
  const timezone = useSettingsStore((state) => state.timezone);
  const locale = useSettingsStore((state) => state.locale);
  const timeFormat = useSettingsStore((state) => state.timeFormat);
  const alarmUrgentHigh = useSettingsStore.getState().alarmUrgentHigh;
  const alarmHigh = useSettingsStore.getState().alarmHigh;
  const alarmLow = useSettingsStore.getState().alarmLow;
  const alarmUrgentLow = useSettingsStore.getState().alarmUrgentLow;

  // Color based on value
  const getColors = (val: number) => {
    if (val >= alarmUrgentHigh || val <= alarmUrgentLow) {
      return {
        bg: 'bg-red-500/90',
        border: 'border-red-600',
        arrow: 'border-r-red-500/90',
      };
    }
    if (val >= alarmHigh || val <= alarmLow) {
      return {
        bg: 'bg-orange-500/90',
        border: 'border-orange-600',
        arrow: 'border-r-orange-500/90',
      };
    }
    return {
      bg: 'bg-green-500/90',
      border: 'border-green-600',
      arrow: 'border-r-green-500/90',
    };
  };

  // Format time and date using custom formatters
  const timeStr = formatTime(value.time, { timezone, locale, timeFormat });

  // Format date with weekday for better context
  const dateStr = new Date(value.time).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: timezone,
  });

  // Determine tooltip colors based on series type
  const getTooltipColors = () => {
    if (value.seriesIdx === 2) {
      // Insulin series
      return {
        bg: 'bg-blue-600/95',
        border: 'border-blue-700',
        arrow: 'border-t-blue-600/95',
      };
    } else if (value.seriesIdx === 3) {
      // Carbs series
      return {
        bg: 'bg-orange-600/95',
        border: 'border-orange-700',
        arrow: 'border-t-orange-600/95',
      };
    } else {
      // BG series - use color based on value
      return getColors(value.value);
    }
  };

  const colors = getTooltipColors();

  // Position tooltip directly at/above the data point
  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${value.x}px`,
    top: `${value.y - 10}px`, // Slightly above the point
    transform: 'translate(-50%, -100%)', // Center horizontally, position above
    pointerEvents: 'none', // Critical: allow mouse events to pass through
  };

  return (
    <div
      style={tooltipStyle}
      className={`${colors.bg} ${colors.border} border-2 rounded-lg px-3 py-1.5 shadow-lg whitespace-nowrap pointer-events-none`}
    >
      {/* Arrow pointing down to the data point */}
      <div
        className={`absolute left-1/2 bottom-0 translate-y-full -translate-x-1/2 w-0 h-0 border-l-6 border-r-6 border-t-6 border-transparent ${colors.arrow} pointer-events-none`}
        style={{
          borderLeftWidth: '6px',
          borderRightWidth: '6px',
          borderTopWidth: '6px',
          pointerEvents: 'none',
        }}
      />

      {/* Content */}
      <div className="flex flex-col text-white">
        {value.seriesIdx === 2 && value.treatment?.insulin ? (
          // Insulin tooltip
          <>
            <span className="text-lg font-bold">
              💉 {value.treatment.insulin.toFixed(1)} U
            </span>
            <span className="text-sm opacity-90">
              BG: {value.value} {units}
            </span>
            <span className="text-xs opacity-90">{dateStr}</span>
            <span className="text-xs opacity-90">{timeStr}</span>
            {value.treatment.notes && (
              <span className="text-xs opacity-75 mt-1 italic">{value.treatment.notes}</span>
            )}
          </>
        ) : value.seriesIdx === 3 && value.treatment?.carbs ? (
          // Carbs tooltip
          <>
            <span className="text-lg font-bold">
              🍕 {value.treatment.carbs} g
            </span>
            <span className="text-sm opacity-90">
              BG: {value.value} {units}
            </span>
            <span className="text-xs opacity-90">{dateStr}</span>
            <span className="text-xs opacity-90">{timeStr}</span>
            {value.treatment.notes && (
              <span className="text-xs opacity-75 mt-1 italic">{value.treatment.notes}</span>
            )}
          </>
        ) : (
          // BG tooltip
          <>
            <span className="text-lg font-bold">
              {value.value} <span className="text-xs font-normal">{units}</span>
            </span>
            <span className="text-xs opacity-90">{dateStr}</span>
            <span className="text-xs opacity-90">{timeStr}</span>
          </>
        )}
      </div>
    </div>
  );
}
