/**
 * AI Discipline OS — Core Module Index
 * ======================================
 * This is the central nervous system of the application.
 *
 * Architecture (v3 — Brain v2 + Multi-Agent Console):
 *
 *   User / Console
 *        ↓
 *   Command Interpreter
 *        ↓
 *   System Brain v2 (orchestrator)
 *        ↓
 *   Decision Engine (rule vs AI vs cache routing)
 *        ↓
 *   AI Modules:
 *     • behaviorAnalyzer   • evolutionEngine
 *     • shadowCoach        • lifeSimulator
 *     • cognitiveOptimizer • brainController
 *        ↓
 *   Directive Generator → Directive Formatter
 *        ↓
 *   Directive Executor → UI / Notifications
 *
 *   Event Bus → System State + Memory → Brain → Directives → Execute
 *   Scheduler (autonomous) → Event Bus → ... (same pipeline)
 *
 * Total modules: 23
 */

// Central State
export { buildSystemState, getQuickState } from "./systemState";

// System Memory — Persistent intelligence
export { recallMemory, rememberDecision, refreshWeeklyInsights, storeStrategy, storeIntervention, updateSkillGraph, incrementMetrics, shouldRefreshWeekly, getCachedStrategy } from "./systemMemory";
export type { MemorySnapshot } from "./systemMemory";

// Event Bus — The heartbeat
export { emit, emitBatch, emitSilent, createEvent, SystemEvents } from "./eventBus";

// Brain Controller (v1) — The intelligence
export { processBrainEvent } from "./brainController";

// Brain v2 — Central orchestrator
export { processCommand } from "./systemBrainV2";
export type { BrainV2Response, AgentMessage, AgentRole } from "./systemBrainV2";

// Command Interpreter — NL → system events
export { interpretCommand, getAvailableCommands } from "./commandInterpreter";
export type { SystemCommand, CommandType } from "./commandInterpreter";

// Decision Engine — Reasoning before action
export { evaluateDirectives, routeDecision } from "./decisionEngine";
export type { EvaluatedDirective, DecisionResult, DecisionPath, RoutingDecision } from "./decisionEngine";

// Directive Generator — Structured actions
export { generateConsoleDirective } from "./directiveGenerator";
export type { ConsoleDirective, ConsoleDirectiveType } from "./directiveGenerator";

// Directive Formatter — System personality on directives
export { formatDirective } from "./directiveFormatter";

// Directive Executor — The executor
export { executeDirectives } from "./directiveExecutor";

// Intervention Engine — Escalating response
export { evaluateIntervention } from "./interventionEngine";
export type { InterventionDecision } from "./interventionEngine";

// Behavior Analyzer — The memory
export { analyzeBehavior } from "./behaviorAnalyzer";
export type { BehaviorInsight } from "./behaviorAnalyzer";

// Training Engine — The teacher
export { generateQuestion, gradeAnswer, detectWeakestSkill, getTrainingRecommendations } from "./trainingEngine";
export type { TrainingQuestion, GradeResult } from "./trainingEngine";

// Skill Graph — Knowledge relationships
export { buildSkillGraph, findWeakestSkillInGraph, getRelatedSkills } from "./skillGraph";
export type { SkillGraph, SkillGraphNode, SkillRecommendation } from "./skillGraph";

// Strategy Generator — The planner (with cache)
export { generateDailyStrategy } from "./strategyGenerator";
export type { DailyStrategy } from "./strategyGenerator";

// Context Builder — Structured AI prompts
export { buildAIContext } from "./contextBuilder";
export type { AIContext } from "./contextBuilder";

// Personality Layer — Consistent System voice
export { getSystemPrompt, determinePersonalityMode, formatSystemResponse, formatSystemNotification } from "./personalityLayer";
export type { PersonalityMode, FormattedResponse } from "./personalityLayer";

// Quality Control — AI response validation
export { validateAIResponse, validateOrFallback, getFallbackResponse } from "./qualityControl";
export type { QualityResult } from "./qualityControl";

// Observability — Metrics & health
export { trackEvent, trackDirective, trackAICall, trackQualityCheck, getSessionMetrics, getSystemHealth, flushMetrics, getFullMetricsReport } from "./observability";
export type { SystemMetrics, SystemHealthReport } from "./observability";

// Scheduler — Autonomous mode
export { runScheduledChecks, runBatchScheduledChecks } from "./systemScheduler";
export type { SchedulerResult, BatchSchedulerResult } from "./systemScheduler";

// Evolution Engine — AI self-improvement
export { evolveStrategy, getStoredParams } from "./evolutionEngine";
export type { EvolutionResult, EvolutionRule, StrategyParameters } from "./evolutionEngine";

// Shadow Coach — Dual brain directive critic
export { reviewStrategy, reviewConsoleResponse } from "./shadowCoach";
export type { CoachReview, CoachAdjustment } from "./shadowCoach";

// Life Simulator — Future projection
export { simulateFuture } from "./lifeSimulator";
export type { FutureProjection } from "./lifeSimulator";

// Cognitive Optimizer — Workload intelligence
export { assessCognitiveLoad } from "./cognitiveOptimizer";
export type { CognitiveAssessment, TaskRecommendation } from "./cognitiveOptimizer";
