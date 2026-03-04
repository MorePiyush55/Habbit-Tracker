import mongoose, { Schema, models } from "mongoose";

const SubtaskSchema = new Schema({
    habitId: { type: Schema.Types.ObjectId, ref: "Habit", required: true, index: true },
    title: { type: String, required: true },
    order: { type: Number, default: 0 },
});

SubtaskSchema.index({ habitId: 1, order: 1 });

export default models.Subtask || mongoose.model("Subtask", SubtaskSchema);
