// ========================================
// IMPERISHABLE CROWN BIBLE BAPTIST CHURCH
// DONATION PAGE JAVASCRIPT
// ========================================

document.addEventListener("DOMContentLoaded", () => {

    // ========================================
    // ELEMENTS
    // ========================================

    const hamburger =
        document.getElementById("hamburger");

    const dropdownMenu =
        document.getElementById("dropdownMenu");

    const toast =
        document.getElementById("toastNotification");

    const mainAmount =
        document.getElementById("mainAmount");

    const mpesaAmount =
        document.getElementById("customMpesaAmount");

    const mpesaPhone =
        document.getElementById("mpesaPhoneNumber");

    const mpesaBtn =
        document.getElementById("mpesaBtn");

    const paypalAmount =
        document.getElementById("paypalAmount");

    const paypalBtn =
        document.getElementById("paypalBtn");


    // ========================================
    // HAMBURGER MENU
    // ========================================

    if (hamburger && dropdownMenu) {

        hamburger.addEventListener("click", (event) => {

            // Prevent document click from immediately
            // closing the menu
            event.stopPropagation();

            dropdownMenu.classList.toggle("show");

            const opened =
                dropdownMenu.classList.contains("show");


            // Update accessibility state
            hamburger.setAttribute(
                "aria-expanded",
                opened ? "true" : "false"
            );


            // Change hamburger icon
            hamburger.innerHTML = opened
                ? '<i class="fas fa-times"></i>'
                : '<i class="fas fa-bars"></i>';

        });


        // Close menu when clicking outside
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


        // Close menu after clicking a navigation link
        const dropdownItems =
            dropdownMenu.querySelectorAll(".dropdown-item");


        dropdownItems.forEach((item) => {

            item.addEventListener("click", () => {

                dropdownMenu.classList.remove("show");

                hamburger.setAttribute(
                    "aria-expanded",
                    "false"
                );

                hamburger.innerHTML =
                    '<i class="fas fa-bars"></i>';

            });

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


            // ========================================
            // DISPLAY TOTAL CONTRIBUTIONS
            // ========================================

            if (
                mainAmount &&
                config.totalContributions !== undefined
            ) {

                const amount =
                    Number(
                        config.totalContributions
                    ).toLocaleString(
                        "en-KE",
                        {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2
                        }
                    );


                mainAmount.textContent =
                    `KES ${amount}`;

            }

        } catch (error) {

            console.error(
                "Configuration error:",
                error
            );


            // Don't make the whole donation page
            // unusable if the config file fails.
            if (mainAmount) {

                mainAmount.textContent =
                    "KES 0.00";

            }

        }

    }


    // Load configuration
    loadDonationConfig();


    // ========================================
    // M-PESA AMOUNT BUTTONS
    // ========================================

    const amountButtons =
        document.querySelectorAll(".amount-btn");


    amountButtons.forEach((button) => {

        button.addEventListener("click", () => {

            const amount =
                button.dataset.amount;


            if (mpesaAmount) {

                mpesaAmount.value = amount;

            }


            // Remove selected state
            // from all buttons
            amountButtons.forEach((btn) => {

                btn.classList.remove("selected");

            });


            // Select clicked button
            button.classList.add("selected");

        });

    });


    // ========================================
    // REMOVE SELECTED BUTTON
    // WHEN CUSTOM AMOUNT IS TYPED
    // ========================================

    if (mpesaAmount) {

        mpesaAmount.addEventListener("input", () => {

            amountButtons.forEach((button) => {

                button.classList.remove("selected");

            });

        });

    }


    // ========================================
    // M-PESA DONATION
    // ========================================

    if (mpesaBtn) {

        mpesaBtn.addEventListener(
            "click",
            async () => {

                const amount =
                    Number(
                        mpesaAmount
                            ? mpesaAmount.value
                            : 0
                    );


                const phone =
                    mpesaPhone
                        ? mpesaPhone.value.trim()
                        : "";


                // Validate amount
                if (!amount || amount < 10) {

                    showToast(
                        "Please enter a valid donation amount of at least KES 10."
                    );

                    return;

                }


                // Validate phone
                if (!phone) {

                    showToast(
                        "Please enter your M-Pesa phone number."
                    );

                    return;

                }


                // Basic Kenyan phone validation
                const cleanPhone =
                    phone.replace(/\s+/g, "");


                const validPhone =
                    /^(?:2547\d{8}|07\d{8}|\+2547\d{8})$/
                        .test(cleanPhone);


                if (!validPhone) {

                    showToast(
                        "Please enter a valid Kenyan M-Pesa phone number."
                    );

                    return;

                }


                // Disable button while processing
                mpesaBtn.disabled = true;

                mpesaBtn.innerHTML =
                    '<i class="fas fa-spinner fa-spin"></i> Processing...';


                try {

                    /*
                     * BACKEND INTEGRATION
                     *
                     * Your Node.js backend should handle:
                     *
                     * POST /api/donations/mpesa
                     *
                     * The backend communicates with
                     * Safaricom Daraja.
                     */

                    const response =
                        await fetch(
                            "/api/donations/mpesa",
                            {

                                method: "POST",

                                headers: {
                                    "Content-Type":
                                        "application/json"
                                },

                                body: JSON.stringify({
                                    amount: amount,
                                    phone: cleanPhone,
                                    currency: "KES",
                                    purpose:
                                        "Church Donation"
                                })

                            }
                        );


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
                        "Check your phone for the M-Pesa payment prompt."
                    );


                } catch (error) {

                    console.error(
                        "M-Pesa error:",
                        error
                    );


                    showToast(
                        error.message ||
                        "M-Pesa service is not connected yet."
                    );

                } finally {

                    // Restore button
                    mpesaBtn.disabled = false;

                    mpesaBtn.innerHTML =
                        '<i class="fas fa-mobile-alt"></i> Donate via M-Pesa';

                }

            }
        );

    }


    // ========================================
    // PAYPAL DONATION
    // ========================================

    if (paypalBtn) {

        paypalBtn.addEventListener(
            "click",
            async () => {

                const amount =
                    Number(
                        paypalAmount
                            ? paypalAmount.value
                            : 0
                    );


                // Validate amount
                if (!amount || amount <= 0) {

                    showToast(
                        "Please enter a valid PayPal donation amount."
                    );

                    return;

                }


                // Disable button while processing
                paypalBtn.disabled = true;

                paypalBtn.innerHTML =
                    '<i class="fas fa-spinner fa-spin"></i> Processing...';


                try {

                    /*
                     * BACKEND INTEGRATION
                     *
                     * Your Node.js backend should handle:
                     *
                     * POST /api/donations/paypal
                     *
                     * The backend creates the PayPal order
                     * and returns the approval URL.
                     */

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
                                    purpose:
                                        "Church Donation"
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


                    // Redirect donor to PayPal
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

                    console.error(
                        "PayPal error:",
                        error
                    );


                    showToast(
                        error.message ||
                        "PayPal service is not connected yet."
                    );

                } finally {

                    // Restore button
                    paypalBtn.disabled = false;

                    paypalBtn.innerHTML =
                        '<i class="fab fa-paypal"></i> Donate with PayPal';

                }

            }
        );

    }


    // ========================================
    // PREVENT NEGATIVE AMOUNTS
    // ========================================

    if (mpesaAmount) {

        mpesaAmount.addEventListener("input", () => {

            if (Number(mpesaAmount.value) < 0) {

                mpesaAmount.value = "";

            }

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