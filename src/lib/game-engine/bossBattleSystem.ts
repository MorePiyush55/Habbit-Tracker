import { BossState } from "@/types";

const BOSS_NAMES = [
    "Shadow Soldier",
    "Red Gate Beast",
    "Ice Elf Warrior",
    "Cerberus",
    "Demon King Baran",
    "Architect",
    "Antares the Dragon",
    "Frost Monarch",
    "Beast Monarch",
    "Shadow Monarch's Shadow",
];

const BOSS_HP = 100;

export function getDailyBoss(date: string): string {
    // Deterministic boss based on date hash
    const hash = date.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return BOSS_NAMES[hash % BOSS_NAMES.length];
}

export function calculateBossState(
    date: string,
    completedEntries: { xpEarned: number; completed: boolean }[]
): BossState {
    const bossName = getDailyBoss(date);
    const damageDealt = completedEntries
        .filter((e) => e.completed)
        .reduce((sum, e) => sum + e.xpEarned, 0);

    const currentHP = Math.max(0, BOSS_HP - damageDealt);

    return {
        totalHP: BOSS_HP,
        currentHP,
        damageDealt,
        isDefeated: currentHP <= 0,
        bossName,
    };
}

export function getDamageForDifficulty(difficulty: "small" | "medium" | "hard"): number {
    switch (difficulty) {
        case "small": return 10;
        case "medium": return 25;
        case "hard": return 50;
    }
}

export { BOSS_HP, BOSS_NAMES };
