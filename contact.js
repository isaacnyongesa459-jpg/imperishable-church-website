// ========================================
// IMPERISHABLE CROWN BIBLE BAPTIST CHURCH
// CONTACT PAGE JAVASCRIPT
// ========================================

document.addEventListener("DOMContentLoaded", () => {

    const hamburger = document.getElementById("hamburger");
    const dropdownMenu = document.getElementById("dropdownMenu");
    const contactForm = document.getElementById("contactForm");


    // ========================================
    // HAMBURGER MENU
    // ========================================

    if (hamburger && dropdownMenu) {

        hamburger.addEventListener("click", () => {

            dropdownMenu.classList.toggle("show");

            const isOpen =
                dropdownMenu.classList.contains("show");

            hamburger.setAttribute(
                "aria-expanded",
                isOpen
            );


            if (isOpen) {

                hamburger.innerHTML =
                    '<i class="fas fa-times"></i>';

            } else {

                hamburger.innerHTML =
                    '<i class="fas fa-bars"></i>';

            }

        });


        // Close menu after selecting a page

        const menuItems =
            document.querySelectorAll(".dropdown-item");

        menuItems.forEach((item) => {

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


        // Close menu when clicking outside

        document.addEventListener("click", (event) => {

            const clickedMenu =
                dropdownMenu.contains(event.target);

            const clickedButton =
                hamburger.contains(event.target);


            if (!clickedMenu && !clickedButton) {

                dropdownMenu.classList.remove("show");

                hamburger.setAttribute(
                    "aria-expanded",
                    "false"
                );

                hamburger.innerHTML =
                    '<i class="fas fa-bars"></i>';

            }

        });

    }


    // ========================================
    // CONTACT FORM
    // ========================================

    if (contactForm) {

        contactForm.addEventListener("submit", (event) => {

            event.preventDefault();

            const name =
                document.getElementById("name").value.trim();

            const email =
                document.getElementById("email").value.trim();

            const message =
                document.getElementById("message").value.trim();


            if (!name || !email || !message) {

                alert(
                    "Please fill in all required fields."
                );

                return;

            }


            alert(
                `Thank you, ${name}! Your message has been received.`
            );


            contactForm.reset();

        });

    }

});