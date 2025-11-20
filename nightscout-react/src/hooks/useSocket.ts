import { useEffect } from 'react';
import { getSocket } from '../lib/socket';
import { useBgStore } from '../stores/bgStore';
import type { BgEntry, Treatment, DeviceStatus, Profile } from '../types';

/**
 * Hook to manage Socket.io connection and real-time updates
 */
export function useSocket() {
  const setData = useBgStore((state) => state.setData);
  const appendNewerEntries = useBgStore((state) => state.appendNewerEntries);

  useEffect(() => {
    const socket = getSocket();

    /**
     * Convert socket.io data format to REST API format
     * Socket uses: mgdl, mills, scaled
     * REST API uses: sgv, date, mills
     */
    const normalizeEntry = (entry: any): BgEntry => {
      return {
        _id: entry._id,
        sgv: entry.mgdl || entry.scaled || entry.sgv, // Socket uses 'mgdl', API uses 'sgv'
        date: entry.mills || entry.date,
        mills: entry.mills || entry.date,
        direction: entry.direction,
        device: entry.device,
        type: entry.type || 'sgv',
      };
    };

    // Listen for data updates from server
    const handleDataUpdate = (data: any) => {
      console.log('📡 Socket dataUpdate event received', data);

      // Check if this is initial data (has full dataset) or incremental update
      const isInitialData = data.sgvs && data.treatments && data.devicestatus;

      if (isInitialData) {
        console.log('📊 Received initial data from socket:', {
          entries: data.sgvs?.length || 0,
          treatments: data.treatments?.length || 0,
          devicestatus: data.devicestatus?.length || 0,
        });

        // Normalize all entries
        const normalizedEntries = (data.sgvs || []).map(normalizeEntry);

        // Full data update - use setData (same as REST API)
        setData({
          entries: normalizedEntries,
          treatments: data.treatments || [],
          devicestatus: data.devicestatus || [],
          profile: data.profiles?.[0] || null,
          serverTime: Date.now(),
        });
      } else if (data.sgvs && data.sgvs.length > 0) {
        // Incremental update with BG entries
        const newEntries = data.sgvs.map(normalizeEntry);

        console.log('📈 Received incremental update:', {
          newEntries: newEntries.length,
          latestSGV: newEntries[0]?.sgv,
          direction: newEntries[0]?.direction,
          entries: newEntries,
          treatments: data.treatments?.length || 0,
          devicestatus: data.devicestatus?.length || 0,
        });

        // Add all new entries at once (avoids multiple store updates)
        appendNewerEntries(newEntries);

        // Update treatments and/or devicestatus if present
        if (data.treatments || data.devicestatus) {
          const currentData = useBgStore.getState();

          if (data.treatments) {
            console.log('💉 Received treatments update:', data.treatments.length);
          }
          if (data.devicestatus) {
            console.log('📱 Received devicestatus update:', data.devicestatus.length);
          }

          setData({
            entries: currentData.entries,
            treatments: data.treatments || currentData.treatments,
            devicestatus: data.devicestatus || currentData.devicestatus,
            profile: currentData.profile,
            serverTime: Date.now(),
          });
        }
      } else if (data.devicestatus || data.treatments) {
        // Update that ONLY contains devicestatus and/or treatments (no BG entries)
        const currentData = useBgStore.getState();

        if (data.treatments) {
          console.log('💉 Received treatments-only update:', data.treatments.length);
        }
        if (data.devicestatus) {
          console.log('📱 Received devicestatus-only update:', data.devicestatus.length);
        }

        setData({
          entries: currentData.entries,
          treatments: data.treatments || currentData.treatments,
          devicestatus: data.devicestatus || currentData.devicestatus,
          profile: currentData.profile,
          serverTime: Date.now(),
        });
      }
    };

    // Listen for notifications
    const handleNotification = (notification: any) => {
      console.log('🔔 Socket notification:', notification);
      // TODO: Handle notifications (show alert/toast)
    };

    // Listen for announcements
    const handleAnnouncement = (announcement: any) => {
      console.log('📢 Socket announcement:', announcement);
      // TODO: Handle announcements (show info message)
    };

    socket.on('dataUpdate', handleDataUpdate);
    socket.on('notification', handleNotification);
    socket.on('announcement', handleAnnouncement);

    return () => {
      socket.off('dataUpdate', handleDataUpdate);
      socket.off('notification', handleNotification);
      socket.off('announcement', handleAnnouncement);
    };
  }, [setData, appendNewerEntries]);
}
