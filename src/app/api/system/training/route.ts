import { getUserId } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import LearningPath from "@/models/LearningPath";
import { aiRouter } from "@/lib/ai/aiRouter";
import { trainingModePrompt } from "@/lib/ai/trainingPrompts";
import { handleError, unauthorized } from "@/lib/apiError";

export async function POST(req: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        await connectDB();

        // Find a learning path that has weak topics to generate a quiz from
        const paths = await LearningPath.find({
            userId,
            isActive: true,
            weakTopics: { $not: { $size: 0 } }
        }).lean();

        if (!paths || paths.length === 0) {
            return Response.json({ message: "No weak topics detected. Continue standard tracking." });
        }

        // Just pick the first path for the quiz
        const path = paths[0];

        const learningData = {
            title: path.title,
            progress: `${path.completedSections}/${path.totalSections}`,
            weakTopics: path.weakTopics
        };

        const prompt = trainingModePrompt(JSON.stringify(learningData, null, 2));

        const result = await aiRouter("learning", prompt);
        const text = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

        const quiz = JSON.parse(text);

        return Response.json({ quiz });
    } catch (error) {
        return handleError(error);
    }
}
