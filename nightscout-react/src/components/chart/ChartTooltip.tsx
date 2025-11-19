import { useSettingsStore } from '../../stores/settingsStore';

interface ChartTooltipProps {
  value: {
    time: number;
    value: number;
    tooltipX: number;
    y: number;
  } | null;
}

export function ChartTooltip({ value }: ChartTooltipProps) {
  if (!value) return null;

  const units = useSettingsStore((state) => state.units);
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

  // Format time
  const timeStr = new Date(value.time).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const colors = getColors(value.value);

  // Position tooltip directly at/above the data point
  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${value.tooltipX}px`,
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
        className={`absolute left-1/2 bottom-0 translate-y-full -translate-x-1/2 w-0 h-0 border-l-6 border-r-6 border-t-6 border-transparent ${colors.arrow.replace('border-r-', 'border-t-')} pointer-events-none`}
        style={{
          borderLeftWidth: '6px',
          borderRightWidth: '6px',
          borderTopWidth: '6px',
          pointerEvents: 'none',
        }}
      />

      {/* Content */}
      <div className="flex flex-col text-white">
        <span className="text-lg font-bold">
          {value.value} <span className="text-xs font-normal">{units}</span>
        </span>
        <span className="text-xs opacity-90">{timeStr}</span>
      </div>
    </div>
  );
}
