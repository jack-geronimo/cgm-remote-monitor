import { useEffect } from 'react';
import { getSocket } from '../lib/socket';
import { useBgStore } from '../stores/bgStore';
import type { BgEntry } from '../types';

/**
 * Hook to manage Socket.io connection and real-time updates
 */
export function useSocket() {
  const updateFromSocket = useBgStore((state) => state.updateFromSocket);

  useEffect(() => {
    const socket = getSocket();

    // Listen for data updates from server
    const handleDataUpdate = (data: { sgvs?: BgEntry[] }) => {
      console.log('📡 Socket data update:', data);

      if (data.sgvs && data.sgvs.length > 0) {
        // Update with latest entry
        updateFromSocket(data.sgvs[0]);
      }
    };

    // Listen for notifications
    const handleNotification = (notification: any) => {
      console.log('🔔 Socket notification:', notification);
      // TODO: Handle notifications
    };

    // Listen for announcements
    const handleAnnouncement = (announcement: any) => {
      console.log('📢 Socket announcement:', announcement);
      // TODO: Handle announcements
    };

    socket.on('dataUpdate', handleDataUpdate);
    socket.on('notification', handleNotification);
    socket.on('announcement', handleAnnouncement);

    return () => {
      socket.off('dataUpdate', handleDataUpdate);
      socket.off('notification', handleNotification);
      socket.off('announcement', handleAnnouncement);
    };
  }, [updateFromSocket]);
}
