import mongoose, { Document, Model } from 'mongoose';

/**
 * A point-in-time record of a match's book, written when the user explicitly
 * saves it.
 *
 * The match name and team names are copied in rather than referenced. These
 * rows are meant to outlive the match: deleting a match wipes its snapshots,
 * but a saved book is a deliberate record and must still read correctly
 * afterwards.
 */
export interface ISavedBook extends Document {
  matchId: string;
  matchName: string;
  teamA: string;
  teamB: string;
  teamA_PL: number;
  teamB_PL: number;
  /** Frames captured at the moment of saving, for context. */
  snapshotCount: number;
  savedAt: Date;
}

const savedBookSchema = new mongoose.Schema<ISavedBook>(
  {
    matchId: { type: String, required: true, index: true, trim: true },
    matchName: { type: String, required: true, trim: true },
    teamA: { type: String, default: '' },
    teamB: { type: String, default: '' },
    teamA_PL: { type: Number, required: true },
    teamB_PL: { type: Number, required: true },
    snapshotCount: { type: Number, min: 0, default: 0 },
    savedAt: { type: Date, required: true, default: Date.now },
  },
  { collection: 'saved_books' }
);

// Listing a match's history, newest first.
savedBookSchema.index({ matchId: 1, savedAt: -1 });
// Listing all matches that have saves, most recently saved first.
savedBookSchema.index({ savedAt: -1 });
// Searching by match name.
savedBookSchema.index({ matchName: 1 });

export const SavedBook: Model<ISavedBook> =
  mongoose.models.SavedBook || mongoose.model<ISavedBook>('SavedBook', savedBookSchema);
