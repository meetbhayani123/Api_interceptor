export interface IOddsEntry {
  timestamp: Date;
  teamA: number;
  teamB: number;
  draw?: number;
  locked: boolean;
}

export interface ITeamOdds {
  odds: [number, number];
  pricing: [number, number];
}

export interface IOddsSnapshot {
  matchId: string;
  sequenceId: number;
  signature: string;
  capturedAt: Date;
  teamA: ITeamOdds;
  teamB: ITeamOdds;
}

export interface IMatch {
  id?: string;
  eventId?: string;
  marketId?: string;
  name: string;
  teamA?: string;
  teamB?: string;
  startTime: Date;
  status: 'upcoming' | 'live' | 'completed';
  oddsHistory: IOddsEntry[];
  snapshots?: IOddsSnapshot[];
}

export interface IFinalBookResult {
  profitTeamA: string;
  profitTeamB: string;
  profitDraw?: string;
  isLocked: boolean;
}
