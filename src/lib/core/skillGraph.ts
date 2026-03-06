/**
 * Skill Graph — Knowledge Graph for Training Intelligence
 * =========================================================
 * Instead of treating skills independently, this module models
 * skill relationships as a directed graph.
 *
 * Structure:
 *   Category → Skills → Sub-skills
 *
 * Example:
 *   Cybersecurity
 *     ├─ Networking (score: 65)
 *     ├─ Cryptography (score: 40)
 *     │    ├─ Hashing (score: 30)
 *     │    └─ PKI (score: 50)
 *     └─ Risk Management (score: 70)
 *
 * Benefits:
 *   - AI can reason about related skills
 *   - Recommends parent skill when child is weak
 *   - Auto-discovers learning paths
 */

import connectDB from "@/lib/mongodb";
import SkillNode from "@/models/SkillNode";
import SkillScore from "@/models/SkillScore";
import type { SystemState } from "@/types";

// ============================================================
// Types
// ============================================================

interface SkillGraphNode {
    skill: string;
    category: string;
    score: number;
    trend: "improving" | "stable" | "declining";
    children: SkillGraphNode[];
    relatedSkills: string[];
    depth: number;
}

interface SkillGraph {
    roots: SkillGraphNode[];    // Top-level categories
    totalSkills: number;
    weakestPath: string[];      // E.g., ["Cybersecurity", "Cryptography", "Hashing"]
    strongestPath: string[];
    recommendations: SkillRecommendation[];
}

interface SkillRecommendation {
    skill: string;
    reason: string;
    priority: "high" | "medium" | "low";
    suggestedAction: "test" | "study" | "review";
    relatedTo?: string;         // Parent or related skill
}

// ============================================================
// BUILD: Construct skill graph from DB data
// ============================================================

export async function buildSkillGraph(userId: string): Promise<SkillGraph> {
    await connectDB();

    const [nodes, scores] = await Promise.all([
        SkillNode.find({ userId, isActive: true }).lean() as Promise<any[]>,
        SkillScore.find({ userId }).lean() as Promise<any[]>,
    ]);

    // Build score lookup
    const scoreMap: Record<string, { score: number; trend: string }> = {};
    for (const s of scores) {
        scoreMap[s.skill] = { score: s.score || 0, trend: s.trend || "stable" };
    }

    // Group nodes by category
    const categoryMap: Record<string, any[]> = {};
    for (const node of nodes) {
        const cat = node.category || "General";
        if (!categoryMap[cat]) categoryMap[cat] = [];
        categoryMap[cat].push(node);
    }

    // Build tree structure
    const roots: SkillGraphNode[] = [];

    for (const [category, catNodes] of Object.entries(categoryMap)) {
        // Find the "root" of each category (skills with no parent in this category)
        const skillNames = new Set(catNodes.map((n) => n.skill));
        const childSkills = new Set<string>();
        for (const node of catNodes) {
            for (const related of node.relatedSkills || []) {
                if (skillNames.has(related)) childSkills.add(related);
            }
        }

        const rootNodes = catNodes.filter((n) => !childSkills.has(n.skill));

        for (const rootNode of rootNodes) {
            const graphNode = buildNodeTree(rootNode, catNodes, scoreMap, 0, new Set());
            roots.push(graphNode);
        }

        // If no clear root, create a category root
        if (rootNodes.length === 0 && catNodes.length > 0) {
            const catScore = scoreMap[category] || { score: 0, trend: "stable" };
            const children = catNodes.map((n) =>
                buildNodeTree(n, [], scoreMap, 1, new Set())
            );
            roots.push({
                skill: category,
                category,
                score: catScore.score,
                trend: catScore.trend as "improving" | "stable" | "declining",
                children,
                relatedSkills: catNodes.map((n) => n.skill),
                depth: 0,
            });
        }
    }

    // Also include scores that don't have SkillNode entries
    const nodesSkills = new Set(nodes.map((n: any) => n.skill));
    for (const s of scores) {
        if (!nodesSkills.has(s.skill)) {
            roots.push({
                skill: s.skill,
                category: s.category || "General",
                score: s.score || 0,
                trend: (s.trend as "improving" | "stable" | "declining") || "stable",
                children: [],
                relatedSkills: [],
                depth: 0,
            });
        }
    }

    // Find weakest and strongest paths
    const allLeaves = flattenGraph(roots);
    allLeaves.sort((a, b) => a.score - b.score);
    const weakestPath = allLeaves.length > 0 ? getPathToNode(roots, allLeaves[0].skill) : [];
    const strongestPath = allLeaves.length > 0 ? getPathToNode(roots, allLeaves[allLeaves.length - 1].skill) : [];

    // Generate recommendations
    const recommendations = generateRecommendations(roots, allLeaves);

    return {
        roots,
        totalSkills: allLeaves.length,
        weakestPath,
        strongestPath,
        recommendations,
    };
}

// ============================================================
// FIND WEAKEST SKILL ALONG GRAPH PATH
// ============================================================

function findWeakestSkillInGraph(graph: SkillGraph): string | null {
    if (graph.weakestPath.length === 0) return null;
    return graph.weakestPath[graph.weakestPath.length - 1]; // Deepest weak node
}

// ============================================================
// GET RELATED SKILLS (for contextual training)
// ============================================================

export function getRelatedSkills(graph: SkillGraph, skill: string): string[] {
    const related: string[] = [];

    function search(nodes: SkillGraphNode[], parent: string | null) {
        for (const node of nodes) {
            if (node.skill === skill) {
                related.push(...node.relatedSkills);
                if (parent) related.push(parent);
                // Add children
                for (const child of node.children) {
                    related.push(child.skill);
                }
            }
            search(node.children, node.skill);
        }
    }

    search(graph.roots, null);
    return [...new Set(related.filter((r) => r !== skill))];
}

// ============================================================
// INTERNAL: Build a node tree recursively
// ============================================================

function buildNodeTree(
    node: any,
    allNodes: any[],
    scoreMap: Record<string, { score: number; trend: string }>,
    depth: number,
    visited: Set<string>
): SkillGraphNode {
    if (visited.has(node.skill)) {
        // Prevent infinite loops in cyclic graphs
        const s = scoreMap[node.skill] || { score: 0, trend: "stable" };
        return {
            skill: node.skill,
            category: node.category || "General",
            score: s.score,
            trend: s.trend as "improving" | "stable" | "declining",
            children: [],
            relatedSkills: node.relatedSkills || [],
            depth,
        };
    }

    visited.add(node.skill);
    const s = scoreMap[node.skill] || { score: 0, trend: "stable" };

    // Find children (skills this node lists as related that are in the same category)
    const children: SkillGraphNode[] = [];
    for (const relatedSkill of node.relatedSkills || []) {
        const childNode = allNodes.find((n) => n.skill === relatedSkill);
        if (childNode && !visited.has(childNode.skill)) {
            children.push(buildNodeTree(childNode, allNodes, scoreMap, depth + 1, visited));
        }
    }

    return {
        skill: node.skill,
        category: node.category || "General",
        score: s.score,
        trend: s.trend as "improving" | "stable" | "declining",
        children,
        relatedSkills: node.relatedSkills || [],
        depth,
    };
}

// ============================================================
// INTERNAL: Flatten graph to leaf nodes
// ============================================================

function flattenGraph(roots: SkillGraphNode[]): SkillGraphNode[] {
    const result: SkillGraphNode[] = [];

    function walk(nodes: SkillGraphNode[]) {
        for (const node of nodes) {
            result.push(node);
            if (node.children.length > 0) {
                walk(node.children);
            }
        }
    }

    walk(roots);
    return result;
}

// ============================================================
// INTERNAL: Get path from root to a specific skill
// ============================================================

function getPathToNode(roots: SkillGraphNode[], targetSkill: string): string[] {
    function search(nodes: SkillGraphNode[], path: string[]): string[] | null {
        for (const node of nodes) {
            const currentPath = [...path, node.skill];
            if (node.skill === targetSkill) return currentPath;
            if (node.children.length > 0) {
                const found = search(node.children, currentPath);
                if (found) return found;
            }
        }
        return null;
    }

    return search(roots, []) || [targetSkill];
}

// ============================================================
// INTERNAL: Generate skill recommendations
// ============================================================

function generateRecommendations(
    roots: SkillGraphNode[],
    allNodes: SkillGraphNode[]
): SkillRecommendation[] {
    const recommendations: SkillRecommendation[] = [];

    for (const node of allNodes) {
        // Critical: score below 30
        if (node.score < 30 && node.score > 0) {
            recommendations.push({
                skill: node.skill,
                reason: `Score critically low (${node.score}/100). Immediate training required.`,
                priority: "high",
                suggestedAction: "test",
                relatedTo: node.children.length > 0 ? node.children[0].skill : undefined,
            });
        }
        // Weak: score 30-50
        else if (node.score >= 30 && node.score < 50) {
            recommendations.push({
                skill: node.skill,
                reason: `Score below threshold (${node.score}/100). Study recommended.`,
                priority: "medium",
                suggestedAction: "study",
            });
        }
        // Declining: was good but dropping
        else if (node.trend === "declining" && node.score >= 50) {
            recommendations.push({
                skill: node.skill,
                reason: `Score declining (${node.score}/100). Review before it drops further.`,
                priority: "medium",
                suggestedAction: "review",
            });
        }
        // Untested: score is 0
        else if (node.score === 0) {
            recommendations.push({
                skill: node.skill,
                reason: "Never tested. Initial assessment needed.",
                priority: "low",
                suggestedAction: "test",
            });
        }
    }

    // Sort: high > medium > low
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return recommendations.slice(0, 10); // Top 10
}
