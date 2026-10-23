// ========================================
// IMPERISHABLE CROWN BIBLE BAPTIST CHURCH
// ABOUT PAGE JAVASCRIPT
// ========================================

document.addEventListener("DOMContentLoaded", function () {

    // ========================================
    // GET NAVIGATION ELEMENTS
    // ========================================

    const hamburger = document.getElementById("hamburger");
    const dropdownMenu = document.getElementById("dropdownMenu");


    // ========================================
    // CHECK ELEMENTS
    // ========================================

    if (!hamburger || !dropdownMenu) {

        console.error(
            "Navigation error: hamburger or dropdown menu was not found."
        );

        return;
    }


    // ========================================
    // HAMBURGER CLICK
    // ========================================

    hamburger.addEventListener("click", function (event) {

        // Prevent document click from immediately
        // closing the menu
        event.stopPropagation();


        // Open / close menu
        dropdownMenu.classList.toggle("show");


        // Check whether menu is open
        const menuIsOpen =
            dropdownMenu.classList.contains("show");


        // ========================================
        // CHANGE HAMBURGER ICON
        // ========================================

        const icon =
            hamburger.querySelector("i");


        if (menuIsOpen) {

            icon.classList.remove("fa-bars");

            icon.classList.add("fa-xmark");

            hamburger.setAttribute(
                "aria-expanded",
                "true"
            );

            hamburger.setAttribute(
                "aria-label",
                "Close navigation menu"
            );

        } else {

            icon.classList.remove("fa-xmark");

            icon.classList.add("fa-bars");

            hamburger.setAttribute(
                "aria-expanded",
                "false"
            );

            hamburger.setAttribute(
                "aria-label",
                "Open navigation menu"
            );
        }

    });


    // ========================================
    // CLOSE MENU WHEN CLICKING OUTSIDE
    // ========================================

    document.addEventListener("click", function (event) {

        const clickedInsideMenu =
            dropdownMenu.contains(event.target);

        const clickedHamburger =
            hamburger.contains(event.target);


        if (!clickedInsideMenu && !clickedHamburger) {

            closeMenu();

        }

    });


    // ========================================
    // CLOSE MENU AFTER CLICKING A LINK
    // ========================================

    const menuLinks =
        dropdownMenu.querySelectorAll(".dropdown-item");


    menuLinks.forEach(function (link) {

        link.addEventListener("click", function () {

            closeMenu();

        });

    });


    // ========================================
    // CLOSE MENU FUNCTION
    // ========================================

    function closeMenu() {

        dropdownMenu.classList.remove("show");


        const icon =
            hamburger.querySelector("i");


        icon.classList.remove("fa-xmark");

        icon.classList.add("fa-bars");


        hamburger.setAttribute(
            "aria-expanded",
            "false"
        );


        hamburger.setAttribute(
            "aria-label",
            "Open navigation menu"
        );

    }


    // ========================================
    // ESCAPE KEY
    // ========================================

    document.addEventListener("keydown", function (event) {

        if (event.key === "Escape") {

            closeMenu();

        }

    });

});