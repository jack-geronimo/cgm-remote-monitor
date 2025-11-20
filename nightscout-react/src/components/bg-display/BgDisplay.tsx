import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { useBgData } from '../../hooks/useBgData';
import { useTimeAgo } from '../../hooks/useTimeAgo';
import { useBgStore, useIsStale } from '../../stores/bgStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { getBgColor, getTrendArrow, formatBgValue } from '../../lib/utils';
import { cn } from '../../lib/utils';

export function BgDisplay() {
  // Initialize data fetching
  useBgData();

  // Subscribe to specific store values
  const currentBg = useBgStore((state) => state.currentBg);
  const direction = useBgStore((state) => state.direction);
  const timestamp = useBgStore((state) => state.timestamp);
  const delta = useBgStore((state) => state.delta);
  const isStale = useIsStale();
  const units = useSettingsStore((state) => state.units);

  // Live-updating time ago
  const timeAgo = useTimeAgo(timestamp);

  const bgColor = currentBg ? getBgColor(currentBg) : 'text-text-muted';
  const trendArrow = direction ? getTrendArrow(direction) : '';
  const displayValue = formatBgValue(currentBg, units);

  return (
    <div className="card relative overflow-hidden py-2 px-3">
      {/* Animated background glow */}
      <div
        className={cn(
          'absolute inset-0 opacity-10 blur-3xl transition-colors duration-500',
          currentBg && !isStale && bgColor
        )}
        style={{
          background: `radial-gradient(circle at center, currentColor 0%, transparent 70%)`,
        }}
      />

      <div className="relative z-10">
        {/* Main BG Display */}
        <div className="flex items-center justify-center gap-2 md:gap-3">
          {/* BG Value */}
          <motion.div
            key={currentBg}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center"
          >
            <span
              className={cn(
                'font-bold tracking-tight transition-colors duration-300',
                'text-4xl md:text-5xl',
                isStale && 'opacity-50 line-through',
                bgColor
              )}
            >
              {displayValue}
            </span>

            {/* Units */}
            <span className="text-xs md:text-sm text-text-secondary mt-0.5">
              {units === 'mg/dl' ? 'mg/dL' : 'mmol/L'}
            </span>
          </motion.div>

          {/* Trend Arrow */}
          {trendArrow && (
            <motion.span
              key={direction}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'text-3xl md:text-4xl',
                isStale && 'opacity-50',
                bgColor
              )}
              role="img"
              aria-label={`Trend: ${direction}`}
            >
              {trendArrow}
            </motion.span>
          )}
        </div>

        {/* Delta */}
        {delta !== null && (
          <div className="mt-2 text-center">
            <span className={cn('text-sm font-medium', bgColor)}>
              {delta > 0 ? '+' : ''}
              {formatBgValue(delta, units)} {units === 'mg/dl' ? 'mg/dL' : 'mmol/L'}
            </span>
          </div>
        )}

        {/* Timestamp */}
        <div className="mt-2 flex items-center justify-center gap-1 text-text-secondary">
          <Clock className="w-3 h-3" />
          <span className="text-xs md:text-sm">
            {timeAgo || 'Loading...'}
          </span>
        </div>

        {/* Stale Warning */}
        {isStale && timestamp && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 px-2 py-1 rounded bg-bg-warning/10 border border-bg-warning/30 text-center"
          >
            <span className="text-xs text-bg-warning">
              ⚠ Data is stale
            </span>
          </motion.div>
        )}
      </div>
    </div>
  );
}
