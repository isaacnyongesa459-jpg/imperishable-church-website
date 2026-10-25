/* ========================================
   IMPERISHABLE CROWN BIBLE BAPTIST CHURCH
   CONTACT PAGE JAVASCRIPT
======================================== */

document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    // ========================================
    // GET ELEMENTS
    // ========================================

    const hamburger = document.getElementById("hamburger");
    const dropdownMenu = document.getElementById("dropdownMenu");
    const contactForm = document.getElementById("contactForm");


    // ========================================
    // HAMBURGER MENU
    // ========================================

    function closeMenu() {
        if (!hamburger || !dropdownMenu) return;

        dropdownMenu.classList.remove("show");
        hamburger.setAttribute("aria-expanded", "false");
        hamburger.setAttribute("aria-label", "Open navigation menu");
        hamburger.innerHTML = '<i class="fas fa-bars" aria-hidden="true"></i>';
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
            if (window.innerWidth > 1000) {
                closeMenu();
            }
        });
    }


    // ========================================
    // CONTACT FORM
    // ========================================

    if (contactForm) {
        contactForm.addEventListener("submit", (event) => {
            event.preventDefault();

            const name = document.getElementById("name").value.trim();
            const email = document.getElementById("email").value.trim();
            const subject = document.getElementById("subject").value.trim();
            const message = document.getElementById("message").value.trim();

            if (!name || !email || !message) {
                alert("Please fill in all required fields.");
                return;
            }

            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!emailPattern.test(email)) {
                alert("Please enter a valid email address.");
                return;
            }

            alert(
                `Thank you, ${name}! Your message has been received.`
            );

            contactForm.reset();
        });
    }

});
