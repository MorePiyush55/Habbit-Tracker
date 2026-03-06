import mongoose, { Schema, models } from "mongoose";

/**
 * Hunter Profile — Deep user context for intelligent coaching.
 * ============================================================
 * Stores missions, learning progress, skill self-ratings,
 * time availability, weaknesses, and long-term vision.
 * This data powers the Action Planner and Directive Generator.
 */

const LearningProgressSchema = new Schema({
    name: { type: String, required: true },           // e.g. "CompTIA Security+"
    completedUnits: { type: Number, default: 0 },     // e.g. 11 sections
    totalUnits: { type: Number, default: 1 },         // e.g. 18 sections
    avgStudyTimeMinutes: { type: Number, default: 0 }, // daily avg
    weeklyGoal: { type: Number, default: 0 },         // e.g. 5 walkthroughs/week
    weakestAreas: [{ type: String }],                  // e.g. ["Endpoint Security", "Cryptography"]
}, { _id: false });

const SkillRatingSchema = new Schema({
    name: { type: String, required: true },
    rating: { type: Number, default: 50, min: 0, max: 100 },
}, { _id: false });

const WeeklyTargetSchema = new Schema({
    name: { type: String, required: true },          // e.g. "Job Applications"
    target: { type: Number, default: 0 },            // e.g. 10 per week
    current: { type: Number, default: 0 },           // e.g. 3 done so far
}, { _id: false });

const HunterProfileSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },

    // SECTION 1 — Main Missions (top 3 life objectives)
    missions: [{ type: String }],

    // SECTION 2 — Learning Progress (courses, certifications)
    learningProgress: [LearningProgressSchema],

    // SECTION 3 — Weekly Targets (job applications, outreach, etc.)
    weeklyTargets: [WeeklyTargetSchema],

    // SECTION 4 — Self-rated Skill Levels (0-100)
    skillRatings: [SkillRatingSchema],

    // SECTION 5 — Time Availability
    dailyAvailableHours: { type: Number, default: 4 },
    bestFocusTime: { type: String, default: "morning", enum: ["morning", "afternoon", "night"] },

    // SECTION 6 — Weakness Detection (self-reported)
    frequentlySkippedTasks: [{ type: String }],

    // SECTION 7 — Self Evaluation
    selfDisciplineRating: { type: Number, default: 50, min: 0, max: 100 },
    selfFocusRating: { type: Number, default: 50, min: 0, max: 100 },

    // SECTION 8 — Long-Term Vision (6-month goal)
    sixMonthVision: [{ type: String }],

    // Metadata
    isOnboarded: { type: Boolean, default: false },
    lastUpdated: { type: Date, default: Date.now },
}, { timestamps: true });

export default models.HunterProfile || mongoose.model("HunterProfile", HunterProfileSchema);
