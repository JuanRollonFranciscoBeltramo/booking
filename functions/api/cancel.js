

async function hashCancellationToken(token) {
    const data = new TextEncoder().encode(token);
    const hash = await crypto.subtle.digest("SHA-256", data);

    return Array.from(new Uint8Array(hash), byte =>
        byte.toString(16).padStart(2, "0")
    ).join("");
}


export async function onRequestGet({ request, env }) {
    try {
        const url = new URL(request.url);
        const token = url.searchParams.get("token");

        if (!token || !/^[a-f0-9]{64}$/.test(token)) {
            return Response.json(
                { error: "Invalid cancellation link." },
                { status: 404 }
            );
        }

        const tokenHash = await hashCancellationToken(token);

        const appointment = await env.DB.prepare(`
            SELECT
                id,
                service_name,
                price_cents,
                customer_name,
                start_at,
                end_at,
                status
            FROM appointments
            WHERE cancellation_token_hash = ?
            LIMIT 1
        `).bind(tokenHash).first();

        if (!appointment) {
            return Response.json(
                { error: "Invalid cancellation link." },
                { status: 404 }
            );
        }

        return Response.json({
            ok: true,
            appointment
        });

    } catch (error) {
        return Response.json(
            { error: "Something went wrong." },
            { status: 500 }
        );
    }
}

export async function onRequestPost({ request, env }) {
    try {
        const body = await request.json();
        const token = body.token;

        if (!token || typeof token !== "string" ||
            !/^[a-f0-9]{64}$/.test(token)) {
            return Response.json(
                { error: "Invalid cancellation link." },
                { status: 404 }
            );
        }

        const tokenHash = await hashCancellationToken(token);

        const result = await env.DB.prepare(`
            UPDATE appointments
            SET status = 'cancelled'
            WHERE cancellation_token_hash = ?
              AND status = 'confirmed'
            RETURNING id
        `).bind(tokenHash).first();

        if (!result) {
            const appointment = await env.DB.prepare(`
                SELECT status
                FROM appointments
                WHERE cancellation_token_hash = ?
                LIMIT 1
            `).bind(tokenHash).first();

            if (!appointment) {
                return Response.json(
                    { error: "Invalid cancellation link." },
                    { status: 404 }
                );
            }

            return Response.json(
                { error: "This appointment has already been cancelled." },
                { status: 409 }
            );
        }

        return Response.json({
            ok: true,
            message: "Appointment cancelled successfully."
        });

    } catch (error) {
        return Response.json(
            { error: "Something went wrong." },
            { status: 500 }
        );
    }
}
