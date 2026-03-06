/**
 * Knowledge Graph API — /api/knowledge
 * =======================================
 * CRUD for knowledge nodes + graph queries.
 *
 * GET    — Get full graph snapshot or specific cluster
 * POST   — Add/update nodes (single or bulk)
 * DELETE — Remove a node (soft delete)
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import {
    getAllNodes,
    getNodesByCategory,
    upsertNode,
    bulkUpsertNodes,
    removeNode,
    buildGraphSnapshot,
    generateLearningPath,
    getWeakClusters,
    formatGraphForContext,
    formatLearningPath,
} from "@/lib/core/knowledgeGraph";

export async function GET(req: NextRequest) {
    try {
        const userId = await getUserId();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const category = searchParams.get("category");
        const view = searchParams.get("view"); // "snapshot" | "path" | "weak" | "nodes"

        if (view === "snapshot" || !view) {
            const snapshot = await buildGraphSnapshot(userId);
            return NextResponse.json({
                snapshot,
                formatted: formatGraphForContext(snapshot),
            });
        }

        if (view === "path") {
            const maxSteps = parseInt(searchParams.get("steps") ?? "5");
            const path = await generateLearningPath(userId, maxSteps);
            return NextResponse.json({
                path,
                formatted: formatLearningPath(path),
            });
        }

        if (view === "weak") {
            const threshold = parseInt(searchParams.get("threshold") ?? "40");
            const clusters = await getWeakClusters(userId, threshold);
            return NextResponse.json({ clusters });
        }

        if (category) {
            const nodes = await getNodesByCategory(userId, category);
            return NextResponse.json({ nodes });
        }

        const nodes = await getAllNodes(userId);
        return NextResponse.json({ nodes });
    } catch (err) {
        console.error("[Knowledge API] GET error:", err);
        return NextResponse.json({ error: "Failed to fetch knowledge graph" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const userId = await getUserId();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const body = await req.json();

        // Bulk import
        if (Array.isArray(body.nodes)) {
            const count = await bulkUpsertNodes(userId, body.nodes);
            return NextResponse.json({ imported: count });
        }

        // Single node
        if (body.nodeId && body.name && body.category) {
            const node = await upsertNode(userId, body);
            return NextResponse.json({ node });
        }

        return NextResponse.json({ error: "Missing required fields: nodeId, name, category" }, { status: 400 });
    } catch (err) {
        console.error("[Knowledge API] POST error:", err);
        return NextResponse.json({ error: "Failed to update knowledge graph" }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const userId = await getUserId();
        if (!userId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const nodeId = searchParams.get("nodeId");
        if (!nodeId) {
            return NextResponse.json({ error: "Missing nodeId parameter" }, { status: 400 });
        }

        const removed = await removeNode(userId, nodeId);
        return NextResponse.json({ removed });
    } catch (err) {
        console.error("[Knowledge API] DELETE error:", err);
        return NextResponse.json({ error: "Failed to delete node" }, { status: 500 });
    }
}
