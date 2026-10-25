/* ========================================
   IMPERISHABLE CROWN BIBLE BAPTIST CHURCH
   ABOUT PAGE JAVASCRIPT
======================================== */

document.addEventListener("DOMContentLoaded", function () {

    // ========================================
    // SELECT ELEMENTS
    // ========================================

    const hamburger = document.getElementById("hamburger");
    const dropdownMenu = document.getElementById("dropdownMenu");


    // ========================================
    // CHECK IF ELEMENTS EXIST
    // ========================================

    if (!hamburger || !dropdownMenu) {
        return;
    }


    // ========================================
    // OPEN / CLOSE MENU
    // ========================================

    hamburger.addEventListener("click", function (event) {
        event.stopPropagation();
        event.preventDefault();

        dropdownMenu.classList.toggle("show");

        const isOpen = dropdownMenu.classList.contains("show");
        const icon = hamburger.querySelector("i");

        if (isOpen) {
            icon.classList.remove("fa-bars");
            icon.classList.add("fa-times");

            hamburger.setAttribute("aria-expanded", "true");
            hamburger.setAttribute("aria-label", "Close menu");
        } else {
            icon.classList.remove("fa-times");
            icon.classList.add("fa-bars");

            hamburger.setAttribute("aria-expanded", "false");
            hamburger.setAttribute("aria-label", "Open menu");
        }
    });


    // ========================================
    // CLOSE MENU WHEN CLICKING OUTSIDE
    // ========================================

    document.addEventListener("click", function (event) {
        if (
            !dropdownMenu.contains(event.target) &&
            !hamburger.contains(event.target)
        ) {
            closeMenu();
        }
    });


    // ========================================
    // CLOSE MENU AFTER CLICKING LINK
    // ========================================

    const links = dropdownMenu.querySelectorAll("a");

    links.forEach(function (link) {
        link.addEventListener("click", function () {
            closeMenu();
        });
    });


    // ========================================
    // CLOSE MENU WITH ESC KEY
    // ========================================

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            closeMenu();
        }
    });


    // ========================================
    // CLOSE MOBILE MENU ON RESIZE
    // ========================================

    window.addEventListener("resize", function () {
        if (window.innerWidth > 768) {
            closeMenu();
        }
    });


    // ========================================
    // CLOSE MENU FUNCTION
    // ========================================

    function closeMenu() {
        dropdownMenu.classList.remove("show");

        const icon = hamburger.querySelector("i");
        if (icon) {
            icon.classList.remove("fa-times");
            icon.classList.add("fa-bars");
        }

        hamburger.setAttribute("aria-expanded", "false");
        hamburger.setAttribute("aria-label", "Open menu");
    }

});
