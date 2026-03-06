/**
 * Observability — System Metrics & Health Tracking
 * ===================================================
 * Tracks internal metrics for system evolution:
 *   - AI decision frequency & accuracy
 *   - Directive success rate
 *   - Completion improvement over time
 *   - AI error rate
 *   - Event processing latency
 *   - System health score
 *
 * Uses in-memory counters + periodic flush to System Memory.
 */

import { incrementMetrics, recallMemory } from "./systemMemory";
import type { MemorySnapshot } from "./systemMemory";

// ============================================================
// Types
// ============================================================

export interface SystemMetrics {
    // Counters (current session)
    eventsProcessed: number;
    directivesExecuted: number;
    directivesRejected: number;
    aiCallsSuccess: number;
    aiCallsFailed: number;
    aiResponseTime: number[];     // Array of ms values
    qualityCheckPassed: number;
    qualityCheckFailed: number;

    // Computed
    aiSuccessRate: number;        // 0-100%
    avgAIResponseTime: number;    // ms
    directiveApprovalRate: number;// 0-100%
    qualityPassRate: number;      // 0-100%
}

export interface SystemHealthReport {
    overall: "healthy" | "degraded" | "critical";
    score: number;  // 0-100
    components: {
        name: string;
        status: "ok" | "warning" | "error";
        detail: string;
    }[];
    uptime: number; // seconds since tracker init
    lastUpdated: string;
}

// ============================================================
// IN-MEMORY COUNTERS (per-process, reset on restart)
// ============================================================

const sessionMetrics: SystemMetrics = {
    eventsProcessed: 0,
    directivesExecuted: 0,
    directivesRejected: 0,
    aiCallsSuccess: 0,
    aiCallsFailed: 0,
    aiResponseTime: [],
    qualityCheckPassed: 0,
    qualityCheckFailed: 0,
    aiSuccessRate: 100,
    avgAIResponseTime: 0,
    directiveApprovalRate: 100,
    qualityPassRate: 100,
};

const sessionStart = Date.now();

// ============================================================
// TRACK: Record individual metric events
// ============================================================

export function trackEvent(): void {
    sessionMetrics.eventsProcessed++;
}

export function trackDirective(approved: boolean): void {
    if (approved) {
        sessionMetrics.directivesExecuted++;
    } else {
        sessionMetrics.directivesRejected++;
    }
    recalcRates();
}

export function trackAICall(success: boolean, responseTimeMs?: number): void {
    if (success) {
        sessionMetrics.aiCallsSuccess++;
    } else {
        sessionMetrics.aiCallsFailed++;
    }
    if (responseTimeMs !== undefined) {
        sessionMetrics.aiResponseTime.push(responseTimeMs);
        // Keep only last 100 measurements
        if (sessionMetrics.aiResponseTime.length > 100) {
            sessionMetrics.aiResponseTime = sessionMetrics.aiResponseTime.slice(-100);
        }
    }
    recalcRates();
}

export function trackQualityCheck(passed: boolean): void {
    if (passed) {
        sessionMetrics.qualityCheckPassed++;
    } else {
        sessionMetrics.qualityCheckFailed++;
    }
    recalcRates();
}

// ============================================================
// GET: Return current session metrics
// ============================================================

export function getSessionMetrics(): SystemMetrics {
    recalcRates();
    return { ...sessionMetrics };
}

// ============================================================
// HEALTH: Generate system health report
// ============================================================

export function getSystemHealth(): SystemHealthReport {
    recalcRates();

    const components: SystemHealthReport["components"] = [];

    // AI Health
    const aiRate = sessionMetrics.aiSuccessRate;
    components.push({
        name: "AI Service",
        status: aiRate >= 90 ? "ok" : aiRate >= 70 ? "warning" : "error",
        detail: `${aiRate.toFixed(0)}% success rate | Avg response: ${sessionMetrics.avgAIResponseTime.toFixed(0)}ms`,
    });

    // Directive Health
    const dirRate = sessionMetrics.directiveApprovalRate;
    components.push({
        name: "Decision Engine",
        status: dirRate >= 80 ? "ok" : dirRate >= 60 ? "warning" : "error",
        detail: `${dirRate.toFixed(0)}% approval rate | ${sessionMetrics.directivesExecuted} executed`,
    });

    // Quality Control
    const qcRate = sessionMetrics.qualityPassRate;
    components.push({
        name: "Quality Control",
        status: qcRate >= 80 ? "ok" : qcRate >= 60 ? "warning" : "error",
        detail: `${qcRate.toFixed(0)}% pass rate`,
    });

    // Event Processing
    components.push({
        name: "Event Bus",
        status: sessionMetrics.eventsProcessed > 0 ? "ok" : "warning",
        detail: `${sessionMetrics.eventsProcessed} events processed this session`,
    });

    // Overall health
    const healthScores = components.map((c) =>
        c.status === "ok" ? 100 : c.status === "warning" ? 60 : 20
    );
    const overallScore = Math.round(
        healthScores.reduce((a, b) => a + b, 0) / healthScores.length
    );

    const overall: "healthy" | "degraded" | "critical" =
        overallScore >= 80 ? "healthy" : overallScore >= 50 ? "degraded" : "critical";

    return {
        overall,
        score: overallScore,
        components,
        uptime: Math.floor((Date.now() - sessionStart) / 1000),
        lastUpdated: new Date().toISOString(),
    };
}

// ============================================================
// FLUSH: Persist session metrics to System Memory (periodic)
// ============================================================

export async function flushMetrics(userId: string): Promise<void> {
    try {
        if (sessionMetrics.aiCallsSuccess + sessionMetrics.aiCallsFailed > 0) {
            await incrementMetrics(userId, "totalAICalls", sessionMetrics.aiCallsSuccess + sessionMetrics.aiCallsFailed);
        }
        if (sessionMetrics.aiCallsFailed > 0) {
            await incrementMetrics(userId, "aiErrorCount", sessionMetrics.aiCallsFailed);
        }
        if (sessionMetrics.directivesExecuted > 0) {
            await incrementMetrics(userId, "totalDirectivesExecuted", sessionMetrics.directivesExecuted);
        }
        if (sessionMetrics.eventsProcessed > 0) {
            await incrementMetrics(userId, "totalEventsProcessed", sessionMetrics.eventsProcessed);
        }
    } catch {
        // Non-fatal
    }
}

// ============================================================
// REPORT: Full metrics report combining session + persistent
// ============================================================

export async function getFullMetricsReport(userId: string): Promise<{
    session: SystemMetrics;
    persistent: MemorySnapshot["metrics"];
    health: SystemHealthReport;
}> {
    const memory = await recallMemory(userId);

    return {
        session: getSessionMetrics(),
        persistent: memory.metrics,
        health: getSystemHealth(),
    };
}

// ============================================================
// INTERNAL: Recalculate derived rates
// ============================================================

function recalcRates(): void {
    const totalAI = sessionMetrics.aiCallsSuccess + sessionMetrics.aiCallsFailed;
    sessionMetrics.aiSuccessRate = totalAI > 0
        ? (sessionMetrics.aiCallsSuccess / totalAI) * 100
        : 100;

    sessionMetrics.avgAIResponseTime = sessionMetrics.aiResponseTime.length > 0
        ? sessionMetrics.aiResponseTime.reduce((a, b) => a + b, 0) / sessionMetrics.aiResponseTime.length
        : 0;

    const totalDir = sessionMetrics.directivesExecuted + sessionMetrics.directivesRejected;
    sessionMetrics.directiveApprovalRate = totalDir > 0
        ? (sessionMetrics.directivesExecuted / totalDir) * 100
        : 100;

    const totalQC = sessionMetrics.qualityCheckPassed + sessionMetrics.qualityCheckFailed;
    sessionMetrics.qualityPassRate = totalQC > 0
        ? (sessionMetrics.qualityCheckPassed / totalQC) * 100
        : 100;
}
