// ── Rank Configuration — stored in localStorage ───────────────────────────
// Users can customise each rank's label, display name, and XP reward.

export interface RankConfig {
    key: string;          // internal key: "E" | "D" | "C" | "B" | "A" | "S"
    label: string;        // displayed letter, e.g. "E"
    name: string;         // difficulty name, e.g. "Easy"
    xp: number;           // XP reward
}

const STORAGE_KEY = "solo_rank_config";

export const DEFAULT_RANKS: RankConfig[] = [
    { key: "E", label: "E", name: "Easy",      xp: 10  },
    { key: "D", label: "D", name: "Moderate",  xp: 20  },
    { key: "C", label: "C", name: "Hard",      xp: 35  },
    { key: "B", label: "B", name: "Very Hard", xp: 55  },
    { key: "A", label: "A", name: "Extreme",   xp: 80  },
    { key: "S", label: "S", name: "Boss",      xp: 120 },
];

export function getRankConfigs(): RankConfig[] {
    if (typeof window === "undefined") return DEFAULT_RANKS;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_RANKS;
        const parsed: RankConfig[] = JSON.parse(raw);
        // Merge — ensure all 6 keys exist even if storage has fewer
        return DEFAULT_RANKS.map(def => parsed.find(p => p.key === def.key) ?? def);
    } catch {
        return DEFAULT_RANKS;
    }
}

export function saveRankConfigs(configs: RankConfig[]): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
}

export function getRankByKey(key: string): RankConfig {
    return getRankConfigs().find(r => r.key === key) ?? DEFAULT_RANKS.find(r => r.key === key) ?? DEFAULT_RANKS[0];
}

export function xpForRankKey(key: string): number {
    return getRankByKey(key).xp;
}
