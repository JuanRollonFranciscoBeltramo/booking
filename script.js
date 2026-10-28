
const serviceButtons = document.querySelectorAll(".select-service");
const selectedService = document.querySelector("#selected-service");
const bookingForm = document.querySelector("#booking-form");
const bookingMessage = document.querySelector("#booking-message");
const bookingDate = document.querySelector("#booking-date");
const bookingTime = document.querySelector("#booking-time");

function normalizeArgentineWhatsAppNumber(phone) {
    let digits = phone.replace(/\D/g, "");

    // Convert an international exit prefix (00) to normal digits
    if (digits.startsWith("00")) {
        digits = digits.slice(2);
    }

    // Already includes Argentina's mobile prefix
    if (digits.startsWith("549")) {
        return digits;
    }

    // Already has Argentina's country code
    if (digits.startsWith("54")) {
        return digits;
    }

    // Remove the leading 0 used in local dialing
    if (digits.startsWith("0")) {
        digits = digits.slice(1);
    }

    // Local Argentine number: assume area code + subscriber number
    if (digits.length === 10) {
        return "549" + digits;
    }

    // We can't safely determine the correct format
    return null;
}
// Set today's date as the earliest selectable date
function getLocalDate() {
    const today = new Date();

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

bookingDate.min = getLocalDate();

// Update the footer year
document.querySelector("#year").textContent =
    new Date().getFullYear();

// Select a service
serviceButtons.forEach((button) => {
    button.addEventListener("click", () => {
        selectedService.value = button.dataset.service;

        serviceButtons.forEach((item) => {
            const isSelected = item === button;

            item.textContent = isSelected
                ? "Selected ✓"
                : "Select";

            item.classList.toggle("selected", isSelected);
        });

        bookingMessage.textContent = "";
        bookingMessage.classList.remove("success");
    });
});

// Clear feedback when the customer changes the form
bookingForm.addEventListener("input", clearMessage);
bookingForm.addEventListener("change", clearMessage);

function clearMessage() {
    bookingMessage.textContent = "";
    bookingMessage.classList.remove("success");
}


bookingForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!bookingForm.reportValidity()) return;

    if (!selectedService.value) {
        bookingMessage.textContent = "Please select a service first.";
        return;
    }

    if (bookingDate.value < getLocalDate()) {
        bookingMessage.textContent = "Please choose today or a future date.";
        return;
    }

    const rawPhone = document
        .querySelector("#customer-phone")
        .value.trim();

    const normalizedPhone =
        normalizeArgentineWhatsAppNumber(rawPhone);

    if (!normalizedPhone) {
        bookingMessage.textContent =
            "Please enter a valid phone number.";
        return;
    }

    const booking = {
        service: selectedService.value,
        date: bookingDate.value,
        time: bookingTime.value,
        name: document.querySelector("#customer-name").value.trim(),
        phone: normalizedPhone
    };

    const submitButton = bookingForm.querySelector(
        'button[type="submit"]'
    );

    submitButton.disabled = true;
    submitButton.textContent = "Booking...";
    bookingMessage.textContent = "";

    try {
        const response = await fetch("/api/bookings", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(booking)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Booking failed.");
        }

        bookingMessage.textContent =
            `Appointment confirmed! Your booking number is ${result.appointmentId}.`;

        bookingMessage.classList.add("success");
        bookingForm.reset();
        selectedService.value = "";

        serviceButtons.forEach((button) => {
            button.textContent = "Select";
            button.classList.remove("selected");
        });

    } catch (error) {
        bookingMessage.textContent = error.message;
        bookingMessage.classList.remove("success");
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Request Booking";
    }
});
