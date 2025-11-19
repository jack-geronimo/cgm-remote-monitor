import type { NightscoutData, BgEntry, Treatment, DeviceStatus, Profile } from '../types';

// Use relative URLs - Vite proxy will forward to VITE_API_URL in development
const API_BASE = '/api/v1';

/**
 * Get headers for API requests including API secret if available
 */
function getHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Add API secret if configured
  const apiSecret = import.meta.env.VITE_API_SECRET;
  if (apiSecret) {
    headers['api-secret'] = apiSecret;
  }

  return headers;
}

/**
 * Fetch current Nightscout status and initial data
 */
export async function fetchNightscoutData(): Promise<NightscoutData> {
  try {
    const headers = getHeaders();

    const [entriesRes, treatmentsRes, profileRes, devicestatusRes] = await Promise.all([
      fetch(`${API_BASE}/entries.json?count=288`, { headers }), // 24 hours at 5min intervals
      fetch(`${API_BASE}/treatments.json?count=200`, { headers }),
      fetch(`${API_BASE}/profile.json`, { headers }),
      fetch(`${API_BASE}/devicestatus.json?count=1`, { headers }),
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
    const headers = getHeaders();
    const res = await fetch(`${API_BASE}/status.json`, { headers });
    return await res.json();
  } catch (error) {
    console.error('Failed to fetch server status:', error);
    throw error;
  }
}
