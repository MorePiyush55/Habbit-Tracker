/**
 * Behavior Analysis API — Deep 30-day behavior analysis
 * Returns detailed insights, interventions, and recommendations
 */
import { getUserId } from "@/lib/auth";
import { analyzeBehavior } from "@/lib/core/behaviorAnalyzer";
import { handleError, unauthorized } from "@/lib/apiError";

export async function GET(req: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        const { searchParams } = new URL(req.url);
        const days = parseInt(searchParams.get("days") || "30");

        const insight = await analyzeBehavior(userId, days);

        return Response.json({ insight });
    } catch (error) {
        return handleError(error);
    }
}
