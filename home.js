// ========================================
// IMPERISHABLE CROWN BIBLE BAPTIST CHURCH
// HOME PAGE JAVASCRIPT
// ========================================

document.addEventListener("DOMContentLoaded", () => {

    // ========================================
    // GET ELEMENTS
    // ========================================

    const hamburger =
        document.getElementById("hamburger");

    const dropdownMenu =
        document.getElementById("dropdownMenu");

    const dropdownItems =
        document.querySelectorAll(".dropdown-item");


    // ========================================
    // CHECK ELEMENTS
    // ========================================

    if (!hamburger || !dropdownMenu) {
        console.error(
            "Navigation elements were not found."
        );

        return;
    }


    // ========================================
    // OPEN / CLOSE MENU
    // ========================================

    hamburger.addEventListener("click", (event) => {

        // Prevent the document click event
        // from immediately closing the menu.
        event.stopPropagation();

        const isOpen =
            dropdownMenu.classList.toggle("show");


        // Update accessibility state
        hamburger.setAttribute(
            "aria-expanded",
            isOpen
        );


        // Change hamburger icon
        if (isOpen) {

            hamburger.innerHTML =
                '<i class="fas fa-times"></i>';

            hamburger.setAttribute(
                "aria-label",
                "Close navigation menu"
            );

        } else {

            hamburger.innerHTML =
                '<i class="fas fa-bars"></i>';

            hamburger.setAttribute(
                "aria-label",
                "Open navigation menu"
            );
        }

    });


    // ========================================
    // CLOSE MENU WHEN CLICKING A LINK
    // ========================================

    dropdownItems.forEach((item) => {

        item.addEventListener("click", () => {

            dropdownMenu.classList.remove("show");

            hamburger.setAttribute(
                "aria-expanded",
                "false"
            );

            hamburger.innerHTML =
                '<i class="fas fa-bars"></i>';

            hamburger.setAttribute(
                "aria-label",
                "Open navigation menu"
            );

        });

    });


    // ========================================
    // CLOSE MENU WHEN CLICKING OUTSIDE
    // ========================================

    document.addEventListener("click", (event) => {

        const clickedInsideMenu =
            dropdownMenu.contains(event.target);

        const clickedHamburger =
            hamburger.contains(event.target);


        if (
            !clickedInsideMenu &&
            !clickedHamburger
        ) {

            dropdownMenu.classList.remove("show");

            hamburger.setAttribute(
                "aria-expanded",
                "false"
            );

            hamburger.innerHTML =
                '<i class="fas fa-bars"></i>';

            hamburger.setAttribute(
                "aria-label",
                "Open navigation menu"
            );
        }

    });


    // ========================================
    // CLOSE MENU WITH ESCAPE KEY
    // ========================================

    document.addEventListener("keydown", (event) => {

        if (event.key === "Escape") {

            dropdownMenu.classList.remove("show");

            hamburger.setAttribute(
                "aria-expanded",
                "false"
            );

            hamburger.innerHTML =
                '<i class="fas fa-bars"></i>';

            hamburger.setAttribute(
                "aria-label",
                "Open navigation menu"
            );

            hamburger.focus();
        }

    });


    // ========================================
    // CLOSE MENU AFTER WINDOW RESIZE
    // ========================================

    window.addEventListener("resize", () => {

        dropdownMenu.classList.remove("show");

        hamburger.setAttribute(
            "aria-expanded",
            "false"
        );

        hamburger.innerHTML =
            '<i class="fas fa-bars"></i>';

        hamburger.setAttribute(
            "aria-label",
            "Open navigation menu"
        );

    });

});