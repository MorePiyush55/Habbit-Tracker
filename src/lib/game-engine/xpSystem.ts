import { Difficulty } from "@/types";

export function calculateXP(difficulty: Difficulty): number {
    switch (difficulty) {
        case "small":
            return 10;
        case "medium":
            return 25;
        case "hard":
            return 50;
    }
}

function calculateSubtaskXP(totalXP: number, subtaskCount: number): number {
    if (subtaskCount <= 0) return totalXP;
    return Math.floor(totalXP / subtaskCount);
}
