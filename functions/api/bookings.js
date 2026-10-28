
export async function onRequestPost({ request, env }) {
    try {
        const body = await request.json();

        const businessId = 1;
        const { service, date, time, name, phone } = body;

        if (!service || !date || !time || !name || !phone) {
            return Response.json(
                { error: "Please complete all fields." },
                { status: 400 }
            );
        }

        const selectedService = await env.DB.prepare(`
            SELECT id, name, price_cents, duration_minutes
            FROM services
            WHERE business_id = ?
              AND name = ?
              AND is_active = 1
        `).bind(businessId, service).first();

        if (!selectedService) {
            return Response.json(
                { error: "This service is unavailable." },
                { status: 400 }
            );
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
            !/^\d{2}:\d{2}$/.test(time)) {
            return Response.json(
                { error: "Invalid date or time." },
                { status: 400 }
            );
        }

        const start = new Date(`${date}T${time}:00-03:00`);

        if (Number.isNaN(start.getTime()) || start <= new Date()) {
            return Response.json(
                { error: "Please choose a future date and time." },
                { status: 400 }
            );
        }

        const end = new Date(
            start.getTime() + selectedService.duration_minutes * 60000
        );

        const startAt = start.toISOString();
        const endAt = end.toISOString();

        const overlap = await env.DB.prepare(`
            SELECT id
            FROM appointments
            WHERE business_id = ?
              AND status = 'confirmed'
              AND start_at < ?
              AND end_at > ?
            LIMIT 1
        `).bind(businessId, endAt, startAt).first();

        if (overlap) {
            return Response.json(
                { error: "That time is already booked. Please choose another." },
                { status: 409 }
            );
        }

        const appointment = await env.DB.prepare(`
            INSERT INTO appointments (
                business_id,
                service_id,
                service_name,
                price_cents,
                duration_minutes,
                customer_name,
                customer_phone,
                start_at,
                end_at,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')
            RETURNING id
        `).bind(
            businessId,
            selectedService.id,
            selectedService.name,
            selectedService.price_cents,
            selectedService.duration_minutes,
            name.trim(),
            phone,
            startAt,
            endAt
        ).first();

        return Response.json({
            ok: true,
            appointmentId: appointment.id,
            message: "Appointment booked successfully."
        }, { status: 201 });

    } catch (error) {
        return Response.json(
            { error: "Something went wrong while booking." },
            { status: 500 }
        );
    }
}
