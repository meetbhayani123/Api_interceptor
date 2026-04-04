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
  status: MatchStatus;
  oddsHistory: IOddsEntry[];
  createdAt?: Date;
  updatedAt?: Date;
}

// ─── Book Result (matches calculateNetBook output) ───
export interface IBookResult {
  teamA_PL: number;
  teamB_PL: number;
}

// ─── Match Detail (API response with snapshots + book) ───
export interface IMatchDetail extends IMatch {
  snapshots: IOddsSnapshot[];
  finalBook?: IBookResult;
}
