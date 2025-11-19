import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  // Display Units
  units: 'mg/dl' | 'mmol';

  // Theme
  theme: 'dark' | 'light' | 'auto';

  // Time Format
  timeFormat: 12 | 24;

  // Alarm Thresholds (in mg/dL)
  alarmUrgentHigh: number;
  alarmHigh: number;
  targetTop: number;
  targetBottom: number;
  alarmLow: number;
  alarmUrgentLow: number;

  // Language
  language: string;

  // Actions
  setUnits: (units: 'mg/dl' | 'mmol') => void;
  setTheme: (theme: 'dark' | 'light' | 'auto') => void;
  setTimeFormat: (format: 12 | 24) => void;
  setAlarmThresholds: (thresholds: Partial<Pick<SettingsState, 'alarmUrgentHigh' | 'alarmHigh' | 'targetTop' | 'targetBottom' | 'alarmLow' | 'alarmUrgentLow'>>) => void;
  setLanguage: (language: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Defaults matching original Nightscout
      units: 'mg/dl',
      theme: 'dark',
      timeFormat: 12,
      alarmUrgentHigh: 260,
      alarmHigh: 180,
      targetTop: 180,
      targetBottom: 80,
      alarmLow: 55,
      alarmUrgentLow: 55,
      language: 'en',

      setUnits: (units) => set({ units }),

      setTheme: (theme) => {
        set({ theme });

        // Apply theme to document
        const root = document.documentElement;
        if (theme === 'dark') {
          root.classList.remove('light');
        } else if (theme === 'light') {
          root.classList.add('light');
        } else {
          // Auto - use system preference
          const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          if (isDark) {
            root.classList.remove('light');
          } else {
            root.classList.add('light');
          }
        }
      },

      setTimeFormat: (timeFormat) => set({ timeFormat }),

      setAlarmThresholds: (thresholds) => set((state) => ({
        ...state,
        ...thresholds,
      })),

      setLanguage: (language) => set({ language }),
    }),
    {
      name: 'nightscout-settings',
    }
  )
);

// Initialize theme on app load
if (typeof window !== 'undefined') {
  const settings = useSettingsStore.getState();
  settings.setTheme(settings.theme);

  // Listen to system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (settings.theme === 'auto') {
      const root = document.documentElement;
      if (e.matches) {
        root.classList.remove('light');
      } else {
        root.classList.add('light');
      }
    }
  });
}
