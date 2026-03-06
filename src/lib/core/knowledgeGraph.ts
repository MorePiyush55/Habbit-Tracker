/**
 * Personal Knowledge Graph (PKG) — Core Module #26
 * ===================================================
 * Manages a structured map of knowledge topics and relationships.
 *
 * The graph represents what the Hunter KNOWS:
 *   - Nodes are learnable concepts/topics
 *   - Edges (dependencies) show prerequisite relationships
 *   - Categories group nodes into knowledge clusters
 *   - Mastery % per node shows understanding depth
 *
 * Integration points:
 *   - trainingEngine → generates targeted questions from weak nodes
 *   - strategyGenerator → builds learning paths from graph gaps
 *   - systemBrain → detects weak clusters for proactive coaching
 *   - skillMasteryEngine → syncs mastery scores with graph nodes
 *   - contextBuilder → feeds graph data to AI prompts
 *
 * Architecture: Event Bus → Brain → knowledgeGraph → directives
 */

import connectDB from "@/lib/mongodb";
import KnowledgeNode from "@/models/KnowledgeNode";

// ============================================================
// Types
// ============================================================

export interface KnowledgeNodeData {
    nodeId: string;
    name: string;
    category: string;
    difficulty: number;
    mastery: number;
    dependencies: string[];
    lastStudied: string | null;
    studyCount: number;
    linkedHabitIds: string[];
    isActive: boolean;
}

export interface KnowledgeCluster {
    category: string;
    nodes: KnowledgeNodeData[];
    avgMastery: number;
    weakestNode: string | null;
    strongestNode: string | null;
    totalNodes: number;
    completionRate: number; // % of nodes with mastery >= 70
}

export interface KnowledgeGraphSnapshot {
    clusters: KnowledgeCluster[];
    totalNodes: number;
    avgMastery: number;
    weakClusters: string[];       // clusters with avg mastery < 40
    strongClusters: string[];     // clusters with avg mastery >= 70
    unlockedNodes: number;        // nodes with mastery > 0
    masteredNodes: number;        // nodes with mastery >= 80
    orphanNodes: string[];        // nodes with no dependencies met
    readyToLearn: string[];       // nodes whose dependencies are all mastered
}

export interface LearningPathStep {
    nodeId: string;
    name: string;
    category: string;
    reason: string;
    estimatedMinutes: number;
    priority: "critical" | "high" | "medium" | "low";
    prerequisitesMet: boolean;
}

// ============================================================
// NODE CRUD
// ============================================================

/** Add or update a knowledge node */
export async function upsertNode(
    userId: string,
    node: Partial<KnowledgeNodeData> & { nodeId: string; name: string; category: string }
): Promise<KnowledgeNodeData> {
    await connectDB();
    const doc = await KnowledgeNode.findOneAndUpdate(
        { userId, nodeId: node.nodeId },
        {
            $set: {
                name: node.name,
                category: node.category,
                difficulty: node.difficulty ?? 1,
                dependencies: node.dependencies ?? [],
                linkedHabitIds: node.linkedHabitIds ?? [],
                isActive: node.isActive ?? true,
            },
            $setOnInsert: { userId, nodeId: node.nodeId, mastery: 0, studyCount: 0 },
        },
        { upsert: true, new: true, lean: true }
    );
    return docToNode(doc);
}

/** Bulk import nodes (e.g. from AI-generated graph) */
export async function bulkUpsertNodes(
    userId: string,
    nodes: Array<{ nodeId: string; name: string; category: string; difficulty?: number; dependencies?: string[] }>
): Promise<number> {
    await connectDB();
    const ops = nodes.map((n) => ({
        updateOne: {
            filter: { userId, nodeId: n.nodeId },
            update: {
                $set: {
                    name: n.name,
                    category: n.category,
                    difficulty: n.difficulty ?? 1,
                    dependencies: n.dependencies ?? [],
                    isActive: true,
                },
                $setOnInsert: { userId, nodeId: n.nodeId, mastery: 0, studyCount: 0, linkedHabitIds: [] },
            },
            upsert: true,
        },
    }));
    if (ops.length === 0) return 0;
    const result = await KnowledgeNode.bulkWrite(ops);
    return result.upsertedCount + result.modifiedCount;
}

/** Get a single node */
export async function getNode(userId: string, nodeId: string): Promise<KnowledgeNodeData | null> {
    await connectDB();
    const doc = await KnowledgeNode.findOne({ userId, nodeId, isActive: true }).lean();
    return doc ? docToNode(doc) : null;
}

/** Get all active nodes for a user */
export async function getAllNodes(userId: string): Promise<KnowledgeNodeData[]> {
    await connectDB();
    const docs = await KnowledgeNode.find({ userId, isActive: true }).sort({ category: 1, name: 1 }).lean();
    return docs.map(docToNode);
}

/** Get nodes in a specific category */
export async function getNodesByCategory(userId: string, category: string): Promise<KnowledgeNodeData[]> {
    await connectDB();
    const docs = await KnowledgeNode.find({
        userId,
        category: { $regex: new RegExp(`^${category}$`, "i") },
        isActive: true,
    }).lean();
    return docs.map(docToNode);
}

/** Delete a node (soft delete) */
export async function removeNode(userId: string, nodeId: string): Promise<boolean> {
    await connectDB();
    const result = await KnowledgeNode.updateOne({ userId, nodeId }, { $set: { isActive: false } });
    return result.modifiedCount > 0;
}

// ============================================================
// GRAPH QUERIES
// ============================================================

/** Get all dependencies of a node (transitive) */
export async function getDependencyChain(userId: string, nodeId: string): Promise<KnowledgeNodeData[]> {
    const allNodes = await getAllNodes(userId);
    const nodeMap = new Map(allNodes.map((n) => [n.nodeId, n]));
    const visited = new Set<string>();
    const chain: KnowledgeNodeData[] = [];

    function walk(id: string) {
        if (visited.has(id)) return;
        visited.add(id);
        const node = nodeMap.get(id);
        if (!node) return;
        for (const dep of node.dependencies) {
            walk(dep);
        }
        chain.push(node);
    }

    const root = nodeMap.get(nodeId);
    if (!root) return [];
    for (const dep of root.dependencies) {
        walk(dep);
    }
    return chain;
}

/** Get nodes that depend on a given node (reverse dependencies) */
export async function getDependents(userId: string, nodeId: string): Promise<KnowledgeNodeData[]> {
    await connectDB();
    const docs = await KnowledgeNode.find({
        userId,
        dependencies: nodeId,
        isActive: true,
    }).lean();
    return docs.map(docToNode);
}

/** Get related topics: dependencies + dependents + same category */
export async function getRelatedTopics(userId: string, nodeId: string): Promise<KnowledgeNodeData[]> {
    const node = await getNode(userId, nodeId);
    if (!node) return [];

    const allNodes = await getAllNodes(userId);
    const related = new Set<string>();

    // Dependencies
    node.dependencies.forEach((d) => related.add(d));

    // Dependents
    allNodes.filter((n) => n.dependencies.includes(nodeId)).forEach((n) => related.add(n.nodeId));

    // Same category (up to 5)
    allNodes
        .filter((n) => n.category === node.category && n.nodeId !== nodeId)
        .slice(0, 5)
        .forEach((n) => related.add(n.nodeId));

    const nodeMap = new Map(allNodes.map((n) => [n.nodeId, n]));
    return [...related].map((id) => nodeMap.get(id)).filter(Boolean) as KnowledgeNodeData[];
}

// ============================================================
// CLUSTER ANALYSIS
// ============================================================

/** Build full graph snapshot with cluster analysis */
export async function buildGraphSnapshot(userId: string): Promise<KnowledgeGraphSnapshot> {
    const allNodes = await getAllNodes(userId);

    if (allNodes.length === 0) {
        return {
            clusters: [],
            totalNodes: 0,
            avgMastery: 0,
            weakClusters: [],
            strongClusters: [],
            unlockedNodes: 0,
            masteredNodes: 0,
            orphanNodes: [],
            readyToLearn: [],
        };
    }

    // Group by category
    const categoryMap = new Map<string, KnowledgeNodeData[]>();
    for (const node of allNodes) {
        const existing = categoryMap.get(node.category) ?? [];
        existing.push(node);
        categoryMap.set(node.category, existing);
    }

    const clusters: KnowledgeCluster[] = [];
    const weakClusters: string[] = [];
    const strongClusters: string[] = [];

    for (const [category, nodes] of categoryMap) {
        const avgMastery = nodes.reduce((sum, n) => sum + n.mastery, 0) / nodes.length;
        const mastered = nodes.filter((n) => n.mastery >= 70);
        const weakest = nodes.reduce((min, n) => (n.mastery < (min?.mastery ?? 101) ? n : min), nodes[0]);
        const strongest = nodes.reduce((max, n) => (n.mastery > (max?.mastery ?? -1) ? n : max), nodes[0]);

        const cluster: KnowledgeCluster = {
            category,
            nodes,
            avgMastery: Math.round(avgMastery),
            weakestNode: weakest?.name ?? null,
            strongestNode: strongest?.name ?? null,
            totalNodes: nodes.length,
            completionRate: Math.round((mastered.length / nodes.length) * 100),
        };
        clusters.push(cluster);

        if (avgMastery < 40) weakClusters.push(category);
        if (avgMastery >= 70) strongClusters.push(category);
    }

    // Orphan detection: nodes whose dependencies aren't met (mastery < 50)
    const nodeMap = new Map(allNodes.map((n) => [n.nodeId, n]));
    const orphanNodes: string[] = [];
    const readyToLearn: string[] = [];

    for (const node of allNodes) {
        if (node.mastery >= 70) continue; // already mastered
        if (node.dependencies.length === 0) {
            if (node.mastery < 20) readyToLearn.push(node.nodeId);
            continue;
        }

        const depsMet = node.dependencies.every((depId) => {
            const dep = nodeMap.get(depId);
            return dep && dep.mastery >= 50;
        });

        if (!depsMet) {
            orphanNodes.push(node.nodeId);
        } else if (node.mastery < 50) {
            readyToLearn.push(node.nodeId);
        }
    }

    const totalMastery = allNodes.reduce((sum, n) => sum + n.mastery, 0);

    return {
        clusters: clusters.sort((a, b) => a.avgMastery - b.avgMastery),
        totalNodes: allNodes.length,
        avgMastery: Math.round(totalMastery / allNodes.length),
        weakClusters,
        strongClusters,
        unlockedNodes: allNodes.filter((n) => n.mastery > 0).length,
        masteredNodes: allNodes.filter((n) => n.mastery >= 80).length,
        orphanNodes,
        readyToLearn,
    };
}

/** Detect weak knowledge clusters (avg mastery < threshold) */
export async function getWeakClusters(userId: string, threshold = 40): Promise<KnowledgeCluster[]> {
    const snapshot = await buildGraphSnapshot(userId);
    return snapshot.clusters.filter((c) => c.avgMastery < threshold);
}

// ============================================================
// LEARNING PATH GENERATION
// ============================================================

/** Generate a prioritized learning path based on graph gaps */
export async function generateLearningPath(
    userId: string,
    maxSteps = 5
): Promise<LearningPathStep[]> {
    const allNodes = await getAllNodes(userId);
    if (allNodes.length === 0) return [];

    const nodeMap = new Map(allNodes.map((n) => [n.nodeId, n]));
    const steps: LearningPathStep[] = [];

    // Priority 1: Nodes that are "ready to learn" (deps met, low mastery)
    const readyNodes = allNodes.filter((n) => {
        if (n.mastery >= 70) return false;
        if (n.dependencies.length === 0) return n.mastery < 50;
        return n.dependencies.every((depId) => {
            const dep = nodeMap.get(depId);
            return dep && dep.mastery >= 50;
        });
    });

    // Sort by: critical (deps unblocking others) > low mastery > high difficulty
    const scoredNodes = readyNodes.map((n) => {
        const dependents = allNodes.filter((other) => other.dependencies.includes(n.nodeId));
        const unblocksCount = dependents.filter((d) => d.mastery < 50).length;
        const urgencyScore = (100 - n.mastery) + (unblocksCount * 20) + (n.difficulty * 5);
        return { node: n, urgencyScore, unblocksCount };
    });

    scoredNodes.sort((a, b) => b.urgencyScore - a.urgencyScore);

    for (const { node, unblocksCount } of scoredNodes.slice(0, maxSteps)) {
        const priority: LearningPathStep["priority"] =
            node.mastery < 20 && unblocksCount > 0 ? "critical" :
                node.mastery < 30 ? "high" :
                    node.mastery < 50 ? "medium" : "low";

        const reason = unblocksCount > 0
            ? `Unblocks ${unblocksCount} dependent topic${unblocksCount > 1 ? "s" : ""}`
            : node.mastery < 20
                ? "Foundational gap — no practice detected"
                : `Mastery at ${node.mastery}% — needs reinforcement`;

        steps.push({
            nodeId: node.nodeId,
            name: node.name,
            category: node.category,
            reason,
            estimatedMinutes: estimateStudyTime(node),
            priority,
            prerequisitesMet: true,
        });
    }

    // If we have room, add "blocked" nodes that need prerequisite work
    if (steps.length < maxSteps) {
        const blockedNodes = allNodes.filter((n) => {
            if (n.mastery >= 50) return false;
            return n.dependencies.some((depId) => {
                const dep = nodeMap.get(depId);
                return !dep || dep.mastery < 50;
            });
        });

        for (const node of blockedNodes.slice(0, maxSteps - steps.length)) {
            const unmetDeps = node.dependencies
                .filter((depId) => {
                    const dep = nodeMap.get(depId);
                    return !dep || dep.mastery < 50;
                })
                .map((depId) => nodeMap.get(depId)?.name ?? depId);

            steps.push({
                nodeId: node.nodeId,
                name: node.name,
                category: node.category,
                reason: `Blocked — needs: ${unmetDeps.join(", ")}`,
                estimatedMinutes: estimateStudyTime(node),
                priority: "low",
                prerequisitesMet: false,
            });
        }
    }

    return steps;
}

// ============================================================
// NODE MASTERY UPDATES
// ============================================================

/** Update a node's mastery (called by skillMasteryEngine) */
export async function updateNodeMastery(
    userId: string,
    nodeId: string,
    masteryDelta: number
): Promise<KnowledgeNodeData | null> {
    await connectDB();
    const doc = await KnowledgeNode.findOneAndUpdate(
        { userId, nodeId, isActive: true },
        {
            $inc: { mastery: masteryDelta, studyCount: 1 },
            $set: { lastStudied: new Date() },
        },
        { new: true, lean: true }
    );
    if (!doc) return null;

    // Clamp mastery to [0, 100]
    if (doc.mastery > 100 || doc.mastery < 0) {
        const clamped = Math.max(0, Math.min(100, doc.mastery as number));
        await KnowledgeNode.updateOne({ _id: doc._id }, { $set: { mastery: clamped } });
        doc.mastery = clamped;
    }

    return docToNode(doc);
}

/** Apply decay to nodes not studied in N days */
export async function applyKnowledgeDecay(
    userId: string,
    decayDays = 7,
    decayAmount = 3
): Promise<{ decayedCount: number; decayedNodes: string[] }> {
    await connectDB();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - decayDays);

    const staleNodes = await KnowledgeNode.find({
        userId,
        isActive: true,
        mastery: { $gt: 10 },
        $or: [
            { lastStudied: { $lt: cutoffDate } },
            { lastStudied: null, createdAt: { $lt: cutoffDate } },
        ],
    }).lean();

    const decayedNodes: string[] = [];
    for (const node of staleNodes) {
        const decay = Math.min(decayAmount, (node.mastery as number) - 5); // don't decay below 5
        if (decay <= 0) continue;
        await KnowledgeNode.updateOne(
            { _id: node._id },
            { $inc: { mastery: -decay } }
        );
        decayedNodes.push(node.name as string);
    }

    return { decayedCount: decayedNodes.length, decayedNodes };
}

// ============================================================
// FORMAT FOR CONTEXT / AI
// ============================================================

/** Format graph snapshot as context string for AI prompts */
export function formatGraphForContext(snapshot: KnowledgeGraphSnapshot): string {
    if (snapshot.totalNodes === 0) {
        return "[KNOWLEDGE GRAPH]\nNo knowledge nodes tracked yet.";
    }

    const parts: string[] = [
        `[KNOWLEDGE GRAPH] (${snapshot.totalNodes} nodes | Avg Mastery: ${snapshot.avgMastery}%)`,
    ];

    if (snapshot.weakClusters.length > 0) {
        parts.push(`Weak Clusters: ${snapshot.weakClusters.join(", ")}`);
    }
    if (snapshot.strongClusters.length > 0) {
        parts.push(`Strong Clusters: ${snapshot.strongClusters.join(", ")}`);
    }

    for (const cluster of snapshot.clusters.slice(0, 8)) {
        const nodesSummary = cluster.nodes
            .sort((a, b) => a.mastery - b.mastery)
            .slice(0, 5)
            .map((n) => `${n.name}: ${n.mastery}%`)
            .join(", ");
        parts.push(`  ${cluster.category} (avg ${cluster.avgMastery}%): ${nodesSummary}`);
    }

    if (snapshot.readyToLearn.length > 0) {
        parts.push(`Ready to Learn: ${snapshot.readyToLearn.slice(0, 5).join(", ")}`);
    }

    return parts.join("\n");
}

/** Format learning path as a directive-style string */
export function formatLearningPath(steps: LearningPathStep[]): string {
    if (steps.length === 0) return "No learning path available — add knowledge nodes first.";

    const lines = steps.map((s, i) => {
        const tag = s.priority === "critical" ? "⚠" : s.priority === "high" ? "▲" : "•";
        const prereq = s.prerequisitesMet ? "" : " [BLOCKED]";
        return `  ${tag} ${i + 1}. ${s.name} (${s.category}) — ${s.estimatedMinutes}min${prereq}\n     ${s.reason}`;
    });

    const totalTime = steps.reduce((sum, s) => sum + s.estimatedMinutes, 0);
    return `LEARNING PATH (${steps.length} steps | ~${totalTime} min)\n${lines.join("\n")}`;
}

/** Format a single cluster as a detailed tree view */
export function formatClusterDetail(cluster: KnowledgeCluster): string {
    const header = `Knowledge Cluster: ${cluster.category}\nAvg Mastery: ${cluster.avgMastery}% | ${cluster.completionRate}% complete\n`;
    const nodes = cluster.nodes
        .sort((a, b) => a.mastery - b.mastery)
        .map((n) => {
            const bar = "█".repeat(Math.floor(n.mastery / 10)) + "░".repeat(10 - Math.floor(n.mastery / 10));
            return `  ${bar} ${n.mastery}% ${n.name} (L${n.difficulty})`;
        });
    const weakest = cluster.weakestNode ? `\nWeakest: ${cluster.weakestNode}` : "";
    return `${header}${nodes.join("\n")}${weakest}`;
}

// ============================================================
// Helpers
// ============================================================

function docToNode(doc: Record<string, any>): KnowledgeNodeData {
    return {
        nodeId: doc.nodeId,
        name: doc.name,
        category: doc.category,
        difficulty: doc.difficulty ?? 1,
        mastery: doc.mastery ?? 0,
        dependencies: doc.dependencies ?? [],
        lastStudied: doc.lastStudied ? new Date(doc.lastStudied).toISOString() : null,
        studyCount: doc.studyCount ?? 0,
        linkedHabitIds: (doc.linkedHabitIds ?? []).map(String),
        isActive: doc.isActive ?? true,
    };
}

function estimateStudyTime(node: KnowledgeNodeData): number {
    const base = node.difficulty * 15; // 15 min per difficulty level
    const masteryFactor = node.mastery < 20 ? 1.5 : node.mastery < 50 ? 1.2 : 1.0;
    return Math.round(base * masteryFactor);
}
