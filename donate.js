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
    const inrAmount = document.getElementById("inrAmount");
    const exchangeRateElement = document.getElementById("exchangeRate");

    let usdToKesRate = null;
    let currencyRates = {};
    let currencyRateDate = null;

    // M-Pesa Elements (KES only)
    const mpesaAmount = document.getElementById("customMpesaAmount");
    const mpesaPhone = document.getElementById("mpesaPhoneNumber");
    const mpesaBtn = document.getElementById("mpesaBtn");

    // PayPal Elements (PayPal settles the server-verified order in USD)
    const paypalEmail = document.getElementById("paypalEmail");
    const donationCurrency = document.getElementById("donationCurrency");
    const donationCurrencyLabel = document.getElementById("donationCurrencyLabel");
    const donationAmount = document.getElementById("donationAmount");
    const paypalBtn = document.getElementById("paypalBtn");
    const paypalStatus = document.getElementById("paypalStatus");
    const kesEquivalent = document.getElementById("kesEquivalent");
    const usdEquivalent = document.getElementById("usdEquivalent");
    const inrEquivalent = document.getElementById("inrEquivalent");
    const currencyRateInfo = document.getElementById("currencyRateInfo");

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

            // Display USD and INR estimates from this same confirmed KES total.
            if (usdAmount) {
                const kesToUsdRate = Number(currencyRates["KES/USD"]);
                if (Number.isFinite(kesToUsdRate) && kesToUsdRate > 0) {
                    usdAmount.textContent = formatCurrency(total * kesToUsdRate, "USD");
                } else {
                    usdAmount.textContent =
                        "USD equivalent unavailable";
                }
            }
            if (inrAmount) {
                const kesToInrRate = Number(currencyRates["KES/INR"]);
                if (Number.isFinite(kesToInrRate) && kesToInrRate > 0) {
                    inrAmount.textContent = formatCurrency(total * kesToInrRate, "INR");
                } else {
                    inrAmount.textContent = "INR equivalent unavailable";
                }
            }
        } catch (error) {
            console.error("Donation total error:", error);
        }
    }


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
    // THREE-CURRENCY CONVERSION + PAYPAL LIVE
    // ========================================
    const currencyNames = { KES: "Kenyan Shillings", USD: "United States Dollars", INR: "Indian Rupees" };

    function formatCurrency(amount, currency) {
        const locales = { KES: "en-KE", USD: "en-US", INR: "en-IN" };
        return new Intl.NumberFormat(locales[currency] || "en", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(amount));
    }

    function getRate(base, quote) {
        return base === quote ? 1 : Number(currencyRates[`${base}/${quote}`]);
    }

    function updateCurrencyEquivalents() {
        if (!donationAmount || !donationCurrency) return;
        const base = donationCurrency.value;
        const amount = Number(donationAmount.value);
        if (!Number.isFinite(amount) || amount <= 0 || !Object.keys(currencyRates).length) {
            [kesEquivalent, usdEquivalent, inrEquivalent].forEach((element) => { if (element) element.textContent = "Enter an amount to see the equivalent."; });
            return;
        }
        const values = { KES: amount * getRate(base, "KES"), USD: amount * getRate(base, "USD"), INR: amount * getRate(base, "INR") };
        if (kesEquivalent) kesEquivalent.textContent = formatCurrency(values.KES, "KES");
        if (usdEquivalent) usdEquivalent.textContent = formatCurrency(values.USD, "USD");
        if (inrEquivalent) inrEquivalent.textContent = formatCurrency(values.INR, "INR");
    }

    function updateCurrencyInput() {
        if (!donationCurrency || !donationAmount) return;
        const currency = donationCurrency.value;
        const maximum = currency === "KES" ? 250000 : currency === "INR" ? 900000 : 10000;
        donationAmount.max = String(maximum);
        donationAmount.step = currency === "KES" ? "1" : "0.01";
        donationAmount.placeholder = currency === "KES" ? "e.g. 1000" : currency === "USD" ? "e.g. 10.00" : "e.g. 1000";
        if (donationCurrencyLabel) donationCurrencyLabel.textContent = currency;
        updateCurrencyEquivalents();
    }

    async function loadCurrencyRates() {
        const response = await fetch(`${API_BASE_URL}/api/currency/rates`);
        const data = await readResponse(response);
        if (!data.rates || !data.rateDate) throw new Error("Indicative currency rates are temporarily unavailable.");
        currencyRates = data.rates;
        currencyRateDate = data.rateDate;
        usdToKesRate = getRate("USD", "KES");
        if (currencyRateInfo) currencyRateInfo.textContent = `${data.source} indicative reference rates · date ${data.rateDate}`;
        if (exchangeRateElement) exchangeRateElement.textContent = `Indicative rate: 1 USD ≈ ${formatCurrency(usdToKesRate, "KES")} · date ${data.rateDate}`;
        updateCurrencyEquivalents();
    }

    async function setupPayPal() {
        if (!paypalBtn) return;
        try {
            await loadCurrencyRates();
            await loadDonationTotal();
            const response = await fetch(`${API_BASE_URL}/api/donations/paypal/config`);
            const config = await readResponse(response);
            if (!config.enabled || !config.clientId) {
                if (paypalStatus) paypalStatus.textContent = "PayPal Live is not configured on the donation server.";
                return;
            }
            const paypal = await loadPayPalSdk(config.clientId, config.environment);
            await paypal.Buttons({
                style: { layout: "vertical", shape: "rect", label: "paypal" },
                createOrder: async () => {
                    const email = String(paypalEmail?.value || "").trim().toLowerCase();
                    const currency = String(donationCurrency?.value || "KES").toUpperCase();
                    const amount = Number(donationAmount?.value || 0);
                    const maximum = currency === "KES" ? 250000 : currency === "INR" ? 900000 : 10000;
                    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
                    if (!Number.isFinite(amount) || amount <= 0 || amount > maximum) throw new Error(`Enter a valid ${currency} donation amount up to ${maximum.toLocaleString("en-US")}.`);
                    if (paypalStatus) paypalStatus.textContent = "Creating your secure PayPal donation order…";
                    const orderResponse = await fetch(`${API_BASE_URL}/api/donations/paypal/create-order`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, currency, amount }) });
                    const order = await readResponse(orderResponse);
                    if (!order.orderId) throw new Error("PayPal did not return a secure order.");
                    return order.orderId;
                },
                onApprove: async (data) => {
                    if (paypalStatus) paypalStatus.textContent = "Confirming your PayPal payment…";
                    const captureResponse = await fetch(`${API_BASE_URL}/api/donations/paypal/capture-order`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: data.orderID }) });
                    const result = await readResponse(captureResponse);
                    if (result.status !== "completed") throw new Error(result.message || "PayPal did not confirm this donation.");
                    if (paypalStatus) paypalStatus.textContent = `Donation confirmed: ${formatCurrency(result.originalAmount, result.originalCurrency)} · PayPal settled ${formatCurrency(result.amountUsd, "USD")}.`;
                    if (donationAmount) donationAmount.value = "";
                    updateCurrencyEquivalents();
                    await loadDonationTotal();
                },
                onCancel: () => { if (paypalStatus) paypalStatus.textContent = "PayPal checkout was cancelled. No donation was recorded."; },
                onError: (error) => { console.error("PayPal error:", error); if (paypalStatus) paypalStatus.textContent = "PayPal could not complete this donation. No donation was recorded."; }
            }).render(paypalBtn);
        } catch (error) {
            console.error("Currency/PayPal setup error:", error);
            if (currencyRateInfo) currencyRateInfo.textContent = error.message || "Indicative rates are temporarily unavailable.";
            if (paypalStatus) paypalStatus.textContent = error.message || "PayPal is temporarily unavailable.";
        }
    }

    if (donationCurrency) donationCurrency.addEventListener("change", updateCurrencyInput);
    if (donationAmount) donationAmount.addEventListener("input", updateCurrencyEquivalents);
    updateCurrencyInput();
    loadDonationTotal();
    setupPayPal();

});
