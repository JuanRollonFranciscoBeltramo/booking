
export async function onRequestPost({ request, env }) {
    try {
        const body = await request.json();
        const businessId = 1;
        const { service, date, time, name, phone } = body;

        if (
            typeof service !== "string" ||
            typeof date !== "string" ||
            typeof time !== "string" ||
            typeof name !== "string" ||
            typeof phone !== "string" ||
            !service.trim() ||
            !name.trim() ||
            !phone.trim()
        ) {
            return Response.json(
                { error: "Please complete all fields." },
                { status: 400 }
            );
        }

        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
            !/^\d{2}:\d{2}$/.test(time)
        ) {
            return Response.json(
                { error: "Invalid date or time." },
                { status: 400 }
            );
        }

        const [year, month, day] = date.split("-").map(Number);
        const [hour, minute] = time.split(":").map(Number);

        if (
            hour > 23 ||
            minute > 59 ||
            new Date(Date.UTC(year, month - 1, day))
                .toISOString().slice(0, 10) !== date
        ) {
            return Response.json(
                { error: "Invalid date or time." },
                { status: 400 }
            );
        }

        // Demo timezone: Argentina (UTC-3).
        const start = new Date(`${date}T${time}:00-03:00`);

        if (start <= new Date()) {
            return Response.json(
                { error: "Please choose a future date and time." },
                { status: 400 }
            );
        }

        const selectedService = await env.DB.prepare(`
            SELECT id, name, price_cents, duration_minutes
            FROM services
            WHERE business_id = ?
              AND name = ?
              AND is_active = 1
        `).bind(businessId, service.trim()).first();

        if (!selectedService) {
            return Response.json(
                { error: "This service is unavailable." },
                { status: 400 }
            );
        }

        const duration = selectedService.duration_minutes;

        if (!Number.isInteger(duration) || duration <= 0) {
            return Response.json(
                { error: "This service has an invalid duration." },
                { status: 500 }
            );
        }

        const end = new Date(start.getTime() + duration * 60000);
        const startAt = start.toISOString();
        const endAt = end.toISOString();

        // Determine the weekday in Argentina.
        const weekday = start.getUTCDay();

        const periods = await env.DB.prepare(`
            SELECT start_time, end_time
            FROM working_hours
            WHERE business_id = ?
              AND weekday = ?
        `).bind(businessId, weekday).all();

        const startMinutes = hour * 60 + minute;
        const endMinutes = startMinutes + duration;

        const fitsOpeningHours = (periods.results || []).some(period => {
            const [openHour, openMinute] =
                period.start_time.split(":").map(Number);
            const [closeHour, closeMinute] =
                period.end_time.split(":").map(Number);

            const opensAt = openHour * 60 + openMinute;
            const closesAt = closeHour * 60 + closeMinute;

            return startMinutes >= opensAt && endMinutes <= closesAt;
        });

        if (!fitsOpeningHours) {
            return Response.json(
                { error: "That appointment is outside opening hours." },
                { status: 400 }
            );
        }

        // Check blocked periods.
        const blocked = await env.DB.prepare(`
            SELECT id
            FROM blocked_times
            WHERE business_id = ?
              AND start_at < ?
              AND end_at > ?
            LIMIT 1
        `).bind(businessId, endAt, startAt).first();

        if (blocked) {
            return Response.json(
                { error: "That time is unavailable." },
                { status: 409 }
            );
        }

        // Check existing confirmed appointments.
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
            duration,
            name.trim(),
            phone.trim(),
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
