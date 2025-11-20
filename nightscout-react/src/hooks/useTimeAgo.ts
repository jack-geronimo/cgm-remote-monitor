import { useState, useEffect } from 'react';
import { formatTimeAgo } from '../lib/utils';

/**
 * Custom hook that returns a live-updating "time ago" string
 * Updates every 10 seconds to keep the display fresh
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Formatted time ago string (e.g., "just now", "2 minutes ago")
 */
export function useTimeAgo(timestamp: number | null): string {
  const [timeAgo, setTimeAgo] = useState<string>('');

  useEffect(() => {
    if (!timestamp) {
      setTimeAgo('');
      return;
    }

    // Update the time ago string
    function updateTimeAgo() {
      setTimeAgo(formatTimeAgo(timestamp));
    }

    // Initial update
    updateTimeAgo();

    // Update every 10 seconds for live display
    const interval = setInterval(updateTimeAgo, 10000);

    return () => clearInterval(interval);
  }, [timestamp]);

  return timeAgo;
}
