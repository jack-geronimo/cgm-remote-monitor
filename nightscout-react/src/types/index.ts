// Core Nightscout Types

export type Direction =
  | 'DoubleUp'
  | 'SingleUp'
  | 'FortyFiveUp'
  | 'Flat'
  | 'FortyFiveDown'
  | 'SingleDown'
  | 'DoubleDown'
  | 'NOT COMPUTABLE'
  | 'RATE OUT OF RANGE';

export interface BgEntry {
  _id: string;
  sgv: number;                  // Sensor Glucose Value (mg/dL)
  date: number;                 // Timestamp
  mills: number;                // Normalized timestamp
  direction: Direction;          // Trend arrow
  device: string;
  type: 'sgv' | 'mbg' | 'cal';
  filtered?: number;
  unfiltered?: number;
  noise?: number;
  rssi?: number;
}

export interface Treatment {
  _id: string;
  eventType: string;
  insulin?: number;
  carbs?: number;
  protein?: number;
  fat?: number;
  duration?: number;
  created_at: string;
  mills: number;
  notes?: string;
  enteredBy?: string;
  glucose?: number;
  glucoseType?: string;
}

export interface DeviceStatus {
  _id: string;
  device: string;
  created_at: string;
  mills: number;
  pump?: {
    battery?: number;
    reservoir?: number;
    clock?: string;
    status?: {
      status: string;
      bolusing: boolean;
      suspended: boolean;
    };
  };
  openaps?: {
    iob?: number;
    suggested?: {
      bg?: number;
      temp?: string;
      snoozeBG?: number;
    };
    enacted?: {
      bg?: number;
      temp?: string;
      duration?: number;
      rate?: number;
    };
  };
  loop?: {
    iob?: {
      iob: number;
      timestamp: string;
    };
    cob?: {
      cob: number;
      timestamp: string;
    };
    predicted?: {
      values: number[];
      startDate: string;
    };
  };
  uploader?: {
    battery?: number;
  };
}

export interface Profile {
  _id: string;
  defaultProfile: string;
  store: Record<string, ProfileStore>;
  startDate: string;
  mills: number;
  created_at: string;
}

export interface ProfileStore {
  dia: number;                  // Duration of Insulin Action (hours)
  carbratio: TimeValue[];       // Carb ratio (g/U)
  carbs_hr: number;             // Carbs absorption rate (g/hr)
  sens: TimeValue[];            // Insulin sensitivity (mg/dL per U)
  basal: TimeValue[];           // Basal rates (U/hr)
  target_low: TimeValue[];      // Target low (mg/dL)
  target_high: TimeValue[];     // Target high (mg/dL)
  timezone: string;
  units: 'mg/dl' | 'mmol';
}

export interface TimeValue {
  time: string;                 // HH:MM format
  value: number;
  timeAsSeconds: number;
}

export interface PluginData {
  iob?: {
    display: string;
    iob: number;
  };
  cob?: {
    display: string;
    cob: number;
  };
  bwp?: {
    bolusEstimate: number;
  };
  cage?: {
    display: string;
    hours: number;
  };
  sage?: {
    display: string;
    hours: number;
  };
  [key: string]: any;
}

export interface NightscoutData {
  entries: BgEntry[];
  treatments: Treatment[];
  devicestatus: DeviceStatus[];
  profile: Profile | null;
  serverTime: number;
}

export interface BgDataState {
  currentBg: number | null;
  direction: Direction | null;
  timestamp: number | null;
  delta: number | null;
  entries: BgEntry[];
  isStale: boolean;
}

export interface SettingsState {
  units: 'mg/dl' | 'mmol';
  theme: 'dark' | 'light' | 'auto';
  timeFormat: 12 | 24;
  alarmUrgentHigh: number;
  alarmHigh: number;
  targetTop: number;
  targetBottom: number;
  alarmLow: number;
  alarmUrgentLow: number;
  language: string;
}
