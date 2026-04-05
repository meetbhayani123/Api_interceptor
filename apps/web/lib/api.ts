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

// ─── Match Endpoints ───

export const api = {
  /** List all matches */
  getMatches: () => request<any[]>('/api/matches'),

  /** Import matches from event IDs */
  importMatches: (eventIds: string) =>
    fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventIds }),
    }).then(async (res) => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
      return data;
    }),

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
