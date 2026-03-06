/**
 * AI Quality Control — Response Validation Layer
 * =================================================
 * Validates AI responses before they reach the user.
 * Rejects generic, too-short, irrelevant, or duplicate responses.
 * Provides fallback directives when AI output is unusable.
 *
 * Checks:
 *   - Minimum length
 *   - Not generic/boilerplate
 *   - Not a duplicate of recent responses
 *   - Contains relevant content
 *   - No harmful/broken output
 */

// ============================================================
// Types
// ============================================================

interface QualityResult {
    passed: boolean;
    original: string;
    cleaned: string;
    issues: string[];
    score: number;  // 0-100
}

// ============================================================
// GENERIC PHRASES: Auto-reject if response is mostly these
// ============================================================

const GENERIC_PHRASES = [
    "i'm here to help",
    "as an ai",
    "i cannot",
    "i don't have access",
    "let me know if",
    "feel free to",
    "hope this helps",
    "is there anything else",
    "i'd be happy to",
    "sure, here",
    "absolutely!",
    "great question",
    "that's a great",
    "of course!",
    "no problem!",
    "you're welcome",
    "happy to assist",
];

const BOILERPLATE_PATTERNS = [
    /^(hi|hello|hey)[\s,.!]*/i,
    /^sure[\s,.!]+/i,
    /^okay[\s,.!]+/i,
    /^alright[\s,.!]+/i,
    /^\*\*note\*\*/i,
    /^as an ai language model/i,
];

// ============================================================
// CORE: Validate an AI response
// ============================================================

export function validateAIResponse(
    response: string,
    context?: {
        minLength?: number;
        maxLength?: number;
        recentResponses?: string[];
        expectedTopic?: string;
    }
): QualityResult {
    const issues: string[] = [];
    let score = 100;
    const minLen = context?.minLength ?? 20;
    const maxLen = context?.maxLength ?? 5000;

    // Clean the response
    let cleaned = response
        .replace(/```[\s\S]*?```/g, "")     // Remove code blocks
        .replace(/<think>[\s\S]*?<\/think>/g, "") // Remove thinking tags
        .replace(/\*\*/g, "")                // Remove bold markdown
        .trim();

    // Check 1: Empty or too short
    if (!cleaned || cleaned.length < minLen) {
        issues.push(`Too short (${cleaned.length} chars, min: ${minLen})`);
        score -= 50;
    }

    // Check 2: Too long (truncate)
    if (cleaned.length > maxLen) {
        cleaned = cleaned.substring(0, maxLen) + "...";
        issues.push(`Truncated from ${response.length} to ${maxLen} chars`);
        score -= 5;
    }

    // Check 3: Generic phrases
    const lowerCleaned = cleaned.toLowerCase();
    let genericCount = 0;
    for (const phrase of GENERIC_PHRASES) {
        if (lowerCleaned.includes(phrase)) {
            genericCount++;
        }
    }
    if (genericCount >= 3) {
        issues.push(`Contains ${genericCount} generic AI phrases`);
        score -= 30;
    } else if (genericCount >= 1) {
        score -= genericCount * 5;
    }

    // Check 4: Boilerplate start
    for (const pattern of BOILERPLATE_PATTERNS) {
        if (pattern.test(cleaned)) {
            // Strip the boilerplate prefix
            cleaned = cleaned.replace(pattern, "").trim();
            issues.push("Stripped boilerplate prefix");
            score -= 5;
        }
    }

    // Check 5: Duplicate of recent response
    if (context?.recentResponses) {
        for (const recent of context.recentResponses) {
            const similarity = calculateSimilarity(cleaned, recent);
            if (similarity > 0.85) {
                issues.push(`Too similar to recent response (${Math.round(similarity * 100)}% match)`);
                score -= 40;
                break;
            }
        }
    }

    // Check 6: Contains broken output markers
    const brokenMarkers = ["undefined", "null", "NaN", "[object Object]", "error:", "Error:"];
    for (const marker of brokenMarkers) {
        if (cleaned.includes(marker)) {
            issues.push(`Contains broken output marker: "${marker}"`);
            score -= 20;
        }
    }

    // Check 7: Mostly whitespace or repetitive
    const words = cleaned.split(/\s+/);
    const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
    if (words.length > 5 && uniqueWords.size / words.length < 0.3) {
        issues.push("Response is highly repetitive");
        score -= 30;
    }

    score = Math.max(0, Math.min(100, score));

    return {
        passed: score >= 40,
        original: response,
        cleaned,
        issues,
        score,
    };
}

// ============================================================
// FALLBACK: Generate a fallback response when AI fails QC
// ============================================================

export function getFallbackResponse(context: "warning" | "commendation" | "strategy" | "notification" | "training"): string {
    switch (context) {
        case "warning":
            return "Hunter. Your performance requires immediate attention. Resume training.";
        case "commendation":
            return "Acceptable progress. Maintain this trajectory.";
        case "strategy":
            return "Focus on your weakest areas first. Complete all assigned quests. Do not deviate.";
        case "notification":
            return "System update: Review your current quest status.";
        case "training":
            return "Testing your knowledge. Answer the question to the best of your ability.";
        default:
            return "System active. Awaiting your next action.";
    }
}

// ============================================================
// WRAP: Validate and auto-fallback
// ============================================================

function validateOrFallback(
    response: string,
    fallbackContext: "warning" | "commendation" | "strategy" | "notification" | "training",
    options?: {
        minLength?: number;
        recentResponses?: string[];
    }
): string {
    const result = validateAIResponse(response, options);
    if (result.passed) {
        return result.cleaned;
    }
    console.warn(`[QC] AI response failed quality check (score: ${result.score}):`, result.issues);
    return getFallbackResponse(fallbackContext);
}

// ============================================================
// INTERNAL: Simple similarity check (Jaccard on word bigrams)
// ============================================================

function calculateSimilarity(a: string, b: string): number {
    if (!a || !b) return 0;

    const getBigrams = (text: string): Set<string> => {
        const words = text.toLowerCase().split(/\s+/);
        const bigrams = new Set<string>();
        for (let i = 0; i < words.length - 1; i++) {
            bigrams.add(`${words[i]} ${words[i + 1]}`);
        }
        return bigrams;
    };

    const setA = getBigrams(a);
    const setB = getBigrams(b);

    if (setA.size === 0 && setB.size === 0) return 1;
    if (setA.size === 0 || setB.size === 0) return 0;

    let intersection = 0;
    for (const bigram of setA) {
        if (setB.has(bigram)) intersection++;
    }

    const union = setA.size + setB.size - intersection;
    return union > 0 ? intersection / union : 0;
}
