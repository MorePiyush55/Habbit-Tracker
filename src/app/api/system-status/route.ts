export async function GET() {
    return Response.json({
        system: "online",
        ai: "connected",
        timestamp: new Date().toISOString()
    });
}
