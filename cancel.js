
const params = new URLSearchParams(window.location.search);
const token = params.get("token");

const loading = document.getElementById("loading");
const appointmentSection = document.getElementById("appointment");
const message = document.getElementById("message");
const cancelButton = document.getElementById("cancelButton");

function showMessage(text) {
    message.textContent = text;
}

function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
        timeZone: "America/Argentina/Buenos_Aires"
    });
}

function formatTime(dateString) {
    return new Date(dateString).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Argentina/Buenos_Aires"
    });
}

async function loadAppointment() {
    if (!token) {
        loading.hidden = true;
        showMessage("Invalid cancellation link.");
        return;
    }

    try {
        const response = await fetch(
            `/api/cancel?token=${encodeURIComponent(token)}`
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Unable to load appointment.");
        }

        const appointment = data.appointment;

        document.getElementById("service").textContent =
            appointment.service_name;

        document.getElementById("customer").textContent =
            appointment.customer_name;

        document.getElementById("date").textContent =
            formatDate(appointment.start_at);

        document.getElementById("time").textContent =
            formatTime(appointment.start_at);

        document.getElementById("status").textContent =
            appointment.status;

        loading.hidden = true;
        appointmentSection.hidden = false;

        if (appointment.status !== "confirmed") {
            cancelButton.hidden = true;
        }

    } catch (error) {
        loading.hidden = true;
        showMessage(error.message);
    }
}

cancelButton.addEventListener("click", async () => {
    const confirmed = window.confirm(
        "Are you sure you want to cancel this appointment?"
    );

    if (!confirmed) return;

    cancelButton.disabled = true;
    showMessage("Cancelling appointment...");

    try {
        const response = await fetch("/api/cancel", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ token })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Cancellation failed.");
        }

        document.getElementById("status").textContent = "cancelled";
        cancelButton.hidden = true;

        showMessage("Your appointment has been cancelled successfully.");

    } catch (error) {
        showMessage(error.message);
        cancelButton.disabled = false;
    }
});

loadAppointment();
