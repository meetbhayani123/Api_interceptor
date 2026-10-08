// ─── Odds Entry (legacy book locking) ───
export interface IOddsEntry {
  timestamp: Date;
  teamA: number;
  teamB: number;
  draw?: number;
  locked: boolean;
}

// ─── Team Odds Snapshot ───
export interface ITeamOdds {
  odds: [number, number];   // [back, lay]
  pricing: [number, number]; // [back, lay]
}

// ─── Odds Snapshot Document ───
export interface IOddsSnapshot {
  _id?: string;
  matchId: string;
  sequenceId: number;
  signature: string;
  capturedAt: Date;
  teamA: ITeamOdds;
  teamB: ITeamOdds;
}

// ─── Match Status ───
export type MatchStatus = 'upcoming' | 'running' | 'completed';

// ─── Match Document ───
export interface IMatch {
  _id?: string;
  eventId?: string;
  marketId?: string;
  name: string;
  teamA?: string;
  teamB?: string;
  startTime: Date;
  pollingStartedAt?: Date;
  /** Last poll that actually returned parseable odds. */
  lastSuccessfulPollAt?: Date;
  /** Failed polls since the last success; reset to 0 on any success. */
  consecutiveFailures?: number;
  /** Why the most recent poll failed, surfaced so failures are not silent. */
  lastPollError?: string;
  status: MatchStatus;
  oddsHistory: IOddsEntry[];
  finalBook?: IBookResult;
  bookHighLow?: IBookHighLow;
  totalSnapshotCount?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// ─── Book Result (matches calculateNetBook output) ───
export interface IBookResult {
  teamA_PL: number;
  teamB_PL: number;
}

// ─── Book High/Low (historical peak & trough of cumulative P/L) ───
export interface IBookHighLow {
  teamA_high: number;
  teamA_low: number;
  teamB_high: number;
  teamB_low: number;
}

// ─── Match Detail (API response with snapshots + book) ───
export interface IMatchDetail extends IMatch {
  snapshots: IOddsSnapshot[];
  finalBook?: IBookResult;
}

// ─── Saved Book (a deliberate point-in-time record of a match's book) ───
export interface ISavedBook {
  _id?: string;
  matchId: string;
  matchName: string;
  teamA: string;
  teamB: string;
  teamA_PL: number;
  teamB_PL: number;
  snapshotCount: number;
  savedAt: Date;
}

// ─── One row of the saved-books index: a match, summarised ───
export interface ISavedBookMatch {
  matchId: string;
  matchName: string;
  teamA: string;
  teamB: string;
  saveCount: number;
  lastSavedAt: Date;
  lastTeamA_PL: number;
  lastTeamB_PL: number;
}

// ─── A page of results ───
export interface IPaginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
