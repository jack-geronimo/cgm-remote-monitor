import { Activity, Droplet, Battery, Zap } from 'lucide-react';
import { useBgStore } from '../../stores/bgStore';
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

  return (
    <div className={cn('pill', statusClasses[status], 'py-1 px-2')}>
      {icon && <span className="flex-shrink-0 w-3 h-3">{icon}</span>}
      <div className="flex flex-col">
        <span className="text-[10px] opacity-75">{label}</span>
        <span className="text-sm font-semibold">{value}</span>
      </div>
    </div>
  );
}

export function Pills() {
  // Subscribe directly to devicestatus instead of deprecated data field
  const devicestatus = useBgStore((state) => state.devicestatus);

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
    <div className="card py-2 px-3">
      <h2 className="text-sm font-semibold text-text-primary mb-2">Status</h2>

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
