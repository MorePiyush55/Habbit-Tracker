/**
 * System State API — Returns the current centralized system state
 * Used by the UI to display the full OS dashboard
 */
import { getUserId } from "@/lib/auth";
import { buildSystemState } from "@/lib/core/systemState";
import { handleError, unauthorized } from "@/lib/apiError";

export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        const state = await buildSystemState(userId);

        return Response.json({ state });
    } catch (error) {
        return handleError(error);
    }
}
