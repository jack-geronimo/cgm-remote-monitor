import type { NightscoutData, BgEntry, Treatment, DeviceStatus, Profile } from '../types';

// Use relative URLs - Vite proxy will forward to VITE_API_URL in development
const API_BASE = '/api/v1';

/**
 * Hash API secret using SHA1 (Nightscout expects hashed secret)
 */
async function hashApiSecret(secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(secret);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Cache for hashed API secret
let hashedSecret: string | null = null;

/**
 * Get headers for API requests including API secret if available
 */
async function getHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Add API secret if configured
  const apiSecret = import.meta.env.VITE_API_SECRET;
  if (apiSecret) {
    // Hash the secret if not already cached
    if (!hashedSecret) {
      hashedSecret = await hashApiSecret(apiSecret);
    }
    headers['api-secret'] = hashedSecret;
  }

  return headers;
}

/**
 * Fetch current Nightscout status and initial data
 */
export async function fetchNightscoutData(): Promise<NightscoutData> {
  try {
    const headers = await getHeaders();

    const [entriesRes, treatmentsRes, profileRes, devicestatusRes] = await Promise.all([
      fetch(`${API_BASE}/entries.json?count=1000`, { headers }), // ~3.5 days at 5min intervals for better scrolling
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
 * Fetch older entries before a given timestamp
 * Used for infinite scroll backwards in time
 */
export async function fetchOlderEntries(beforeTimestamp: number, count: number = 288): Promise<BgEntry[]> {
  try {
    const headers = await getHeaders();
    // Nightscout API: find[date][$lt]=timestamp filters entries before the given date
    const url = `${API_BASE}/entries.json?find[date][$lt]=${beforeTimestamp}&count=${count}`;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      throw new Error(`Failed to fetch older entries: ${res.status} ${res.statusText}`);
    }

    const entries: BgEntry[] = await res.json();
    return entries;
  } catch (error) {
    console.error('Failed to fetch older entries:', error);
    throw error;
  }
}

/**
 * Fetch server status
 */
export async function fetchServerStatus() {
  try {
    const headers = await getHeaders();
    const res = await fetch(`${API_BASE}/status.json`, { headers });
    return await res.json();
  } catch (error) {
    console.error('Failed to fetch server status:', error);
    throw error;
  }
}
