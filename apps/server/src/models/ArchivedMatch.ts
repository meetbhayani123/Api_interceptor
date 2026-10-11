import mongoose, { Document, Model } from 'mongoose';
import type { IBookResult, IBookHighLow } from '@repo/types';

/**
 * A deleted match, preserved.
 *
 * Deleting a match removes it and its snapshots; this keeps a permanent record
 * of what was there. Everything is copied in rather than referenced, because
 * the originals are gone by the time anyone reads this.
 */
export interface IArchivedMatchDocument extends Document {
  originalMatchId: string;
  name: string;
  teamA: string;
  teamB: string;
  eventId?: string;
  marketId?: string;
  startTime?: Date;
  finalBook?: IBookResult;
  bookHighLow?: IBookHighLow;
  frameCount: number;
  firstFrameAt?: Date;
  lastFrameAt?: Date;
  archivedAt: Date;
}

const archivedMatchSchema = new mongoose.Schema<IArchivedMatchDocument>(
  {
    originalMatchId: { type: String, required: true, index: true, trim: true },
    name: { type: String, required: true, trim: true },
    teamA: { type: String, default: '' },
    teamB: { type: String, default: '' },
    eventId: { type: String },
    marketId: { type: String },
    startTime: { type: Date },
    finalBook: { type: mongoose.Schema.Types.Mixed },
    bookHighLow: { type: mongoose.Schema.Types.Mixed },
    frameCount: { type: Number, min: 0, default: 0 },
    firstFrameAt: { type: Date },
    lastFrameAt: { type: Date },
    archivedAt: { type: Date, required: true, default: Date.now },
  },
  { collection: 'archived_matches' }
);

archivedMatchSchema.index({ archivedAt: -1 });
archivedMatchSchema.index({ name: 1 });

export const ArchivedMatch: Model<IArchivedMatchDocument> =
  mongoose.models.ArchivedMatch ||
  mongoose.model<IArchivedMatchDocument>('ArchivedMatch', archivedMatchSchema);
