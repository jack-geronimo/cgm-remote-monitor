import { useState } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const settings = useSettingsStore();

  // Local state for form
  const [alarmUrgentHigh, setAlarmUrgentHigh] = useState(settings.alarmUrgentHigh);
  const [alarmHigh, setAlarmHigh] = useState(settings.alarmHigh);
  const [targetTop, setTargetTop] = useState(settings.targetTop);
  const [targetBottom, setTargetBottom] = useState(settings.targetBottom);
  const [alarmLow, setAlarmLow] = useState(settings.alarmLow);
  const [alarmUrgentLow, setAlarmUrgentLow] = useState(settings.alarmUrgentLow);

  const handleSave = () => {
    settings.setAlarmThresholds({
      alarmUrgentHigh,
      alarmHigh,
      targetTop,
      targetBottom,
      alarmLow,
      alarmUrgentLow,
    });
    onClose();
  };

  const handleReset = () => {
    // Reset to defaults
    setAlarmUrgentHigh(260);
    setAlarmHigh(180);
    setTargetTop(180);
    setTargetBottom(80);
    setAlarmLow(55);
    setAlarmUrgentLow(55);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
      <div className="bg-surface-1 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface-3">
          <h2 className="text-2xl font-bold text-text-primary">Settings</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Alarm Thresholds Section */}
          <div>
            <h3 className="text-lg font-semibold text-text-primary mb-4">Alarm Thresholds (mg/dL)</h3>
            <div className="space-y-4">
              {/* Urgent High */}
              <div className="flex items-center justify-between">
                <label className="text-text-primary font-medium">Urgent High (Red)</label>
                <input
                  type="number"
                  value={alarmUrgentHigh}
                  onChange={(e) => setAlarmUrgentHigh(Number(e.target.value))}
                  className="w-24 px-3 py-2 bg-surface-2 border border-surface-3 rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-bg-info"
                />
              </div>

              {/* High */}
              <div className="flex items-center justify-between">
                <label className="text-text-primary font-medium">High (Yellow)</label>
                <input
                  type="number"
                  value={alarmHigh}
                  onChange={(e) => setAlarmHigh(Number(e.target.value))}
                  className="w-24 px-3 py-2 bg-surface-2 border border-surface-3 rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-bg-info"
                />
              </div>

              {/* Target Top */}
              <div className="flex items-center justify-between">
                <label className="text-text-primary font-medium">Target Top (Green)</label>
                <input
                  type="number"
                  value={targetTop}
                  onChange={(e) => setTargetTop(Number(e.target.value))}
                  className="w-24 px-3 py-2 bg-surface-2 border border-surface-3 rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-bg-info"
                />
              </div>

              {/* Target Bottom */}
              <div className="flex items-center justify-between">
                <label className="text-text-primary font-medium">Target Bottom (Green)</label>
                <input
                  type="number"
                  value={targetBottom}
                  onChange={(e) => setTargetBottom(Number(e.target.value))}
                  className="w-24 px-3 py-2 bg-surface-2 border border-surface-3 rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-bg-info"
                />
              </div>

              {/* Low */}
              <div className="flex items-center justify-between">
                <label className="text-text-primary font-medium">Low (Yellow)</label>
                <input
                  type="number"
                  value={alarmLow}
                  onChange={(e) => setAlarmLow(Number(e.target.value))}
                  className="w-24 px-3 py-2 bg-surface-2 border border-surface-3 rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-bg-info"
                />
              </div>

              {/* Urgent Low */}
              <div className="flex items-center justify-between">
                <label className="text-text-primary font-medium">Urgent Low (Red)</label>
                <input
                  type="number"
                  value={alarmUrgentLow}
                  onChange={(e) => setAlarmUrgentLow(Number(e.target.value))}
                  className="w-24 px-3 py-2 bg-surface-2 border border-surface-3 rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-bg-info"
                />
              </div>
            </div>

            {/* Visual Preview */}
            <div className="mt-6 p-4 bg-surface-2 rounded-lg">
              <p className="text-sm text-text-secondary mb-2">Preview:</p>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-600 rounded"></div>
                  <span className="text-text-primary">Urgent High: &gt; {alarmUrgentHigh}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                  <span className="text-text-primary">High: {alarmHigh} - {alarmUrgentHigh}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded"></div>
                  <span className="text-text-primary">Target: {targetBottom} - {targetTop}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                  <span className="text-text-primary">Low: {alarmUrgentLow} - {targetBottom}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-600 rounded"></div>
                  <span className="text-text-primary">Urgent Low: &lt; {alarmUrgentLow}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-surface-3">
          <button
            onClick={handleReset}
            className="px-4 py-2 text-text-secondary hover:text-text-primary transition-colors"
          >
            Reset to Defaults
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-surface-2 hover:bg-surface-3 text-text-primary rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-bg-info hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
