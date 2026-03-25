export const SYSTEM_RULES = {
    DAILY_MIN_TASKS: 3,
    LATE_WINDOW_HOURS: 8,
    RECOVERY_COOLDOWN_DAYS: 3,
    DAILY_XP_SOFT_CAP: 200,
    DAILY_XP_SOFT_CAP_MULTIPLIER: 0.5,
    COMBO_WINDOW_MINUTES: 120,
    COMBO_REWARDS: {
        THREE_STREAK: 20,
        FIVE_STREAK: 50,
        PERFECT_RUN: 100,
    },
} as const;

export function getComboBonus(newCombo: number, totalQuestCount: number): { xp: number; text: string } {
    if (newCombo === 3) {
        return { xp: SYSTEM_RULES.COMBO_REWARDS.THREE_STREAK, text: "3x COMBO!" };
    }

    if (newCombo === 5) {
        return { xp: SYSTEM_RULES.COMBO_REWARDS.FIVE_STREAK, text: "5x COMBO!" };
    }

    if (newCombo === totalQuestCount && totalQuestCount > 0) {
        return { xp: SYSTEM_RULES.COMBO_REWARDS.PERFECT_RUN, text: "PERFECT COMBO!" };
    }

    return { xp: 0, text: "" };
}