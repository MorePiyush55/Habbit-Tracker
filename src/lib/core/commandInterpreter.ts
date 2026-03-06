/**
 * Command Interpreter — Natural Language → System Events
 * ========================================================
 * Translates chat messages into structured system commands.
 * This prevents AI from being asked directly — instead, the user's
 * intent is routed through the state-driven pipeline.
 *
 * Flow:
 *   User Message → interpretCommand() → SystemCommand → Brain v2 → Directive
 *
 * Supported intents:
 *   - Task queries (remaining, completed, progress)
 *   - Strategy requests (plan, strategy, schedule)
 *   - Status checks (stats, level, streak, score)
 *   - Skill queries (weak skill, training, skill graph)
 *   - Behavior analysis (how am I doing, performance, trend)
 *   - System commands (reset, help, debrief)
 *   - Free-form chat (fallback to AI reasoning)
 */

// ============================================================
// Types
// ============================================================

export type CommandType =
    | "REQUEST_REMAINING_TASKS"
    | "REQUEST_COMPLETED_TASKS"
    | "REQUEST_DAILY_STRATEGY"
    | "REQUEST_STATUS"
    | "REQUEST_SKILL_REPORT"
    | "REQUEST_BEHAVIOR_ANALYSIS"
    | "REQUEST_DEBRIEF"
    | "REQUEST_PREDICTION"
    | "REQUEST_WORKLOAD_CHECK"
    | "REQUEST_HELP"
    | "REQUEST_MOTIVATION"
    | "REQUEST_TRAINING"
    | "REQUEST_SIMULATION"
    | "REQUEST_EVOLUTION"
    | "REQUEST_KNOWLEDGE_GRAPH"
    | "REQUEST_MASTERY_REPORT"
    | "FREE_CHAT";

export interface SystemCommand {
    type: CommandType;
    confidence: number;          // 0.0 – 1.0 — how confident is the interpretation
    originalMessage: string;
    extractedEntities: {         // Any entities pulled from the message
        habitName?: string;
        skillName?: string;
        timeframe?: string;
        number?: number;
    };
    requiresAI: boolean;         // Whether AI reasoning is needed beyond rules
    agent: "SYSTEM" | "ANALYST" | "STRATEGIST" | "TUTOR" | "SHADOW_COACH";
}

// ============================================================
// Pattern definitions — ordered by specificity
// ============================================================

interface IntentPattern {
    type: CommandType;
    patterns: RegExp[];
    agent: SystemCommand["agent"];
    requiresAI: boolean;
    confidence: number;
}

const INTENT_PATTERNS: IntentPattern[] = [
    // Task queries
    {
        type: "REQUEST_REMAINING_TASKS",
        patterns: [
            /\b(remaining|left|pending|incomplete|unfinished|todo|to.?do)\b/i,
            /\bwhat('s| is| are).*(left|remaining|pending)\b/i,
            /\bhow many.*(task|quest|habit).*(left|remaining)\b/i,
            /\bshow.*(task|quest|habit)/i,
            /\btask.*(today|now)/i,
        ],
        agent: "SYSTEM",
        requiresAI: false,
        confidence: 0.90,
    },
    {
        type: "REQUEST_COMPLETED_TASKS",
        patterns: [
            /\b(completed|done|finished|accomplished)\b.*\b(task|quest|habit)/i,
            /\bwhat.*(did i|have i).*(complete|finish|do)/i,
            /\bprogress.*(today|so far)/i,
        ],
        agent: "SYSTEM",
        requiresAI: false,
        confidence: 0.88,
    },

    // Strategy
    {
        type: "REQUEST_DAILY_STRATEGY",
        patterns: [
            /\b(strategy|plan|schedule|roadmap)\b/i,
            /\bwhat should i.*(do|focus|work|train)/i,
            /\bgive me.*(plan|strategy|guidance|direction)/i,
            /\bwhat('s| is) (the|my).*(plan|strategy)/i,
            /\bnext step/i,
            /\bwhat now/i,
        ],
        agent: "STRATEGIST",
        requiresAI: true,
        confidence: 0.85,
    },

    // Status
    {
        type: "REQUEST_STATUS",
        patterns: [
            /\b(status|stats|level|xp|rank|streak|score)\b/i,
            /\bhow am i.*(doing|performing|progressing)/i,
            /\bmy (progress|performance|standing)/i,
            /\bwhere (do i|am i) stand/i,
            /\bdashboard\b/i,
        ],
        agent: "SYSTEM",
        requiresAI: false,
        confidence: 0.92,
    },

    // Skill queries
    {
        type: "REQUEST_SKILL_REPORT",
        patterns: [
            /\b(skill|knowledge|proficiency|competency)\b/i,
            /\bweak(est|ness|nesses)\b/i,
            /\bstrong(est|ness)\b/i,
            /\btrain(ing)?\b.*\b(need|recommend|suggest)/i,
            /\bwhat.*(improve|learn|study|practice)/i,
        ],
        agent: "TUTOR",
        requiresAI: false,
        confidence: 0.85,
    },

    // Behavior analysis
    {
        type: "REQUEST_BEHAVIOR_ANALYSIS",
        patterns: [
            /\b(behavior|behaviour|pattern|habit|trend|analysis|analyze|analyse)\b/i,
            /\bhow.*(performing|trending|doing).*(week|month|lately|recently)/i,
            /\b(consistency|discipline|focus)\b.*\b(score|report|check)/i,
            /\bwhat('s| is).*(wrong|issue|problem)/i,
        ],
        agent: "ANALYST",
        requiresAI: true,
        confidence: 0.82,
    },

    // Debrief
    {
        type: "REQUEST_DEBRIEF",
        patterns: [
            /\b(debrief|summary|recap|review|report)\b/i,
            /\bend of day\b/i,
            /\bdaily (report|review|summary)/i,
        ],
        agent: "ANALYST",
        requiresAI: true,
        confidence: 0.88,
    },

    // Prediction
    {
        type: "REQUEST_PREDICTION",
        patterns: [
            /\b(predict|forecast|project|simulate|future)\b/i,
            /\bwhat (will|would).*(happen|be|look)/i,
            /\bif i (continue|keep|maintain)/i,
            /\b(30|thirty).?day/i,
            /\bwhere.*(will|would) i (be|end)/i,
        ],
        agent: "ANALYST",
        requiresAI: false,
        confidence: 0.85,
    },

    // Workload
    {
        type: "REQUEST_WORKLOAD_CHECK",
        patterns: [
            /\b(workload|load|overload|burnout|too much|overwhelm)/i,
            /\b(can i|should i).*(handle|manage|do)/i,
            /\bhow much.*(can|should)/i,
            /\b(tired|exhausted|struggling|burned out)/i,
            /\breduce.*(task|work|load)/i,
        ],
        agent: "SHADOW_COACH",
        requiresAI: false,
        confidence: 0.80,
    },

    // Help
    {
        type: "REQUEST_HELP",
        patterns: [
            /\b(help|commands?|what can you|how to|guide)\b/i,
            /\bwhat (do|can) you (do|know|understand)/i,
        ],
        agent: "SYSTEM",
        requiresAI: false,
        confidence: 0.95,
    },

    // Motivation
    {
        type: "REQUEST_MOTIVATION",
        patterns: [
            /\b(motivat|inspir|encourag|push me|i (need|want) (to|a) (push|boost))/i,
            /\bi('m| am) (feeling|unmotivat|lazy|stuck)/i,
            /\bgive me (a reason|strength)/i,
        ],
        agent: "SYSTEM",
        requiresAI: true,
        confidence: 0.78,
    },
    // Training / Test
    {
        type: "REQUEST_TRAINING",
        patterns: [
            /\b(test|quiz|drill|exam|assess|practice)\b.*\b(me|my|skill|knowledge)\b/i,
            /\b(generate|give|create).*(question|test|quiz)/i,
            /\btrain me\b/i,
        ],
        agent: "TUTOR",
        requiresAI: true,
        confidence: 0.85,
    },

    // Simulation
    {
        type: "REQUEST_SIMULATION",
        patterns: [
            /\b(simulat|what if|scenario|project)\b/i,
            /\bimproved strategy\b/i,
            /\bcompare.*(current|future|projection)/i,
        ],
        agent: "ANALYST",
        requiresAI: false,
        confidence: 0.82,
    },

    // Evolution
    {
        type: "REQUEST_EVOLUTION",
        patterns: [
            /\b(evolution|evolve|self.?learn|adapt|parameter|rule.?update)\b/i,
            /\bhow.*(system|ai).*(learn|adapt|evolv)/i,
            /\bsystem rule/i,
        ],
        agent: "SYSTEM",
        requiresAI: false,
        confidence: 0.80,
    },

    // Knowledge Graph
    {
        type: "REQUEST_KNOWLEDGE_GRAPH",
        patterns: [
            /\b(knowledge|graph|topic|concept|cluster)\b.*\b(map|tree|graph|view|show)\b/i,
            /\bwhat.*(know|learned|studied|topics)/i,
            /\bknowledge.*(graph|map|tree)/i,
            /\blearning.*(path|map|graph)/i,
            /\bweak.*(cluster|topic|area|knowledge)/i,
        ],
        agent: "TUTOR",
        requiresAI: false,
        confidence: 0.82,
    },

    // Mastery Report
    {
        type: "REQUEST_MASTERY_REPORT",
        patterns: [
            /\b(mastery|master)\b/i,
            /\bskill.*(mastery|level|progress|growth)/i,
            /\bhow.*(mastered|mastery|skilled)/i,
            /\b(decay|declining|rust).*(skill|knowledge)/i,
        ],
        agent: "TUTOR",
        requiresAI: false,
        confidence: 0.83,
    },];

// ============================================================
// CORE: Interpret a chat message into a system command
// ============================================================

// ============================================================
// SLASH COMMANDS — Direct command mapping
// ============================================================

const SLASH_COMMANDS: Record<string, {
    type: CommandType;
    agent: SystemCommand["agent"];
    requiresAI: boolean;
}> = {
    "/tasks":     { type: "REQUEST_REMAINING_TASKS", agent: "SYSTEM", requiresAI: false },
    "/completed": { type: "REQUEST_COMPLETED_TASKS", agent: "SYSTEM", requiresAI: false },
    "/progress":  { type: "REQUEST_STATUS", agent: "SYSTEM", requiresAI: false },
    "/status":    { type: "REQUEST_STATUS", agent: "SYSTEM", requiresAI: false },
    "/strategy":  { type: "REQUEST_DAILY_STRATEGY", agent: "STRATEGIST", requiresAI: true },
    "/plan":      { type: "REQUEST_DAILY_STRATEGY", agent: "STRATEGIST", requiresAI: true },
    "/skills":    { type: "REQUEST_SKILL_REPORT", agent: "TUTOR", requiresAI: false },
    "/analyze":   { type: "REQUEST_BEHAVIOR_ANALYSIS", agent: "ANALYST", requiresAI: true },
    "/analyse":   { type: "REQUEST_BEHAVIOR_ANALYSIS", agent: "ANALYST", requiresAI: true },
    "/debrief":   { type: "REQUEST_DEBRIEF", agent: "ANALYST", requiresAI: true },
    "/predict":   { type: "REQUEST_PREDICTION", agent: "ANALYST", requiresAI: false },
    "/simulate":  { type: "REQUEST_SIMULATION", agent: "ANALYST", requiresAI: false },
    "/workload":  { type: "REQUEST_WORKLOAD_CHECK", agent: "SHADOW_COACH", requiresAI: false },
    "/test":      { type: "REQUEST_TRAINING", agent: "TUTOR", requiresAI: true },
    "/train":     { type: "REQUEST_TRAINING", agent: "TUTOR", requiresAI: true },
    "/evolve":    { type: "REQUEST_EVOLUTION", agent: "SYSTEM", requiresAI: false },
    "/help":      { type: "REQUEST_HELP", agent: "SYSTEM", requiresAI: false },
    "/motivate":  { type: "REQUEST_MOTIVATION", agent: "SYSTEM", requiresAI: true },
    "/knowledge": { type: "REQUEST_KNOWLEDGE_GRAPH", agent: "TUTOR", requiresAI: false },
    "/graph":     { type: "REQUEST_KNOWLEDGE_GRAPH", agent: "TUTOR", requiresAI: false },
    "/mastery":   { type: "REQUEST_MASTERY_REPORT", agent: "TUTOR", requiresAI: false },
};

export function interpretCommand(message: string): SystemCommand {
    const trimmed = message.trim();

    // Extract entities before pattern matching
    const entities = extractEntities(trimmed);

    // Step 0: Check for slash commands (highest priority)
    const slashWord = trimmed.split(/\s+/)[0].toLowerCase();
    if (slashWord.startsWith("/") && SLASH_COMMANDS[slashWord]) {
        const slash = SLASH_COMMANDS[slashWord];
        return {
            type: slash.type,
            confidence: 1.0,
            originalMessage: trimmed,
            extractedEntities: entities,
            requiresAI: slash.requiresAI,
            agent: slash.agent,
        };
    }

    // Step 1: Match against NL patterns — highest confidence wins
    let bestMatch: {
        type: CommandType;
        confidence: number;
        agent: SystemCommand["agent"];
        requiresAI: boolean;
    } | null = null;

    for (const intent of INTENT_PATTERNS) {
        for (const pattern of intent.patterns) {
            if (pattern.test(trimmed)) {
                if (!bestMatch || intent.confidence > bestMatch.confidence) {
                    bestMatch = {
                        type: intent.type,
                        confidence: intent.confidence,
                        agent: intent.agent,
                        requiresAI: intent.requiresAI,
                    };
                }
                break;
            }
        }
    }

    // Fallback: free chat (AI reasoning)
    if (!bestMatch) {
        return {
            type: "FREE_CHAT",
            confidence: 0.5,
            originalMessage: trimmed,
            extractedEntities: entities,
            requiresAI: true,
            agent: "SYSTEM",
        };
    }

    return {
        type: bestMatch.type,
        confidence: bestMatch.confidence,
        originalMessage: trimmed,
        extractedEntities: entities,
        requiresAI: bestMatch.requiresAI,
        agent: bestMatch.agent,
    };
}

// ============================================================
// Entity extraction — pull structured data from messages
// ============================================================

function extractEntities(message: string): SystemCommand["extractedEntities"] {
    const entities: SystemCommand["extractedEntities"] = {};

    // Extract numbers
    const numberMatch = message.match(/\b(\d+)\b/);
    if (numberMatch) {
        entities.number = parseInt(numberMatch[1], 10);
    }

    // Extract timeframe
    const timeframes = [
        { pattern: /\btoday\b/i, value: "today" },
        { pattern: /\byesterday\b/i, value: "yesterday" },
        { pattern: /\bthis week\b/i, value: "this_week" },
        { pattern: /\blast week\b/i, value: "last_week" },
        { pattern: /\bthis month\b/i, value: "this_month" },
        { pattern: /\b(\d+)\s*days?\b/i, value: "custom_days" },
    ];
    for (const tf of timeframes) {
        if (tf.pattern.test(message)) {
            entities.timeframe = tf.value;
            break;
        }
    }

    return entities;
}

// ============================================================
// HELP: Return available commands
// ============================================================

export function getAvailableCommands(): string {
    return `SYSTEM CONSOLE — Available Commands

Slash Commands:
  /tasks      → View pending tasks
  /completed  → View completed tasks
  /progress   → Hunter status overview
  /strategy   → Get daily training plan
  /skills     → Skill proficiency report
  /analyze    → Behavior analysis (30-day)
  /debrief    → End-of-day mission summary
  /predict    → 30-day performance projection
  /simulate   → Life simulation with scenarios
  /workload   → Cognitive load assessment
  /test       → Generate skill training question
  /evolve     → View system evolution parameters
  /motivate   → System motivational push
  /knowledge  → Personal Knowledge Graph
  /graph      → Knowledge cluster map
  /mastery    → Skill mastery report with trends
  /help       → This command list

Natural Language:
  "What tasks are remaining?" → View pending tasks
  "How am I performing?" → Behavior analysis
  "Am I overloaded?" → Workload assessment
  "Test me on cryptography" → Skill drill
  "Show me my knowledge graph" → Knowledge map
  "What's my mastery?" → Skill mastery report

Or ask anything — the System will respond.`;
}
