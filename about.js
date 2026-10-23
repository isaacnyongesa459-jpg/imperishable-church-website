// ========================================
// IMPERISHABLE CROWN BIBLE BAPTIST CHURCH
// ABOUT PAGE JAVASCRIPT
// ========================================

document.addEventListener("DOMContentLoaded", function () {

    // ========================================
    // SELECT ELEMENTS
    // ========================================

    const hamburger =
        document.getElementById("hamburger");

    const dropdownMenu =
        document.getElementById("dropdownMenu");


    // ========================================
    // CHECK IF ELEMENTS EXIST
    // ========================================

    if (!hamburger || !dropdownMenu) {

        console.error(
            "ERROR: Navigation elements not found."
        );

        return;
    }


    // ========================================
    // OPEN / CLOSE MENU
    // ========================================

    hamburger.addEventListener("click", function (event) {

        event.stopPropagation();

        dropdownMenu.classList.toggle("show");


        // Check menu status

        const isOpen =
            dropdownMenu.classList.contains("show");


        // Get hamburger icon

        const icon =
            hamburger.querySelector("i");


        if (isOpen) {

            // Change bars to X

            icon.classList.remove("fa-bars");

            icon.classList.add("fa-xmark");


            hamburger.setAttribute(
                "aria-expanded",
                "true"
            );


            hamburger.setAttribute(
                "aria-label",
                "Close menu"
            );

        } else {

            // Change X back to bars

            icon.classList.remove("fa-xmark");

            icon.classList.add("fa-bars");


            hamburger.setAttribute(
                "aria-expanded",
                "false"
            );


            hamburger.setAttribute(
                "aria-label",
                "Open menu"
            );

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

    const links =
        dropdownMenu.querySelectorAll("a");


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
            "Open menu"
        );

    }

});