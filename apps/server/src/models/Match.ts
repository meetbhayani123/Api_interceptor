import mongoose, { Schema, Document } from 'mongoose';
import { IMatch, IOddsEntry } from '@repo/types';

export interface IMatchDocument extends Omit<IMatch, 'id'>, Document {}

const OddsEntrySchema = new Schema<IOddsEntry>({
  timestamp: { type: Date, default: Date.now },
  teamA: { type: Number, required: true },
  teamB: { type: Number, required: true },
  draw: { type: Number, required: false },
  locked: { type: Boolean, default: false }
}, { _id: false });

const TeamOddsSchema = new Schema({
  odds: [Number],
  price: [Number]
}, { _id: false });

const SnapshotSchema = new Schema({
  matchId: { type: Schema.Types.ObjectId, ref: 'Match', required: true },
  timestamp: { type: Date, default: Date.now },
  teamA: TeamOddsSchema,
  teamB: TeamOddsSchema
});

const MatchSchema = new Schema<IMatchDocument>({
  eventId: { type: String, required: false },
  marketId: { type: String, required: false },
  name: { type: String, required: true },
  teamA: { type: String, required: false },
  teamB: { type: String, required: false },
  startTime: { type: Date, required: true },
  status: { type: String, enum: ['upcoming', 'live', 'completed'], default: 'upcoming' },
  oddsHistory: [OddsEntrySchema]
}, { timestamps: true });

export const Match = mongoose.model<IMatchDocument>('Match', MatchSchema);
export const Snapshot = mongoose.model('Snapshot', SnapshotSchema);
