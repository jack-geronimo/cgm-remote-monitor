import { useBgStore } from '../../stores/bgStore';
import { useSettingsStore } from '../../stores/settingsStore';

export function CurrentValueWindow() {
  const currentBg = useBgStore((state) => state.currentBg);
  const direction = useBgStore((state) => state.direction);
  const delta = useBgStore((state) => state.delta);
  const timestamp = useBgStore((state) => state.timestamp);
  const units = useSettingsStore((state) => state.units);

  if (!currentBg || !timestamp) {
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
    <div className="fixed top-20 right-4 z-50 bg-surface-2 border border-surface-3 rounded-lg shadow-lg p-2 min-w-[180px] pointer-events-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-1 pb-1 border-b border-surface-3">
        <span className="text-xs font-medium text-text-secondary">Current</span>
        <span className="text-xs text-text-muted">
          {new Date(timestamp).toLocaleTimeString()}
        </span>
      </div>

      {/* Main Value - Compact */}
      <div className="flex items-center justify-center my-2">
        <div className={`text-3xl font-bold ${getValueColor(currentBg)}`}>
          {currentBg}
          <span className="text-sm ml-1 text-text-muted">{units}</span>
        </div>
      </div>

      {/* Direction and Delta - Compact */}
      {direction && (
        <div className="flex items-center justify-between text-xs border-t border-surface-3 pt-1">
          <div className="flex items-center gap-1">
            <span className="text-lg">{getDirectionSymbol(direction)}</span>
          </div>
          {delta !== null && (
            <div className={`font-mono ${delta > 0 ? 'text-orange-500' : delta < 0 ? 'text-blue-500' : 'text-text-muted'}`}>
              {delta > 0 ? '+' : ''}{delta.toFixed(1)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
