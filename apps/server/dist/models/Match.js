import mongoose, { Schema } from 'mongoose';
const OddsEntrySchema = new Schema({
    timestamp: { type: Date, default: Date.now },
    teamA: { type: Number, required: true },
    teamB: { type: Number, required: true },
    draw: { type: Number, required: false },
    locked: { type: Boolean, default: false },
}, { _id: false });
const MatchSchema = new Schema({
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
    finalBook: { type: Schema.Types.Mixed, required: false },
    totalSnapshotCount: { type: Number, min: 0, default: 0 },
}, { timestamps: true });
export const Match = mongoose.model('Match', MatchSchema);
