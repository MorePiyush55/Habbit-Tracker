import mongoose, { Schema, models } from "mongoose";

const UserSchema = new Schema(
    {
        googleId: { type: String, required: true, unique: true, index: true },
        name: { type: String, required: true },
        email: { type: String, required: true, unique: true },
        photo: { type: String, default: "" },
        level: { type: Number, default: 1 },
        totalXP: { type: Number, default: 0 },
        currentStreak: { type: Number, default: 0 },
        longestStreak: { type: Number, default: 0 },
        lastCompletedDate: { type: String, default: "" },

        // RPG Phase 2 Addition: Economy and Stats
        gold: { type: Number, default: 0 },
        statPoints: { type: Number, default: 0 }, // Unspent points earned on level up
        
        // RPG Phase 3 Addition: Survival Mechanics
        hp: { type: Number, default: 100 },
        maxHp: { type: Number, default: 100 },
        
        // 6 Core Life Stats (value = actual level, xp = progress to next point)
        stats: {
            STR: { value: { type: Number, default: 10 }, xp: { type: Number, default: 0 } },
            VIT: { value: { type: Number, default: 10 }, xp: { type: Number, default: 0 } },
            INT: { value: { type: Number, default: 10 }, xp: { type: Number, default: 0 } },
            AGI: { value: { type: Number, default: 10 }, xp: { type: Number, default: 0 } },
            PER: { value: { type: Number, default: 10 }, xp: { type: Number, default: 0 } },
            CHA: { value: { type: Number, default: 10 }, xp: { type: Number, default: 0 } }
        },

        // RPG Phase 4 Addition: Job System & Equipment
        jobClass: { type: String, default: "F-Rank Recruit" },
        equippedItems: {
            weapon: { type: String, default: null },
            armor: { type: String, default: null },
            accessory: { type: String, default: null }
        },
        inventory: [{ type: String }],

        // Phase 5: Long-Term Analytics
        disciplineScore: { type: Number, default: 50 },  // Ranges 0-100
        focusScore: { type: Number, default: 50 },
        skillGrowthScore: { type: Number, default: 50 },
        hunterRank: { type: String, default: "E-Class" }, // Evaluated weekly

        // Boss Raid variables
        weeklyBossHP: { type: Number, default: 500 },
        bossDefeatedThisWeek: { type: Boolean, default: false },
        bossRewardClaimedThisWeek: { type: Boolean, default: false },

        // Phase 13 — Streak Locking (delete-proof)
        streakSecuredDate: { type: String, default: "" }, // "YYYY-MM-DD"

        // Phase 13.3 — Daily Snapshot Freeze
        dailySnapshotLocked: { type: Boolean, default: false },
        dailySnapshotDate:   { type: String,  default: "" },  // "YYYY-MM-DD"

        // Phase 13.3 — XP Cap (anti-inflation)
        dailyXP:     { type: Number, default: 0 },   // XP earned today
        dailyXPDate: { type: String, default: "" },  // resets each day

        // Phase 13.3 — Fail Feedback (shown once per day reset)
        failFeedbackShownDate: { type: String, default: "" }, // "YYYY-MM-DD"

        // Phase 13 — Recovery Token (anti-exploit hardened)
        recoveryToken: {
            count:          { type: Number, default: 1 },
            lastUsedDate:   { type: Date,   default: null },
            weekRefillKey:  { type: String, default: "" },  // "2026-W12"
            _id: false,
        },

        // Phase 13 — Combo XP (server-validated)
        sessionCombo:         { type: Number, default: 0 },
        lastTaskCompletedAt:  { type: Date,   default: null },

        // Phase 13 — Session Mode (refresh-safe)
        session: {
            active:                      { type: Boolean, default: false },
            startedAt:                   { type: Date,    default: null  },
            completedTasksDuringSession: { type: Number,  default: 0    },
            durationMinutes:             { type: Number,  default: 60   },
            _id: false,
        },

        // Custom Rank Config (persisted per user)
        rankConfigs: [{
            key:   { type: String },
            label: { type: String },
            name:  { type: String },
            xp:    { type: Number },
            _id:   false,
        }],
    },
    { timestamps: true }
);

export default models.User || mongoose.model("User", UserSchema);
