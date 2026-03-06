import { getUserId } from "@/lib/auth";
import { getFullMetricsReport, getSystemHealth } from "@/lib/core/observability";

export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const report = await getFullMetricsReport(userId);

        return Response.json({
            success: true,
            ...report,
        });
    } catch (error: any) {
        console.error("[API] Metrics error:", error.message);
        return Response.json({ error: "Failed to get metrics" }, { status: 500 });
    }
}
