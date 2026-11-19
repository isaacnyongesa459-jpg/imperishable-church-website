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
    const usdAmount = document.getElementById("usdAmount");
    const exchangeRateElement = document.getElementById("exchangeRate");
    const exchangeRateUpdated = document.getElementById("exchangeRateUpdated");

    let usdToKesRate = null;

    // M-Pesa Elements
    const mpesaAmount = document.getElementById("customMpesaAmount");
    const mpesaPhone = document.getElementById("mpesaPhoneNumber");
    const mpesaBtn = document.getElementById("mpesaBtn");

    // Paystack Elements
    const paystackEmail = document.getElementById("paystackEmail");
    const paystackAmount = document.getElementById("paystackAmount");
    const paystackBtn = document.getElementById("paystackBtn");

    // PayPal Elements
    const paypalEmail = document.getElementById("paypalEmail");
    const paypalAmount = document.getElementById("paypalAmount");
    const paypalBtn = document.getElementById("paypalBtn");
    const paypalStatus = document.getElementById("paypalStatus");
    const paypalKesEquivalent = document.getElementById("paypalKesEquivalent");
    const paypalExchangeRate = document.getElementById("paypalExchangeRate");
    let paypalRate = null;

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
                throw new Error("Invalid donation total.");
            }

            // Display the confirmed donation total in Kenyan shillings.
            mainAmount.textContent = `KES ${formatKES(total)}`;

            // Display an estimated USD equivalent when a rate is available.
            if (usdAmount) {
                if (usdToKesRate !== null && usdToKesRate > 0) {
                    usdAmount.textContent =
                        "$" + (total / usdToKesRate).toLocaleString(
                            "en-US",
                            {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                            }
                        );
                } else {
                    usdAmount.textContent =
                        "USD equivalent unavailable";
                }
            }
        } catch (error) {
            console.error("Donation total error:", error);
        }
    }

    // Initial load call
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
    // CHECK PAYMENT STATUS (M-PESA)
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
    // PAYSTACK SERVER-VERIFIED DONATION
    // ========================================
    async function verifyReturnedPaystackPayment() {
        const params = new URLSearchParams(window.location.search);
        const reference = params.get("reference") || params.get("trxref");
        if (!reference) return;
        window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
        showToast("Checking your donation securely with Paystack...");
        try {
            const response = await fetch(`${API_BASE_URL}/api/donations/paystack/verify`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reference })
            });
            const data = await readResponse(response);
            if (data.status !== "completed") {
                showToast(data.message || "Payment is still being processed. Please check again shortly.");
                return;
            }
            showToast(`${data.message} Reference: ${data.reference}`);
            if (paystackEmail) paystackEmail.value = "";
            if (paystackAmount) paystackAmount.value = "";
            await loadDonationTotal();
        } catch (error) {
            showToast(error.message || "We could not verify this payment. Please contact the church with your Paystack reference.");
        }
    }
    verifyReturnedPaystackPayment();

    if (paystackBtn) {
        paystackBtn.addEventListener("click", async (event) => {
            event.preventDefault();
            const email = paystackEmail ? paystackEmail.value.trim() : "";
            const amount = Number(paystackAmount ? paystackAmount.value : 0);
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                showToast("Please enter a valid email address for Paystack.");
                if (paystackEmail) paystackEmail.focus();
                return;
            }
            if (!Number.isSafeInteger(amount) || amount < 10 || amount > 250000) {
                showToast("Enter a whole-number donation between KES 10 and KES 250,000.");
                if (paystackAmount) paystackAmount.focus();
                return;
            }
            const originalHTML = paystackBtn.innerHTML;
            paystackBtn.disabled = true;
            paystackBtn.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Connecting securely...';
            try {
                const response = await fetch(`${API_BASE_URL}/api/donations/paystack/initialize`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, amount })
                });
                const data = await readResponse(response);
                if (!data.authorizationUrl || !data.reference) {
                    throw new Error("Paystack did not return a secure checkout link.");
                }
                window.location.assign(data.authorizationUrl);
            } catch (error) {
                showToast(error.message || "Unable to start Paystack checkout. Please try again.");
                paystackBtn.disabled = false;
                paystackBtn.innerHTML = originalHTML;
            }
        });
    }

    if (paystackAmount) {
        paystackAmount.addEventListener("input", () => {
            if (Number(paystackAmount.value) < 0) paystackAmount.value = "";
        });
    }

    // ========================================
    // PAYPAL
    // ========================================
    function formatKes(value) {
        return Number(value).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function updatePaypalConversion() {
        const amount = Number(paypalAmount ? paypalAmount.value : 0);
        if (!paypalKesEquivalent || !paypalRate || !Number.isFinite(amount) || amount <= 0) {
            if (paypalKesEquivalent) paypalKesEquivalent.textContent = "Enter an amount to see the KES equivalent.";
            return;
        }
        paypalKesEquivalent.textContent = `USD ${amount.toFixed(2)} ≈ KES ${formatKes(amount * paypalRate)}`;
    }

    function loadPayPalSdk(clientId, environment) {
        return new Promise((resolve, reject) => {
            if (window.paypal) return resolve(window.paypal);
            const script = document.createElement("script");
            script.src = `${environment === "live" ? "https://www.paypal.com" : "https://www.sandbox.paypal.com"}/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture&components=buttons`;
            script.onload = () => resolve(window.paypal);
            script.onerror = () => reject(new Error("PayPal checkout could not be loaded."));
            document.head.appendChild(script);
        });
    }

    async function setupPayPal() {
        if (!paypalBtn) return;
        try {
            const response = await fetch(`${API_BASE_URL}/api/donations/paypal/config`);
            const config = await response.json();
            if (!response.ok || !config.usdToKes) throw new Error(config.error || "PayPal exchange rate is unavailable.");
            paypalRate = Number(config.usdToKes);
            if (paypalExchangeRate) paypalExchangeRate.textContent = `1 USD ≈ KES ${formatKes(paypalRate)} · rate refreshed ${new Date(config.rateUpdatedAt).toLocaleString("en-KE")}`;
            usdToKesRate = paypalRate;
            if (exchangeRateElement) exchangeRateElement.textContent = `1 USD ≈ KES ${formatKES(usdToKesRate)} · updated ${new Date(config.rateUpdatedAt).toLocaleString("en-KE")}`;
            loadDonationTotal();
            updatePaypalConversion();
            if (!config.enabled || !config.clientId) {
                if (paypalStatus) paypalStatus.textContent = "PayPal is not configured on the donation server yet.";
                return;
            }
            const paypal = await loadPayPalSdk(config.clientId, config.environment);
            await paypal.Buttons({
                style: { layout: "vertical", shape: "rect", label: "paypal" },
                createOrder: async () => {
                    const email = String(paypalEmail?.value || "").trim().toLowerCase();
                    const amountUsd = Number(paypalAmount?.value || 0);
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
                    if (!Number.isFinite(amountUsd) || amountUsd < 1 || amountUsd > 10000) throw new Error("Enter a PayPal donation between USD 1 and USD 10,000.");
                    if (paypalStatus) paypalStatus.textContent = "Creating your secure PayPal donation order…";
                    const orderResponse = await fetch(`${API_BASE_URL}/api/donations/paypal/create-order`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email, amountUsd })
                    });
                    const order = await orderResponse.json();
                    if (!orderResponse.ok || !order.orderId) throw new Error(order.error || "Could not start PayPal checkout.");
                    paypalRate = Number(order.usdToKes) || paypalRate;
                    updatePaypalConversion();
                    return order.orderId;
                },
                onApprove: async (data) => {
                    if (paypalStatus) paypalStatus.textContent = "Confirming your PayPal payment…";
                    const captureResponse = await fetch(`${API_BASE_URL}/api/donations/paypal/capture-order`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ orderId: data.orderID })
                    });
                    const result = await captureResponse.json();
                    if (!captureResponse.ok || result.status !== "completed") throw new Error(result.message || result.error || "PayPal did not confirm this donation.");
                    if (paypalStatus) paypalStatus.textContent = `Donation confirmed: USD ${Number(result.amountUsd).toFixed(2)} ≈ KES ${formatKes(result.amountKes)}. PayPal capture: ${result.captureId}.`;
                    if (paypalAmount) paypalAmount.value = "";
                    return result;
                },
                onCancel: () => { if (paypalStatus) paypalStatus.textContent = "PayPal checkout was cancelled. No donation was recorded."; },
                onError: (error) => { console.error("PayPal error:", error); if (paypalStatus) paypalStatus.textContent = "PayPal could not complete this donation. No donation was recorded."; }
            }).render(paypalBtn);
        } catch (error) {
            console.error("PayPal setup error:", error);
            if (paypalStatus) paypalStatus.textContent = error.message || "PayPal is temporarily unavailable.";
        }
    }

    if (paypalAmount) paypalAmount.addEventListener("input", updatePaypalConversion);
    setupPayPal();

});
