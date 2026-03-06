/**
 * Context Builder — Structured AI Prompt Context
 * =================================================
 * Instead of passing raw state directly to AI, this module builds
 * a clean, consistent, and optimized context string.
 *
 * Every AI call uses the same context format, making prompts:
 *   - Consistent across all features
 *   - Easy to improve in one place
 *   - Token-efficient (only relevant data)
 *   - Enriched with memory (not just live state)
 */

import type { SystemState } from "@/types";
import type { MemorySnapshot } from "./systemMemory";
import connectDB from "@/lib/mongodb";
import HunterProfile from "@/models/HunterProfile";
import { buildGraphSnapshot, formatGraphForContext } from "./knowledgeGraph";
import { getSkillMasteryReport, formatSkillMasteryCompact, formatSkillMasteryContext } from "./skillMasteryEngine";

// ============================================================
// Types
// ============================================================

export interface AIContext {
    compact: string;     // Short context (~500 tokens) for simple AI calls
    full: string;        // Full context (~1500 tokens) for complex reasoning
    structured: {        // Programmatic access to context pieces
        hunterProfile: string;
        hunterMissions: string;
        currentHabits: string;
        behaviorSummary: string;
        skillOverview: string;
        knowledgeGraph: string;
        skillMastery: string;
        recentEvents: string;
        memoryInsights: string;
        activeInterventions: string;
    };
}

// ============================================================
// BUILD: Create AI context from state + memory
// ============================================================

export async function buildAIContext(
    state: SystemState,
    memory?: MemorySnapshot | null
): Promise<AIContext> {
    const hunterProfile = buildHunterProfileSection(state);
    const currentHabits = buildHabitsContext(state);
    const behaviorSummary = buildBehaviorSummary(state);
    const skillOverview = buildSkillOverview(state);
    const recentEvents = buildRecentEvents(state);
    const memoryInsights = memory ? buildMemoryInsights(memory) : "No persistent memory available.";
    const activeInterventions = memory ? buildInterventionContext(memory) : "No intervention history.";

    // Fetch hunter profile for deep context
    let hunterMissions = "";
    try {
        await connectDB();
        const profile = await HunterProfile.findOne({ userId: state.hunter.userId }).lean() as Record<string, any> | null;
        if (profile?.isOnboarded) {
            hunterMissions = buildHunterMissionsContext(profile);
        }
    } catch { /* non-fatal */ }

    // Fetch knowledge graph + skill mastery for AI context
    let knowledgeGraph = "";
    let skillMastery = "";
    let skillMasteryCompact = "";
    try {
        const [graphSnapshot, masteryReport] = await Promise.all([
            buildGraphSnapshot(state.hunter.userId),
            getSkillMasteryReport(state.hunter.userId),
        ]);
        if (graphSnapshot.totalNodes > 0) {
            knowledgeGraph = formatGraphForContext(graphSnapshot);
        }
        if (masteryReport.totalSkills > 0) {
            skillMastery = formatSkillMasteryContext(masteryReport);
            skillMasteryCompact = formatSkillMasteryCompact(masteryReport);
        }
    } catch { /* non-fatal */ }

    // Compact context — for simple AI calls (chat, notifications)
    const compact = `HUNTER: ${state.hunter.name} | Lv.${state.hunter.level} | ${state.hunter.hunterRank}
Streak: ${state.hunter.streak} days | Discipline: ${state.hunter.disciplineScore}% | XP: ${state.hunter.xp}
Today: ${state.activeHabits.length} habits | ${state.weakHabits.length} weak | ${state.strongHabits.length} strong
Trend: ${state.behaviorAnalysis.trend} | Avg Completion: ${state.behaviorAnalysis.avgCompletion}%
${state.weakHabits.length > 0 ? `Weak: ${state.weakHabits.join(", ")}` : "No weak habits."}
${hunterMissions ? `Missions: ${hunterMissions.substring(0, 200)}` : ""}
${skillMasteryCompact ? skillMasteryCompact : ""}
${memory?.weeklyInsights.generatedAt ? `Memory: ${memory.weeklyInsights.disciplineTrend} trend | Consistency: ${memory.weeklyInsights.consistencyScore}/100` : ""}`.trim();

    // Full context — for strategy, analysis, complex decisions
    const full = `=== SYSTEM STATE ===

${hunterProfile}
${hunterMissions ? `\n${hunterMissions}` : ""}

${currentHabits}

${behaviorSummary}

${skillOverview}

${knowledgeGraph ? `${knowledgeGraph}\n\n` : ""}${skillMastery ? `${skillMastery}\n\n` : ""}${recentEvents}

${memoryInsights}

${activeInterventions}`;

    return {
        compact,
        full,
        structured: {
            hunterProfile,
            hunterMissions,
            currentHabits,
            behaviorSummary,
            skillOverview,
            knowledgeGraph,
            skillMastery,
            recentEvents,
            memoryInsights,
            activeInterventions,
        },
    };
}

// ============================================================
// SECTION BUILDERS
// ============================================================

function buildHunterProfileSection(state: SystemState): string {
    const h = state.hunter;
    return `[HUNTER PROFILE]
Name: ${h.name}
Level: ${h.level} | Rank: ${h.hunterRank}
XP: ${h.xp} | Streak: ${h.streak} days (longest: ${h.longestStreak})
Discipline: ${h.disciplineScore}% | Focus: ${h.focusScore}% | Skill Growth: ${h.skillGrowthScore}%
Boss: ${state.bossRaid.bossDefeatedThisWeek ? "DEFEATED this week" : `HP: ${state.bossRaid.bossHP}`}`;
}

function buildHunterMissionsContext(profile: Record<string, any>): string {
    const parts: string[] = ["[HUNTER MISSIONS & GOALS]"];

    if (profile.missions?.length > 0) {
        parts.push(`Top Missions: ${profile.missions.join(" | ")}`);
    }

    if (profile.learningProgress?.length > 0) {
        const lpLines = profile.learningProgress.map((lp: any) => {
            const pct = Math.round((lp.completedUnits / lp.totalUnits) * 100);
            return `  ${lp.name}: ${lp.completedUnits}/${lp.totalUnits} (${pct}%)`;
        });
        parts.push(`Learning Progress:\n${lpLines.join("\n")}`);
    }

    if (profile.weeklyTargets?.length > 0) {
        const wtLines = profile.weeklyTargets.map((wt: any) =>
            `  ${wt.name}: ${wt.current}/${wt.target} this week`
        );
        parts.push(`Weekly Targets:\n${wtLines.join("\n")}`);
    }

    if (profile.skillRatings?.length > 0) {
        const srLines = profile.skillRatings.map((sr: any) =>
            `  ${sr.name}: ${sr.rating}/100`
        );
        parts.push(`Self-Rated Skills:\n${srLines.join("\n")}`);
    }

    parts.push(`Available Time: ${profile.dailyAvailableHours || 4}h/day | Best Focus: ${profile.bestFocusTime || "morning"}`);

    if (profile.frequentlySkippedTasks?.length > 0) {
        parts.push(`Frequently Skipped: ${profile.frequentlySkippedTasks.join(", ")}`);
    }

    if (profile.sixMonthVision?.length > 0) {
        parts.push(`6-Month Vision: ${profile.sixMonthVision.join(" | ")}`);
    }

    parts.push(`Self-Eval: Discipline ${profile.selfDisciplineRating || 50}/100 | Focus ${profile.selfFocusRating || 50}/100`);

    return parts.join("\n");
}

function buildHabitsContext(state: SystemState): string {
    if (state.activeHabits.length === 0) {
        return "[ACTIVE HABITS]\nNo active habits.";
    }

    const habitLines = state.activeHabits.map((h) => {
        const status = h.progress >= 100 ? "✓" : h.progress >= 50 ? "◐" : "✗";
        return `  ${status} ${h.name} (${h.category}) — ${h.progress}% | ${h.difficulty} L${h.difficultyLevel} | Streak: ${h.consecutiveCompletions}`;
    });

    return `[ACTIVE HABITS] (${state.activeHabits.length} total)
${habitLines.join("\n")}
Weak: ${state.weakHabits.join(", ") || "None"}
Strong: ${state.strongHabits.join(", ") || "None"}`;
}

function buildBehaviorSummary(state: SystemState): string {
    const ba = state.behaviorAnalysis;
    const recentDays = state.recentBehavior.slice(0, 5);

    let recentTrend = "";
    if (recentDays.length > 0) {
        recentTrend = recentDays
            .map((d) => `  ${d.date}: ${d.completionRate}% (${d.tasksCompleted} done, ${d.tasksFailed} failed, +${d.xpEarned} XP)`)
            .join("\n");
    }

    return `[BEHAVIOR ANALYSIS] (${ba.activeDays}-day window)
Avg Completion: ${ba.avgCompletion}%
Trend: ${ba.trend.toUpperCase()}
Trajectory: ${ba.disciplineTrajectory}
Top Weak: ${ba.topWeakHabits.slice(0, 3).join(", ") || "None"}
Top Strong: ${ba.topStrongHabits.slice(0, 3).join(", ") || "None"}
${recentTrend ? `Recent:\n${recentTrend}` : ""}`;
}

function buildSkillOverview(state: SystemState): string {
    if (state.skillScores.length === 0) {
        return "[SKILL SCORES]\nNo skill data yet.";
    }

    const skillLines = state.skillScores
        .sort((a, b) => a.score - b.score)
        .map((s) => `  ${s.skill}: ${s.score}/100 (${s.trend}) — last tested: ${s.lastTested}`);

    return `[SKILL SCORES] (${state.skillScores.length} tracked)
${skillLines.join("\n")}`;
}

function buildRecentEvents(state: SystemState): string {
    if (state.recentDecisions.length === 0) {
        return "[RECENT DECISIONS]\nNo recent system decisions.";
    }

    const lines = state.recentDecisions
        .slice(0, 5)
        .map((d) => `  ${d.date}: ${d.action} — ${d.reason}`);

    return `[RECENT SYSTEM DECISIONS]
${lines.join("\n")}`;
}

function buildMemoryInsights(memory: MemorySnapshot): string {
    const wi = memory.weeklyInsights;

    if (!wi.generatedAt) {
        return "[SYSTEM MEMORY]\nNo weekly insights generated yet.";
    }

    const recentDecisions = memory.recentDecisionsSummary.slice(-5);
    const decisionLines = recentDecisions.length > 0
        ? recentDecisions.map((d) => `  ${d.date}: ${d.decision} (${Math.round(d.confidence * 100)}%) — ${d.reason}`).join("\n")
        : "  None";

    return `[SYSTEM MEMORY] (generated: ${wi.generatedAt})
Weakest Habit: ${wi.weakestHabit || "Unknown"}
Strongest Habit: ${wi.strongestHabit || "Unknown"}
Discipline Trend: ${wi.disciplineTrend}
Avg Completion: ${wi.avgCompletion}%
Consistency: ${wi.consistencyScore}/100
Streak Health: ${wi.streakHealth}
Interventions: ${wi.topInterventions.slice(0, 3).join(" | ") || "None"}
Recent AI Decisions:
${decisionLines}
Metrics: ${memory.metrics.totalEventsProcessed} events | ${memory.metrics.totalAICalls} AI calls | ${memory.metrics.sessionCount} sessions`;
}

function buildInterventionContext(memory: MemorySnapshot): string {
    const li = memory.lastIntervention;
    if (!li.type) {
        return "[LAST INTERVENTION]\nNo interventions issued.";
    }

    return `[LAST INTERVENTION]
Type: ${li.type}
Reason: ${li.reason}
Date: ${li.date}
Escalation Level: ${li.escalationLevel}/4`;
}
