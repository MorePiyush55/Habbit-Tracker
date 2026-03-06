import mongoose, { Schema, models } from "mongoose";

/**
 * Knowledge Node — A single concept in the Personal Knowledge Graph.
 *
 * Nodes form a directed acyclic graph where:
 *   - Each node represents a learnable concept/topic
 *   - Dependencies define prerequisite relationships
 *   - Categories group nodes into knowledge clusters
 *   - Mastery tracks how well the user understands this concept
 *
 * Example graph:
 *   Cybersecurity
 *    ├─ Networking
 *    │   ├─ TCP/IP
 *    │   └─ DNS
 *    ├─ Cryptography
 *    │   ├─ Hashing
 *    │   └─ PKI
 *    └─ Risk Management
 */
const KnowledgeNodeSchema = new Schema(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
        nodeId: { type: String, required: true },           // e.g. "crypto_hashing"
        name: { type: String, required: true },             // e.g. "Hashing"
        category: { type: String, required: true },         // e.g. "Cryptography"
        dependencies: [{ type: String }],                   // nodeId references
        difficulty: { type: Number, default: 1, min: 1, max: 5 },
        mastery: { type: Number, default: 0, min: 0, max: 100 }, // how well user knows this
        lastStudied: { type: Date, default: null },
        studyCount: { type: Number, default: 0 },           // times studied/practiced
        linkedHabitIds: [{ type: Schema.Types.ObjectId, ref: "Habit" }],
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

KnowledgeNodeSchema.index({ userId: 1, nodeId: 1 }, { unique: true });
KnowledgeNodeSchema.index({ userId: 1, category: 1 });
KnowledgeNodeSchema.index({ userId: 1, mastery: 1 });

export default models.KnowledgeNode || mongoose.model("KnowledgeNode", KnowledgeNodeSchema);
