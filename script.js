
/* =====================================================
   IMPERISHABLE CROWN OUTREACH BAPTIST CHURCH
   MAIN WELCOME PAGE JAVASCRIPT
===================================================== */

"use strict";

/* =====================================================
   1. WELCOME BUTTON
===================================================== */

document.addEventListener("DOMContentLoaded", () => {

    const joinButton = document.getElementById("joinButton");

    if (joinButton) {

        joinButton.addEventListener("click", () => {

            joinButton.classList.add("clicked");

            joinButton.setAttribute("aria-busy", "true");

        });

    }

    console.log("Imperishable Crown welcome page loaded.");

});

/* =====================================================
   2. PROGRESSIVE WEB APP (PWA)
===================================================== */

if ("serviceWorker" in navigator) {

    window.addEventListener("load", async () => {

        try {

            const registration = await navigator.serviceWorker.register(
                "./service-worker.js"
            );

            console.log(
                "Church PWA registered successfully:",
                registration.scope
            );

        } catch (error) {

            console.error(
                "Church PWA registration failed:",
                error
            );

        }

    });

}

/* =====================================================
   3. ERROR HANDLING
===================================================== */

window.addEventListener("error", (event) => {

    console.error(
        "Website error:",
        event.message
    );

});
