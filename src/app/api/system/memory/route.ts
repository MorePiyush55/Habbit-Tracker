import { getUserId } from "@/lib/auth";
import { recallMemory, refreshWeeklyInsights, shouldRefreshWeekly } from "@/lib/core/systemMemory";

export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Auto-refresh if stale
        const memory = await recallMemory(userId);
        if (shouldRefreshWeekly(memory)) {
            await refreshWeeklyInsights(userId);
            const refreshed = await recallMemory(userId);
            return Response.json({ success: true, memory: refreshed, refreshed: true });
        }

        return Response.json({ success: true, memory, refreshed: false });
    } catch (error: any) {
        console.error("[API] Memory error:", error.message);
        return Response.json({ error: "Failed to get memory" }, { status: 500 });
    }
}
