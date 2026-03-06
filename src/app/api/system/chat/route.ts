/**
 * System Chat API — Brain v2 Powered
 * =====================================
 * POST: Messages now route through the full Brain v2 pipeline:
 *   message → commandInterpreter → systemBrainV2 → directive → formatted response
 *
 * GET: Returns chat history (used by both SystemChat and SystemConsole)
 *
 * The old direct-AI path is replaced. All intelligence now flows through
 * the command interpreter + brain v2, keeping AI as ONE layer of reasoning.
 */

import { getUserId } from "@/lib/auth";
import { handleError, unauthorized, badRequest } from "@/lib/apiError";
import { interpretCommand } from "@/lib/core/commandInterpreter";
import { processCommand } from "@/lib/core/systemBrainV2";
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

        // ── Route through Brain v2 pipeline ──────────────
        const command = interpretCommand(message);
        const result = await processCommand(userId, command);

        // Combine agent messages into a single reply for backwards compatibility
        const combinedReply = result.messages
            .map((m) => (result.messages.length > 1 ? `[${m.agent}]\n${m.text}` : m.text))
            .join("\n\n---\n\n");

        // Save system response
        await SystemMessage.create({
            userId,
            role: "system",
            content: combinedReply,
        });

        return Response.json({
            reply: combinedReply,
            // New fields for console-aware clients
            messages: result.messages,
            command: { type: command.type, confidence: command.confidence },
            metadata: {
                processingTimeMs: result.processingTimeMs,
                agentsInvolved: result.agentsInvolved,
                usedAI: result.usedAI,
            },
            penalty: null,
        });
    } catch (error: any) {
        console.error("[System Chat API Error]:", error.message || error);

        return Response.json({
            reply: "⚠ SYSTEM NOTICE\n\nCritical system failure.\nThe System could not process your request.\nRetry your command, Hunter.",
            penalty: null,
        });
    }
}

export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        await connectDB();

        const messages = await SystemMessage.find({ userId })
            .sort({ timestamp: 1 })
            .lean();

        return Response.json({ messages });
    } catch (error) {
        return handleError(error);
    }
}
