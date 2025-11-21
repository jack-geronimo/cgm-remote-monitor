import { useEffect, useRef, useState } from 'react';
import { Activity, Droplet, Battery, Zap, Clock } from 'lucide-react';
import { motion, useAnimation } from 'framer-motion';
import { useBgStore } from '../../stores/bgStore';
import { useTimeAgo } from '../../hooks/useTimeAgo';
import { cn } from '../../lib/utils';

interface PillProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  status?: 'urgent' | 'warning' | 'success' | 'info';
}

function Pill({ label, value, icon, status = 'info' }: PillProps) {
  const statusClasses = {
    urgent: 'pill-urgent',
    warning: 'pill-warning',
    success: 'pill-success',
    info: 'pill-info',
  };

  // Animation controls
  const controls = useAnimation();
  const prevValue = useRef<string | number>(value);
  const isFirstRender = useRef(true);

  // Trigger glow animation when value changes
  useEffect(() => {
    // Skip animation on first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevValue.current = value;
      return;
    }

    // Only animate if value actually changed
    if (prevValue.current !== value) {
      prevValue.current = value;

      // Trigger glow flicker animation (multiple quick pulses over 1.5s)
      controls.start({
        boxShadow: [
          '0 0 0px rgba(59, 130, 246, 0)',      // Start: no glow
          '0 0 25px rgba(59, 130, 246, 0.7)',   // Flash 1
          '0 0 5px rgba(59, 130, 246, 0.2)',    // Dim
          '0 0 25px rgba(59, 130, 246, 0.7)',   // Flash 2
          '0 0 5px rgba(59, 130, 246, 0.2)',    // Dim
          '0 0 20px rgba(59, 130, 246, 0.5)',   // Flash 3 (softer)
          '0 0 0px rgba(59, 130, 246, 0)',      // End: fade out
        ],
        transition: {
          duration: 1.5,
          times: [0, 0.15, 0.25, 0.45, 0.55, 0.75, 1],
          ease: 'easeInOut',
        },
      });
    }
  }, [value, controls]);

  return (
    <motion.div
      className={cn('pill', statusClasses[status], 'py-1 px-2')}
      animate={controls}
    >
      {icon && <span className="flex-shrink-0 w-3 h-3">{icon}</span>}
      <div className="flex items-baseline gap-1">
        <span className="text-[10px] opacity-75">{label}</span>
        <span className="text-sm font-semibold">{value}</span>
      </div>
    </motion.div>
  );
}

export function Pills() {
  // Subscribe directly to devicestatus instead of deprecated data field
  const devicestatus = useBgStore((state) => state.devicestatus);
  const setData = useBgStore((state) => state.setData);
  const entries = useBgStore((state) => state.entries);
  const treatments = useBgStore((state) => state.treatments);
  const profile = useBgStore((state) => state.profile);

  // Get last update timestamp from devicestatus
  const lastUpdateTime = devicestatus?.[0]?.mills || devicestatus?.[0]?.created_at
    ? new Date(devicestatus[0].mills || devicestatus[0].created_at).getTime()
    : null;
  const timeAgo = useTimeAgo(lastUpdateTime);

  // Development helper: Expose test function to window (only in dev mode)
  useEffect(() => {
    if (import.meta.env.DEV) {
      (window as any).testPillUpdate = () => {
        const currentDeviceStatus = devicestatus?.[0] || {};

        // Pick a random value to change
        const valuesToChange = ['iob', 'cob', 'battery', 'reservoir', 'uploader'];
        const randomPick = valuesToChange[Math.floor(Math.random() * valuesToChange.length)];

        // Start with current values
        const updatedDeviceStatus = { ...currentDeviceStatus };

        let changedValue = '';

        // Only change one random value
        switch (randomPick) {
          case 'iob':
            const randomIOB = (Math.random() * 5).toFixed(2);
            updatedDeviceStatus.openaps = {
              ...currentDeviceStatus.openaps,
              iob: { iob: parseFloat(randomIOB) },
            };
            changedValue = `IOB: ${randomIOB}U`;
            break;

          case 'cob':
            const randomCOB = Math.floor(Math.random() * 100);
            updatedDeviceStatus.openaps = {
              ...currentDeviceStatus.openaps,
              suggested: {
                ...(currentDeviceStatus.openaps?.suggested || {}),
                COB: randomCOB
              },
            };
            changedValue = `COB: ${randomCOB}g`;
            break;

          case 'battery':
            const randomBattery = Math.floor(Math.random() * 100);
            updatedDeviceStatus.pump = {
              ...currentDeviceStatus.pump,
              battery: randomBattery,
            };
            changedValue = `Battery: ${randomBattery}%`;
            break;

          case 'reservoir':
            const randomReservoir = (Math.random() * 200).toFixed(1);
            updatedDeviceStatus.pump = {
              ...currentDeviceStatus.pump,
              reservoir: parseFloat(randomReservoir),
            };
            changedValue = `Reservoir: ${randomReservoir}U`;
            break;

          case 'uploader':
            const randomUploader = Math.floor(Math.random() * 100);
            updatedDeviceStatus.uploaderBattery = randomUploader;
            changedValue = `Uploader: ${randomUploader}%`;
            break;
        }

        // Update timestamp
        updatedDeviceStatus._id = currentDeviceStatus._id || 'test-' + Date.now();
        updatedDeviceStatus.created_at = new Date().toISOString();
        updatedDeviceStatus.mills = Date.now();

        // Update store with new device status
        setData({
          entries,
          treatments,
          devicestatus: [updatedDeviceStatus, ...(devicestatus || [])],
          profile,
          serverTime: Date.now(),
        });

        console.log(`🧪 Test update: ${changedValue}`);
      };

      console.log('🧪 Dev mode: Use testPillUpdate() in console to trigger pill glow animation');
    }

    return () => {
      if (import.meta.env.DEV) {
        delete (window as any).testPillUpdate;
      }
    };
  }, [devicestatus, setData, entries, treatments, profile]);

  // Calculate IOB from device status - try multiple sources
  let iob: number | null = null;
  const deviceStatus = devicestatus?.[0];

  if (deviceStatus) {
    // Try different IOB sources
    if (deviceStatus.openaps?.iob?.iob !== undefined) {
      iob = Number(deviceStatus.openaps.iob.iob);
    } else if (deviceStatus.openaps?.iob !== undefined) {
      iob = Number(deviceStatus.openaps.iob);
    } else if (deviceStatus.loop?.iob?.iob !== undefined) {
      iob = Number(deviceStatus.loop.iob.iob);
    } else if (deviceStatus.pump?.iob !== undefined) {
      iob = Number(deviceStatus.pump.iob);
    }
  }

  const iobValue = (iob !== null && !isNaN(iob)) ? `${iob.toFixed(2)}U` : '---';
  const iobStatus = (iob !== null && iob > 3) ? 'warning' : 'info';

  // Calculate COB from device status - try multiple sources
  let cob: number | null = null;

  if (deviceStatus) {
    // Try different COB sources (AAPS stores it in suggested or enacted)
    if (deviceStatus.openaps?.suggested?.COB !== undefined) {
      cob = Number(deviceStatus.openaps.suggested.COB);
    } else if (deviceStatus.openaps?.enacted?.COB !== undefined) {
      cob = Number(deviceStatus.openaps.enacted.COB);
    } else if (deviceStatus.loop?.cob?.cob !== undefined) {
      cob = Number(deviceStatus.loop.cob.cob);
    } else if (deviceStatus.openaps?.cob !== undefined) {
      cob = Number(deviceStatus.openaps.cob);
    } else if (deviceStatus.pump?.cob !== undefined) {
      cob = Number(deviceStatus.pump.cob);
    }
  }

  const cobValue = (cob !== null && !isNaN(cob)) ? `${cob.toFixed(1)}g` : '---';
  const cobStatus = (cob !== null && cob > 100) ? 'warning' : 'info';

  // Pump battery - handle both number and object formats
  let pumpBattery: number | null = null;
  if (deviceStatus?.pump?.battery !== undefined) {
    const batteryData = deviceStatus.pump.battery;
    if (typeof batteryData === 'number') {
      pumpBattery = batteryData;
    } else if (typeof batteryData === 'object' && batteryData !== null) {
      // Try common property names
      pumpBattery = (batteryData as any).percent ?? (batteryData as any).value ?? null;
    }
  }

  const pumpBatteryValue = (pumpBattery !== null && !isNaN(pumpBattery)) ? `${Math.round(pumpBattery)}%` : '---';
  const pumpBatteryStatus = (pumpBattery !== null && !isNaN(pumpBattery))
    ? pumpBattery < 20
      ? 'urgent'
      : pumpBattery < 50
      ? 'warning'
      : 'success'
    : 'info';

  // Pump reservoir - handle both number and object formats
  let reservoir: number | null = null;
  if (deviceStatus?.pump?.reservoir !== undefined) {
    const reservoirData = deviceStatus.pump.reservoir;
    if (typeof reservoirData === 'number') {
      reservoir = reservoirData;
    } else if (typeof reservoirData === 'object' && reservoirData !== null) {
      reservoir = (reservoirData as any).value ?? (reservoirData as any).units ?? null;
    }
  }

  const reservoirValue = (reservoir !== null && !isNaN(reservoir)) ? `${reservoir.toFixed(1)}U` : '---';
  const reservoirStatus = (reservoir !== null && !isNaN(reservoir))
    ? reservoir < 20
      ? 'urgent'
      : reservoir < 50
      ? 'warning'
      : 'success'
    : 'info';

  // Uploader battery - AAPS stores it directly on root level as uploaderBattery
  let uploaderBattery: number | null = null;
  if (deviceStatus?.uploaderBattery !== undefined) {
    uploaderBattery = Number(deviceStatus.uploaderBattery);
  } else if (deviceStatus?.uploader?.battery !== undefined) {
    const uploaderData = deviceStatus.uploader.battery;
    if (typeof uploaderData === 'number') {
      uploaderBattery = uploaderData;
    } else if (typeof uploaderData === 'object' && uploaderData !== null) {
      uploaderBattery = (uploaderData as any).percent ?? (uploaderData as any).value ?? null;
    }
  }

  const uploaderBatteryValue = (uploaderBattery !== null && !isNaN(uploaderBattery)) ? `${Math.round(uploaderBattery)}%` : '---';
  const uploaderBatteryStatus = (uploaderBattery !== null && !isNaN(uploaderBattery))
    ? uploaderBattery < 20
      ? 'urgent'
      : uploaderBattery < 50
      ? 'warning'
      : 'success'
    : 'info';

  return (
    <div className="card py-2 px-3 h-full">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-text-primary">Status</h2>
        {timeAgo && (
          <div className="flex items-center gap-1 text-text-secondary">
            <Clock className="w-3 h-3" />
            <span className="text-xs">{timeAgo}</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
        {/* IOB - Insulin on Board */}
        <Pill label="IOB" value={iobValue} icon={<Droplet className="w-3 h-3" />} status={iobStatus} />

        {/* COB - Carbs on Board */}
        <Pill label="COB" value={cobValue} icon={<Activity className="w-3 h-3" />} status={cobStatus} />

        {/* Pump Battery */}
        {pumpBattery !== undefined && (
          <Pill
            label="Pump"
            value={pumpBatteryValue}
            icon={<Battery className="w-3 h-3" />}
            status={pumpBatteryStatus}
          />
        )}

        {/* Reservoir */}
        {reservoir !== undefined && (
          <Pill
            label="Reservoir"
            value={reservoirValue}
            icon={<Droplet className="w-3 h-3" />}
            status={reservoirStatus}
          />
        )}

        {/* Uploader Battery */}
        {uploaderBattery !== undefined && (
          <Pill
            label="Uploader"
            value={uploaderBatteryValue}
            icon={<Zap className="w-3 h-3" />}
            status={uploaderBatteryStatus}
          />
        )}
      </div>

      {/* No data message */}
      {!iob && !cob && !pumpBattery && !reservoir && !uploaderBattery && (
        <div className="text-center py-8">
          <p className="text-text-secondary">No device status data available</p>
          <p className="text-sm text-text-muted mt-1">
            Connect your pump or loop system to see status information
          </p>
        </div>
      )}
    </div>
  );
}
