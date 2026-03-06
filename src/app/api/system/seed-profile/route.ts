/**
 * Seed Hunter Profile API — /api/system/seed-profile
 * =====================================================
 * One-time endpoint to populate the Hunter's actual progress data.
 * This seeds the HunterProfile so THE SYSTEM has accurate context.
 */

import { getUserId } from "@/lib/auth";
import { handleError, unauthorized } from "@/lib/apiError";
import connectDB from "@/lib/mongodb";
import HunterProfile from "@/models/HunterProfile";

export async function POST() {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        await connectDB();

        const profileData = {
            userId,

            // SECTION 1 — Main Missions
            missions: [
                "Pass CompTIA Security+",
                "Get a cybersecurity job at Google",
                "Build automation business",
            ],

            // SECTION 2 & 3 — Learning Progress
            learningProgress: [
                {
                    name: "CompTIA Security+",
                    completedUnits: 11,
                    totalUnits: 18,
                    avgStudyTimeMinutes: 180, // 3 hours/day
                    weeklyGoal: 0,
                    weakestAreas: [
                        "Endpoint Security",
                        "Cryptography",
                        "Network Monitoring / Detection",
                    ],
                },
                {
                    name: "TryHackMe Walkthroughs",
                    completedUnits: 77,
                    totalUnits: 350,
                    avgStudyTimeMinutes: 60, // 1 hour/day
                    weeklyGoal: 5, // 5 walkthroughs per week
                    weakestAreas: [],
                },
            ],

            // SECTION 4 & 5 — Weekly Targets
            weeklyTargets: [
                {
                    name: "Job Applications",
                    target: 70, // 10/day × 7 days
                    current: 0,
                },
            ],

            // SECTION 6 — Self-Rated Skills (0-100)
            skillRatings: [
                { name: "Networking", rating: 65 },
                { name: "Linux", rating: 55 },
                { name: "Automation", rating: 50 },
                { name: "Cybersecurity", rating: 60 },
                { name: "Endpoint Security", rating: 35 },
                { name: "Cryptography", rating: 40 },
                { name: "Network Monitoring", rating: 40 },
            ],

            // SECTION 7 — Time Availability
            dailyAvailableHours: 2,
            bestFocusTime: "night" as const,

            // SECTION 8 — Weakness Detection
            frequentlySkippedTasks: [
                "Book Reading",
            ],

            // SECTION 9 — Self Evaluation
            selfDisciplineRating: 55,
            selfFocusRating: 40,

            // SECTION 10 — Long-Term Vision (4-month, user-specified)
            sixMonthVision: [
                "CompTIA Security+ certified",
                "Cybersecurity job at Google",
                "Automation business with clients",
            ],

            isOnboarded: true,
            lastUpdated: new Date(),
        };

        const profile = await HunterProfile.findOneAndUpdate(
            { userId },
            { $set: profileData },
            { upsert: true, new: true, lean: true }
        );

        return Response.json({
            message: "Hunter profile seeded successfully. THE SYSTEM now has full context.",
            profile,
            summary: {
                missions: 3,
                learningTracks: 2,
                weeklyTargets: 1,
                skills: 7,
                availableHours: 2,
                focusTime: "night",
                discipline: 55,
                focus: 40,
                vision: 3,
            },
        });
    } catch (error) {
        return handleError(error);
    }
}
