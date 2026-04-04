import mongoose, { Document, Model } from 'mongoose';

export interface ITeamOdds {
  odds: [number, number];
  pricing: [number, number];
}

export interface IOddsSnapshot extends Document {
  matchId: string;
  sequenceId: number;
  signature: string;
  capturedAt: Date;
  teamA: ITeamOdds;
  teamB: ITeamOdds;
}

const teamOddsSchema = new mongoose.Schema<ITeamOdds>(
  {
    odds: {
      type: [Number],
      validate: {
        validator: (v: number[]) => v.length === 2,
        message: 'odds must have exactly 2 elements [back, lay]',
      },
      required: true,
    },
    pricing: {
      type: [Number],
      validate: {
        validator: (v: number[]) => v.length === 2,
        message: 'pricing must have exactly 2 elements [back, lay]',
      },
      required: true,
    },
  },
  { _id: false }
);

const oddsSnapshotSchema = new mongoose.Schema<IOddsSnapshot>(
  {
    matchId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    sequenceId: {
      type: Number,
      required: true,
      min: 1,
    },
    signature: {
      type: String,
      required: true,
      trim: true,
    },
    capturedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    teamA: {
      type: teamOddsSchema,
      required: true,
    },
    teamB: {
      type: teamOddsSchema,
      required: true,
    },
  },
  {
    collection: 'odds_snapshots',
  }
);

oddsSnapshotSchema.index({ matchId: 1, capturedAt: -1 });

oddsSnapshotSchema.index(
  { capturedAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
);

export const OddsSnapshot: Model<IOddsSnapshot> =
  mongoose.models.OddsSnapshot || mongoose.model<IOddsSnapshot>('OddsSnapshot', oddsSnapshotSchema);
