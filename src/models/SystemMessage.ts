import mongoose from "mongoose";

const systemMessageSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["system", "user", "assistant"], required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
});

// Index for getting conversation history quickly
systemMessageSchema.index({ userId: 1, timestamp: -1 });

export default mongoose.models.SystemMessage || mongoose.model("SystemMessage", systemMessageSchema);
