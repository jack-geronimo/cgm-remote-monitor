import type { NightscoutData, BgEntry, Treatment, DeviceStatus, Profile } from '../types';

const API_BASE = '/api/v1';

/**
 * Fetch current Nightscout status and initial data
 */
export async function fetchNightscoutData(): Promise<NightscoutData> {
  try {
    const [entriesRes, treatmentsRes, profileRes, devicestatusRes] = await Promise.all([
      fetch(`${API_BASE}/entries.json?count=288`), // 24 hours at 5min intervals
      fetch(`${API_BASE}/treatments.json?count=200`),
      fetch(`${API_BASE}/profile.json`),
      fetch(`${API_BASE}/devicestatus.json?count=1`),
    ]);

    const entries: BgEntry[] = await entriesRes.json();
    const treatments: Treatment[] = await treatmentsRes.json();
    const profiles: Profile[] = await profileRes.json();
    const devicestatus: DeviceStatus[] = await devicestatusRes.json();

    return {
      entries,
      treatments,
      devicestatus,
      profile: profiles[0] || null,
      serverTime: Date.now(),
    };
  } catch (error) {
    console.error('Failed to fetch Nightscout data:', error);
    throw error;
  }
}

/**
 * Fetch server status
 */
export async function fetchServerStatus() {
  try {
    const res = await fetch(`${API_BASE}/status.json`);
    return await res.json();
  } catch (error) {
    console.error('Failed to fetch server status:', error);
    throw error;
  }
}
