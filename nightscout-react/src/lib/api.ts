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
 * Build URL with authentication parameter if using Subject Token
 * Subject Tokens are passed as URL parameter: ?token=xxx
 * API_SECRET is passed as header (handled in getHeaders)
 */
function buildUrl(endpoint: string): string {
  const subjectToken = import.meta.env.VITE_SUBJECT_TOKEN;

  if (subjectToken) {
    // Subject Token goes in URL parameter
    const separator = endpoint.includes('?') ? '&' : '?';
    return `${endpoint}${separator}token=${subjectToken}`;
  }

  // No Subject Token, return endpoint as-is (will use API_SECRET header if available)
  return endpoint;
}

/**
 * Get headers for API requests including authentication
 * Supports two authentication methods with separate environment variables:
 * 1. VITE_SUBJECT_TOKEN - Subject Token from Admin Tools (recommended) - passed as URL parameter
 * 2. VITE_API_SECRET - Legacy Master API_SECRET (full access) - passed as header
 *
 * Priority: VITE_SUBJECT_TOKEN > VITE_API_SECRET
 */
async function getHeaders(): Promise<HeadersInit> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Check for Subject Token first (takes precedence)
  const subjectToken = import.meta.env.VITE_SUBJECT_TOKEN;
  if (subjectToken) {
    // Subject Token is added to URL via buildUrl(), not headers
    console.log('✅ Using Subject Token authentication (from Admin Tools)');
    return headers;
  }

  // Method 2: Legacy API_SECRET (fallback)
  const apiSecret = import.meta.env.VITE_API_SECRET;
  if (apiSecret) {
    if (!hashedSecret) {
      hashedSecret = await hashApiSecret(apiSecret);
    }
    headers['api-secret'] = hashedSecret;
    console.log('⚠️  Using legacy API_SECRET authentication (full access)');
    return headers;
  }

  // No authentication configured
  console.warn('⚠️  No authentication configured! Set VITE_SUBJECT_TOKEN or VITE_API_SECRET');
  return headers;
}

/**
 * Normalize treatment data from REST API
 * REST API returns created_at as string, but we need mills as number
 */
function normalizeTreatment(treatment: any): Treatment {
  // Calculate mills from created_at if not present
  const mills = treatment.mills || new Date(treatment.created_at).getTime();

  return {
    ...treatment,
    mills,
  };
}

/**
 * Fetch current Nightscout status and initial data
 */
export async function fetchNightscoutData(): Promise<NightscoutData> {
  try {
    const headers = await getHeaders();

    const [entriesRes, treatmentsRes, profileRes, devicestatusRes] = await Promise.all([
      fetch(buildUrl(`${API_BASE}/entries.json?count=1000`), { headers }), // ~3.5 days for initial load
      fetch(buildUrl(`${API_BASE}/treatments.json?count=200`), { headers }),
      fetch(buildUrl(`${API_BASE}/profile.json`), { headers }),
      fetch(buildUrl(`${API_BASE}/devicestatus.json?count=1`), { headers }),
    ]);

    const entries: BgEntry[] = await entriesRes.json();
    const rawTreatments: any[] = await treatmentsRes.json();
    const profiles: Profile[] = await profileRes.json();
    const devicestatus: DeviceStatus[] = await devicestatusRes.json();

    // Normalize treatments to ensure mills field exists
    const treatments: Treatment[] = rawTreatments.map(normalizeTreatment);

    console.log('🔧 Normalized treatments from REST API:', {
      total: treatments.length,
      firstTreatment: treatments[0] ? {
        created_at: treatments[0].created_at,
        mills: treatments[0].mills,
        hasInsulin: !!treatments[0].insulin,
        hasCarbs: !!treatments[0].carbs,
      } : 'none',
    });

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
    const endpoint = `${API_BASE}/entries.json?find[date][$lt]=${beforeTimestamp}&count=${count}`;
    const res = await fetch(buildUrl(endpoint), { headers });

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
 * Fetch newer entries after a given timestamp
 * Used to load new data when scrolling forward (e.g., after scrolling back and time passing)
 */
export async function fetchNewerEntries(afterTimestamp: number, count: number = 288): Promise<BgEntry[]> {
  try {
    const headers = await getHeaders();
    // Nightscout API: find[date][$gt]=timestamp filters entries after the given date
    const endpoint = `${API_BASE}/entries.json?find[date][$gt]=${afterTimestamp}&count=${count}`;
    const res = await fetch(buildUrl(endpoint), { headers });

    if (!res.ok) {
      throw new Error(`Failed to fetch newer entries: ${res.status} ${res.statusText}`);
    }

    const entries: BgEntry[] = await res.json();
    return entries;
  } catch (error) {
    console.error('Failed to fetch newer entries:', error);
    throw error;
  }
}

/**
 * Fetch server status
 */
export async function fetchServerStatus() {
  try {
    const headers = await getHeaders();
    const res = await fetch(buildUrl(`${API_BASE}/status.json`), { headers });
    return await res.json();
  } catch (error) {
    console.error('Failed to fetch server status:', error);
    throw error;
  }
}
