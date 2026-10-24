
/* ========================================
   IMPERISHABLE CROWN BIBLE BAPTIST CHURCH
   DONATION PAGE JAVASCRIPT
======================================== */

document.addEventListener("DOMContentLoaded", () => {
    // ========================================
    // BACKEND CONFIGURATION
    // Replace this placeholder after deploying
    // the backend to Render.
    // ========================================

    const API_BASE_URL = "https://YOUR-RENDER-SERVICE.onrender.com";

    // ========================================
    // PAGE ELEMENTS
    // ========================================

    const hamburger = document.getElementById("hamburger");
    const dropdownMenu = document.getElementById("dropdownMenu");
    const toast = document.getElementById("toastNotification");
    const mainAmount = document.getElementById("mainAmount");
    const mpesaAmount = document.getElementById("customMpesaAmount");
    const mpesaPhone = document.getElementById("mpesaPhoneNumber");
    const mpesaBtn = document.getElementById("mpesaBtn");
    const paypalAmount = document.getElementById("paypalAmount");
    const paypalBtn = document.getElementById("paypalBtn");

    // ========================================
    // NAVIGATION MENU
    // ========================================

    function closeMenu() {
        if (!hamburger || !dropdownMenu) return;

        dropdownMenu.classList.remove("show");
        hamburger.setAttribute("aria-expanded", "false");
        hamburger.innerHTML = '<i class="fas fa-bars"></i>';
    }

    if (hamburger && dropdownMenu) {
        hamburger.setAttribute("aria-expanded", "false");

        hamburger.addEventListener("click", (event) => {
            event.stopPropagation();

            dropdownMenu.classList.toggle("show");

            const opened = dropdownMenu.classList.contains("show");

            hamburger.setAttribute(
                "aria-expanded",
                opened ? "true" : "false"
            );

            hamburger.innerHTML = opened
                ? '<i class="fas fa-times"></i>'
                : '<i class="fas fa-bars"></i>';
        });

        document.addEventListener("click", (event) => {
            if (
                !dropdownMenu.contains(event.target) &&
                !hamburger.contains(event.target)
            ) {
                closeMenu();
            }
        });

        dropdownMenu
            .querySelectorAll(".dropdown-item")
            .forEach((item) => {
                item.addEventListener("click", closeMenu);
            });
    }

    // ========================================
    // TOAST NOTIFICATIONS
    // ========================================

    let toastTimer;

    function showToast(message) {
        if (!toast) {
            alert(message);
            return;
        }

        toast.textContent = message;
        toast.classList.add("show");

        clearTimeout(toastTimer);

        toastTimer = setTimeout(() => {
            toast.classList.remove("show");
        }, 5000);
    }

    // ========================================
    // SAFE JSON RESPONSE HANDLING
    // ========================================

    async function readResponse(response) {
        let data;

        try {
            data = await response.json();
        } catch {
            throw new Error(
                "The server returned an unreadable response. Please try again."
            );
        }

        if (!response.ok) {
            throw new Error(
                data.error ||
                data.message ||
                "The request failed. Please try again."
            );
        }

        return data;
    }

    // ========================================
    // LOAD TOTAL CONTRIBUTIONS
    // ========================================

    async function loadDonationTotal() {
        if (!mainAmount) return;

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/donations/total`
            );

            const data = await readResponse(response);

            const total = Number(data.total);

            if (!Number.isFinite(total)) {
                throw new Error("Invalid donation total.");
            }

            mainAmount.textContent = `KES ${total.toLocaleString(
                "en-KE",
                {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }
            )}`;
        } catch (error) {
            console.error("Donation total error:", error);

            // Keep the existing displayed value if the
            // backend is temporarily unavailable.
        }
    }

    loadDonationTotal();

    // ========================================
    // PRESET M-PESA AMOUNTS
    // ========================================

    const amountButtons = document.querySelectorAll(".amount-btn");

    amountButtons.forEach((button) => {
        button.addEventListener("click", () => {
            if (mpesaAmount) {
                mpesaAmount.value = button.dataset.amount || "";
            }

            amountButtons.forEach((item) => {
                item.classList.remove("selected");
            });

            button.classList.add("selected");
        });
    });

    if (mpesaAmount) {
        mpesaAmount.addEventListener("input", () => {
            amountButtons.forEach((button) => {
                button.classList.remove("selected");
            });

            if (Number(mpesaAmount.value) < 0) {
                mpesaAmount.value = "";
            }
        });
    }

    // ========================================
    // M-PESA PHONE NUMBER NORMALIZATION
    // ========================================

    function normalizeKenyanPhone(value) {
        let phone = value.replace(/[\s()-]/g, "");

        if (phone.startsWith("+")) {
            phone = phone.slice(1);
        }

        if (phone.startsWith("0")) {
            phone = "254" + phone.slice(1);
        } else if (
            phone.startsWith("7") ||
            phone.startsWith("1")
        ) {
            phone = "254" + phone;
        }

        if (!/^254[17]\d{8}$/.test(phone)) {
            throw new Error(
                "Enter a valid Kenyan mobile number, such as 0712345678."
            );
        }

        return phone;
    }

    // ========================================
    // CHECK M-PESA PAYMENT STATUS
    // ========================================

    async function checkPaymentStatus(checkoutRequestId) {
        const maxAttempts = 12;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            await new Promise((resolve) => setTimeout(resolve, 5000));

            try {
                const response = await fetch(
                    `${API_BASE_URL}/api/donations/status/${encodeURIComponent(
                        checkoutRequestId
                    )}`
                );

                const data = await readResponse(response);

                if (data.status === "completed") {
                    const receipt = data.mpesa_receipt_number
                        ? ` Receipt: ${data.mpesa_receipt_number}.`
                        : "";

                    showToast(
                        `Donation confirmed successfully!${receipt}`
                    );

                    await loadDonationTotal();
                    return;
                }

                if (data.status === "failed") {
                    showToast(
                        data.result_desc ||
                        "The M-PESA payment was not completed."
                    );
                    return;
                }
            } catch (error) {
                console.error("Payment status check error:", error);
            }
        }

        showToast(
            "Your payment is still awaiting confirmation. Please check your M-PESA messages before trying again."
        );
    }

    // ========================================
    // M-PESA DONATION
    // ========================================

    if (mpesaBtn) {
        mpesaBtn.addEventListener("click", async () => {
            const amount = Number(
                mpesaAmount ? mpesaAmount.value : 0
            );

            const rawPhone = mpesaPhone
                ? mpesaPhone.value.trim()
                : "";

            if (
                !Number.isSafeInteger(amount) ||
                amount < 10 ||
                amount > 250000
            ) {
                showToast(
                    "Enter a whole-number donation between KES 10 and KES 250,000."
                );
                return;
            }

            let phone;

            try {
                phone = normalizeKenyanPhone(rawPhone);
            } catch (error) {
                showToast(error.message);
                return;
            }

            const originalButton = mpesaBtn.innerHTML;

            mpesaBtn.disabled = true;
            mpesaBtn.innerHTML =
                '<i class="fas fa-spinner fa-spin"></i> Processing...';

            try {
                if (
                    API_BASE_URL.includes("YOUR-RENDER-SERVICE")
                ) {
                    throw new Error(
                        "The backend URL has not been configured yet."
                    );
                }

                const response = await fetch(
                    `${API_BASE_URL}/api/donations/mpesa`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            amount,
                            phone,
                            currency: "KES",
                            purpose: "Church Donation"
                        })
                    }
                );

                const data = await readResponse(response);

                if (!data.checkoutRequestId) {
                    showToast(
                        data.message ||
                        "The request was sent, but a payment reference was not returned. Check your phone and payment status."
                    );
                    return;
                }

                showToast(
                    data.message ||
                    "Payment request sent. Check your phone for the M-PESA prompt."
                );

                // Do not report success until the backend
                // confirms the payment through its callback.
                await checkPaymentStatus(data.checkoutRequestId);
            } catch (error) {
                console.error("M-PESA error:", error);

                showToast(
                    error.message ||
                    "Unable to start M-PESA payment. Please try again."
                );
            } finally {
                mpesaBtn.disabled = false;
                mpesaBtn.innerHTML = originalButton;
            }
        });
    }

    // ========================================
    // PAYPAL SECTION
    // Backend integration is not yet implemented.
    // ========================================

    if (paypalBtn) {
        paypalBtn.addEventListener("click", () => {
            showToast(
                "PayPal payments are not connected yet. Please use M-PESA while this feature is being configured."
            );
        });
    }

    // ========================================
    // PREVENT NEGATIVE PAYPAL AMOUNTS
    // ========================================

    if (paypalAmount) {
        paypalAmount.addEventListener("input", () => {
            if (Number(paypalAmount.value) < 0) {
                paypalAmount.value = "";
            }
        });
    }
});
