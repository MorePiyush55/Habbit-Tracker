import { getUserId } from "@/lib/auth";
import { buildSkillGraph, getRelatedSkills } from "@/lib/core/skillGraph";

export async function GET(req: Request) {
    try {
        const userId = await getUserId();
        if (!userId) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const graph = await buildSkillGraph(userId);

        // Optional: get related skills for a specific skill
        const url = new URL(req.url);
        const skill = url.searchParams.get("skill");
        const related = skill ? getRelatedSkills(graph, skill) : null;

        return Response.json({
            success: true,
            graph: {
                totalSkills: graph.totalSkills,
                weakestPath: graph.weakestPath,
                strongestPath: graph.strongestPath,
                roots: graph.roots,
                recommendations: graph.recommendations,
            },
            ...(related ? { relatedSkills: related } : {}),
        });
    } catch (error: any) {
        console.error("[API] Skill graph error:", error.message);
        return Response.json({ error: "Failed to build skill graph" }, { status: 500 });
    }
}
