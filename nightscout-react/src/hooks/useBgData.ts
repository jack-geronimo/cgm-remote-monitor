import { useEffect, useState } from 'react';
import { useBgStore } from '../stores/bgStore';
import { fetchNightscoutData } from '../lib/api';

/**
 * Hook to fetch and manage BG data
 */
export function useBgData() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { currentBg, direction, timestamp, delta, entries } = useBgStore();
  const setData = useBgStore((state) => state.setData);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        setIsLoading(true);
        const data = await fetchNightscoutData();

        if (mounted) {
          setData(data);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to load data'));
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    // Reload data every 5 minutes as fallback
    const interval = setInterval(loadData, 5 * 60 * 1000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [setData]);

  return {
    currentBg,
    direction,
    timestamp,
    delta,
    entries,
    isLoading,
    error,
  };
}
