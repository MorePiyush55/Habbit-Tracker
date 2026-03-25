import type { Quest } from "@/components/game/QuestPanel";

const PRIORITY_WEIGHT: Record<string, number> = {
    S: 70,
    A: 55,
    B: 40,
    C: 30,
    D: 20,
    E: 10,
};

export function scoreTask(quest: Quest): number {
    const isIncomplete = !quest.isFullyCompleted;
    const isBacklog = Boolean(quest.isBacklog || quest.completionType === "backlog");
    const priorityWeight = PRIORITY_WEIGHT[quest.rank || "E"] ?? PRIORITY_WEIGHT.E;

    return (
        (isIncomplete ? 100 : 0) +
        (isBacklog ? 80 : 0) +
        ((quest.xpReward || 0) * 0.5) +
        priorityWeight
    );
}

export function getTop3Tasks(quests: Quest[]): Quest[] {
    if (!quests || quests.length === 0) return [];

    return [...quests]
        .map((q) => ({ quest: q, score: scoreTask(q) }))
        .sort((a, b) => b.score - a.score)
        .map((item) => item.quest)
        .slice(0, 3);
}

export function getEmotionalFeedback(completedCount: number, totalCount: number, hasStreak: boolean): {
    state: "success" | "at-risk" | "failure";
    message: string;
    emoji: string;
} {
    const completionRate = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    if (completedCount >= 3 || completionRate >= 80) {
        return {
            state: "success",
            message: "Mission complete. Maintain this standard.",
            emoji: "🔥",
        };
    }

    if (completedCount >= 1 || completionRate >= 40) {
        return {
            state: "at-risk",
            message: "Recover now: Complete 1 task immediately.",
            emoji: "⚠️",
        };
    }

    return {
        state: "failure",
        message: "Reset. Execute tomorrow without hesitation.",
        emoji: "💪",
    };
}

export function shouldShowFeedback(lastFeedbackAt: number | null, majorEvent: boolean, cooldownHours = 3): boolean {
    if (majorEvent) return true;
    if (!lastFeedbackAt) return true;

    const elapsedMs = Date.now() - lastFeedbackAt;
    return elapsedMs >= cooldownHours * 60 * 60 * 1000;
}
