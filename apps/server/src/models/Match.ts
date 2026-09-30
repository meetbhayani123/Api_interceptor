import mongoose, { Schema, Document } from 'mongoose';
import type { IMatch, IOddsEntry, IBookResult } from '@repo/types';

export interface IMatchDocument extends Omit<IMatch, '_id'>, Document {
  finalBook?: IBookResult;
  totalSnapshotCount?: number;
}

const OddsEntrySchema = new Schema<IOddsEntry>({
  timestamp: { type: Date, default: Date.now },
  teamA: { type: Number, required: true },
  teamB: { type: Number, required: true },
  draw: { type: Number, required: false },
  locked: { type: Boolean, default: false },
}, { _id: false });

const MatchSchema = new Schema<IMatchDocument>({
  eventId: { type: String, required: false, index: true },
  marketId: { type: String, required: false },
  name: { type: String, required: true },
  teamA: { type: String, required: false },
  teamB: { type: String, required: false },
  startTime: { type: Date, required: true },
  // When polling actually began (set PRE_START_LEAD_MS before startTime by MatchScheduler).
  pollingStartedAt: { type: Date, required: false },
  status: {
    type: String,
    enum: ['upcoming', 'running', 'completed'],
    default: 'upcoming',
  },
  oddsHistory: [OddsEntrySchema],
  finalBook: { type: Schema.Types.Mixed, required: false },
  totalSnapshotCount: { type: Number, min: 0, default: 0 },
} as any, { timestamps: true });

export const Match = mongoose.model<IMatchDocument>('Match', MatchSchema);
