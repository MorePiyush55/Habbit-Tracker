import mongoose from "mongoose";

const penaltyQuestSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reason: { type: String, required: true },
    penaltyType: { type: String, required: true },
    questTitle: { type: String, required: true },
    xpReward: { type: Number, required: true },
    expires: { type: Date, required: true },
    completed: { type: Boolean, default: false }
}, {
    timestamps: true
});

penaltyQuestSchema.index({ userId: 1, completed: 1, expires: 1 });

export default mongoose.models.PenaltyQuest || mongoose.model("PenaltyQuest", penaltyQuestSchema);
