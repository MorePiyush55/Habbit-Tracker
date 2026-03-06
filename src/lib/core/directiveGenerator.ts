/**
 * Directive Generator — Structured Action Producer
 * ==================================================
 * Creates structured console directives from Brain v2 decisions.
 * These are NOT the same as SystemDirectives (which are for the event bus).
 * Console directives represent responses to console commands.
 *
 * Flow:
 *   Brain v2 → generateConsoleDirective() → ConsoleDirective → Formatter → UI
 */

// ============================================================
// Types
// ============================================================

export type ConsoleDirectiveType =
    | "SHOW_REMAINING_TASKS"
    | "SHOW_COMPLETED_TASKS"
    | "SHOW_STRATEGY"
    | "SHOW_STATUS"
    | "SHOW_SKILL_REPORT"
    | "SHOW_BEHAVIOR_ANALYSIS"
    | "SHOW_DEBRIEF"
    | "SHOW_PREDICTION"
    | "SHOW_WORKLOAD"
    | "SHOW_HELP"
    | "SHOW_MOTIVATION"
    | "FREE_RESPONSE";

export interface ConsoleDirective {
    type: ConsoleDirectiveType;
    data: Record<string, any>;
    timestamp: string;
}

// ============================================================
// CORE: Generate a console directive
// ============================================================

export function generateConsoleDirective(
    type: ConsoleDirectiveType,
    data: Record<string, any>
): ConsoleDirective {
    return {
        type,
        data,
        timestamp: new Date().toISOString(),
    };
}
