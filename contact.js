// ========================================
// IMPERISHABLE CROWN BIBLE BAPTIST CHURCH
// CONTACT PAGE JAVASCRIPT
// ========================================

document.addEventListener("DOMContentLoaded", () => {

    // ========================================
    // GET ELEMENTS
    // ========================================

    const hamburger = document.getElementById("hamburger");
    const dropdownMenu = document.getElementById("dropdownMenu");
    const contactForm = document.getElementById("contactForm");


    // ========================================
    // HAMBURGER MENU
    // ========================================

    if (hamburger && dropdownMenu) {

        // Open / close menu
        hamburger.addEventListener("click", (event) => {

            // Prevent the document click listener
            // from immediately closing the menu
            event.stopPropagation();

            const isOpen =
                dropdownMenu.classList.toggle("show");

            // Update accessibility state
            hamburger.setAttribute(
                "aria-expanded",
                String(isOpen)
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
        // CLOSE MENU AFTER CLICKING A LINK
        // ========================================

        const menuItems =
            document.querySelectorAll(".dropdown-item");

        menuItems.forEach((item) => {

            item.addEventListener("click", () => {

                dropdownMenu.classList.remove("show");

                hamburger.setAttribute(
                    "aria-expanded",
                    "false"
                );

                hamburger.setAttribute(
                    "aria-label",
                    "Open navigation menu"
                );

                hamburger.innerHTML =
                    '<i class="fas fa-bars"></i>';

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

                hamburger.setAttribute(
                    "aria-label",
                    "Open navigation menu"
                );

                hamburger.innerHTML =
                    '<i class="fas fa-bars"></i>';

            }

        });


        // ========================================
        // CLOSE MENU WITH ESCAPE KEY
        // ========================================

        document.addEventListener("keydown", (event) => {

            if (
                event.key === "Escape" &&
                dropdownMenu.classList.contains("show")
            ) {

                dropdownMenu.classList.remove("show");

                hamburger.setAttribute(
                    "aria-expanded",
                    "false"
                );

                hamburger.setAttribute(
                    "aria-label",
                    "Open navigation menu"
                );

                hamburger.innerHTML =
                    '<i class="fas fa-bars"></i>';

                hamburger.focus();

            }

        });

    }


    // ========================================
    // CONTACT FORM
    // ========================================

    if (contactForm) {

        contactForm.addEventListener("submit", (event) => {

            // Prevent page refresh
            event.preventDefault();


            // Get form values
            const name =
                document.getElementById("name").value.trim();

            const email =
                document.getElementById("email").value.trim();

            const subject =
                document.getElementById("subject").value.trim();

            const message =
                document.getElementById("message").value.trim();


            // ========================================
            // VALIDATION
            // ========================================

            if (!name || !email || !message) {

                alert(
                    "Please fill in all required fields."
                );

                return;
            }


            // ========================================
            // BASIC EMAIL VALIDATION
            // ========================================

            const emailPattern =
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!emailPattern.test(email)) {

                alert(
                    "Please enter a valid email address."
                );

                return;
            }


            // ========================================
            // MESSAGE RECEIVED
            // ========================================

            alert(
                `Thank you, ${name}! Your message has been received.`
            );


            // Clear the form
            contactForm.reset();

        });

    }

});