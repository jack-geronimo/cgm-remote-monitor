import { useEffect } from 'react';
import { BgDisplay } from './components/bg-display/BgDisplay';
import { UPlotChart } from './components/chart/UPlotChart';
import { Pills } from './components/pills/Pills';
import { useSocket } from './hooks/useSocket';
import { useBgData } from './hooks/useBgData';
import { useSettingsStore } from './stores/settingsStore';

function App() {
  // Initialize socket connection
  useSocket();

  // Load initial data
  useBgData();

  // Theme management
  const theme = useSettingsStore((state) => state.theme);

  useEffect(() => {
    // Apply theme to document
    if (theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.body.classList.remove('light');
    } else {
      document.body.classList.add('light');
    }
  }, [theme]);

  return (
    <div className="min-h-screen bg-surface-0 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-text-primary">
                Nightscout
              </h1>
              <p className="text-sm text-text-secondary mt-1">
                CGM Remote Monitor
              </p>
            </div>

            {/* Settings button - placeholder for future settings panel */}
            <button
              className="p-2 rounded-lg bg-surface-1 hover:bg-surface-2 transition-colors"
              aria-label="Settings"
            >
              <svg
                className="w-6 h-6 text-text-secondary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </button>
          </div>
        </header>

        {/* Top Row - BG Display and Pills */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* BG Display */}
          <div className="lg:col-span-1">
            <BgDisplay />
          </div>

          {/* Pills */}
          <div className="lg:col-span-2">
            <Pills />
          </div>
        </div>

        {/* Full Width Chart */}
        <UPlotChart />

        {/* Footer */}
        <footer className="mt-8 text-center text-sm text-text-muted">
          <p>
            Nightscout {new Date().getFullYear()} • Open Source CGM in the Cloud
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
