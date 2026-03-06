/**
 * System Brain v2 — Central Intelligence Orchestrator
 * =====================================================
 * This is the SINGLE entry point for all system reasoning.
 * Every user action and chat command flows through here.
 *
 * Architecture:
 *   Command/Event → Brain v2 → State + Memory → Decision Engine
 *     → Directive Generator → Directive Formatter → Response
 *
 * Key principle: AI is ONE LAYER of reasoning, not the main controller.
 * Most commands are answered from real state. AI is used only when
 * rule-based logic is insufficient.
 *
 * Agents:
 *   SYSTEM      — Core state/task responses (no AI needed)
 *   ANALYST     — Behavior analysis, debrief (may use AI)
 *   STRATEGIST  — Strategy generation (uses AI)
 *   TUTOR       — Skill/training guidance (may use AI)
 *   SHADOW_COACH — Critiques and adjustments (uses AI)
 */

import type { SystemState } from "@/types";
import type { SystemCommand, CommandType } from "./commandInterpreter";
import type { MemorySnapshot } from "./systemMemory";
import type { ConsoleDirective } from "./directiveGenerator";
import { buildSystemState } from "./systemState";
import { recallMemory } from "./systemMemory";
import { generateConsoleDirective } from "./directiveGenerator";
import { formatDirective } from "./directiveFormatter";
import { buildAIContext } from "./contextBuilder";
import { generateDailyStrategy } from "./strategyGenerator";
import { analyzeBehavior } from "./behaviorAnalyzer";
import { simulateFuture } from "./lifeSimulator";
import { assessCognitiveLoad } from "./cognitiveOptimizer";
import { getAvailableCommands } from "./commandInterpreter";

// ============================================================
// Types
// ============================================================

export type AgentRole = "SYSTEM" | "ANALYST" | "STRATEGIST" | "TUTOR" | "SHADOW_COACH";

export interface BrainV2Response {
    messages: AgentMessage[];       // Multi-agent conversation messages
    directives: ConsoleDirective[]; // Structured directives produced
    processingTimeMs: number;
    agentsInvolved: AgentRole[];
    usedAI: boolean;
}

export interface AgentMessage {
    agent: AgentRole;
    text: string;
    timestamp: string;
}

// ============================================================
// CORE: Process a command through Brain v2
// ============================================================

export async function processCommand(
    userId: string,
    command: SystemCommand
): Promise<BrainV2Response> {
    const startTime = Date.now();
    const messages: AgentMessage[] = [];
    const directives: ConsoleDirective[] = [];
    const agentsInvolved: Set<AgentRole> = new Set();
    let usedAI = false;

    // Step 1: Build state + recall memory in parallel
    const [state, memory] = await Promise.all([
        buildSystemState(userId),
        recallMemory(userId),
    ]);

    // Step 2: Route to the appropriate handler based on command type
    const handler = COMMAND_HANDLERS[command.type];
    if (handler) {
        const result = await handler(command, state, memory, userId);
        messages.push(...result.messages);
        directives.push(...result.directives);
        result.agents.forEach((a) => agentsInvolved.add(a));
        usedAI = result.usedAI;
    } else {
        // Unknown command — fallback to free chat
        const result = await handleFreeChat(command, state, memory, userId);
        messages.push(...result.messages);
        directives.push(...result.directives);
        result.agents.forEach((a) => agentsInvolved.add(a));
        usedAI = result.usedAI;
    }

    return {
        messages,
        directives,
        processingTimeMs: Date.now() - startTime,
        agentsInvolved: Array.from(agentsInvolved),
        usedAI,
    };
}

// ============================================================
// Handler Result Type
// ============================================================

interface HandlerResult {
    messages: AgentMessage[];
    directives: ConsoleDirective[];
    agents: AgentRole[];
    usedAI: boolean;
}

function msg(agent: AgentRole, text: string): AgentMessage {
    return { agent, text, timestamp: new Date().toISOString() };
}

// ============================================================
// COMMAND HANDLERS — Each command type has a dedicated handler
// ============================================================

const COMMAND_HANDLERS: Record<CommandType, (
    cmd: SystemCommand,
    state: SystemState,
    memory: MemorySnapshot | null,
    userId: string
) => Promise<HandlerResult>> = {

    // ── REMAINING TASKS ──────────────────────────────────
    REQUEST_REMAINING_TASKS: async (cmd, state) => {
        const remaining = state.activeHabits.filter((h) => h.progress < 100);
        const directive = generateConsoleDirective("SHOW_REMAINING_TASKS", {
            tasks: remaining.map((h) => ({
                name: h.name,
                category: h.category,
                progress: h.progress,
                completed: h.completed,
                total: h.total,
            })),
        });

        const formatted = formatDirective(directive, state);

        return {
            messages: [msg("SYSTEM", formatted)],
            directives: [directive],
            agents: ["SYSTEM"],
            usedAI: false,
        };
    },

    // ── COMPLETED TASKS ──────────────────────────────────
    REQUEST_COMPLETED_TASKS: async (cmd, state) => {
        const completed = state.activeHabits.filter((h) => h.progress >= 100);
        const inProgress = state.activeHabits.filter((h) => h.progress > 0 && h.progress < 100);
        const directive = generateConsoleDirective("SHOW_COMPLETED_TASKS", {
            completed: completed.map((h) => h.name),
            inProgress: inProgress.map((h) => ({ name: h.name, progress: h.progress })),
        });

        const formatted = formatDirective(directive, state);

        return {
            messages: [msg("SYSTEM", formatted)],
            directives: [directive],
            agents: ["SYSTEM"],
            usedAI: false,
        };
    },

    // ── DAILY STRATEGY ───────────────────────────────────
    REQUEST_DAILY_STRATEGY: async (cmd, state) => {
        const strategy = await generateDailyStrategy(state);
        const directive = generateConsoleDirective("SHOW_STRATEGY", {
            strategy,
        });

        const agentMessages: AgentMessage[] = [
            msg("STRATEGIST", strategy.rawText),
        ];

        // Add analyst commentary if performance is declining
        if (state.behaviorAnalysis.trend === "declining") {
            agentMessages.push(
                msg("ANALYST", `Warning: Performance trend is DECLINING. Average completion at ${state.behaviorAnalysis.avgCompletion}%. Strategy urgency is HIGH.`)
            );
        }

        return {
            messages: agentMessages,
            directives: [directive],
            agents: ["STRATEGIST", ...(state.behaviorAnalysis.trend === "declining" ? ["ANALYST" as AgentRole] : [])],
            usedAI: strategy.usedAI,
        };
    },

    // ── HUNTER STATUS ────────────────────────────────────
    REQUEST_STATUS: async (cmd, state) => {
        const h = state.hunter;
        const totalTasks = state.activeHabits.length;
        const completedTasks = state.activeHabits.filter((hab) => hab.progress >= 100).length;
        const overallProgress = totalTasks > 0
            ? Math.round(state.activeHabits.reduce((sum, hab) => sum + hab.progress, 0) / totalTasks)
            : 0;

        const directive = generateConsoleDirective("SHOW_STATUS", {
            hunter: h,
            todayProgress: overallProgress,
            tasksCompleted: completedTasks,
            totalTasks,
            bossRaid: state.bossRaid,
        });

        const formatted = formatDirective(directive, state);

        return {
            messages: [msg("SYSTEM", formatted)],
            directives: [directive],
            agents: ["SYSTEM"],
            usedAI: false,
        };
    },

    // ── SKILL REPORT ─────────────────────────────────────
    REQUEST_SKILL_REPORT: async (cmd, state) => {
        const weakSkills = state.skillScores.filter((s) => s.score < 50);
        const strongSkills = state.skillScores.filter((s) => s.score >= 70);
        const decliningSkills = state.skillScores.filter((s) => s.trend === "declining");

        const directive = generateConsoleDirective("SHOW_SKILL_REPORT", {
            skills: state.skillScores,
            weakSkills,
            strongSkills,
            decliningSkills,
        });

        const formatted = formatDirective(directive, state);
        const agentMessages: AgentMessage[] = [msg("TUTOR", formatted)];

        // Add training recommendation if weak skills exist
        if (weakSkills.length > 0) {
            agentMessages.push(
                msg("TUTOR", `Training Priority: ${weakSkills[0].skill} (${weakSkills[0].score}/100). Immediate drill recommended.`)
            );
        }

        return {
            messages: agentMessages,
            directives: [directive],
            agents: ["TUTOR"],
            usedAI: false,
        };
    },

    // ── BEHAVIOR ANALYSIS ────────────────────────────────
    REQUEST_BEHAVIOR_ANALYSIS: async (cmd, state, memory, userId) => {
        const insight = await analyzeBehavior(userId, 30);
        const directive = generateConsoleDirective("SHOW_BEHAVIOR_ANALYSIS", {
            insight,
        });

        const formatted = formatDirective(directive, state);
        const agentMessages: AgentMessage[] = [msg("ANALYST", formatted)];

        // Add interventions as separate messages
        if (insight.interventions.length > 0) {
            agentMessages.push(
                msg("ANALYST", `Interventions Required:\n${insight.interventions.map((i) => `• ${i}`).join("\n")}`)
            );
        }

        return {
            messages: agentMessages,
            directives: [directive],
            agents: ["ANALYST"],
            usedAI: false,
        };
    },

    // ── DEBRIEF ──────────────────────────────────────────
    REQUEST_DEBRIEF: async (cmd, state, memory, userId) => {
        const insight = await analyzeBehavior(userId, 7);
        const context = buildAIContext(state, memory);

        // Use AI for the debrief narrative
        let narrative = "";
        let usedAI = false;
        try {
            const { aiRouter } = await import("@/lib/ai/aiRouter");
            narrative = await aiRouter("analysis", `You are THE SYSTEM. Generate a concise mission debrief for this Hunter.

${context.compact}

Recent Analysis: ${insight.summary}

RULES:
- 3-5 sentences max.
- State facts: completion rate, trend, key issues.
- End with a single directive for tomorrow.
- Tone: cold, commanding. Address as "Hunter".
- Plain text only.`);
            usedAI = true;
        } catch {
            narrative = `Debrief: ${insight.summary}. ${insight.interventions[0] || "Continue current trajectory."}`;
        }

        const directive = generateConsoleDirective("SHOW_DEBRIEF", {
            insight,
            narrative,
        });

        return {
            messages: [
                msg("ANALYST", narrative),
                msg("SYSTEM", `Stats: ${insight.completionRate}% avg | ${insight.disciplineTrend} trend | Consistency: ${insight.consistencyScore}/100`),
            ],
            directives: [directive],
            agents: ["ANALYST", "SYSTEM"],
            usedAI,
        };
    },

    // ── PREDICTION ───────────────────────────────────────
    REQUEST_PREDICTION: async (cmd, state, memory, userId) => {
        const projection = await simulateFuture(userId, state, 30);
        const directive = generateConsoleDirective("SHOW_PREDICTION", {
            projection,
        });

        const formatted = formatDirective(directive, state);

        return {
            messages: [msg("ANALYST", formatted)],
            directives: [directive],
            agents: ["ANALYST"],
            usedAI: false,
        };
    },

    // ── WORKLOAD CHECK ───────────────────────────────────
    REQUEST_WORKLOAD_CHECK: async (cmd, state, memory, userId) => {
        const assessment = await assessCognitiveLoad(userId, state);
        const directive = generateConsoleDirective("SHOW_WORKLOAD", {
            assessment,
        });

        const formatted = formatDirective(directive, state);
        const agentMessages: AgentMessage[] = [msg("SHADOW_COACH", formatted)];

        if (assessment.isOverloaded) {
            agentMessages.push(
                msg("SHADOW_COACH", `Recommendation: ${assessment.recommendation}`)
            );
        }

        return {
            messages: agentMessages,
            directives: [directive],
            agents: ["SHADOW_COACH"],
            usedAI: false,
        };
    },

    // ── HELP ─────────────────────────────────────────────
    REQUEST_HELP: async () => {
        const helpText = getAvailableCommands();
        const directive = generateConsoleDirective("SHOW_HELP", {});

        return {
            messages: [msg("SYSTEM", helpText)],
            directives: [directive],
            agents: ["SYSTEM"],
            usedAI: false,
        };
    },

    // ── MOTIVATION ───────────────────────────────────────
    REQUEST_MOTIVATION: async (cmd, state, memory) => {
        const h = state.hunter;
        let motivationText: string;
        let usedAI = false;

        // Try AI for motivation, fall back to rule-based
        try {
            const context = buildAIContext(state, memory);
            const { aiRouter } = await import("@/lib/ai/aiRouter");
            motivationText = await aiRouter("chat", `You are THE SYSTEM from Solo Leveling. The Hunter needs a push.

${context.compact}

Give a 2-3 sentence motivational push. Be commanding, not friendly. Reference their actual data (streak, level, weak areas). End with a direct order. Plain text only.`);
            usedAI = true;
        } catch {
            // Rule-based motivation
            if (h.streak >= 7) {
                motivationText = `Hunter. ${h.streak}-day streak active. You didn't come this far to stop. Execute today's tasks or watch that chain shatter. Move.`;
            } else if (h.disciplineScore < 40) {
                motivationText = `Hunter. Discipline at ${h.disciplineScore}%. This is unacceptable. You know what you need to do. Stop thinking. Start executing. Now.`;
            } else {
                motivationText = `Hunter. Level ${h.level}. ${h.xp} XP earned through effort. Don't waste it with inaction today. The System is watching. Perform.`;
            }
        }

        const directive = generateConsoleDirective("SHOW_MOTIVATION", {});

        return {
            messages: [msg("SYSTEM", motivationText)],
            directives: [directive],
            agents: ["SYSTEM"],
            usedAI,
        };
    },

    // ── FREE CHAT ────────────────────────────────────────
    FREE_CHAT: async (cmd, state, memory, userId) => {
        return handleFreeChat(cmd, state, memory, userId);
    },

    // ── v3 STUBS (handled by Brain v3, kept here for type safety) ──
    REQUEST_TRAINING: async () => ({
        messages: [msg("SYSTEM", "Training is handled by Brain v3. Upgrade in progress.")],
        directives: [],
        agents: ["SYSTEM"] as AgentRole[],
        usedAI: false,
    }),
    REQUEST_SIMULATION: async () => ({
        messages: [msg("SYSTEM", "Simulation is handled by Brain v3. Upgrade in progress.")],
        directives: [],
        agents: ["SYSTEM"] as AgentRole[],
        usedAI: false,
    }),
    REQUEST_EVOLUTION: async () => ({
        messages: [msg("SYSTEM", "Evolution status is handled by Brain v3. Upgrade in progress.")],
        directives: [],
        agents: ["SYSTEM"] as AgentRole[],
        usedAI: false,
    }),
};

// ============================================================
// FREE CHAT: AI-powered but state-grounded
// ============================================================

async function handleFreeChat(
    cmd: SystemCommand,
    state: SystemState,
    memory: MemorySnapshot | null,
    userId: string
): Promise<HandlerResult> {
    const context = buildAIContext(state, memory);

    let reply: string;
    let usedAI = false;

    try {
        const { aiRouter } = await import("@/lib/ai/aiRouter");
        reply = await aiRouter("chat", `You are THE SYSTEM from Solo Leveling — an AI Discipline Operating System.

CURRENT HUNTER STATE:
${context.full}

CRITICAL RULES:
- Your answers must reference the Hunter's ACTUAL data above.
- Never make up tasks, scores, or stats. Use only what's provided.
- If the question is about tasks/progress, reference activeHabits data.
- If about performance, reference behavior analysis data.
- Keep responses to 2-5 sentences. Be commanding and direct.
- Address as "Hunter". No casual language. No emojis.
- Plain text only. No markdown.

Hunter's message: "${cmd.originalMessage}"`);
        usedAI = true;
    } catch {
        reply = `Hunter. System processing encountered resistance. Your current state: Level ${state.hunter.level}, Discipline ${state.hunter.disciplineScore}%, Streak ${state.hunter.streak} days. ${state.weakHabits.length > 0 ? `Focus on: ${state.weakHabits[0]}.` : "Continue your current trajectory."} Execute.`;
    }

    const directive = generateConsoleDirective("FREE_RESPONSE", {
        message: cmd.originalMessage,
    });

    return {
        messages: [msg("SYSTEM", reply)],
        directives: [directive],
        agents: ["SYSTEM"],
        usedAI,
    };
}
