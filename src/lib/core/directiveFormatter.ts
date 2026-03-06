/**
 * Directive Formatter — System Personality Applied to Directives
 * ===============================================================
 * Takes a ConsoleDirective and formats it with the System personality.
 * Produces clean, consistent, authoritative text for the console.
 *
 * Every response goes through here to maintain voice consistency.
 */

import type { SystemState } from "@/types";
import type { ConsoleDirective } from "./directiveGenerator";

// ============================================================
// CORE: Format a directive into display text
// ============================================================

export function formatDirective(
    directive: ConsoleDirective,
    state: SystemState
): string {
    switch (directive.type) {
        case "SHOW_REMAINING_TASKS":
            return formatRemainingTasks(directive.data, state);
        case "SHOW_COMPLETED_TASKS":
            return formatCompletedTasks(directive.data, state);
        case "SHOW_STATUS":
            return formatStatus(directive.data);
        case "SHOW_SKILL_REPORT":
            return formatSkillReport(directive.data);
        case "SHOW_BEHAVIOR_ANALYSIS":
            return formatBehaviorAnalysis(directive.data);
        case "SHOW_PREDICTION":
            return formatPrediction(directive.data);
        case "SHOW_WORKLOAD":
            return formatWorkload(directive.data);
        case "SHOW_STRATEGY":
            return directive.data.strategy?.rawText || "No strategy available.";
        case "SHOW_DEBRIEF":
            return directive.data.narrative || "No debrief data.";
        case "SHOW_HELP":
        case "SHOW_MOTIVATION":
        case "FREE_RESPONSE":
            return ""; // These are handled directly by handlers
        default:
            return "";
    }
}

// ============================================================
// FORMATTERS
// ============================================================

function formatRemainingTasks(
    data: Record<string, any>,
    state: SystemState
): string {
    const tasks = data.tasks || [];
    const totalHabits = state.activeHabits.length;

    if (tasks.length === 0) {
        return `Hunter.\n\nAll ${totalHabits} tasks completed today. Adequate performance.\nStandby for next cycle.`;
    }

    const lines = tasks.map((t: any) => {
        const bar = progressBar(t.progress);
        return `• ${t.name} — ${bar} ${t.progress}% (${t.completed}/${t.total})`;
    });

    const completedCount = totalHabits - tasks.length;

    return `Hunter.\n\n${tasks.length} task${tasks.length > 1 ? "s" : ""} remain today. ${completedCount}/${totalHabits} completed.\n\n${lines.join("\n")}\n\nExecute. No excuses.`;
}

function formatCompletedTasks(
    data: Record<string, any>,
    state: SystemState
): string {
    const completed = data.completed || [];
    const inProgress = data.inProgress || [];
    const totalHabits = state.activeHabits.length;

    const parts: string[] = [`Hunter.\n\n${completed.length}/${totalHabits} tasks completed today.`];

    if (completed.length > 0) {
        parts.push(`\nCompleted:\n${completed.map((c: string) => `  ✓ ${c}`).join("\n")}`);
    }

    if (inProgress.length > 0) {
        parts.push(`\nIn Progress:\n${inProgress.map((p: any) => `  ◐ ${p.name} — ${p.progress}%`).join("\n")}`);
    }

    if (completed.length === totalHabits) {
        parts.push("\nAll objectives met. Acceptable.");
    } else {
        parts.push(`\n${totalHabits - completed.length - inProgress.length} tasks untouched. Unacceptable.`);
    }

    return parts.join("");
}

function formatStatus(data: Record<string, any>): string {
    const h = data.hunter;
    const boss = data.bossRaid;

    return `Hunter.\n\n── STATUS REPORT ──\nLevel: ${h.level} | Rank: ${h.hunterRank}\nXP: ${h.xp} | Streak: ${h.streak} days\nDiscipline: ${h.disciplineScore}% | Focus: ${h.focusScore}%\nSkill Growth: ${h.skillGrowthScore}%\n\nToday: ${data.tasksCompleted}/${data.totalTasks} tasks | ${data.todayProgress}% complete\nBoss: ${boss.bossDefeatedThisWeek ? "DEFEATED" : `HP: ${boss.bossHP} — Active`}\n\n${getStatusVerdict(h.disciplineScore, data.todayProgress)}`;
}

function formatSkillReport(data: Record<string, any>): string {
    const skills = data.skills || [];
    const weak = data.weakSkills || [];
    const strong = data.strongSkills || [];
    const declining = data.decliningSkills || [];

    if (skills.length === 0) {
        return "Hunter.\n\nNo skill data recorded. Complete training sessions to build your skill profile.";
    }

    const parts: string[] = ["Hunter.\n\n── SKILL PROFICIENCY REPORT ──"];

    // All skills sorted by score
    const skillLines = skills
        .sort((a: any, b: any) => a.score - b.score)
        .map((s: any) => {
            const bar = progressBar(s.score);
            const icon = s.score < 50 ? "⚠" : s.score >= 70 ? "◆" : "○";
            return `  ${icon} ${s.skill}: ${bar} ${s.score}/100 (${s.trend})`;
        });

    parts.push(skillLines.join("\n"));

    if (weak.length > 0) {
        parts.push(`\nCritical Weaknesses: ${weak.map((s: any) => s.skill).join(", ")}`);
    }
    if (declining.length > 0) {
        parts.push(`Declining: ${declining.map((s: any) => `${s.skill} (↓)`).join(", ")}`);
    }
    if (strong.length > 0) {
        parts.push(`Strengths: ${strong.map((s: any) => s.skill).join(", ")}`);
    }

    return parts.join("\n");
}

function formatBehaviorAnalysis(data: Record<string, any>): string {
    const i = data.insight;
    if (!i) return "Hunter.\n\nInsufficient behavior data.";

    const parts: string[] = [
        "Hunter.\n\n── BEHAVIOR ANALYSIS ──",
        `Completion Rate: ${i.completionRate}%`,
        `Discipline Trend: ${i.disciplineTrend.toUpperCase()}`,
        `Consistency: ${i.consistencyScore}/100`,
        `Streak Health: ${i.currentStreakHealth.toUpperCase()} (risk: ${i.streakRisk}%)`,
    ];

    if (i.weakestHabit) parts.push(`Weakest Habit: ${i.weakestHabit}`);
    if (i.strongestHabit) parts.push(`Strongest Habit: ${i.strongestHabit}`);

    if (i.bestDay) parts.push(`Best Day: ${i.bestDay.date} (${i.bestDay.completionRate}%)`);
    if (i.worstDay) parts.push(`Worst Day: ${i.worstDay.date} (${i.worstDay.completionRate}%)`);

    // Weekday pattern
    const weekdays = Object.entries(i.weekdayPattern || {}).sort((a: any, b: any) => b[1] - a[1]);
    if (weekdays.length > 0) {
        const best = weekdays[0];
        const worst = weekdays[weekdays.length - 1];
        parts.push(`\nBest Weekday: ${best[0]} (${best[1]}%)`);
        parts.push(`Worst Weekday: ${worst[0]} (${worst[1]}%)`);
    }

    return parts.join("\n");
}

function formatPrediction(data: Record<string, any>): string {
    const p = data.projection;
    if (!p) return "Hunter.\n\nInsufficient data for projection.";

    return `Hunter.\n\n── 30-DAY PROJECTION ──\n\nIf current pattern continues:\n\nDiscipline Score: ${p.projectedDiscipline}%\nCompletion Rate: ${p.projectedCompletion}%\nStreak: ${p.projectedStreak} days\nLevel: ${p.projectedLevel}\nXP: ${p.projectedXP}\n\nOutcome: ${p.outcome}\n\n${p.verdict}`;
}

function formatWorkload(data: Record<string, any>): string {
    const a = data.assessment;
    if (!a) return "Hunter.\n\nNo workload data available.";

    const status = a.isOverloaded ? "⚠ OVERLOADED" : "WITHIN LIMITS";

    return `Hunter.\n\n── COGNITIVE LOAD ASSESSMENT ──\n\nStatus: ${status}\nCurrent Load: ${a.currentLoadHours.toFixed(1)} hours\nOptimal Load: ${a.optimalLoadHours.toFixed(1)} hours\nCapacity Used: ${a.capacityPercent}%\n\nActive Tasks: ${a.activeTasks}\nCompletion Rate: ${a.recentCompletionRate}%\nFocus Score: ${a.focusScore}%\n\n${a.recommendation}`;
}

// ============================================================
// HELPERS
// ============================================================

function progressBar(percent: number): string {
    const filled = Math.round(percent / 10);
    const empty = 10 - filled;
    return `[${"█".repeat(filled)}${"░".repeat(empty)}]`;
}

function getStatusVerdict(discipline: number, todayProgress: number): string {
    if (discipline >= 75 && todayProgress >= 80) {
        return "Performance: COMMENDABLE. Maintain this output.";
    }
    if (discipline >= 50 && todayProgress >= 50) {
        return "Performance: ACCEPTABLE. Push harder.";
    }
    if (discipline < 30) {
        return "Performance: CRITICAL. Immediate improvement required.";
    }
    return "Performance: BELOW EXPECTATIONS. Increase output.";
}
