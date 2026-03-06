/**
 * AI Discipline OS — Core Module Index
 * ======================================
 * This is the central nervous system of the application.
 *
 * Architecture (v2 — Autonomous):
 *   User Actions → Event Bus → System State + Memory → Brain Controller
 *        → Decision Engine → Directive Executor → Personality Layer → UI
 *
 *   Scheduler (autonomous) → Event Bus → ... (same pipeline)
 *
 * Components:
 *   - systemState.ts        — Central state builder (one call, complete picture)
 *   - systemMemory.ts       — Persistent intelligence layer (weekly insights, caches, metrics)
 *   - eventBus.ts           — Event emission and routing
 *   - brainController.ts    — Decision engine (rules + AI)
 *   - decisionEngine.ts     — Directive evaluation, scoring, conflict resolution
 *   - directiveExecutor.ts  — Executes brain decisions
 *   - interventionEngine.ts — Escalating system response (warning → penalty → training → difficulty↓)
 *   - behaviorAnalyzer.ts   — Deep 30-day analysis
 *   - trainingEngine.ts     — Skill testing flow
 *   - skillGraph.ts         — Knowledge graph for skill relationships
 *   - strategyGenerator.ts  — Daily strategy production (with cache)
 *   - contextBuilder.ts     — Structured AI prompt context
 *   - personalityLayer.ts   — Consistent System voice
 *   - qualityControl.ts     — AI response validation
 *   - observability.ts      — System metrics & health tracking
 *   - systemScheduler.ts    — Autonomous background checks
 */

// Central State
export { buildSystemState, getQuickState } from "./systemState";

// System Memory — Persistent intelligence
export { recallMemory, rememberDecision, refreshWeeklyInsights, storeStrategy, storeIntervention, updateSkillGraph, incrementMetrics, shouldRefreshWeekly, getCachedStrategy } from "./systemMemory";
export type { MemorySnapshot } from "./systemMemory";

// Event Bus — The heartbeat
export { emit, emitBatch, emitSilent, createEvent, SystemEvents } from "./eventBus";

// Brain Controller — The intelligence
export { processBrainEvent } from "./brainController";

// Decision Engine — Reasoning before action
export { evaluateDirectives } from "./decisionEngine";
export type { EvaluatedDirective, DecisionResult } from "./decisionEngine";

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
