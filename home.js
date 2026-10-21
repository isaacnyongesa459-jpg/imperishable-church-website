// ========================================
// IMPERISHABLE CROWN BIBLE BAPTIST CHURCH
// HOME PAGE JAVASCRIPT
// ========================================

document.addEventListener("DOMContentLoaded", () => {

    const hamburger = document.getElementById("hamburger");
    const dropdownMenu = document.getElementById("dropdownMenu");

    if (!hamburger || !dropdownMenu) {
        return;
    }


    // Open and close the menu
    hamburger.addEventListener("click", () => {

        dropdownMenu.classList.toggle("show");

        const isOpen = dropdownMenu.classList.contains("show");

        hamburger.setAttribute("aria-expanded", isOpen);

        // Change hamburger icon
        if (isOpen) {
            hamburger.innerHTML = '<i class="fas fa-times"></i>';
        } else {
            hamburger.innerHTML = '<i class="fas fa-bars"></i>';
        }

    });


    // Close menu when a menu item is clicked
    const menuItems = document.querySelectorAll(".dropdown-item");

    menuItems.forEach((item) => {

        item.addEventListener("click", () => {

            dropdownMenu.classList.remove("show");

            hamburger.setAttribute("aria-expanded", "false");

            hamburger.innerHTML = '<i class="fas fa-bars"></i>';

        });

    });


    // Close menu when clicking outside it
    document.addEventListener("click", (event) => {

        const clickedInsideMenu =
            dropdownMenu.contains(event.target);

        const clickedHamburger =
            hamburger.contains(event.target);


        if (!clickedInsideMenu && !clickedHamburger) {

            dropdownMenu.classList.remove("show");

            hamburger.setAttribute("aria-expanded", "false");

            hamburger.innerHTML = '<i class="fas fa-bars"></i>';

        }

    });

});