import { useBgStore } from '../../stores/bgStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { formatTimestamp } from '../../lib/utils';

interface CurrentValueWindowProps {
  hoveredValue?: { time: number; value: number } | null;
}

export function CurrentValueWindow({ hoveredValue }: CurrentValueWindowProps) {
  const currentBg = useBgStore((state) => state.currentBg);
  const direction = useBgStore((state) => state.direction);
  const delta = useBgStore((state) => state.delta);
  const timestamp = useBgStore((state) => state.timestamp);
  const units = useSettingsStore((state) => state.units);

  // Use hovered value if available, otherwise current BG
  const displayValue = hoveredValue?.value ?? currentBg;
  const displayTime = hoveredValue?.time ?? timestamp;

  if (!displayValue || !displayTime) {
    return null;
  }

  // Direction arrow
  const getDirectionSymbol = (dir: string | null) => {
    switch (dir) {
      case 'DoubleUp': return '⇈';
      case 'SingleUp': return '↑';
      case 'FortyFiveUp': return '↗';
      case 'Flat': return '→';
      case 'FortyFiveDown': return '↘';
      case 'SingleDown': return '↓';
      case 'DoubleDown': return '⇊';
      default: return '→';
    }
  };

  // Color based on value
  const getValueColor = (value: number) => {
    const alarmUrgentHigh = useSettingsStore.getState().alarmUrgentHigh;
    const alarmHigh = useSettingsStore.getState().alarmHigh;
    const alarmLow = useSettingsStore.getState().alarmLow;
    const alarmUrgentLow = useSettingsStore.getState().alarmUrgentLow;

    if (value >= alarmUrgentHigh || value <= alarmUrgentLow) {
      return 'text-red-500';
    }
    if (value >= alarmHigh || value <= alarmLow) {
      return 'text-orange-500';
    }
    return 'text-green-500';
  };

  return (
    <div className="fixed top-20 right-6 z-50 bg-surface-2 border-2 border-surface-3 rounded-lg shadow-2xl p-4 min-w-[280px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-surface-3">
        <span className="text-sm font-medium text-text-secondary">
          {hoveredValue ? 'Historical Value' : 'Current Value'}
        </span>
        <span className="text-xs text-text-muted">
          {new Date(displayTime).toLocaleTimeString()}
        </span>
      </div>

      {/* Main Value with Crosshair */}
      <div className="flex items-center justify-center mb-4">
        {/* Crosshair background */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-surface-3 -translate-x-1/2 opacity-50" />
          {/* Horizontal line */}
          <div className="absolute top-1/2 left-0 right-0 h-px bg-surface-3 -translate-y-1/2 opacity-50" />

          {/* Value */}
          <div className={`relative text-5xl font-bold ${getValueColor(displayValue)} px-6 py-4`}>
            {displayValue}
            <span className="text-xl ml-1 text-text-muted">{units}</span>
          </div>
        </div>
      </div>

      {/* Direction and Delta */}
      {!hoveredValue && direction && (
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{getDirectionSymbol(direction)}</span>
            <span className="text-text-secondary font-medium">{direction}</span>
          </div>
          {delta !== null && (
            <div className={`font-mono ${delta > 0 ? 'text-orange-500' : delta < 0 ? 'text-blue-500' : 'text-text-muted'}`}>
              {delta > 0 ? '+' : ''}{delta.toFixed(1)} {units}
            </div>
          )}
        </div>
      )}

      {/* Placeholder for future data */}
      <div className="mt-4 pt-3 border-t border-surface-3">
        <div className="text-xs text-text-muted text-center">
          Additional data will appear here
        </div>
      </div>
    </div>
  );
}
