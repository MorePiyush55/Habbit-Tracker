import { LevelInfo } from "@/types";

const XP_PER_LEVEL = 100;

const RANK_TIERS = [
    { minLevel: 1, maxLevel: 1, rank: "E-Rank", title: "E-Rank Hunter" },
    { minLevel: 2, maxLevel: 4, rank: "D-Rank", title: "D-Rank Hunter" },
    { minLevel: 5, maxLevel: 9, rank: "C-Rank", title: "C-Rank Hunter" },
    { minLevel: 10, maxLevel: 14, rank: "B-Rank", title: "B-Rank Hunter" },
    { minLevel: 15, maxLevel: 19, rank: "A-Rank", title: "A-Rank Hunter" },
    { minLevel: 20, maxLevel: 29, rank: "S-Rank", title: "S-Rank Hunter" },
    { minLevel: 30, maxLevel: Infinity, rank: "Monarch", title: "Shadow Monarch" },
];

export function getLevelFromXP(totalXP: number): number {
    return Math.floor(totalXP / XP_PER_LEVEL) + 1;
}

export function getRankInfo(level: number): { rank: string; title: string } {
    const tier = RANK_TIERS.find((t) => level >= t.minLevel && level <= t.maxLevel);
    return tier ? { rank: tier.rank, title: tier.title } : { rank: "E-Rank", title: "E-Rank Hunter" };
}

export function getLevelInfo(totalXP: number): LevelInfo {
    const level = getLevelFromXP(totalXP);
    const { rank, title } = getRankInfo(level);
    const xpForCurrentLevel = (level - 1) * XP_PER_LEVEL;
    const xpForNextLevel = level * XP_PER_LEVEL;
    const currentXP = totalXP - xpForCurrentLevel;
    const progress = Math.min(100, Math.floor((currentXP / XP_PER_LEVEL) * 100));

    return {
        level,
        rank,
        title,
        currentXP,
        xpForCurrentLevel,
        xpForNextLevel,
        progress,
    };
}

export { RANK_TIERS, XP_PER_LEVEL };
