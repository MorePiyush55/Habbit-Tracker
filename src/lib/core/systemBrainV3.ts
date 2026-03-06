/**
 * System Brain v3 — Autonomous Intelligence Orchestrator
 * ========================================================
 * Upgrade from v2: adds autonomous reasoning, long-term planning,
 * self-evolving rules, shadow coach review on every strategy,
 * and cognitive load constraints.
 *
 * Architecture:
 *   Command/Event → Brain v3 → Context Builder → Decision Engine
 *     → Modules (behaviorAnalyzer, evolutionEngine, lifeSimulator,
 *       cognitiveOptimizer, trainingEngine, shadowCoach)
 *     → Directive Generator → Directive Formatter → Response
 *
 * v3 upgrades over v2:
 *   1. Shadow Coach reviews ALL strategy/AI outputs before returning
 *   2. Evolution Engine feeds into strategy generation
 *   3. Cognitive Optimizer constrains all task recommendations
 *   4. Autonomous mode: scheduler can push events through Brain v3
 *   5. Multi-agent enrichment: most handlers return 2-3 agent messages
 *   6. Slash command support: /progress, /tasks, /strategy, etc.
 *   7. Training integration: /test command generates skill questions
 *
 * Key principle: AI is ONE LAYER of reasoning.
 * Evolution, Shadow Coach, and Cognitive Optimizer are constraint layers
 * that modify outputs before they reach the user.
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
import { analyzeBehavior, type BehaviorInsight } from "./behaviorAnalyzer";
import { simulateFuture } from "./lifeSimulator";
import { assessCognitiveLoad } from "./cognitiveOptimizer";
import { evolveStrategy, getStoredParams } from "./evolutionEngine";
import { reviewStrategy, reviewConsoleResponse } from "./shadowCoach";
import { getAvailableCommands } from "./commandInterpreter";
import { generateQuestion, detectWeakestSkill, getTrainingRecommendations } from "./trainingEngine";

// ============================================================
// Types
// ============================================================

export type AgentRole = "SYSTEM" | "ANALYST" | "STRATEGIST" | "TUTOR" | "SHADOW_COACH";

export interface BrainV3Response {
    messages: AgentMessage[];
    directives: ConsoleDirective[];
    processingTimeMs: number;
    agentsInvolved: AgentRole[];
    usedAI: boolean;
    evolutionApplied: boolean;       // v3: did evolution engine adjust params?
    shadowCoachReviewed: boolean;    // v3: did shadow coach review the output?
    cognitiveConstrained: boolean;   // v3: did cognitive optimizer cap anything?
}

export interface AgentMessage {
    agent: AgentRole;
    text: string;
    timestamp: string;
}

// ============================================================
// Handler internals
// ============================================================

interface HandlerResult {
    messages: AgentMessage[];
    directives: ConsoleDirective[];
    agents: AgentRole[];
    usedAI: boolean;
    evolutionApplied?: boolean;
    shadowCoachReviewed?: boolean;
    cognitiveConstrained?: boolean;
}

function msg(agent: AgentRole, text: string): AgentMessage {
    return { agent, text, timestamp: new Date().toISOString() };
}

// ============================================================
// CORE: Process a command through Brain v3
// ============================================================

export async function processCommand(
    userId: string,
    command: SystemCommand
): Promise<BrainV3Response> {
    const startTime = Date.now();

    // Step 1: Build state + recall memory in parallel
    const [state, memory] = await Promise.all([
        buildSystemState(userId),
        recallMemory(userId),
    ]);

    // Step 2: Route to the appropriate handler
    const handler = COMMAND_HANDLERS[command.type];
    const result = handler
        ? await handler(command, state, memory, userId)
        : await handleFreeChat(command, state, memory, userId);

    return {
        messages: result.messages,
        directives: result.directives,
        processingTimeMs: Date.now() - startTime,
        agentsInvolved: [...new Set(result.agents)],
        usedAI: result.usedAI,
        evolutionApplied: result.evolutionApplied || false,
        shadowCoachReviewed: result.shadowCoachReviewed || false,
        cognitiveConstrained: result.cognitiveConstrained || false,
    };
}

// ============================================================
// AUTONOMOUS: Process a scheduler event through Brain v3
// ============================================================

export async function processAutonomousEvent(
    userId: string,
    eventType: string,
    data: Record<string, unknown> = {}
): Promise<BrainV3Response> {
    const startTime = Date.now();

    const [state, memory] = await Promise.all([
        buildSystemState(userId),
        recallMemory(userId),
    ]);

    const messages: AgentMessage[] = [];
    const directives: ConsoleDirective[] = [];
    const agents: Set<AgentRole> = new Set();
    let usedAI = false;
    let evolutionApplied = false;

    switch (eventType) {
        case "RUN_BEHAVIOR_ANALYSIS": {
            const insight = await analyzeBehavior(userId, 30);
            messages.push(msg("ANALYST",
                `📊 AUTONOMOUS ANALYSIS\n\n` +
                `Completion: ${insight.completionRate}%\n` +
                `Trend: ${insight.disciplineTrend}\n` +
                `Consistency: ${insight.consistencyScore}/100\n` +
                (insight.interventions.length > 0
                    ? `\nCritical: ${insight.interventions[0]}`
                    : "\nNo interventions needed.")));
            agents.add("ANALYST");
            break;
        }

        case "GENERATE_STRATEGY": {
            // v3: Evolution feeds into strategy, shadow coach reviews it
            const evoResult = await evolveStrategy(userId, state, memory);
            evolutionApplied = evoResult.totalAdjustments > 0;

            const strategy = await generateDailyStrategy(state);
            const review = reviewStrategy(strategy, state, memory);

            messages.push(msg("STRATEGIST", strategy.rawText));

            if (review.warnings.length > 0) {
                messages.push(msg("SHADOW_COACH",
                    `⚠ STRATEGY REVIEW — ${review.summary}\n\n` +
                    review.warnings.map(w => `• ${w}`).join("\n")));
                agents.add("SHADOW_COACH");
            }
            if (evolutionApplied) {
                messages.push(msg("SYSTEM",
                    `Evolution Engine: ${evoResult.summary}`));
            }
            agents.add("STRATEGIST");
            agents.add("SYSTEM");
            usedAI = strategy.usedAI;
            break;
        }

        case "CHECK_COGNITIVE_LOAD": {
            const assessment = await assessCognitiveLoad(userId, state);
            if (assessment.isOverloaded) {
                messages.push(msg("SHADOW_COACH",
                    `⚠ OVERLOAD DETECTED\n\nCurrent: ${assessment.currentLoadHours.toFixed(1)}h | ` +
                    `Optimal: ${assessment.optimalLoadHours.toFixed(1)}h\n\n${assessment.recommendation}`));
                agents.add("SHADOW_COACH");
            }
            break;
        }

        case "UPDATE_DIFFICULTY": {
            const evoResult = await evolveStrategy(userId, state, memory);
            evolutionApplied = evoResult.totalAdjustments > 0;
            if (evolutionApplied) {
                messages.push(msg("SYSTEM",
                    `🧬 SYSTEM EVOLUTION\n\n${evoResult.summary}\n\n` +
                    evoResult.rules.map(r => `• ${r.parameter}: ${r.previousValue} → ${r.newValue} (${r.reason})`).join("\n")));
                agents.add("SYSTEM");
            }
            break;
        }

        default: {
            // Pass through — no brain processing needed
            break;
        }
    }

    return {
        messages,
        directives,
        processingTimeMs: Date.now() - startTime,
        agentsInvolved: [...agents],
        usedAI,
        evolutionApplied,
        shadowCoachReviewed: false,
        cognitiveConstrained: false,
    };
}

// ============================================================
// COMMAND HANDLERS — v3: Multi-agent + constraint layers
// ============================================================

const COMMAND_HANDLERS: Record<CommandType, (
    cmd: SystemCommand,
    state: SystemState,
    memory: MemorySnapshot | null,
    userId: string
) => Promise<HandlerResult>> = {

    // ── REMAINING TASKS ──────────────────────────────────
    REQUEST_REMAINING_TASKS: async (cmd, state, memory, userId) => {
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
        const agentMessages: AgentMessage[] = [msg("SYSTEM", formatted)];
        const agents: AgentRole[] = ["SYSTEM"];

        // v3: If overloaded, shadow coach adds recommendation
        const assessment = await assessCognitiveLoad(userId, state);
        if (assessment.isOverloaded) {
            agentMessages.push(msg("SHADOW_COACH",
                `⚠ Load Warning: Current workload exceeds optimal capacity ` +
                `(${assessment.currentLoadHours.toFixed(1)}h vs ${assessment.optimalLoadHours.toFixed(1)}h). ` +
                `${assessment.recommendation}`));
            agents.push("SHADOW_COACH");
        }

        return {
            messages: agentMessages,
            directives: [directive],
            agents,
            usedAI: false,
            cognitiveConstrained: assessment.isOverloaded,
        };
    },

    // ── COMPLETED TASKS ──────────────────────────────────
    REQUEST_COMPLETED_TASKS: async (cmd, state) => {
        const completed = state.activeHabits.filter((h) => h.progress >= 100);
        const inProgress = state.activeHabits.filter((h) => h.progress > 0 && h.progress < 100);
        const total = state.activeHabits.length;
        const completionPct = total > 0 ? Math.round((completed.length / total) * 100) : 0;

        const directive = generateConsoleDirective("SHOW_COMPLETED_TASKS", {
            completed: completed.map((h) => h.name),
            inProgress: inProgress.map((h) => ({ name: h.name, progress: h.progress })),
        });

        const formatted = formatDirective(directive, state);
        const agentMessages: AgentMessage[] = [msg("SYSTEM", formatted)];
        const agents: AgentRole[] = ["SYSTEM"];

        // v3: Analyst adds trend context
        if (state.behaviorAnalysis.trend === "declining" && completionPct < 50) {
            agentMessages.push(msg("ANALYST",
                `Completion at ${completionPct}% today with a declining weekly trend. ` +
                `Focus on finishing ${inProgress.length > 0 ? inProgress[0].name : "your next task"} before adding more.`));
            agents.push("ANALYST");
        } else if (completionPct >= 80) {
            agentMessages.push(msg("ANALYST",
                `Strong execution today: ${completionPct}% complete. Maintain this pace, Hunter.`));
            agents.push("ANALYST");
        }

        return {
            messages: agentMessages,
            directives: [directive],
            agents,
            usedAI: false,
        };
    },

    // ── DAILY STRATEGY ───────────────────────────────────
    REQUEST_DAILY_STRATEGY: async (cmd, state, memory, userId) => {
        // v3: Evolution feeds parameters into strategy generation
        let evolutionApplied = false;
        try {
            const evoResult = await evolveStrategy(userId, state, memory);
            evolutionApplied = evoResult.totalAdjustments > 0;
        } catch { /* non-fatal */ }

        const strategy = await generateDailyStrategy(state);

        // v3: Shadow coach reviews the strategy
        const review = reviewStrategy(strategy, state, memory);

        const agentMessages: AgentMessage[] = [
            msg("STRATEGIST", strategy.rawText),
        ];
        const agents: AgentRole[] = ["STRATEGIST"];

        // Shadow coach feedback
        if (review.adjustments.length > 0 || review.warnings.length > 0) {
            const coachLines: string[] = [];
            if (review.adjustments.length > 0) {
                coachLines.push(`Adjustments (${review.adjustments.length}):`);
                review.adjustments.forEach(a =>
                    coachLines.push(`  • ${a.target}: ${a.original} → ${a.adjusted} — ${a.reason}`));
            }
            if (review.warnings.length > 0) {
                coachLines.push(`\nWarnings:`);
                review.warnings.forEach(w => coachLines.push(`  • ${w}`));
            }
            coachLines.push(`\nFeasibility: ${review.originalScore} → ${review.adjustedScore}/100`);

            agentMessages.push(msg("SHADOW_COACH", coachLines.join("\n")));
            agents.push("SHADOW_COACH");
        }

        // v3: Cognitive check on strategy task count
        const assessment = await assessCognitiveLoad(userId, state);
        if (assessment.isOverloaded) {
            agentMessages.push(msg("SHADOW_COACH",
                `⚠ Cognitive Load: ${assessment.currentLoadHours.toFixed(1)}h exceeds optimal ${assessment.optimalLoadHours.toFixed(1)}h. ` +
                `${assessment.recommendation}`));
            if (!agents.includes("SHADOW_COACH")) agents.push("SHADOW_COACH");
        }

        // Analyst adds trend context if declining
        if (state.behaviorAnalysis.trend === "declining") {
            agentMessages.push(msg("ANALYST",
                `Performance trend: DECLINING. Average completion at ${state.behaviorAnalysis.avgCompletion}%. ` +
                `Strategy urgency is HIGH.`));
            agents.push("ANALYST");
        }

        // Evolution notice
        if (evolutionApplied) {
            agentMessages.push(msg("SYSTEM",
                `🧬 Evolution Engine adjusted strategy parameters based on recent performance data.`));
            agents.push("SYSTEM");
        }

        return {
            messages: agentMessages,
            directives: [generateConsoleDirective("SHOW_STRATEGY", { strategy })],
            agents,
            usedAI: strategy.usedAI,
            evolutionApplied,
            shadowCoachReviewed: true,
            cognitiveConstrained: assessment.isOverloaded,
        };
    },

    // ── HUNTER STATUS ────────────────────────────────────
    REQUEST_STATUS: async (cmd, state, memory, userId) => {
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
        const agentMessages: AgentMessage[] = [msg("SYSTEM", formatted)];
        const agents: AgentRole[] = ["SYSTEM"];

        // v3: Multi-agent enrichment on status
        // Analyst adds trend insight
        const trend = state.behaviorAnalysis.trend;
        if (trend !== "stable") {
            agentMessages.push(msg("ANALYST",
                `Trend: ${trend.toUpperCase()}. Avg completion: ${state.behaviorAnalysis.avgCompletion}%. ` +
                `Active days: ${state.behaviorAnalysis.activeDays}. Trajectory: ${state.behaviorAnalysis.disciplineTrajectory}.`));
            agents.push("ANALYST");
        }

        // Evolution params summary
        const params = getStoredParams(memory);
        if (params.streakProtectionMode && h.streak >= 7) {
            agentMessages.push(msg("SYSTEM",
                `🛡️ Streak Protection: ACTIVE (${h.streak}-day streak). System is guarding your chain.`));
        }

        return {
            messages: agentMessages,
            directives: [directive],
            agents,
            usedAI: false,
        };
    },

    // ── SKILL REPORT ─────────────────────────────────────
    REQUEST_SKILL_REPORT: async (cmd, state, memory, userId) => {
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
        const agents: AgentRole[] = ["TUTOR"];

        // v3: Tutor adds training recommendations
        if (weakSkills.length > 0) {
            const recs = await getTrainingRecommendations(state);
            if (recs.needsTraining) {
                agentMessages.push(msg("TUTOR",
                    `Training Priority: ${recs.skills.slice(0, 3).join(", ")}.\n${recs.reason}`));
            }
        }

        // Shadow coach on skill focus
        if (decliningSkills.length >= 2) {
            agentMessages.push(msg("SHADOW_COACH",
                `${decliningSkills.length} skills declining simultaneously. ` +
                `Pick ONE to focus on for the next 7 days. Spreading effort will worsen all.`));
            agents.push("SHADOW_COACH");
        }

        return {
            messages: agentMessages,
            directives: [directive],
            agents,
            usedAI: false,
        };
    },

    // ── BEHAVIOR ANALYSIS ────────────────────────────────
    REQUEST_BEHAVIOR_ANALYSIS: async (cmd, state, memory, userId) => {
        const insight = await analyzeBehavior(userId, 30);
        const directive = generateConsoleDirective("SHOW_BEHAVIOR_ANALYSIS", { insight });

        const formatted = formatDirective(directive, state);
        const agentMessages: AgentMessage[] = [msg("ANALYST", formatted)];
        const agents: AgentRole[] = ["ANALYST"];

        // v3: Interventions as separate messages
        if (insight.interventions.length > 0) {
            agentMessages.push(msg("ANALYST",
                `Interventions Required:\n${insight.interventions.map((i) => `• ${i}`).join("\n")}`));
        }

        // v3: Strategist recommends action based on analysis
        if (insight.disciplineTrend === "declining") {
            agentMessages.push(msg("STRATEGIST",
                `Based on declining trend: reduce task count to ${Math.max(3, state.activeHabits.length - 2)} and ` +
                `focus on ${insight.habitBreakdown[0]?.habit || "core habits"} this week.`));
            agents.push("STRATEGIST");
        } else if (insight.completionRate >= 80) {
            agentMessages.push(msg("STRATEGIST",
                `Strong performance. Consider increasing difficulty or adding 1 new habit to maintain growth.`));
            agents.push("STRATEGIST");
        }

        // v3: Shadow coach weighs in on burnout risk
        if (insight.completionRate < 40 && insight.consistencyScore < 40) {
            agentMessages.push(msg("SHADOW_COACH",
                `Burnout indicators present. Completion at ${insight.completionRate}%, consistency at ${insight.consistencyScore}%. ` +
                `Recommend a recovery day before pushing harder.`));
            agents.push("SHADOW_COACH");
        }

        return {
            messages: agentMessages,
            directives: [directive],
            agents,
            usedAI: false,
        };
    },

    // ── DEBRIEF ──────────────────────────────────────────
    REQUEST_DEBRIEF: async (cmd, state, memory, userId) => {
        const insight = await analyzeBehavior(userId, 7);
        const context = buildAIContext(state, memory);

        // AI narrative
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

        // v3: Shadow coach reviews the debrief narrative
        const coachFeedback = reviewConsoleResponse(narrative, state);

        const agentMessages: AgentMessage[] = [
            msg("ANALYST", narrative),
            msg("SYSTEM", `Stats: ${insight.completionRate}% avg | ${insight.disciplineTrend} trend | Consistency: ${insight.consistencyScore}/100`),
        ];
        const agents: AgentRole[] = ["ANALYST", "SYSTEM"];

        // v3: Life simulator adds 30-day projection
        try {
            const projection = await simulateFuture(userId, state, 30);
            agentMessages.push(msg("ANALYST",
                `30-Day Projection: ${projection.outcome} — ${projection.verdict}`));
        } catch { /* non-fatal */ }

        // Shadow coach warning if narrative was flagged
        if (coachFeedback.feedback) {
            agentMessages.push(msg("SHADOW_COACH", coachFeedback.feedback));
            agents.push("SHADOW_COACH");
        }

        return {
            messages: agentMessages,
            directives: [generateConsoleDirective("SHOW_DEBRIEF", { insight, narrative })],
            agents,
            usedAI,
            shadowCoachReviewed: true,
        };
    },

    // ── PREDICTION ───────────────────────────────────────
    REQUEST_PREDICTION: async (cmd, state, memory, userId) => {
        const projection = await simulateFuture(userId, state, 30);
        const directive = generateConsoleDirective("SHOW_PREDICTION", { projection });

        const formatted = formatDirective(directive, state);
        const agentMessages: AgentMessage[] = [msg("ANALYST", formatted)];
        const agents: AgentRole[] = ["ANALYST"];

        // v3: Strategist suggests how to improve the projection
        if (projection.outcome === "declining" || projection.outcome === "critical") {
            agentMessages.push(msg("STRATEGIST",
                `This trajectory leads to ${projection.outcome}. To reverse: ` +
                `reduce tasks to ${Math.max(3, state.activeHabits.length - 2)}, ` +
                `focus on ${state.weakHabits[0] || "core habits"}, and maintain consistency for 7 days.`));
            agents.push("STRATEGIST");
        } else if (projection.outcome === "stagnant") {
            agentMessages.push(msg("STRATEGIST",
                `Stagnation detected. Increase difficulty or add a new challenge area to break the plateau.`));
            agents.push("STRATEGIST");
        }

        // v3: Shadow coach reality check
        agentMessages.push(msg("SHADOW_COACH",
            `Projection is based on current behavior patterns. Any break in consistency will shift these numbers downward. ` +
            `The System does not predict miracles — only consequences.`));
        agents.push("SHADOW_COACH");

        return {
            messages: agentMessages,
            directives: [directive],
            agents,
            usedAI: false,
        };
    },

    // ── WORKLOAD CHECK ───────────────────────────────────
    REQUEST_WORKLOAD_CHECK: async (cmd, state, memory, userId) => {
        const assessment = await assessCognitiveLoad(userId, state);
        const directive = generateConsoleDirective("SHOW_WORKLOAD", { assessment });

        const formatted = formatDirective(directive, state);
        const agentMessages: AgentMessage[] = [msg("SHADOW_COACH", formatted)];
        const agents: AgentRole[] = ["SHADOW_COACH"];

        if (assessment.isOverloaded) {
            agentMessages.push(msg("SHADOW_COACH",
                `Recommendation: ${assessment.recommendation}`));

            // v3: Strategist suggests what to cut
            const removeTasks = assessment.taskRecommendations
                .filter(t => t.action === "remove")
                .map(t => t.habitName);
            const reduceTasks = assessment.taskRecommendations
                .filter(t => t.action === "reduce")
                .map(t => t.habitName);

            if (removeTasks.length > 0 || reduceTasks.length > 0) {
                const lines: string[] = ["Workload Reduction Plan:"];
                if (removeTasks.length > 0) {
                    lines.push(`  Remove: ${removeTasks.join(", ")}`);
                }
                if (reduceTasks.length > 0) {
                    lines.push(`  Reduce: ${reduceTasks.join(", ")}`);
                }
                agentMessages.push(msg("STRATEGIST", lines.join("\n")));
                agents.push("STRATEGIST");
            }
        } else {
            agentMessages.push(msg("SYSTEM",
                `Workload is within optimal range. No adjustments needed.`));
            agents.push("SYSTEM");
        }

        return {
            messages: agentMessages,
            directives: [directive],
            agents,
            usedAI: false,
            cognitiveConstrained: assessment.isOverloaded,
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
    REQUEST_MOTIVATION: async (cmd, state, memory, userId) => {
        const h = state.hunter;
        let motivationText: string;
        let usedAI = false;

        try {
            const context = buildAIContext(state, memory);
            const { aiRouter } = await import("@/lib/ai/aiRouter");
            motivationText = await aiRouter("chat", `You are THE SYSTEM from Solo Leveling. The Hunter needs a push.

${context.compact}

Give a 2-3 sentence motivational push. Be commanding, not friendly. Reference their actual data (streak, level, weak areas). End with a direct order. Plain text only.`);
            usedAI = true;
        } catch {
            if (h.streak >= 7) {
                motivationText = `Hunter. ${h.streak}-day streak active. You didn't come this far to stop. Execute today's tasks or watch that chain shatter. Move.`;
            } else if (h.disciplineScore < 40) {
                motivationText = `Hunter. Discipline at ${h.disciplineScore}%. This is unacceptable. You know what you need to do. Stop thinking. Start executing. Now.`;
            } else {
                motivationText = `Hunter. Level ${h.level}. ${h.xp} XP earned through effort. Don't waste it with inaction today. The System is watching. Perform.`;
            }
        }

        // v3: Shadow coach reviews motivation
        const feedback = reviewConsoleResponse(motivationText, state);
        const agentMessages: AgentMessage[] = [msg("SYSTEM", motivationText)];
        const agents: AgentRole[] = ["SYSTEM"];

        if (feedback.feedback) {
            // Re-generate with more specific data
            agentMessages.push(msg("SHADOW_COACH",
                `Specific focus: ${state.weakHabits[0] || "consistency"}. Level ${h.level}, ` +
                `${state.activeHabits.filter(t => t.progress < 100).length} tasks remaining today.`));
            agents.push("SHADOW_COACH");
        }

        return {
            messages: agentMessages,
            directives: [generateConsoleDirective("SHOW_MOTIVATION", {})],
            agents,
            usedAI,
            shadowCoachReviewed: true,
        };
    },

    // ── TRAINING / TEST ──────────────────────────────────
    REQUEST_TRAINING: async (cmd, state, memory, userId) => {
        const weakest = await detectWeakestSkill(userId);
        const skill = cmd.extractedEntities.skillName || weakest || "general";

        let question;
        try {
            question = await generateQuestion(userId, skill);
        } catch {
            return {
                messages: [msg("TUTOR",
                    `Training system is preparing your ${skill} assessment. ` +
                    `Try again in a moment, Hunter.`)],
                directives: [],
                agents: ["TUTOR"],
                usedAI: false,
            };
        }

        const agentMessages: AgentMessage[] = [
            msg("TUTOR",
                `📝 TRAINING DRILL — ${skill.toUpperCase()}\n\n` +
                `Difficulty: ${question.difficulty.toUpperCase()}\n\n` +
                `${question.question}\n\n` +
                `Hint: ${question.hint}\n\n` +
                `Type your answer.`),
        ];

        return {
            messages: agentMessages,
            directives: [generateConsoleDirective("FREE_RESPONSE", { training: true, skill })],
            agents: ["TUTOR"],
            usedAI: true,
        };
    },

    // ── SIMULATION ───────────────────────────────────────
    REQUEST_SIMULATION: async (cmd, state, memory, userId) => {
        const days = cmd.extractedEntities.number || 30;
        const projection = await simulateFuture(userId, state, days);
        const directive = generateConsoleDirective("SHOW_PREDICTION", { projection });
        const formatted = formatDirective(directive, state);

        const agentMessages: AgentMessage[] = [
            msg("ANALYST", formatted),
        ];
        const agents: AgentRole[] = ["ANALYST"];

        // v3: Compare current vs improved trajectories
        if (projection.outcome !== "excellent" && projection.outcome !== "good") {
            const improved = await simulateFuture(userId, {
                ...state,
                behaviorAnalysis: {
                    ...state.behaviorAnalysis,
                    avgCompletion: Math.min(100, state.behaviorAnalysis.avgCompletion + 20),
                    trend: "improving",
                },
            }, days);

            agentMessages.push(msg("STRATEGIST",
                `IF you improve by 20%:\n` +
                `  Discipline: ${projection.projectedDiscipline} → ${improved.projectedDiscipline}\n` +
                `  Outcome: ${projection.outcome} → ${improved.outcome}\n` +
                `  ${improved.verdict}`));
            agents.push("STRATEGIST");
        }

        return {
            messages: agentMessages,
            directives: [directive],
            agents,
            usedAI: false,
        };
    },

    // ── EVOLUTION STATUS ─────────────────────────────────
    REQUEST_EVOLUTION: async (cmd, state, memory, userId) => {
        const evoResult = await evolveStrategy(userId, state, memory);
        const params = getStoredParams(memory);

        const agentMessages: AgentMessage[] = [
            msg("SYSTEM",
                `🧬 EVOLUTION ENGINE STATUS\n\n` +
                `Current Parameters:\n` +
                `  Task Time: ${params.optimalTaskTime}\n` +
                `  Difficulty Threshold: ${params.difficultyScaleThreshold}\n` +
                `  Intervention Sensitivity: ${params.interventionSensitivity}\n` +
                `  Focus: ${params.focusPriority}\n` +
                `  Max Daily Tasks: ${params.maxDailyTasks}\n` +
                `  Streak Protection: ${params.streakProtectionMode ? "ON" : "OFF"}\n\n` +
                (evoResult.totalAdjustments > 0
                    ? `Recent Adjustments:\n${evoResult.rules.map(r =>
                        `  • ${r.parameter}: ${r.previousValue} → ${r.newValue}\n    Reason: ${r.reason}`).join("\n")}`
                    : "No adjustments needed — current parameters are effective.") +
                `\n\nNext evaluation in: ${evoResult.nextEvaluationIn}`),
        ];

        return {
            messages: agentMessages,
            directives: [],
            agents: ["SYSTEM"],
            usedAI: false,
            evolutionApplied: evoResult.totalAdjustments > 0,
        };
    },

    // ── FREE CHAT ────────────────────────────────────────
    FREE_CHAT: async (cmd, state, memory, userId) => {
        return handleFreeChat(cmd, state, memory, userId);
    },
};

// ============================================================
// FREE CHAT: AI-powered but state-grounded + shadow coach reviewed
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
        reply = `Hunter. System processing encountered resistance. Your current state: Level ${state.hunter.level}, ` +
            `Discipline ${state.hunter.disciplineScore}%, Streak ${state.hunter.streak} days. ` +
            `${state.weakHabits.length > 0 ? `Focus on: ${state.weakHabits[0]}.` : "Continue your current trajectory."} Execute.`;
    }

    // v3: Shadow coach reviews all AI responses
    const feedback = reviewConsoleResponse(reply, state);
    const agentMessages: AgentMessage[] = [msg("SYSTEM", reply)];
    const agents: AgentRole[] = ["SYSTEM"];

    if (feedback.feedback) {
        agentMessages.push(msg("SHADOW_COACH", feedback.feedback));
        agents.push("SHADOW_COACH");
    }

    return {
        messages: agentMessages,
        directives: [generateConsoleDirective("FREE_RESPONSE", { message: cmd.originalMessage })],
        agents,
        usedAI,
        shadowCoachReviewed: true,
    };
}
