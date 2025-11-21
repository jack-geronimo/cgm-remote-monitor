import { useEffect, useRef } from 'react';
import { motion, useAnimation } from 'framer-motion';
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

  // Store actions for testing
  const appendNewerEntries = useBgStore((state) => state.appendNewerEntries);

  // Live-updating time ago
  const timeAgo = useTimeAgo(timestamp);

  const bgColor = currentBg ? getBgColor(currentBg) : 'text-text-muted';
  const trendArrow = direction ? getTrendArrow(direction) : '';
  const displayValue = formatBgValue(currentBg, units);

  // Glow animation controls
  const controls = useAnimation();
  const prevBg = useRef<number | null>(currentBg);
  const isFirstRender = useRef(true);

  // Trigger glow animation when BG value changes
  useEffect(() => {
    // Skip animation on first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevBg.current = currentBg;
      return;
    }

    // Only animate if value actually changed
    if (prevBg.current !== currentBg && currentBg !== null) {
      prevBg.current = currentBg;

      // Trigger glow flicker animation (multiple quick pulses over 1.5s)
      controls.start({
        boxShadow: [
          '0 0 0px rgba(59, 130, 246, 0)',      // Start: no glow
          '0 0 30px rgba(59, 130, 246, 0.7)',   // Flash 1
          '0 0 8px rgba(59, 130, 246, 0.2)',    // Dim
          '0 0 30px rgba(59, 130, 246, 0.7)',   // Flash 2
          '0 0 8px rgba(59, 130, 246, 0.2)',    // Dim
          '0 0 25px rgba(59, 130, 246, 0.5)',   // Flash 3 (softer)
          '0 0 0px rgba(59, 130, 246, 0)',      // End: fade out
        ],
        transition: {
          duration: 1.5,
          times: [0, 0.15, 0.25, 0.45, 0.55, 0.75, 1],
          ease: 'easeInOut',
        },
      });
    }
  }, [currentBg, controls]);

  // Development helper: Expose test function to window (only in dev mode)
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as any).testBgUpdate = () => {
        // Generate random BG value
        const randomBg = Math.floor(Math.random() * (300 - 50) + 50); // 50-300 mg/dL
        const directions = ['DoubleUp', 'SingleUp', 'FortyFiveUp', 'Flat', 'FortyFiveDown', 'SingleDown', 'DoubleDown'];
        const randomDirection = directions[Math.floor(Math.random() * directions.length)];

        // Create new BG entry
        const newEntry = {
          _id: 'test-' + Date.now(),
          sgv: randomBg,
          date: Date.now(),
          mills: Date.now(),
          direction: randomDirection as any,
          device: 'test',
          type: 'sgv' as const,
        };

        // Add to store (will trigger glow animation)
        appendNewerEntries([newEntry]);

        console.log(`🧪 Test BG update: ${randomBg} mg/dL ${randomDirection}`);
      };

      console.log('🧪 Dev mode: Use testBgUpdate() in console to trigger BG glow animation');
    }

    return () => {
      if (import.meta.env.DEV) {
        delete (window as any).testBgUpdate;
      }
    };
  }, [appendNewerEntries]);

  return (
    <motion.div
      className="card relative overflow-hidden py-2 px-3 h-full"
      animate={controls}
    >
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
        {/* Main Layout: BG/Trend on top, Delta below, Timestamp top right */}
        <div className="flex items-start justify-between gap-2">
          {/* Left: BG and Delta stacked */}
          <motion.div
            key={currentBg}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-0.5"
          >
            {/* Line 1: BG Value + Units + Trend */}
            <div className="flex flex-wrap items-baseline gap-1.5 md:gap-2">
              <div className="flex items-baseline gap-1">
                <span
                  className={cn(
                    'font-bold tracking-tight transition-colors duration-300',
                    'text-3xl md:text-4xl',
                    isStale && 'opacity-50 line-through',
                    bgColor
                  )}
                >
                  {displayValue}
                </span>
                <span className="text-xs text-text-secondary">
                  {units === 'mg/dl' ? 'mg/dL' : 'mmol/L'}
                </span>
              </div>

              {/* Trend Arrow */}
              {trendArrow && (
                <motion.span
                  key={direction}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    'text-2xl md:text-3xl',
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

            {/* Line 2: Delta below BG */}
            {delta !== null && (
              <div className="flex items-baseline gap-1">
                <span className="text-sm text-text-secondary">Δ</span>
                <span className={cn('text-sm md:text-base font-medium', bgColor)}>
                  {delta > 0 ? '+' : ''}
                  {formatBgValue(delta, units)} {units === 'mg/dl' ? 'mg/dL' : 'mmol/L'}
                </span>
              </div>
            )}
          </motion.div>

          {/* Right: Timestamp - Top Right */}
          <div className="flex items-center gap-1 text-text-secondary">
            <Clock className="w-3 h-3" />
            <span className="text-xs md:text-sm whitespace-nowrap">
              {timeAgo || 'Loading...'}
            </span>
          </div>
        </div>

        {/* Stale Warning - Below */}
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
    </motion.div>
  );
}
