// ========================================
// IMPERISHABLE CROWN BIBLE BAPTIST CHURCH
// DONATION PAGE JAVASCRIPT
// ========================================

document.addEventListener("DOMContentLoaded", () => {

    const hamburger =
        document.getElementById("hamburger");

    const dropdownMenu =
        document.getElementById("dropdownMenu");

    const toast =
        document.getElementById("toastNotification");


    // ========================================
    // HAMBURGER MENU
    // ========================================

    if (hamburger && dropdownMenu) {

        hamburger.addEventListener("click", () => {

            dropdownMenu.classList.toggle("show");

            const opened =
                dropdownMenu.classList.contains("show");

            hamburger.setAttribute(
                "aria-expanded",
                opened
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

                dropdownMenu.classList.remove("show");

                hamburger.setAttribute(
                    "aria-expanded",
                    "false"
                );

                hamburger.innerHTML =
                    '<i class="fas fa-bars"></i>';

            }

        });

    }


    // ========================================
    // TOAST MESSAGE
    // ========================================

    function showToast(message) {

        if (!toast) return;

        toast.textContent = message;

        toast.classList.add("show");

        setTimeout(() => {

            toast.classList.remove("show");

        }, 4000);

    }


    // ========================================
    // LOAD DONATION CONFIGURATION
    // ========================================

    async function loadDonationConfig() {

        try {

            const response =
                await fetch("donation-config.json");

            if (!response.ok) {
                throw new Error(
                    "Unable to load donation configuration."
                );
            }

            const config =
                await response.json();


            // Display total contributions

            if (config.totalContributions !== undefined) {

                const amount =
                    Number(config.totalContributions)
                    .toLocaleString(
                        "en-KE",
                        {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        }
                    );

                document.getElementById("mainAmount")
                    .textContent =
                    `KES ${amount}`;

            }


            // Display bank information

            if (config.bank) {

                document.getElementById("bankName")
                    .textContent =
                    config.bank.bankName || "Not provided";

                document.getElementById("accountName")
                    .textContent =
                    config.bank.accountName || "Not provided";

                document.getElementById("accountNumber")
                    .textContent =
                    config.bank.accountNumber || "Not provided";

                document.getElementById("bankBranch")
                    .textContent =
                    config.bank.branch || "Not provided";

            }

        } catch (error) {

            console.error(error);

            showToast(
                "Donation information could not be loaded."
            );

        }

    }


    loadDonationConfig();


    // ========================================
    // M-PESA AMOUNT BUTTONS
    // ========================================

    const amountButtons =
        document.querySelectorAll(".amount-btn");


    const mpesaAmount =
        document.getElementById("customMpesaAmount");


    amountButtons.forEach((button) => {

        button.addEventListener("click", () => {

            const amount =
                button.dataset.amount;

            mpesaAmount.value = amount;


            amountButtons.forEach((btn) => {
                btn.classList.remove("selected");
            });

            button.classList.add("selected");

        });

    });


    // ========================================
    // M-PESA
    // ========================================

    const mpesaBtn =
        document.getElementById("mpesaBtn");


    if (mpesaBtn) {

        mpesaBtn.addEventListener("click", async () => {

            const amount =
                Number(mpesaAmount.value);

            const phone =
                document
                    .getElementById("mpesaPhoneNumber")
                    .value
                    .trim();


            if (!amount || amount < 10) {

                showToast(
                    "Please enter a valid donation amount."
                );

                return;

            }


            if (!phone) {

                showToast(
                    "Please enter your M-Pesa phone number."
                );

                return;

            }


            /*
             * BACKEND INTEGRATION
             *
             * Later this request will go to:
             *
             * POST /api/donations/mpesa
             *
             * The Node.js backend will communicate
             * with Safaricom Daraja.
             */

            try {

                const response =
                    await fetch("/api/donations/mpesa", {

                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            amount: amount,
                            phone: phone,
                            currency: "KES",
                            purpose: "Church Donation"
                        })

                    });


                const data =
                    await response.json();


                if (!response.ok) {

                    throw new Error(
                        data.message ||
                        "M-Pesa payment could not be started."
                    );

                }


                showToast(
                    data.message ||
                    "Check your phone for the M-Pesa prompt."
                );


            } catch (error) {

                console.error(error);

                showToast(
                    "M-Pesa service is not connected yet."
                );

            }

        });

    }


    // ========================================
    // AIRTEL MONEY
    // ========================================

    const airtelBtn =
        document.getElementById("airtelBtn");


    if (airtelBtn) {

        airtelBtn.addEventListener("click", async () => {

            const amount =
                Number(
                    document.getElementById(
                        "customAirtelAmount"
                    ).value
                );


            const phone =
                document.getElementById(
                    "airtelPhoneNumber"
                ).value.trim();


            if (!amount || amount < 10) {

                showToast(
                    "Please enter a valid donation amount."
                );

                return;

            }


            if (!phone) {

                showToast(
                    "Please enter your Airtel phone number."
                );

                return;

            }


            try {

                const response =
                    await fetch(
                        "/api/donations/airtel",
                        {

                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body: JSON.stringify({
                                amount: amount,
                                phone: phone,
                                currency: "KES",
                                purpose: "Church Donation"
                            })

                        }
                    );


                const data =
                    await response.json();


                if (!response.ok) {

                    throw new Error(
                        data.message ||
                        "Airtel payment failed."
                    );

                }


                showToast(
                    data.message ||
                    "Airtel Money payment initiated."
                );


            } catch (error) {

                console.error(error);

                showToast(
                    "Airtel Money service is not connected yet."
                );

            }

        });

    }


    // ========================================
    // BANK PAYMENT
    // ========================================

    const bankBtn =
        document.getElementById("bankBtn");


    if (bankBtn) {

        bankBtn.addEventListener("click", () => {

            showToast(
                "Bank payment integration will be connected to the backend."
            );

        });

    }


    // ========================================
    // PAYPAL
    // ========================================

    const paypalBtn =
        document.getElementById("paypalBtn");


    if (paypalBtn) {

        paypalBtn.addEventListener("click", async () => {

            const amount =
                Number(
                    document.getElementById(
                        "paypalAmount"
                    ).value
                );


            if (!amount || amount <= 0) {

                showToast(
                    "Please enter a valid PayPal amount."
                );

                return;

            }


            /*
             * Later:
             *
             * POST /api/donations/paypal
             *
             * Backend creates the PayPal order.
             */

            try {

                const response =
                    await fetch(
                        "/api/donations/paypal",
                        {

                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body: JSON.stringify({
                                amount: amount,
                                currency: "USD",
                                purpose: "Church Donation"
                            })

                        }
                    );


                const data =
                    await response.json();


                if (!response.ok) {

                    throw new Error(
                        data.message ||
                        "PayPal payment could not be started."
                    );

                }


                if (data.approvalUrl) {

                    window.location.href =
                        data.approvalUrl;

                } else {

                    showToast(
                        data.message ||
                        "PayPal integration is not ready."
                    );

                }


            } catch (error) {

                console.error(error);

                showToast(
                    "PayPal service is not connected yet."
                );

            }

        });

    }


    // ========================================
    // VENMO
    // ========================================

    const venmoBtn =
        document.getElementById("venmoBtn");


    if (venmoBtn) {

        venmoBtn.addEventListener("click", async () => {

            const amount =
                Number(
                    document.getElementById(
                        "venmoAmount"
                    ).value
                );


            if (!amount || amount <= 0) {

                showToast(
                    "Please enter a valid Venmo amount."
                );

                return;

            }


            /*
             * Later:
             *
             * POST /api/donations/venmo
             *
             * The backend will handle the
             * payment-provider integration.
             */

            try {

                const response =
                    await fetch(
                        "/api/donations/venmo",
                        {

                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body: JSON.stringify({
                                amount: amount,
                                currency: "USD",
                                purpose: "Church Donation"
                            })

                        }
                    );


                const data =
                    await response.json();


                if (!response.ok) {

                    throw new Error(
                        data.message ||
                        "Venmo payment could not be started."
                    );

                }


                if (data.approvalUrl) {

                    window.location.href =
                        data.approvalUrl;

                } else {

                    showToast(
                        data.message ||
                        "Venmo integration is not ready."
                    );

                }


            } catch (error) {

                console.error(error);

                showToast(
                    "Venmo service is not connected yet."
                );

            }

        });

    }

});