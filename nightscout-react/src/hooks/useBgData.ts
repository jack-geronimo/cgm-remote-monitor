import { useEffect, useState } from 'react';
import { useBgStore } from '../stores/bgStore';
import { fetchNightscoutData } from '../lib/api';
import { getSocket } from '../lib/socket';

/**
 * Hook to fetch and manage BG data
 * This hook only handles data fetching - components should subscribe to store directly
 *
 * Strategy:
 * - Initial load via REST API on mount
 * - Socket.io provides live updates (see useSocket hook)
 * - Fallback polling ONLY when Socket.io is disconnected
 */
export function useBgData() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Only subscribe to the setData action, not the entire store
  const setData = useBgStore((state) => state.setData);

  useEffect(() => {
    let mounted = true;
    let pollInterval: NodeJS.Timeout | null = null;

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

    // Start fallback polling (when Socket is disconnected)
    const startPolling = () => {
      if (pollInterval) return; // Already polling
      console.log('⏰ Socket disconnected - starting fallback polling (every 60s)');
      pollInterval = setInterval(loadData, 60 * 1000); // Poll every 60 seconds
    };

    // Stop fallback polling (when Socket is connected)
    const stopPolling = () => {
      if (!pollInterval) return; // Not polling
      console.log('✅ Socket connected - stopping fallback polling');
      clearInterval(pollInterval);
      pollInterval = null;
    };

    // Socket event handlers (defined with stable references for cleanup)
    const handleConnect = () => {
      stopPolling();
    };

    const handleDisconnect = () => {
      startPolling();
    };

    // Initial load
    loadData();

    // Setup Socket.io event listeners for intelligent fallback
    const socket = getSocket();

    // Register event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    // Note: We don't check socket.connected on mount because:
    // - Socket connects very quickly (< 100ms)
    // - Initial data comes from REST API anyway
    // - We only want to poll if socket actually disconnects AFTER being connected

    return () => {
      mounted = false;
      stopPolling();

      // Clean up socket listeners - MUST use same function references!
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [setData]);

  return {
    isLoading,
    error,
  };
}
