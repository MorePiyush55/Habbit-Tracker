/**
 * System Scheduler — Autonomous Mode
 * =====================================
 * Makes the system PROACTIVE instead of reactive.
 * Runs periodic checks via cron/API triggers every 30-60 minutes.
 *
 * Scheduled Events:
 *   - INACTIVITY_CHECK: Detect users who haven't been active
 *   - DISCIPLINE_REVIEW: Analyze discipline trends
 *   - SKILL_DECAY_CHECK: Find skills degrading from disuse
 *   - WEEKLY_INSIGHT_REFRESH: Update memory weekly insights
 *   - STRATEGY_PREGENERATION: Pre-generate tomorrow's strategy
 *
 * Autonomous Console Messages:
 *   The scheduler now writes SYSTEM-initiated messages directly into
 *   the chat history so they appear in the System Console as autonomous
 *   alerts from different agents.
 *
 * Trigger via: /api/cron/system-check or external cron service
 */

import connectDB from "@/lib/mongodb";
import User from "@/models/User";
import BehaviorLog from "@/models/BehaviorLog";
import SkillScore from "@/models/SkillScore";
import SystemMessage from "@/models/SystemMessage";
import { emit, createEvent } from "./eventBus";
import { recallMemory, refreshWeeklyInsights, shouldRefreshWeekly, incrementMetrics } from "./systemMemory";
import { buildSystemState } from "./systemState";
import type { SystemEventType } from "@/types";

// ============================================================
// Types
// ============================================================

export interface SchedulerResult {
    userId: string;
    checksRun: string[];
    eventsEmitted: string[];
    errors: string[];
    duration: number;
}

export interface BatchSchedulerResult {
    totalUsers: number;
    processed: number;
    results: SchedulerResult[];
    totalDuration: number;
}

// ============================================================
// CORE: Run all scheduled checks for a single user
// ============================================================

export async function runScheduledChecks(userId: string): Promise<SchedulerResult> {
    const start = Date.now();
    const checksRun: string[] = [];
    const eventsEmitted: string[] = [];
    const errors: string[] = [];

    try {
        await connectDB();

        // 1. Inactivity Check
        try {
            const result = await checkInactivity(userId);
            checksRun.push("INACTIVITY_CHECK");
            if (result.emitted) eventsEmitted.push("INACTIVITY");
        } catch (e: any) {
            errors.push(`INACTIVITY_CHECK: ${e.message}`);
        }

        // 2. Discipline Review
        try {
            const result = await checkDiscipline(userId);
            checksRun.push("DISCIPLINE_REVIEW");
            if (result.emitted) eventsEmitted.push(result.eventType!);
        } catch (e: any) {
            errors.push(`DISCIPLINE_REVIEW: ${e.message}`);
        }

        // 3. Skill Decay Check
        try {
            const result = await checkSkillDecay(userId);
            checksRun.push("SKILL_DECAY_CHECK");
            for (const ev of result.emitted) eventsEmitted.push(ev);
        } catch (e: any) {
            errors.push(`SKILL_DECAY_CHECK: ${e.message}`);
        }

        // 4. Weekly Insight Refresh
        try {
            const memory = await recallMemory(userId);
            if (shouldRefreshWeekly(memory)) {
                await refreshWeeklyInsights(userId);
                checksRun.push("WEEKLY_INSIGHT_REFRESH");
            }
        } catch (e: any) {
            errors.push(`WEEKLY_INSIGHT_REFRESH: ${e.message}`);
        }

        // 5. Streak Risk Check
        try {
            const result = await checkStreakRisk(userId);
            checksRun.push("STREAK_RISK_CHECK");
            if (result.emitted) eventsEmitted.push("STREAK_MILESTONE");
        } catch (e: any) {
            errors.push(`STREAK_RISK_CHECK: ${e.message}`);
        }

        // Track metrics
        await incrementMetrics(userId, "totalEventsProcessed", eventsEmitted.length);

    } catch (e: any) {
        errors.push(`SCHEDULER_GLOBAL: ${e.message}`);
    }

    const result: SchedulerResult = {
        userId,
        checksRun,
        eventsEmitted,
        errors,
        duration: Date.now() - start,
    };

    // Generate autonomous console alerts from emitted events
    if (eventsEmitted.length > 0) {
        try {
            await generateAutonomousAlerts(userId, result);
        } catch {
            // Non-fatal: alerts are bonus, not critical
        }
    }

    return result;
}

// ============================================================
// BATCH: Run scheduled checks for ALL active users
// ============================================================

export async function runBatchScheduledChecks(): Promise<BatchSchedulerResult> {
    const start = Date.now();
    await connectDB();

    // Find users active in the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activeUsers = await User.find({
        lastLogin: { $gte: sevenDaysAgo },
    })
        .select("_id")
        .lean() as any[];

    const results: SchedulerResult[] = [];

    // Process sequentially to avoid overwhelming DB/AI
    for (const user of activeUsers) {
        try {
            const result = await runScheduledChecks(user._id.toString());
            results.push(result);
        } catch (e: any) {
            results.push({
                userId: user._id.toString(),
                checksRun: [],
                eventsEmitted: [],
                errors: [`FATAL: ${e.message}`],
                duration: 0,
            });
        }
    }

    return {
        totalUsers: activeUsers.length,
        processed: results.length,
        results,
        totalDuration: Date.now() - start,
    };
}

// ============================================================
// CHECK: Inactivity detection
// ============================================================

async function checkInactivity(
    userId: string
): Promise<{ emitted: boolean }> {
    const latestLog = await BehaviorLog.findOne({ userId })
        .sort({ date: -1 })
        .lean() as any;

    if (!latestLog) {
        // No behavior logs at all — emit inactivity
        await emit(createEvent("INACTIVITY", userId, { daysMissed: 999 }));
        return { emitted: true };
    }

    const lastDate = new Date(latestLog.date);
    const daysSince = Math.floor(
        (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSince >= 2) {
        await emit(createEvent("INACTIVITY", userId, { daysMissed: daysSince }));
        return { emitted: true };
    }

    return { emitted: false };
}

// ============================================================
// CHECK: Discipline trend review
// ============================================================

async function checkDiscipline(
    userId: string
): Promise<{ emitted: boolean; eventType?: SystemEventType }> {
    const recentLogs = await BehaviorLog.find({ userId })
        .sort({ date: -1 })
        .limit(7)
        .lean() as any[];

    if (recentLogs.length < 3) return { emitted: false };

    const completionRates = recentLogs.map((l) => l.completionRate || 0);
    const avg = completionRates.reduce((a, b) => a + b, 0) / completionRates.length;

    // Check for critical decline
    if (avg < 30) {
        await emit(
            createEvent("WEAK_PROGRESS", userId, {
                completionRate: Math.round(avg),
                reason: "7-day average critically low",
            })
        );
        return { emitted: true, eventType: "WEAK_PROGRESS" };
    }

    // Check for improvement
    const halfLen = Math.floor(completionRates.length / 2) || 1;
    const recentAvg = completionRates.slice(0, halfLen).reduce((a, b) => a + b, 0) / halfLen;
    const olderAvg = completionRates.slice(halfLen).reduce((a, b) => a + b, 0) / (halfLen || 1);

    if (recentAvg > olderAvg + 15) {
        await emit(
            createEvent("DISCIPLINE_IMPROVEMENT", userId, {
                score: Math.round(recentAvg),
                improvement: Math.round(recentAvg - olderAvg),
            })
        );
        return { emitted: true, eventType: "DISCIPLINE_IMPROVEMENT" };
    }

    return { emitted: false };
}

// ============================================================
// CHECK: Skill decay (skills not tested in 14+ days)
// ============================================================

async function checkSkillDecay(
    userId: string
): Promise<{ emitted: string[] }> {
    const emitted: string[] = [];

    const skills = await SkillScore.find({ userId }).lean() as any[];

    for (const skill of skills) {
        if (!skill.lastTested) continue;

        const daysSince = Math.floor(
            (Date.now() - new Date(skill.lastTested).getTime()) / (1000 * 60 * 60 * 24)
        );

        // Decay after 14 days of no testing
        if (daysSince >= 14 && skill.score > 20) {
            // Reduce score by 5 points (decay)
            const newScore = Math.max(0, skill.score - 5);
            await SkillScore.findByIdAndUpdate(skill._id, {
                $set: { score: newScore, trend: "declining" },
            });

            await emit(
                createEvent("SKILL_DEGRADATION", userId, {
                    skill: skill.skill,
                    currentScore: newScore,
                    originalScore: skill.score,
                    daysSinceTest: daysSince,
                })
            );
            emitted.push(`SKILL_DEGRADATION:${skill.skill}`);
        }
    }

    return { emitted };
}

// ============================================================
// CHECK: Streak at risk
// ============================================================

async function checkStreakRisk(
    userId: string
): Promise<{ emitted: boolean }> {
    const user = await User.findById(userId).lean() as any;
    if (!user) return { emitted: false };

    const streak = user.currentStreak || 0;

    // If streak is significant (5+) and recent completion is low, warn
    if (streak >= 5) {
        const todayLog = await BehaviorLog.findOne({
            userId,
            date: new Date().toISOString().split("T")[0],
        }).lean() as any;

        // If no activity today and it's past noon, streak is at risk
        const hour = new Date().getHours();
        if (!todayLog && hour >= 12) {
            await emit(
                createEvent("STREAK_MILESTONE", userId, {
                    streakDays: streak,
                    atRisk: true,
                    reason: `${streak}-day streak at risk — no activity today after noon`,
                })
            );
            return { emitted: true };
        }
    }

    return { emitted: false };
}
// ============================================================
// AUTONOMOUS CONSOLE MESSAGES
// ============================================================
// These functions write System-initiated messages into the chat
// history so they appear as autonomous alerts in the Console.

type AutoAgent = "SYSTEM" | "ANALYST" | "STRATEGIST" | "TUTOR" | "SHADOW_COACH";

interface AutonomousAlert {
    agent: AutoAgent;
    text: string;
}

/**
 * Generate autonomous console alerts from scheduler results.
 * Called AFTER runScheduledChecks() to translate events into visible messages.
 */
export async function generateAutonomousAlerts(
    userId: string,
    result: SchedulerResult
): Promise<AutonomousAlert[]> {
    const alerts: AutonomousAlert[] = [];

    for (const event of result.eventsEmitted) {
        const alert = translateEventToAlert(event, result);
        if (alert) alerts.push(alert);
    }

    // Persist to chat history
    for (const alert of alerts) {
        try {
            await SystemMessage.create({
                userId,
                role: "system",
                content: `[${alert.agent}] ${alert.text}`,
                metadata: { autonomous: true, agent: alert.agent },
            });
        } catch {
            // Non-fatal
        }
    }

    return alerts;
}

function translateEventToAlert(
    eventType: string,
    result: SchedulerResult
): AutonomousAlert | null {
    switch (eventType) {
        case "INACTIVITY":
            return {
                agent: "SYSTEM",
                text: "⚠ SYSTEM ALERT\n\nHunter.\n\nYou have been inactive. Your training stalls.\n\nResume your quests immediately.",
            };

        case "WEAK_PROGRESS":
            return {
                agent: "ANALYST",
                text: "📊 BEHAVIOR ANALYSIS\n\nCompletion rate has dropped critically this week.\n\nRecommendation: reduce task difficulty and focus on core habits only.\n\nThis decline, if unchecked, will compound.",
            };

        case "DISCIPLINE_IMPROVEMENT":
            return {
                agent: "SYSTEM",
                text: "✦ DISCIPLINE UPGRADE DETECTED\n\nHunter.\n\nYour performance trend is improving. The System acknowledges your effort.\n\nMaintain this trajectory.",
            };

        case "STREAK_MILESTONE":
            return {
                agent: "SHADOW_COACH",
                text: "⚠ STREAK AT RISK\n\nYour streak is in danger.\n\nComplete at least one task before midnight to preserve it.\n\nDon't waste what you've built.",
            };

        default:
            // Handle SKILL_DEGRADATION:skillName
            if (eventType.startsWith("SKILL_DEGRADATION:")) {
                const skill = eventType.split(":")[1];
                return {
                    agent: "TUTOR",
                    text: `📉 SKILL DECAY DETECTED\n\nYour ${skill} skill is degrading from disuse.\n\nRecommendation: Complete a practice session or test in this area within 48 hours.`,
                };
            }
            return null;
    }
}

/**
 * Get autonomous alerts that haven't been seen yet.
 * Used by the console to poll for new system-initiated messages.
 */
export async function getUnseenAlerts(
    userId: string,
    since: Date
): Promise<AutonomousAlert[]> {
    await connectDB();

    const messages = await SystemMessage.find({
        userId,
        role: "system",
        "metadata.autonomous": true,
        timestamp: { $gt: since },
    })
        .sort({ timestamp: 1 })
        .limit(10)
        .lean() as any[];

    return messages.map((m) => ({
        agent: (m.metadata?.agent || "SYSTEM") as AutoAgent,
        text: m.content.replace(/^\[[A-Z_]+\]\s*/, ""), // Strip agent prefix
    }));
}