/**
 * RPG Progression Engine
 * Pure math and logic module for XP scaling, ranks, and stat rewards.
 * 
 * Blueprint Rules:
 * - Level Curve: XPn = 100 + 25 × (n−1)²
 * - Ranks: F(1-4), E(5-9), D(10-14), C(15-19), B(20-24), A(25-29), S(30+)
 * - Base XP: E(10), D(20), C(35), B(55), A(80), S(120)
 * - Stat XP: 100 Stat XP = 1 Stat Point
 */

export type HunterRank = 'F' | 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
export type QuestDifficulty = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
export type StatType = 'STR' | 'VIT' | 'INT' | 'AGI' | 'PER' | 'CHA';

/**
 * Calculates the exact XP required to reach a specific level.
 * Formula: 100 + 25 × (n−1)²
 */
export function calculateRequiredXpForLevel(level: number): number {
    if (level <= 1) return 100;
    return 100 + 25 * Math.pow(level - 1, 2);
}

/**
 * Maps an integer Level to the corresponding Hunter Rank string.
 */
export function getHunterRankTitle(level: number): string {
    if (level < 5) return "Unawakened (F-Rank)";
    if (level < 10) return "Newly Awakened (E-Rank)";
    if (level < 15) return "Local Hunter (D-Rank)";
    if (level < 20) return "Professional Hunter (C-Rank)";
    if (level < 25) return "Elite Hunter (B-Rank)";
    if (level < 30) return "National-level Hunter (A-Rank)";
    return "World-class Hunter (S-Rank)";
}

export function getHunterRankLetter(level: number): HunterRank {
    if (level < 5) return 'F';
    if (level < 10) return 'E';
    if (level < 15) return 'D';
    if (level < 20) return 'C';
    if (level < 25) return 'B';
    if (level < 30) return 'A';
    return 'S';
}

/**
 * Returns the base XP and Gold reward for a quest based on its difficulty.
 */
export function getQuestBaseRewards(difficulty: QuestDifficulty): { baseXP: number, baseGold: number } {
    switch (difficulty) {
        case 'E': return { baseXP: 10, baseGold: 5 };
        case 'D': return { baseXP: 20, baseGold: 10 };
        case 'C': return { baseXP: 35, baseGold: 20 };
        case 'B': return { baseXP: 55, baseGold: 35 };
        case 'A': return { baseXP: 80, baseGold: 50 };
        case 'S': return { baseXP: 120, baseGold: 100 };
        default: return { baseXP: 10, baseGold: 5 };
    }
}

/**
 * Processes a quest completion, calculating multipliers and XP totals.
 */
export interface QuestResult {
    totalXP: number;
    totalGold: number;
    statXPGained: number;
}

export function calculateQuestCompletion(
    difficulty: QuestDifficulty,
    currentStreak: number,
    isWeakestStat: boolean
): QuestResult {
    const { baseXP, baseGold } = getQuestBaseRewards(difficulty);
    
    let xpMultiplier = 1.0;
    
    // +25% XP for maintaining a 7-day streak
    if (currentStreak >= 7) {
        xpMultiplier += 0.25;
    }
    
    // +20% for working on a statistically weakest stat
    if (isWeakestStat) {
        xpMultiplier += 0.20;
    }
    
    // Both stack additively (1.0 + 0.25 + 0.20 = 1.45) if true
    
    const totalXP = Math.round(baseXP * xpMultiplier);
    
    // Stat XP mirrors global XP gain
    const statXPGained = totalXP;
    
    return {
        totalXP,
        totalGold: baseGold,
        statXPGained
    };
}

/**
 * Calculates HP damage taken for failing or missing a quest.
 * Higher rank quests deal more damage.
 */
export function getQuestDamage(difficulty: QuestDifficulty): number {
    switch (difficulty) {
        case 'E': return 5;
        case 'D': return 10;
        case 'C': return 20;
        case 'B': return 35;
        case 'A': return 50;
        case 'S': return 80;
        default: return 5;
    }
}

/**
 * Evaluates the user's current highest stat to assign a Job Class.
 */
export function evaluateJobClass(stats: Record<string, { value: number }>): string {
    let highestStat = 'STR';
    let highestValue = 0;

    for (const [stat, data] of Object.entries(stats)) {
        if (data.value > highestValue) {
            highestValue = data.value;
            highestStat = stat;
        }
    }

    // Default starting class if no stat is dominant
    if (highestValue <= 10) return "F-Rank Recruit";

    switch (highestStat) {
        case 'STR': return "Fighter";
        case 'AGI': return "Assassin";
        case 'INT': return "Mage";
        case 'VIT': return "Tank";
        case 'PER': return "Ranger";
        case 'CHA': return "Commander";
        default: return "Hunter";
    }
}

/**
 * Calculates effective stats by combining base values with equipment modifiers.
 */
export function calculateEffectiveStats(
    baseStats: Record<string, { value: number }>,
    equippedItems: any[]
): Record<string, number> {
    const effective: Record<string, number> = {};

    // Initialize with base values
    for (const [stat, data] of Object.entries(baseStats)) {
        effective[stat] = data.value;
    }

    // Apply equipment modifiers
    for (const item of equippedItems) {
        if (!item || !item.statBoosts) continue;
        for (const [stat, boost] of Object.entries(item.statBoosts)) {
            if (effective[stat] !== undefined && typeof boost === "number") {
                effective[stat] += boost;
            }
        }
    }

    return effective;
}
