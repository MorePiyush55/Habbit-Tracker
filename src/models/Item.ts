import mongoose from "mongoose";

const StatBoostsSchema = new mongoose.Schema({
    STR: { type: Number, default: 0 },
    VIT: { type: Number, default: 0 },
    INT: { type: Number, default: 0 },
    AGI: { type: Number, default: 0 },
    PER: { type: Number, default: 0 },
    CHA: { type: Number, default: 0 }
}, { _id: false });

const ItemSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    type: { type: String, enum: ["weapon", "armor", "accessory", "consumable"], required: true },
    rarity: { type: String, enum: ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic"], default: "Common" },
    statBoosts: { type: StatBoostsSchema, default: {} },
    equipped: { type: Boolean, default: false }
}, { timestamps: true });

ItemSchema.index({ userId: 1 });

export default mongoose.models.Item || mongoose.model("Item", ItemSchema);
