
export async function onRequest({ env }) {
    try {
        await env.DB.prepare("SELECT 1 AS ok").first();

        return Response.json({
            ok: true,
            database: "connected"
        });
    } catch (error) {
        return Response.json(
            {
                ok: false,
                error: "Database connection failed"
            },
            { status: 500 }
        );
    }
}
