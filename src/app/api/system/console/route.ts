/**
 * System Console API — Brain v3 Entry Point
 * ============================================
 * POST: Sends a message through the full Brain v3 pipeline:
 *   message → commandInterpreter → systemBrainV3 → directive → formatted response
 *
 * v3 upgrades: autonomous reasoning, evolution integration,
 * shadow coach review, cognitive constraints, slash commands.
 */

import { getUserId } from "@/lib/auth";
import { handleError, unauthorized, badRequest } from "@/lib/apiError";
import { interpretCommand } from "@/lib/core/commandInterpreter";
import { processCommand } from "@/lib/core/systemBrainV3";
import connectDB from "@/lib/mongodb";
import SystemMessage from "@/models/SystemMessage";

export async function POST(req: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        const { message } = await req.json();
        if (!message) return badRequest("Message is required.");

        await connectDB();

        // Save user message
        await SystemMessage.create({
            userId,
            role: "user",
            content: message,
        });

        // ── Step 1: Interpret command ────────────────────
        const command = interpretCommand(message);
        console.log(`[Console] Command: ${command.type} | Agent: ${command.agent} | Confidence: ${command.confidence} | AI: ${command.requiresAI}`);

        // ── Step 2: Process through Brain v3 ─────────────
        const result = await processCommand(userId, command);
        console.log(`[Console] Response: ${result.messages.length} messages | Agents: ${result.agentsInvolved.join(", ")} | AI: ${result.usedAI} | Evolution: ${result.evolutionApplied} | Shadow: ${result.shadowCoachReviewed} | Cognitive: ${result.cognitiveConstrained} | ${result.processingTimeMs}ms`);

        // ── Step 3: Save agent messages for history ──────
        for (const msg of result.messages) {
            try {
                await SystemMessage.create({
                    userId,
                    role: "system",
                    content: `[${msg.agent}] ${msg.text}`,
                });
            } catch {
                // Non-fatal: don't let persistence failure block response
            }
        }

        return Response.json({
            messages: result.messages,
            command: {
                type: command.type,
                confidence: command.confidence,
                agent: command.agent,
            },
            metadata: {
                processingTimeMs: result.processingTimeMs,
                agentsInvolved: result.agentsInvolved,
                usedAI: result.usedAI,
                evolutionApplied: result.evolutionApplied,
                shadowCoachReviewed: result.shadowCoachReviewed,
                cognitiveConstrained: result.cognitiveConstrained,
            },
        });
    } catch (error: any) {
        console.error("[Console API] Error:", error.message || error);

        // Always return a message to the frontend
        return Response.json({
            messages: [
                {
                    agent: "SYSTEM",
                    text: "⚠ SYSTEM FAILURE\n\nThe System encountered a critical error processing your command.\nRetry, Hunter.",
                    timestamp: new Date().toISOString(),
                },
            ],
            command: { type: "FREE_CHAT", confidence: 0 },
            metadata: { processingTimeMs: 0, agentsInvolved: ["SYSTEM"], usedAI: false, error: error.message },
        });
    }
}
