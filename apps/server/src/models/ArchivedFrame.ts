import mongoose, { Document, Model } from 'mongoose';

/**
 * One captured frame, preserved after its match was deleted.
 *
 * Deliberately a separate collection from odds_snapshots, which carries a
 * 30-day TTL — copying frames into a TTL'd collection would quietly erase the
 * archive a month later. Nothing here expires.
 */
export interface IArchivedFrameDocument extends Document {
  archiveId: mongoose.Types.ObjectId;
  originalMatchId: string;
  sequenceId: number;
  capturedAt: Date;
  teamA: { odds: number[]; pricing: number[] };
  teamB: { odds: number[]; pricing: number[] };
}

const sideSchema = new mongoose.Schema(
  {
    odds: { type: [Number], required: true },
    pricing: { type: [Number], required: true },
  },
  { _id: false }
);

const archivedFrameSchema = new mongoose.Schema<IArchivedFrameDocument>(
  {
    archiveId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    originalMatchId: { type: String, required: true, trim: true },
    sequenceId: { type: Number, required: true },
    capturedAt: { type: Date, required: true },
    teamA: { type: sideSchema, required: true },
    teamB: { type: sideSchema, required: true },
  },
  { collection: 'archived_frames' }
);

// Paging through one archive in capture order.
archivedFrameSchema.index({ archiveId: 1, capturedAt: 1 });

export const ArchivedFrame: Model<IArchivedFrameDocument> =
  mongoose.models.ArchivedFrame ||
  mongoose.model<IArchivedFrameDocument>('ArchivedFrame', archivedFrameSchema);
