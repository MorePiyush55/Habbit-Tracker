export class ApiError extends Error {
    statusCode: number;

    constructor(message: string, statusCode: number = 500) {
        super(message);
        this.name = "ApiError";
        this.statusCode = statusCode;
    }
}

export function handleError(error: unknown): Response {
    console.error("API Error:", error);

    if (error instanceof ApiError) {
        return Response.json(
            { error: error.message },
            { status: error.statusCode }
        );
    }

    if (error instanceof Error) {
        return Response.json(
            { error: error.message },
            { status: 500 }
        );
    }

    return Response.json(
        { error: "An unexpected error occurred" },
        { status: 500 }
    );
}

export function unauthorized(): Response {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function notFound(resource: string = "Resource"): Response {
    return Response.json({ error: `${resource} not found` }, { status: 404 });
}

export function badRequest(message: string): Response {
    return Response.json({ error: message }, { status: 400 });
}
