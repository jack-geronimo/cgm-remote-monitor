import { useSettingsStore } from '../../stores/settingsStore';

interface ChartTooltipProps {
  value: {
    time: number;
    value: number;
    x: number;
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

  // Position tooltip like a flag at the point
  // Offset to the right and up a bit so it doesn't cover the point
  const tooltipStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${value.x + 15}px`, // Offset to the right
    top: `${value.y}px`,
    transform: 'translateY(-50%)',
  };

  return (
    <div
      style={tooltipStyle}
      className={`${colors.bg} ${colors.border} border-2 rounded-lg px-3 py-1.5 shadow-lg pointer-events-none z-50 whitespace-nowrap`}
    >
      {/* Pointer/Arrow pointing to the data point */}
      <div
        className={`absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 w-0 h-0 border-t-8 border-b-8 border-r-8 border-transparent ${colors.arrow}`}
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
