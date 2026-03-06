import { getUserId } from "@/lib/auth";
import connectDB from "@/lib/mongodb";
import LearningPath from "@/models/LearningPath";
import { handleError, unauthorized, badRequest } from "@/lib/apiError";

export async function GET() {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        await connectDB();
        const paths = await LearningPath.find({ userId, isActive: true }).lean();
        return Response.json({ learningPaths: paths });
    } catch (error) {
        return handleError(error);
    }
}

export async function POST(req: Request) {
    try {
        const userId = await getUserId();
        if (!userId) return unauthorized();

        const body = await req.json();
        if (!body.title || !body.totalSections) {
            return badRequest("Title and totalSections are required.");
        }

        await connectDB();
        const newPath = await LearningPath.create({
            userId,
            title: body.title,
            totalSections: body.totalSections,
            weakTopics: body.weakTopics || [],
            masteredTopics: body.masteredTopics || [],
        });

        return Response.json({ learningPath: newPath }, { status: 201 });
    } catch (error) {
        return handleError(error);
    }
}
