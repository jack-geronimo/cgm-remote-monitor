import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { useBgData } from '../../hooks/useBgData';
import { useIsStale } from '../../stores/bgStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { getBgColor, getTrendArrow, formatTimeAgo, formatBgValue } from '../../lib/utils';
import { cn } from '../../lib/utils';

export function BgDisplay() {
  const { currentBg, direction, timestamp, delta } = useBgData();
  const isStale = useIsStale();
  const units = useSettingsStore((state) => state.units);

  const bgColor = currentBg ? getBgColor(currentBg) : 'text-text-muted';
  const trendArrow = direction ? getTrendArrow(direction) : '';
  const displayValue = formatBgValue(currentBg, units);
  const timeAgo = timestamp ? formatTimeAgo(timestamp) : '';

  return (
    <div className="card relative overflow-hidden">
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
        <div className="flex items-center justify-center gap-4 md:gap-6">
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
                'text-bg-display-sm md:text-bg-display',
                isStale && 'opacity-50 line-through',
                bgColor
              )}
            >
              {displayValue}
            </span>

            {/* Units */}
            <span className="text-sm md:text-base text-text-secondary mt-1">
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
                'text-trend-arrow-sm md:text-trend-arrow',
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
          <div className="mt-4 text-center">
            <span className={cn('text-lg font-medium', bgColor)}>
              {delta > 0 ? '+' : ''}
              {formatBgValue(delta, units)} {units === 'mg/dl' ? 'mg/dL' : 'mmol/L'}
            </span>
          </div>
        )}

        {/* Timestamp */}
        <div className="mt-6 flex items-center justify-center gap-2 text-text-secondary">
          <Clock className="w-4 h-4" />
          <span className="text-sm md:text-base">
            {timeAgo || 'Loading...'}
          </span>
        </div>

        {/* Stale Warning */}
        {isStale && timestamp && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 px-4 py-2 rounded-lg bg-bg-warning/10 border border-bg-warning/30 text-center"
          >
            <span className="text-sm text-bg-warning">
              ⚠ Data is stale (over 15 minutes old)
            </span>
          </motion.div>
        )}
      </div>
    </div>
  );
}
