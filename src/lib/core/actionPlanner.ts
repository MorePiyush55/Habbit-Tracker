/**
 * Action Planner — Tactical Directive Generator
 * ================================================
 * Takes system state + hunter profile → generates a prioritized
 * action plan with specific tasks, estimated times, and reasoning.
 *
 * This is the missing "decision intelligence" layer that turns
 * status reports into actionable coaching directives.
 *
 * Architecture:
 *   SystemState + HunterProfile → ActionPlanner → ActionPlan
 *     → Used by Brain v3 handlers to enrich every response
 *
 * Key principle: Every response should END with what to do next.
 */

import type { SystemState } from "@/types";
import connectDB from "@/lib/mongodb";
import HunterProfile from "@/models/HunterProfile";

// ============================================================
// Types
// ============================================================

interface ActionItem {
    task: string;
    category: string;
    estimatedMinutes: number;
    priority: "critical" | "high" | "medium" | "low";
    reason: string;
}

interface ActionPlan {
    immediateActions: ActionItem[];     // Do RIGHT NOW
    secondaryActions: ActionItem[];     // Do after immediate
    estimatedTotalMinutes: number;
    difficulty: "light" | "medium" | "heavy" | "extreme";
    focusArea: string;                  // Single biggest priority
    profileAvailable: boolean;          // Whether hunter profile exists
    coachingQuestion?: string;          // Interactive question for the user
}

interface HunterProfileData {
    missions: string[];
    learningProgress: { name: string; completedUnits: number; totalUnits: number; avgStudyTimeMinutes: number }[];
    weeklyTargets: { name: string; target: number; current: number }[];
    skillRatings: { name: string; rating: number }[];
    dailyAvailableHours: number;
    bestFocusTime: string;
    frequentlySkippedTasks: string[];
    selfDisciplineRating: number;
    selfFocusRating: number;
    sixMonthVision: string[];
    isOnboarded: boolean;
}

// ============================================================
// CORE: Generate action plan from state + profile
// ============================================================

export async function generateActionPlan(
    userId: string,
    state: SystemState
): Promise<ActionPlan> {
    await connectDB();

    // Fetch hunter profile
    const profile = await HunterProfile.findOne({ userId }).lean() as HunterProfileData | null;

    const remainingHabits = state.activeHabits.filter(h => h.progress < 100);
    const completedCount = state.activeHabits.length - remainingHabits.length;
    const totalCount = state.activeHabits.length;

    // ── Build immediate actions from remaining habits ──
    const immediateActions: ActionItem[] = [];
    const secondaryActions: ActionItem[] = [];

    // Sort: weakest habits first, then by category priority
    const sorted = [...remainingHabits].sort((a, b) => {
        // Weak habits get priority
        const aWeak = state.weakHabits.includes(a.name) ? -1 : 0;
        const bWeak = state.weakHabits.includes(b.name) ? -1 : 0;
        if (aWeak !== bWeak) return aWeak - bWeak;
        // Then by progress (least progress first)
        return a.progress - b.progress;
    });

    for (const habit of sorted) {
        const remainingSubtasks = habit.total - habit.completed;
        const estimatedMinutes = estimateTime(habit, profile);
        const priority = determinePriority(habit, state, profile);
        const reason = buildReason(habit, state, profile);

        const item: ActionItem = {
            task: habit.name,
            category: habit.category,
            estimatedMinutes,
            priority,
            reason,
        };

        if (priority === "critical" || priority === "high") {
            immediateActions.push(item);
        } else {
            secondaryActions.push(item);
        }
    }

    // ── Add learning progress actions if profile exists ──
    if (profile?.learningProgress) {
        for (const lp of profile.learningProgress) {
            const progressPct = Math.round((lp.completedUnits / lp.totalUnits) * 100);
            const remaining = lp.totalUnits - lp.completedUnits;

            // Check if this learning item maps to an existing habit
            const alreadyInHabits = state.activeHabits.some(
                h => h.name.toLowerCase().includes(lp.name.toLowerCase().split(" ")[0])
            );

            if (!alreadyInHabits && remaining > 0) {
                secondaryActions.push({
                    task: `Continue ${lp.name} (${progressPct}% — ${remaining} units left)`,
                    category: "learning",
                    estimatedMinutes: lp.avgStudyTimeMinutes || 60,
                    priority: progressPct > 80 ? "high" : "medium",
                    reason: progressPct > 80
                        ? `Near completion — ${remaining} units to finish`
                        : `${progressPct}% done. Consistent study needed.`,
                });
            }
        }
    }

    // ── Weekly target actions ──
    if (profile?.weeklyTargets) {
        for (const wt of profile.weeklyTargets) {
            const remaining = wt.target - wt.current;
            if (remaining > 0) {
                const dailyNeeded = Math.ceil(remaining / daysLeftInWeek());
                secondaryActions.push({
                    task: `${wt.name}: ${dailyNeeded} today (${wt.current}/${wt.target} this week)`,
                    category: "target",
                    estimatedMinutes: dailyNeeded * 10, // rough estimate
                    priority: remaining > wt.target * 0.7 ? "high" : "medium",
                    reason: `${remaining} remaining this week. ${dailyNeeded}/day to hit target.`,
                });
            }
        }
    }

    // ── Calculate totals ──
    const allActions = [...immediateActions, ...secondaryActions];
    const estimatedTotalMinutes = allActions.reduce((sum, a) => sum + a.estimatedMinutes, 0);

    // ── Determine focus area ──
    const focusArea = determineFocusArea(state, profile);

    // ── Determine difficulty ──
    const availableMinutes = (profile?.dailyAvailableHours || 4) * 60;
    const loadRatio = estimatedTotalMinutes / availableMinutes;
    const difficulty: ActionPlan["difficulty"] =
        loadRatio > 1.5 ? "extreme" :
        loadRatio > 1.0 ? "heavy" :
        loadRatio > 0.6 ? "medium" : "light";

    // ── Generate coaching question ──
    const coachingQuestion = generateCoachingQuestion(state, profile);

    return {
        immediateActions: immediateActions.slice(0, 3), // Max 3 immediate
        secondaryActions: secondaryActions.slice(0, 5), // Max 5 secondary
        estimatedTotalMinutes,
        difficulty,
        focusArea,
        profileAvailable: profile?.isOnboarded || false,
        coachingQuestion,
    };
}

// ============================================================
// FORMAT: Convert action plan to display text
// ============================================================

export function formatActionPlan(plan: ActionPlan, state: SystemState): string {
    const lines: string[] = [];
    const h = state.hunter;

    const totalTasks = state.activeHabits.length;
    const completedTasks = state.activeHabits.filter(hab => hab.progress >= 100).length;
    const remainingTasks = totalTasks - completedTasks;

    // ── ANALYSIS section ──
    if (remainingTasks > 0) {
        lines.push(`ANALYSIS\n`);
        lines.push(`Your task completion rate is ${completedTasks}/${totalTasks} today.`);

        if (state.weakHabits.length > 0) {
            lines.push(`Weakest area: ${state.weakHabits[0]}.`);
        }

        if (state.behaviorAnalysis.trend === "declining") {
            lines.push(`Performance trend is DECLINING. Immediate correction required.`);
        } else if (state.behaviorAnalysis.trend === "improving") {
            lines.push(`Performance trend is IMPROVING. Maintain this trajectory.`);
        }

        lines.push("");
    }

    // ── DIRECTIVE section ──
    lines.push(`DIRECTIVE\n`);

    if (plan.immediateActions.length > 0) {
        lines.push(`Immediate objectives:\n`);
        plan.immediateActions.forEach((a, i) => {
            lines.push(`${i + 1}. ${a.task}`);
            if (a.reason) lines.push(`   ${a.reason}`);
        });
        lines.push("");
    }

    if (plan.secondaryActions.length > 0) {
        lines.push(`Secondary objectives:\n`);
        plan.secondaryActions.forEach((a, i) => {
            lines.push(`${i + 1}. ${a.task}`);
        });
        lines.push("");
    }

    if (plan.estimatedTotalMinutes > 0) {
        const hours = Math.floor(plan.estimatedTotalMinutes / 60);
        const mins = plan.estimatedTotalMinutes % 60;
        const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins} minutes`;
        lines.push(`Estimated training time: ${timeStr}.`);
    }

    // ── Coaching question ──
    if (plan.coachingQuestion) {
        lines.push(`\n${plan.coachingQuestion}`);
    }

    if (remainingTasks > 0) {
        lines.push(`\nResume training.`);
    } else {
        lines.push(`\nAll objectives met. Stand by for next cycle.`);
    }

    return lines.join("\n");
}

// ============================================================
// HELPER: Estimate time for a habit
// ============================================================

function estimateTime(
    habit: SystemState["activeHabits"][0],
    profile: HunterProfileData | null
): number {
    const baseMinutes =
        habit.difficulty === "hard" ? 45 :
        habit.difficulty === "medium" ? 30 : 15;

    const remainingRatio = 1 - (habit.progress / 100);
    let estimated = Math.round(baseMinutes * remainingRatio);

    // Check if profile has study time data for matching learning items
    if (profile?.learningProgress) {
        const match = profile.learningProgress.find(
            lp => habit.name.toLowerCase().includes(lp.name.toLowerCase().split(" ")[0])
        );
        if (match && match.avgStudyTimeMinutes > 0) {
            estimated = Math.round(match.avgStudyTimeMinutes * remainingRatio);
        }
    }

    return Math.max(5, estimated);
}

// ============================================================
// HELPER: Determine priority for a habit
// ============================================================

function determinePriority(
    habit: SystemState["activeHabits"][0],
    state: SystemState,
    profile: HunterProfileData | null
): ActionItem["priority"] {
    // Frequently skipped = critical
    if (profile?.frequentlySkippedTasks?.some(
        t => habit.name.toLowerCase().includes(t.toLowerCase())
    )) {
        return "critical";
    }

    // Weak habit = critical
    if (state.weakHabits.includes(habit.name)) {
        return "critical";
    }

    // Zero progress = high
    if (habit.progress === 0) {
        return "high";
    }

    // Partially done = medium
    if (habit.progress < 50) {
        return "medium";
    }

    return "low";
}

// ============================================================
// HELPER: Build reason string for an action
// ============================================================

function buildReason(
    habit: SystemState["activeHabits"][0],
    state: SystemState,
    profile: HunterProfileData | null
): string {
    if (state.weakHabits.includes(habit.name)) {
        return `This is your weakest area today. Focus here first.`;
    }

    if (profile?.frequentlySkippedTasks?.some(
        t => habit.name.toLowerCase().includes(t.toLowerCase())
    )) {
        return `You frequently skip this. Breaking the avoidance pattern is critical.`;
    }

    if (habit.progress === 0) {
        return `Not started. Begin immediately.`;
    }

    if (habit.progress > 50) {
        return `${habit.progress}% done. Quick finish possible.`;
    }

    return `${habit.completed}/${habit.total} subtasks complete.`;
}

// ============================================================
// HELPER: Determine the single biggest focus area
// ============================================================

function determineFocusArea(
    state: SystemState,
    profile: HunterProfileData | null
): string {
    // If there are weak habits, focus there
    if (state.weakHabits.length > 0) {
        return state.weakHabits[0];
    }

    // If profile has missions, focus on the first
    if (profile?.missions && profile.missions.length > 0) {
        return profile.missions[0];
    }

    // If declining trend, focus on consistency
    if (state.behaviorAnalysis.trend === "declining") {
        return "consistency";
    }

    return "task completion";
}

// ============================================================
// HELPER: Generate interactive coaching question
// ============================================================

function generateCoachingQuestion(
    state: SystemState,
    profile: HunterProfileData | null
): string | undefined {
    const completedTasks = state.activeHabits.filter(h => h.progress >= 100).length;
    const totalTasks = state.activeHabits.length;
    const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Low completion — ask what blocked
    if (pct < 30 && totalTasks > 0) {
        return `Question: What is blocking your progress today?\n1. Lack of time\n2. Low focus\n3. Task difficulty\n4. Low motivation`;
    }

    // No profile — prompt onboarding
    if (!profile?.isOnboarded) {
        return `Your Hunter Profile is not configured. Set it up in Settings to unlock intelligent coaching.`;
    }

    // Mid completion — push forward
    if (pct >= 30 && pct < 70) {
        return `You're at ${pct}%. Can you complete ${totalTasks - completedTasks} more tasks in the next ${Math.ceil((totalTasks - completedTasks) * 0.5)} hours?`;
    }

    return undefined;
}

// ============================================================
// HELPER: Days left in current week
// ============================================================

function daysLeftInWeek(): number {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 6=Sat
    return Math.max(1, 7 - dayOfWeek);
}
