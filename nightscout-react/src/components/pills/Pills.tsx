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

  // Calculate COB from device status
  const cob = data?.devicestatus?.[0]?.loop?.cob?.cob;
  const cobValue = cob ? `${Math.round(cob)}g` : '---';
  const cobStatus = cob && cob > 100 ? 'warning' : 'info';

  // Pump battery
  const pumpBattery = data?.devicestatus?.[0]?.pump?.battery;
  const pumpBatteryValue = pumpBattery ? `${pumpBattery}%` : '---';
  const pumpBatteryStatus = pumpBattery
    ? pumpBattery < 20
      ? 'urgent'
      : pumpBattery < 50
      ? 'warning'
      : 'success'
    : 'info';

  // Pump reservoir
  const reservoir = data?.devicestatus?.[0]?.pump?.reservoir;
  const reservoirValue = reservoir ? `${reservoir}U` : '---';
  const reservoirStatus = reservoir
    ? reservoir < 20
      ? 'urgent'
      : reservoir < 50
      ? 'warning'
      : 'success'
    : 'info';

  // Uploader battery
  const uploaderBattery = data?.devicestatus?.[0]?.uploader?.battery;
  const uploaderBatteryValue = uploaderBattery ? `${uploaderBattery}%` : '---';
  const uploaderBatteryStatus = uploaderBattery
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
