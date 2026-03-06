/**
 * Strategy Generator — Daily Training Plan Producer
 * ===================================================
 * Uses System State to generate structured daily strategies.
 * Can work with or without AI.
 *
 * Output format:
 *   MORNING → tasks
 *   AFTERNOON → tasks  
 *   EVENING → tasks
 *   DIRECTIVE → strategic command
 */

import type { SystemState } from "@/types";
import { aiRouter } from "@/lib/ai/aiRouter";

export interface DailyStrategy {
    morning: string[];
    afternoon: string[];
    evening: string[];
    directive: string;
    rawText: string;  // Full formatted text for display
    generatedAt: string;
    usedAI: boolean;
}

// ============================================================
// GENERATE: Create daily strategy from system state
// ============================================================
export async function generateDailyStrategy(state: SystemState): Promise<DailyStrategy> {
    try {
        return await generateAIStrategy(state);
    } catch (err: any) {
        console.error("[Strategy Generator] AI failed, using rule-based strategy:", err.message);
        return generateRuleBasedStrategy(state);
    }
}

// ============================================================
// AI-POWERED strategy generation
// ============================================================
async function generateAIStrategy(state: SystemState): Promise<DailyStrategy> {
    const prompt = `You are THE SYSTEM from Solo Leveling. Generate a daily training strategy for this Hunter.

Hunter Data:
${JSON.stringify(state.hunter, null, 2)}

Current Habits:
${JSON.stringify(state.activeHabits.map(h => ({ name: h.name, category: h.category, progress: h.progress + "%", difficulty: h.difficulty })), null, 2)}

Weak Habits (need attention): ${state.weakHabits.join(", ") || "None identified"}
Strong Habits: ${state.strongHabits.join(", ") || "None identified"}

Behavior Analysis:
- Trend: ${state.behaviorAnalysis.trend}
- Avg Completion: ${state.behaviorAnalysis.avgCompletion}%
- Active Days: ${state.behaviorAnalysis.activeDays}

Skill Scores:
${state.skillScores.map(s => `${s.skill}: ${s.score}/100 (${s.trend})`).join("\n") || "No skill data yet"}

RULES:
- Create a structured plan with MORNING, AFTERNOON, and EVENING blocks.
- Each block should have 1-3 specific, actionable tasks.
- Prioritize weak habits and declining areas.
- Tone: commanding, strategic, direct.
- Return ONLY plain text. No JSON. No markdown code blocks.

Format EXACTLY like this:
MORNING
• [Specific task 1]
• [Specific task 2]

AFTERNOON
• [Specific task 1]
• [Specific task 2]

EVENING
• [Specific task 1]

DIRECTIVE
[One sentence strategic command]`;

    const response = await aiRouter("strategy", prompt);
    const rawText = response || getFallbackText(state);

    return parseStrategyText(rawText, true);
}

// ============================================================
// RULE-BASED strategy (no AI, instant)
// ============================================================
function generateRuleBasedStrategy(state: SystemState): DailyStrategy {
    const morning: string[] = [];
    const afternoon: string[] = [];
    const evening: string[] = [];
    let directive = "Discipline is built through consistency. Do not deviate from the plan.";

    // Morning: Priority tasks and weak habits
    if (state.weakHabits.length > 0) {
        morning.push(`Focus on weakest area: ${state.weakHabits[0]}`);
    }
    morning.push("Review today's quest list and plan your approach");

    // Find high-difficulty habits for morning
    const hardHabits = state.activeHabits.filter(h => h.difficulty === "hard");
    if (hardHabits.length > 0) {
        morning.push(`Complete hard quest: ${hardHabits[0].name}`);
    }

    // Afternoon: Medium tasks and skill training
    const mediumHabits = state.activeHabits.filter(h => h.difficulty === "medium" && h.progress < 100);
    if (mediumHabits.length > 0) {
        afternoon.push(`Complete: ${mediumHabits.slice(0, 2).map(h => h.name).join(", ")}`);
    }
    afternoon.push("Complete at least 2 quest subtasks");

    // Check for skill training needs
    const weakSkills = state.skillScores.filter(s => s.score < 50);
    if (weakSkills.length > 0) {
        afternoon.push(`Train weak skill: ${weakSkills[0].skill} (${weakSkills[0].score}/100)`);
    }

    // Evening: Review and remaining tasks
    evening.push("Review today's progress and complete remaining quests");
    
    const incompleteHabits = state.activeHabits.filter(h => h.progress < 100);
    if (incompleteHabits.length > 0) {
        evening.push(`Finish incomplete: ${incompleteHabits.slice(0, 2).map(h => h.name).join(", ")}`);
    }

    // Adaptive directive based on state
    if (state.behaviorAnalysis.trend === "declining") {
        directive = "Performance is DECLINING. Today's execution must be flawless. No excuses.";
    } else if (state.hunter.streak >= 7) {
        directive = `${state.hunter.streak}-day streak active. Maintain the chain. Break it and face consequences.`;
    } else if (state.hunter.disciplineScore < 40) {
        directive = "Discipline is critically low. Complete every task today without exception.";
    } else if (state.behaviorAnalysis.avgCompletion >= 80) {
        directive = "Performance is strong. Now push harder. Increase difficulty.";
    }

    const rawText = formatStrategy(morning, afternoon, evening, directive);

    return {
        morning,
        afternoon,
        evening,
        directive,
        rawText,
        generatedAt: new Date().toISOString(),
        usedAI: false,
    };
}

// ============================================================
// PARSE: Convert raw strategy text into structured format
// ============================================================
function parseStrategyText(text: string, usedAI: boolean): DailyStrategy {
    const morning: string[] = [];
    const afternoon: string[] = [];
    const evening: string[] = [];
    let directive = "";

    let currentSection = "";
    const lines = text.split("\n");

    for (const line of lines) {
        const trimmed = line.trim();
        const upper = trimmed.toUpperCase();

        if (upper.startsWith("MORNING")) {
            currentSection = "morning";
            continue;
        } else if (upper.startsWith("AFTERNOON")) {
            currentSection = "afternoon";
            continue;
        } else if (upper.startsWith("EVENING")) {
            currentSection = "evening";
            continue;
        } else if (upper.startsWith("DIRECTIVE")) {
            currentSection = "directive";
            continue;
        }

        if (!trimmed || trimmed === "•" || trimmed === "-") continue;

        const clean = trimmed.replace(/^[•\-\*]\s*/, "").trim();
        if (!clean) continue;

        switch (currentSection) {
            case "morning": morning.push(clean); break;
            case "afternoon": afternoon.push(clean); break;
            case "evening": evening.push(clean); break;
            case "directive": directive += (directive ? " " : "") + clean; break;
        }
    }

    return {
        morning: morning.length > 0 ? morning : ["Complete your highest priority quest first"],
        afternoon: afternoon.length > 0 ? afternoon : ["Focus on your weakest skill category"],
        evening: evening.length > 0 ? evening : ["Review today's progress"],
        directive: directive || "Discipline is built through consistency.",
        rawText: text,
        generatedAt: new Date().toISOString(),
        usedAI,
    };
}

// ============================================================
// HELPERS
// ============================================================
function formatStrategy(
    morning: string[],
    afternoon: string[],
    evening: string[],
    directive: string
): string {
    return `MORNING
${morning.map(t => `• ${t}`).join("\n")}

AFTERNOON
${afternoon.map(t => `• ${t}`).join("\n")}

EVENING
${evening.map(t => `• ${t}`).join("\n")}

DIRECTIVE
${directive}`;
}

function getFallbackText(state: SystemState): string {
    const weak = state.weakHabits[0] || "your weakest area";
    return `MORNING
• Complete your highest priority quest first
• Focus on: ${weak}

AFTERNOON
• Complete at least 2 quest subtasks
• Train your weakest skill

EVENING
• Review today's progress
• Plan tomorrow's priorities

DIRECTIVE
Discipline is built through consistency. Do not deviate from the plan.`;
}
