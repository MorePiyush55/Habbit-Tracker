import { getUserId } from "@/lib/auth";
import { buildSystemState } from "@/lib/core/systemState";
import { generateDailyStrategy } from "@/lib/core/strategyGenerator";
import { handleError, unauthorized } from "@/lib/apiError";

export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        // Build the central system state, then generate strategy from it
        const state = await buildSystemState(userId);
        const strategyResult = await generateDailyStrategy(state);

        // Return the raw text for backward compatibility with the UI
        return Response.json({
            strategy: strategyResult.rawText,
            structured: {
                morning: strategyResult.morning,
                afternoon: strategyResult.afternoon,
                evening: strategyResult.evening,
                directive: strategyResult.directive,
            },
            usedAI: strategyResult.usedAI,
        });
    } catch (error) {
        return handleError(error);
    }
}
