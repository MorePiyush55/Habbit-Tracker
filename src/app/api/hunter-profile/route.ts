/**
 * Hunter Profile API — CRUD for deep user context
 * ==================================================
 * GET:  Fetch the current hunter profile
 * PUT:  Create or update the full profile
 * PATCH: Partial update (e.g. update just weeklyTargets.current)
 */

import { NextRequest } from "next/server";
import { getUserId } from "@/lib/auth";
import { handleError, unauthorized, badRequest } from "@/lib/apiError";
import connectDB from "@/lib/mongodb";
import HunterProfile from "@/models/HunterProfile";

export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        await connectDB();

        let profile = await HunterProfile.findOne({ userId }).lean();

        if (!profile) {
            // Return empty scaffold
            profile = {
                userId,
                missions: [],
                learningProgress: [],
                weeklyTargets: [],
                skillRatings: [],
                dailyAvailableHours: 4,
                bestFocusTime: "morning",
                frequentlySkippedTasks: [],
                selfDisciplineRating: 50,
                selfFocusRating: 50,
                sixMonthVision: [],
                isOnboarded: false,
            };
        }

        return Response.json({ profile });
    } catch (error) {
        return handleError(error);
    }
}

export async function PUT(req: NextRequest) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        const body = await req.json();
        if (!body) return badRequest("Profile data is required.");

        await connectDB();

        const profileData = {
            userId,
            missions: body.missions || [],
            learningProgress: body.learningProgress || [],
            weeklyTargets: body.weeklyTargets || [],
            skillRatings: body.skillRatings || [],
            dailyAvailableHours: body.dailyAvailableHours || 4,
            bestFocusTime: body.bestFocusTime || "morning",
            frequentlySkippedTasks: body.frequentlySkippedTasks || [],
            selfDisciplineRating: body.selfDisciplineRating ?? 50,
            selfFocusRating: body.selfFocusRating ?? 50,
            sixMonthVision: body.sixMonthVision || [],
            isOnboarded: true,
            lastUpdated: new Date(),
        };

        const profile = await HunterProfile.findOneAndUpdate(
            { userId },
            { $set: profileData },
            { upsert: true, new: true, lean: true }
        );

        return Response.json({ profile, message: "Profile updated." });
    } catch (error) {
        return handleError(error);
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        const updates = await req.json();
        if (!updates || Object.keys(updates).length === 0) {
            return badRequest("No updates provided.");
        }

        await connectDB();

        // Remove protected fields
        delete updates.userId;
        delete updates._id;
        updates.lastUpdated = new Date();

        const profile = await HunterProfile.findOneAndUpdate(
            { userId },
            { $set: updates },
            { new: true, lean: true }
        );

        if (!profile) return badRequest("Profile not found.");

        return Response.json({ profile });
    } catch (error) {
        return handleError(error);
    }
}
