
"use strict";

// ========================================
// IMPERISHABLE CROWN OUTREACH BAPTIST CHURCH
// HOME PAGE JAVASCRIPT
// ========================================

document.addEventListener("DOMContentLoaded", () => {
    const hamburger = document.getElementById("hamburger");
    const dropdownMenu = document.getElementById("dropdownMenu");

    if (!hamburger || !dropdownMenu) {
        console.error("Navigation elements were not found.");
        return;
    }

    const dropdownItems = dropdownMenu.querySelectorAll(".dropdown-item");

    // Open the navigation menu
    function openMenu() {
        dropdownMenu.classList.add("show");
        hamburger.setAttribute("aria-expanded", "true");
        hamburger.setAttribute("aria-label", "Close navigation menu");

        const icon = hamburger.querySelector("i");
        if (icon) {
            icon.className = "fas fa-times";
        }
    }

    // Close the navigation menu
    function closeMenu() {
        dropdownMenu.classList.remove("show");
        hamburger.setAttribute("aria-expanded", "false");
        hamburger.setAttribute("aria-label", "Open navigation menu");

        const icon = hamburger.querySelector("i");
        if (icon) {
            icon.className = "fas fa-bars";
        }
    }

    // Toggle menu when hamburger is clicked
    hamburger.addEventListener("click", (event) => {
        event.stopPropagation();

        const isOpen = dropdownMenu.classList.contains("show");

        if (isOpen) {
            closeMenu();
        } else {
            openMenu();
        }
    });

    // Close menu after selecting a navigation link
    dropdownItems.forEach((item) => {
        item.addEventListener("click", closeMenu);
    });

    // Close menu when clicking outside it
    document.addEventListener("click", (event) => {
        const clickedInsideMenu = dropdownMenu.contains(event.target);
        const clickedHamburger = hamburger.contains(event.target);

        if (!clickedInsideMenu && !clickedHamburger) {
            closeMenu();
        }
    });

    // Close menu with Escape key
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeMenu();
            hamburger.focus();
        }
    });

    // Close mobile menu when screen becomes wider
    window.addEventListener("resize", () => {
        if (window.innerWidth > 900) {
            closeMenu();
        }
    });

    console.log("Imperishable Crown home page loaded successfully.");
});
