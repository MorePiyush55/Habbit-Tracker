import { runBatchScheduledChecks } from "@/lib/core/systemScheduler";

// Vercel Cron: runs every hour
// In vercel.json: { "crons": [{ "path": "/api/cron/system-check", "schedule": "0 * * * *" }] }

export async function GET(req: Request) {
    try {
        // Verify cron secret (Vercel sends this automatically)
        const authHeader = req.headers.get("authorization");
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === "production") {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        console.log("[Cron] Starting autonomous system check...");

        // Run the full scheduler across all active users
        const result = await runBatchScheduledChecks();

        const totalEvents = result.results.reduce((sum, r) => sum + r.eventsEmitted.length, 0);
        const totalErrors = result.results.reduce((sum, r) => sum + r.errors.length, 0);

        console.log(`[Cron] System check complete. Users: ${result.totalUsers}, Events: ${totalEvents}, Errors: ${totalErrors}, Duration: ${result.totalDuration}ms`);

        return Response.json({
            success: true,
            usersChecked: result.totalUsers,
            processed: result.processed,
            totalEvents,
            totalErrors,
            duration: result.totalDuration,
            details: result.results.map((r) => ({
                userId: r.userId.substring(0, 8) + "...",
                checks: r.checksRun.length,
                events: r.eventsEmitted,
                errors: r.errors.length,
                duration: r.duration,
            })),
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error("[Cron] System check failed:", error.message);
        return Response.json({ error: "Cron job failed", detail: error.message }, { status: 500 });
    }
}
