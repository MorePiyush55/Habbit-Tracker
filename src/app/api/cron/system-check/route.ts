import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import DailyProgress from "@/models/DailyProgress";
import SystemEvent from "@/models/SystemEvent";
import SystemDecision from "@/models/SystemDecision";
import SkillScore from "@/models/SkillScore";

// Vercel Cron: runs every hour
// In vercel.json: { "crons": [{ "path": "/api/cron/system-check", "schedule": "0 * * * *" }] }

export async function GET(req: Request) {
    try {
        // Verify cron secret (Vercel sends this automatically)
        const authHeader = req.headers.get("authorization");
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === "production") {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        await connectDB();

        const today = new Date().toISOString().split("T")[0];
        const now = new Date();
        const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);

        // Get all active users
        const users = await User.find({}).lean();
        let eventsTriggered = 0;

        for (const user of users) {
            const userId = user._id.toString();

            // 1. INACTIVITY_WARNING — No progress entries today and it's past 2PM
            if (now.getHours() >= 14) {
                const todayProgress = await DailyProgress.findOne({ userId, date: today }).lean();
                if (!todayProgress || (todayProgress as any).completionRate === 0) {
                    const alreadyWarned = await SystemEvent.findOne({
                        userId, eventType: "INACTIVITY_WARNING", date: today
                    });
                    if (!alreadyWarned) {
                        await SystemEvent.create({
                            userId,
                            eventType: "INACTIVITY_WARNING",
                            message: "[ALERT] Hunter. You have been inactive today. No quests completed. Resume training immediately. The System does not tolerate idle Hunters.",
                            date: today
                        });
                        await SystemDecision.create({
                            userId,
                            decisionType: "INACTIVITY_CHECK",
                            reason: "No progress detected today past 2PM",
                            context: { completionRate: 0, currentHour: now.getHours() },
                            result: { eventFired: "INACTIVITY_WARNING" },
                            date: today
                        });
                        eventsTriggered++;
                    }
                }
            }

            // 2. SKILL_DEGRADATION — Skills not tested in 7+ days
            const staleSkills = await SkillScore.find({
                userId,
                lastTested: { $lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
            }).lean();

            for (const skill of staleSkills) {
                const alreadyWarned = await SystemEvent.findOne({
                    userId, eventType: "SKILL_DEGRADATION", date: today,
                    context: { $regex: skill.skill }
                });
                if (!alreadyWarned) {
                    await SystemEvent.create({
                        userId,
                        eventType: "SKILL_DEGRADATION",
                        message: `[WARNING] Hunter. Your ${skill.skill} knowledge has not been tested in over 7 days. Skill degradation detected. Current proficiency: ${skill.score}%. Resume training in this area immediately.`,
                        context: skill.skill,
                        date: today
                    });
                    eventsTriggered++;
                }
            }

            // 3. DISCIPLINE_IMPROVEMENT — If discipline score improved by 10+ points this week
            if ((user.disciplineScore || 50) >= 60) {
                const lastWeekDecision = await SystemDecision.findOne({
                    userId, decisionType: "BEHAVIOR_ANALYSIS",
                    createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }
                });
                if (!lastWeekDecision) {
                    const alreadyAcknowledged = await SystemEvent.findOne({
                        userId, eventType: "DISCIPLINE_IMPROVEMENT", date: today
                    });
                    if (!alreadyAcknowledged && (user.disciplineScore || 50) >= 70) {
                        await SystemEvent.create({
                            userId,
                            eventType: "DISCIPLINE_IMPROVEMENT",
                            message: `[COMMENDATION] Hunter. Your discipline score has reached ${user.disciplineScore}%. This is acceptable progress. Do not become complacent. Maintain this standard.`,
                            date: today
                        });
                        await SystemDecision.create({
                            userId,
                            decisionType: "BEHAVIOR_ANALYSIS",
                            reason: `Discipline score at ${user.disciplineScore}%`,
                            context: { disciplineScore: user.disciplineScore },
                            result: { eventFired: "DISCIPLINE_IMPROVEMENT" },
                            date: today
                        });
                        eventsTriggered++;
                    }
                }
            }
        }

        console.log(`[Cron] System check complete. Users: ${users.length}, Events: ${eventsTriggered}`);

        return Response.json({
            success: true,
            usersChecked: users.length,
            eventsTriggered,
            timestamp: now.toISOString()
        });
    } catch (error: any) {
        console.error("[Cron] System check failed:", error.message);
        return Response.json({ error: "Cron job failed" }, { status: 500 });
    }
}
