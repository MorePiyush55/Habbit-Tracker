/**
 * AI Discipline OS — Core Module Index
 * ======================================
 * This is the central nervous system of the application.
 *
 * Architecture (v6 — Knowledge Graph + Skill Mastery Engine):
 *
 *   User / Console / Scheduler
 *        ↓
 *   Command Interpreter (NL + 20 slash commands)
 *        ↓
 *   System Brain v3 (autonomous orchestrator)
 *        ↓
 *   Decision Engine + Constraint Layers:
 *     • Evolution Engine (self-evolving rules)
 *     • Shadow Coach (reviews ALL outputs)
 *     • Cognitive Optimizer (workload caps)
 *     • Action Planner (tactical directives)
 *        ↓
 *   AI Modules:
 *     • behaviorAnalyzer   • lifeSimulator
 *     • trainingEngine     • strategyGenerator
 *     • brainController    • personalityLayer
 *     • actionPlanner      • contextBuilder (profile-aware)
 *     • knowledgeGraph     • skillMasteryEngine
 *        ↓
 *   Directive Generator → Directive Formatter
 *        ↓
 *   Multi-Agent Response → UI / Notifications
 *
 *   Scheduler (autonomous) → Brain v3 autonomous events
 *   Hunter Profile → Context Builder → AI prompts
 *   Knowledge Graph → Learning Paths → Strategy
 *   Skill Mastery → Decay Detection → Alerts
 *
 * Total modules: 27
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

// Brain v2 — Legacy orchestrator (kept for reference)
export { processCommand as processCommandV2 } from "./systemBrainV2";
export type { BrainV2Response } from "./systemBrainV2";

// Brain v3 — Autonomous orchestrator (active)
export { processCommand, processAutonomousEvent } from "./systemBrainV3";
export type { BrainV3Response, AgentMessage, AgentRole } from "./systemBrainV3";

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
export { runScheduledChecks, runBatchScheduledChecks, generateAutonomousAlerts, getUnseenAlerts } from "./systemScheduler";
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

// Action Planner — Tactical directive generator (v4)
export { generateActionPlan, formatActionPlan } from "./actionPlanner";
export type { ActionPlan, ActionItem, HunterProfileData } from "./actionPlanner";

// Knowledge Graph — Personal Knowledge Graph (PKG)
export { buildGraphSnapshot, generateLearningPath, getWeakClusters, upsertNode, bulkUpsertNodes, getAllNodes, getRelatedTopics, formatGraphForContext, formatLearningPath, formatClusterDetail } from "./knowledgeGraph";
export type { KnowledgeNodeData, KnowledgeCluster, KnowledgeGraphSnapshot, LearningPathStep } from "./knowledgeGraph";

// Skill Mastery Engine — Skill Mastery Tracking Engine (SMTE)
export { getSkillMasteryReport, getWeakestSkills, getDecliningSkills, updateSkillFromTask, updateSkillFromQuiz, checkDecay, ensureSkill, formatSkillMasteryContext, formatSkillMasteryCompact } from "./skillMasteryEngine";
export type { SkillMasteryData, SkillMasteryReport, MasteryUpdateResult, DecayCheckResult } from "./skillMasteryEngine";
