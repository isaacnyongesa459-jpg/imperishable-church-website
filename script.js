
/* =====================================================
   IMPERISHABLE CROWN OUTREACH BAPTIST CHURCH
   MAIN WELCOME PAGE JAVASCRIPT
===================================================== */

"use strict";

/* =====================================================
   1. WELCOME BUTTON
===================================================== */

document.addEventListener("DOMContentLoaded", () => {

    const hamburger = document.getElementById("hamburger");
    const dropdownMenu = document.getElementById("dropdownMenu");
    const menuLinks = dropdownMenu?.querySelectorAll("a") || [];

    function closeMenu(returnFocus = false) {
        if (!hamburger || !dropdownMenu) return;
        dropdownMenu.classList.remove("show");
        hamburger.setAttribute("aria-expanded", "false");
        hamburger.setAttribute("aria-label", "Open navigation menu");
        const icon = hamburger.querySelector("i");
        if (icon) icon.className = "fas fa-bars";
        if (returnFocus) hamburger.focus();
    }

    if (hamburger && dropdownMenu) {
        hamburger.setAttribute("aria-expanded", "false");
        hamburger.addEventListener("click", event => {
            event.stopPropagation();
            const isOpen = dropdownMenu.classList.toggle("show");
            hamburger.setAttribute("aria-expanded", String(isOpen));
            hamburger.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
            const icon = hamburger.querySelector("i");
            if (icon) icon.className = isOpen ? "fas fa-times" : "fas fa-bars";
        });
        menuLinks.forEach(link => link.addEventListener("click", () => closeMenu()));
        document.addEventListener("click", event => {
            if (!dropdownMenu.contains(event.target) && !hamburger.contains(event.target)) closeMenu();
        });
        document.addEventListener("keydown", event => {
            if (event.key === "Escape" && dropdownMenu.classList.contains("show")) closeMenu(true);
        });
        window.addEventListener("resize", () => {
            if (window.innerWidth > 768) closeMenu();
        });
    }

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
