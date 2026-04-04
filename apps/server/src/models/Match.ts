import mongoose, { Schema, Document } from 'mongoose';
import type { IMatch, IOddsEntry } from '@repo/types';

export interface IMatchDocument extends Omit<IMatch, '_id'>, Document {}

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
  status: {
    type: String,
    enum: ['upcoming', 'running', 'completed'],
    default: 'upcoming',
  },
  oddsHistory: [OddsEntrySchema],
}, { timestamps: true });

export const Match = mongoose.model<IMatchDocument>('Match', MatchSchema);
