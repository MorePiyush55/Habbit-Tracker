/**
 * AI Discipline OS — Core Module Index
 * ======================================
 * This is the central nervous system of the application.
 *
 * Architecture:
 *   User Actions → Event Bus → System State → Brain Controller → Directives → Executor
 *
 * Components:
 *   - systemState.ts      — Central state builder (one call, complete picture)
 *   - eventBus.ts         — Event emission and routing
 *   - brainController.ts  — Decision engine (rules + AI)
 *   - directiveExecutor.ts — Executes brain decisions
 *   - behaviorAnalyzer.ts — Deep 30-day analysis
 *   - trainingEngine.ts   — Skill testing flow
 *   - strategyGenerator.ts — Daily strategy production
 */

// Central State
export { buildSystemState, getQuickState } from "./systemState";

// Event Bus — The heartbeat
export { emit, emitBatch, emitSilent, createEvent, SystemEvents } from "./eventBus";

// Brain Controller — The intelligence
export { processBrainEvent } from "./brainController";

// Directive Executor — The executor
export { executeDirectives } from "./directiveExecutor";

// Behavior Analyzer — The memory
export { analyzeBehavior } from "./behaviorAnalyzer";
export type { BehaviorInsight } from "./behaviorAnalyzer";

// Training Engine — The teacher
export { generateQuestion, gradeAnswer, detectWeakestSkill, getTrainingRecommendations } from "./trainingEngine";
export type { TrainingQuestion, GradeResult } from "./trainingEngine";

// Strategy Generator — The planner
export { generateDailyStrategy } from "./strategyGenerator";
export type { DailyStrategy } from "./strategyGenerator";
