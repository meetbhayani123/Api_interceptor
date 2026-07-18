const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Centralized API client. All fetch calls go through here.
 */
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data as T;
}

// ─── 11xplay Client-Side Fetch Helpers ───

/**
 * Fetch event details directly from 11xplay API using the browser.
 *
 * WHY client-side? Cloudflare WAF blocks ALL datacenter IPs (Vercel, Render,
 * AWS, GCP, etc.). The only way to reliably reach 11xplay is from a
 * residential IP — i.e. the user's browser.
 */
async function fetchEventFromBrowser(eventId: string) {
  const response = await fetch(
    `https://api.11xplay.pink/api/guest/event/${eventId}`,
    {
      method: 'POST',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: '',
    }
  );

  if (!response.ok) {
    const text = await response.text();
    const isWaf = text.includes('Cloudflare') || text.includes('cloudflare');
    throw new Error(
      isWaf
        ? `Cloudflare blocked the request (${response.status}). Try refreshing.`
        : `11xplay API returned ${response.status}: ${text.substring(0, 200)}`
    );
  }

  return response.json();
}

/**
 * Extract team names, marketId, and match name from 11xplay event payload.
 */
function extractEventData(eventId: string, payload: any) {
  const runners =
    payload.data?.event?.match_odds?.runners ||
    payload.match_odds?.runners ||
    [];

  let team1 = runners.length > 0 ? runners[0].name : 'Unknown Team A';
  let team2 = runners.length > 1 ? runners[1].name : 'Unknown Team B';

  if (team1 === 'Unknown Team A' && team2 === 'Unknown Team B') {
    const matchName =
      payload.data?.event?.event?.name ||
      payload.name ||
      payload.event?.name ||
      '';
    if (matchName.includes(' v ')) {
      const parts = matchName.split(' v ');
      team1 = parts[0]?.trim();
      team2 = parts[1]?.trim();
    } else if (matchName.includes(' vs ')) {
      const parts = matchName.split(' vs ');
      team1 = parts[0]?.trim();
      team2 = parts[1]?.trim();
    } else if (matchName) {
      team1 = matchName;
    }
  }

  const marketId =
    payload.data?.event?.match_odds?.market_id || payload.match_odds?.market_id;
  const name =
    payload.data?.event?.event?.name ||
    payload.name ||
    `${team1} vs ${team2}`;

  if (!marketId) {
    throw new Error(`market_id not found in event ${eventId}`);
  }

  return { eventId, team1, team2, marketId, name };
}

// ─── Match Endpoints ───

export const api = {
  /** List all matches */
  getMatches: () => request<any[]>('/api/matches'),

  /**
   * Import matches by fetching event data from the BROWSER (client-side),
   * then saving the extracted details to the Render backend.
   *
   * Flow:
   *   1. Browser → api.11xplay.pink  (user's residential IP — not blocked)
   *   2. Browser → Render /api/match/import-details  (just saves to MongoDB)
   */
  importMatches: async (eventIds: string) => {
    const ids = eventIds
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (ids.length === 0) {
      throw new Error('No valid event IDs provided');
    }

    const imported: any[] = [];
    const errors: Array<{ id: string; message: string }> = [];

    for (const eventId of ids) {
      try {
        // Step 1: Browser fetches event data directly from 11xplay
        const payload = await fetchEventFromBrowser(eventId);

        // Step 2: Extract teams + marketId
        const details = extractEventData(eventId, payload);

        // Step 3: Save to backend (no external API call — just MongoDB write)
        const saved = await request<any>('/api/match/import-details', {
          method: 'POST',
          body: JSON.stringify(details),
        });

        imported.push(saved.match);
      } catch (err: any) {
        errors.push({
          id: eventId,
          message: err.message || 'Failed to import',
        });
      }
    }

    return {
      message: `Finished importing. Success: ${imported.length}, Failed: ${errors.length}`,
      matches: imported,
      errors: errors.length > 0 ? errors : undefined,
    };
  },

  /** Get single match with snapshots + book */
  getMatch: (id: string) => request<any>(`/api/match/${id}`),

  /** Delete a match (password required) */
  deleteMatch: (id: string, password: string) =>
    request<any>(`/api/match/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ password }),
    }),

  /** Start polling for a match */
  startPolling: (id: string) =>
    request<any>(`/api/match/${id}/start-polling`, { method: 'POST' }),

  /** Stop polling for a match */
  stopPolling: (id: string) =>
    request<any>(`/api/match/${id}/stop-polling`, { method: 'POST' }),

  /** Check polling status */
  getPollingStatus: (id: string) =>
    request<{ isPolling: boolean }>(`/api/match/${id}/polling-status`),

  /** Lock book */
  lockBook: (id: string, currentOdds: any) =>
    request<any>(`/api/match/${id}/lock`, {
      method: 'POST',
      body: JSON.stringify({ currentOdds }),
    }),
};
