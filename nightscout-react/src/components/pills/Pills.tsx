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
    <div className={cn('pill', statusClasses[status])}>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <div className="flex flex-col">
        <span className="text-xs opacity-75">{label}</span>
        <span className="font-semibold">{value}</span>
      </div>
    </div>
  );
}

export function Pills() {
  const data = useBgStore((state) => state.data);

  // Calculate IOB from device status - try multiple sources
  let iob: number | null = null;
  const deviceStatus = data?.devicestatus?.[0];

  if (deviceStatus) {
    // Debug: log the device status structure
    console.log('Device status:', deviceStatus);

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

    console.log('Extracted IOB:', iob);
  }

  const iobValue = (iob !== null && !isNaN(iob)) ? `${iob.toFixed(2)}U` : '---';
  const iobStatus = (iob !== null && iob > 3) ? 'warning' : 'info';

  // Calculate COB from device status - try multiple sources
  let cob: number | null = null;

  if (deviceStatus) {
    // Try different COB sources
    if (deviceStatus.loop?.cob?.cob !== undefined) {
      cob = Number(deviceStatus.loop.cob.cob);
    } else if (deviceStatus.openaps?.cob !== undefined) {
      cob = Number(deviceStatus.openaps.cob);
    } else if (deviceStatus.pump?.cob !== undefined) {
      cob = Number(deviceStatus.pump.cob);
    }

    console.log('Extracted COB:', cob);
  }

  const cobValue = (cob !== null && !isNaN(cob)) ? `${Math.round(cob)}g` : '---';
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

  console.log('Extracted pump battery:', pumpBattery);

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

  console.log('Extracted reservoir:', reservoir);

  const reservoirValue = (reservoir !== null && !isNaN(reservoir)) ? `${reservoir.toFixed(1)}U` : '---';
  const reservoirStatus = (reservoir !== null && !isNaN(reservoir))
    ? reservoir < 20
      ? 'urgent'
      : reservoir < 50
      ? 'warning'
      : 'success'
    : 'info';

  // Uploader battery - handle both number and object formats
  let uploaderBattery: number | null = null;
  if (deviceStatus?.uploader?.battery !== undefined) {
    const uploaderData = deviceStatus.uploader.battery;
    if (typeof uploaderData === 'number') {
      uploaderBattery = uploaderData;
    } else if (typeof uploaderData === 'object' && uploaderData !== null) {
      uploaderBattery = (uploaderData as any).percent ?? (uploaderData as any).value ?? null;
    }
  }

  console.log('Extracted uploader battery:', uploaderBattery);

  const uploaderBatteryValue = (uploaderBattery !== null && !isNaN(uploaderBattery)) ? `${Math.round(uploaderBattery)}%` : '---';
  const uploaderBatteryStatus = (uploaderBattery !== null && !isNaN(uploaderBattery))
    ? uploaderBattery < 20
      ? 'urgent'
      : uploaderBattery < 50
      ? 'warning'
      : 'success'
    : 'info';

  return (
    <div className="card">
      <h2 className="text-xl font-semibold text-text-primary mb-4">Status</h2>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* IOB - Insulin on Board */}
        <Pill label="IOB" value={iobValue} icon={<Droplet className="w-4 h-4" />} status={iobStatus} />

        {/* COB - Carbs on Board */}
        <Pill label="COB" value={cobValue} icon={<Activity className="w-4 h-4" />} status={cobStatus} />

        {/* Pump Battery */}
        {pumpBattery !== undefined && (
          <Pill
            label="Pump"
            value={pumpBatteryValue}
            icon={<Battery className="w-4 h-4" />}
            status={pumpBatteryStatus}
          />
        )}

        {/* Reservoir */}
        {reservoir !== undefined && (
          <Pill
            label="Reservoir"
            value={reservoirValue}
            icon={<Droplet className="w-4 h-4" />}
            status={reservoirStatus}
          />
        )}

        {/* Uploader Battery */}
        {uploaderBattery !== undefined && (
          <Pill
            label="Uploader"
            value={uploaderBatteryValue}
            icon={<Zap className="w-4 h-4" />}
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
