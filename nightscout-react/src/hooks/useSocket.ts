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
      // Check if this is initial data (has full dataset) or incremental update
      const isInitialData = data.sgvs && data.treatments && data.devicestatus;

      if (isInitialData) {
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

        // Add all new entries at once (avoids multiple store updates)
        appendNewerEntries(newEntries);

        // Update treatments and/or devicestatus if present
        // These are INCREMENTAL updates - we need to MERGE, not replace!
        if (data.treatments || data.devicestatus) {
          const currentData = useBgStore.getState();

          // Merge new treatments with existing ones
          let mergedTreatments = currentData.treatments;
          if (data.treatments) {
            // Filter out duplicates by _id
            const existingIds = new Set(currentData.treatments.map((t: any) => t._id));
            const newTreatments = data.treatments.filter((t: any) => !existingIds.has(t._id));

            // Prepend new treatments (they are newer)
            mergedTreatments = [...newTreatments, ...currentData.treatments];
          }

          // Merge new devicestatus with existing ones
          let mergedDevicestatus = currentData.devicestatus;
          if (data.devicestatus) {
            // Filter out duplicates by _id
            const existingIds = new Set(currentData.devicestatus.map((d: any) => d._id));
            const newDevicestatus = data.devicestatus.filter((d: any) => !existingIds.has(d._id));

            // Prepend new devicestatus (they are newer)
            mergedDevicestatus = [...newDevicestatus, ...currentData.devicestatus];
          }

          setData({
            entries: currentData.entries,
            treatments: mergedTreatments,
            devicestatus: mergedDevicestatus,
            profile: currentData.profile,
            serverTime: Date.now(),
          });
        }
      } else if (data.devicestatus || data.treatments) {
        // Update that ONLY contains devicestatus and/or treatments (no BG entries)
        // These are INCREMENTAL updates - we need to MERGE, not replace!
        const currentData = useBgStore.getState();

        // Merge new treatments with existing ones
        let mergedTreatments = currentData.treatments;
        if (data.treatments) {
          // Filter out duplicates by _id
          const existingIds = new Set(currentData.treatments.map((t: any) => t._id));
          const newTreatments = data.treatments.filter((t: any) => !existingIds.has(t._id));

          // Prepend new treatments (they are newer)
          mergedTreatments = [...newTreatments, ...currentData.treatments];
        }

        // Merge new devicestatus with existing ones
        let mergedDevicestatus = currentData.devicestatus;
        if (data.devicestatus) {
          // Filter out duplicates by _id
          const existingIds = new Set(currentData.devicestatus.map((d: any) => d._id));
          const newDevicestatus = data.devicestatus.filter((d: any) => !existingIds.has(d._id));

          // Prepend new devicestatus (they are newer)
          mergedDevicestatus = [...newDevicestatus, ...currentData.devicestatus];
        }

        setData({
          entries: currentData.entries,
          treatments: mergedTreatments,
          devicestatus: mergedDevicestatus,
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
