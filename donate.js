/* ========================================
   IMPERISHABLE CROWN BIBLE BAPTIST CHURCH
   DONATION PAGE JAVASCRIPT
======================================== */

document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    // ========================================
    // BACKEND CONFIGURATION
    // ========================================

    const API_BASE_URL = "https://imperishable-church-mpesa-backend-fa2a.onrender.com";

    const backendConfigured =
        !API_BASE_URL.includes("YOUR-RENDER-SERVICE");

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

    const amountButtons = document.querySelectorAll(
        '.amount-btn[data-method="mpesa"]'
    );

    // ========================================
    // NAVIGATION MENU
    // ========================================

    function closeMenu() {
        if (!hamburger || !dropdownMenu) return;

        dropdownMenu.classList.remove("show");
        hamburger.setAttribute("aria-expanded", "false");
        hamburger.setAttribute("aria-label", "Open navigation menu");
        hamburger.innerHTML =
            '<i class="fas fa-bars" aria-hidden="true"></i>';
    }

    if (hamburger && dropdownMenu) {
        hamburger.setAttribute("aria-expanded", "false");

        hamburger.addEventListener("click", (event) => {
            event.stopPropagation();

            const isOpen = dropdownMenu.classList.toggle("show");

            hamburger.setAttribute(
                "aria-expanded",
                String(isOpen)
            );

            hamburger.setAttribute(
                "aria-label",
                isOpen ? "Close navigation menu" : "Open navigation menu"
            );

            hamburger.innerHTML = isOpen
                ? '<i class="fas fa-times" aria-hidden="true"></i>'
                : '<i class="fas fa-bars" aria-hidden="true"></i>';
        });

        document.addEventListener("click", (event) => {
            if (
                !dropdownMenu.contains(event.target) &&
                !hamburger.contains(event.target)
            ) {
                closeMenu();
            }
        });

        dropdownMenu.querySelectorAll("a").forEach((link) => {
            link.addEventListener("click", closeMenu);
        });

        document.addEventListener("keydown", (event) => {
            if (
                event.key === "Escape" &&
                dropdownMenu.classList.contains("show")
            ) {
                closeMenu();
                hamburger.focus();
            }
        });

        window.addEventListener("resize", () => {
            if (window.innerWidth > 768) {
                closeMenu();
            }
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
        }, 6000);
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
    // FORMAT KENYAN SHILLINGS
    // ========================================

    function formatKES(amount) {
        return Number(amount).toLocaleString("en-KE", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    // ========================================
    // LOAD CONFIRMED DONATION TOTAL
    // ========================================

    async function loadDonationTotal() {
        if (!mainAmount || !backendConfigured) return;

        try {
            const response = await fetch(
                `${API_BASE_URL}/api/donations/total`
            );

            const data = await readResponse(response);
            const total = Number(data.total);

            if (!Number.isFinite(total) || total < 0) {
                throw new Error("The server returned an invalid donation total.");
            }

            mainAmount.textContent = `KES ${formatKES(total)}`;
        } catch (error) {
            console.error("Donation total error:", error);
        }
    }

    loadDonationTotal();

    // ========================================
    // PRESET M-PESA AMOUNTS
    // ========================================

    function clearSelectedAmounts() {
        amountButtons.forEach((button) => {
            button.classList.remove("selected");
            button.setAttribute("aria-pressed", "false");
        });
    }

    amountButtons.forEach((button) => {
        button.addEventListener("click", () => {
            if (!mpesaAmount) return;

            const amount = Number(button.dataset.amount);

            if (!Number.isSafeInteger(amount) || amount <= 0) {
                showToast("This preset donation amount is invalid.");
                return;
            }

            mpesaAmount.value = String(amount);
            clearSelectedAmounts();

            button.classList.add("selected");
            button.setAttribute("aria-pressed", "true");
        });
    });

    if (mpesaAmount) {
        mpesaAmount.addEventListener("input", () => {
            clearSelectedAmounts();

            if (Number(mpesaAmount.value) < 0) {
                mpesaAmount.value = "";
            }
        });
    }

    // ========================================
    // VALIDATE AND NORMALIZE KENYAN PHONE
    // ========================================

    function normalizeKenyanPhone(value) {
        let phone = value.trim().replace(/[\s()-]/g, "");

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
    // CHECK PAYMENT STATUS
    // ========================================

    function wait(milliseconds) {
        return new Promise((resolve) => {
            setTimeout(resolve, milliseconds);
        });
    }

    async function checkPaymentStatus(checkoutRequestId) {
        const maxAttempts = 12;
        const delayBetweenChecks = 5000;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            await wait(delayBetweenChecks);

            try {
                const response = await fetch(
                    `${API_BASE_URL}/api/donations/status/${encodeURIComponent(
                        checkoutRequestId
                    )}`
                );

                const data = await readResponse(response);

                if (data.status === "completed") {
                    const receipt =
                        data.mpesa_receipt_number ||
                        data.receipt ||
                        data.mpesaReceiptNumber;

                    showToast(
                        "Donation confirmed successfully!" +
                        (receipt ? ` M-PESA receipt: ${receipt}.` : "")
                    );

                    await loadDonationTotal();
                    return;
                }

                if (data.status === "failed") {
                    showToast(
                        data.result_desc ||
                        data.resultDesc ||
                        "The M-PESA payment was not completed. Check your phone and try again if appropriate."
                    );
                    return;
                }
            } catch (error) {
                console.error("Payment status check error:", error);
            }
        }

        showToast(
            "Confirmation is taking longer than expected. Check your M-PESA messages and donation status before attempting another payment."
        );
    }

    // ========================================
    // M-PESA DONATION
    // ========================================

    if (mpesaBtn) {
        mpesaBtn.addEventListener("click", async () => {
            if (!backendConfigured) {
                showToast(
                    "The donation backend has not been configured yet. Finish setting up the backend before testing payments."
                );
                return;
            }

            const amount = Number(
                mpesaAmount ? mpesaAmount.value : 0
            );

            const rawPhone = mpesaPhone
                ? mpesaPhone.value
                : "";

            if (
                !Number.isSafeInteger(amount) ||
                amount < 10 ||
                amount > 250000
            ) {
                showToast(
                    "Enter a whole-number donation between KES 10 and KES 250,000."
                );

                if (mpesaAmount) mpesaAmount.focus();
                return;
            }

            let phone;

            try {
                phone = normalizeKenyanPhone(rawPhone);
            } catch (error) {
                showToast(error.message);

                if (mpesaPhone) mpesaPhone.focus();
                return;
            }

            const originalButton = mpesaBtn.innerHTML;

            mpesaBtn.disabled = true;
            mpesaBtn.innerHTML =
                '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Processing...';

            try {
                const response = await fetch(
                    `${API_BASE_URL}/api/donations/mpesa`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            amount: amount,
                            phone: phone,
                            currency: "KES",
                            purpose: "Church Donation"
                        })
                    }
                );

                const data = await readResponse(response);

                if (!data.checkoutRequestId) {
                    throw new Error(
                        data.message ||
                        "The server did not return a payment reference. Check your payment status before trying again."
                    );
                }

                showToast(
                    data.message ||
                    "Payment request accepted. Check your phone for the M-PESA prompt."
                );

                await checkPaymentStatus(data.checkoutRequestId);
            } catch (error) {
                console.error("M-PESA request error:", error);

                showToast(
                    error.message ||
                    "Unable to start the M-PESA request. Check your connection and payment status."
                );
            } finally {
                mpesaBtn.disabled = false;
                mpesaBtn.innerHTML = originalButton;
            }
        });
    }

    // ========================================
    // PAYPAL
    // ========================================

    if (paypalBtn) {
        paypalBtn.addEventListener("click", () => {
            const amount = Number(
                paypalAmount ? paypalAmount.value : 0
            );

            if (
                paypalAmount &&
                paypalAmount.value.trim() !== "" &&
                (!Number.isSafeInteger(amount) || amount <= 0)
            ) {
                showToast(
                    "Enter a valid whole-number donation amount."
                );
                paypalAmount.focus();
                return;
            }

            showToast(
                "PayPal payments are not connected yet. Please use M-PESA while this feature is being configured."
            );
        });
    }

    if (paypalAmount) {
        paypalAmount.addEventListener("input", () => {
            if (Number(paypalAmount.value) < 0) {
                paypalAmount.value = "";
            }
        });
    }
});
