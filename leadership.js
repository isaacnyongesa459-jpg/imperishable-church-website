/* ========================================
   IMPERISHABLE CROWN BIBLE BAPTIST CHURCH
   LEADERSHIP PAGE JAVASCRIPT
======================================== */

document.addEventListener("DOMContentLoaded", function () {

    // Get navigation elements
    const hamburger = document.getElementById("hamburger");
    const dropdownMenu = document.getElementById("dropdownMenu");

    // Open and close the mobile navigation
    function closeMenu() {
        if (!hamburger || !dropdownMenu) return;

        dropdownMenu.classList.remove("show");
        hamburger.setAttribute("aria-expanded", "false");
        hamburger.setAttribute("aria-label", "Open navigation menu");

        hamburger.innerHTML = '<i class="fas fa-bars" aria-hidden="true"></i>';
    }

    function openMenu() {
        if (!hamburger || !dropdownMenu) return;

        dropdownMenu.classList.add("show");
        hamburger.setAttribute("aria-expanded", "true");
        hamburger.setAttribute("aria-label", "Close navigation menu");

        hamburger.innerHTML = '<i class="fas fa-times" aria-hidden="true"></i>';
    }

    if (hamburger && dropdownMenu) {

        hamburger.addEventListener("click", function (event) {
            event.preventDefault();
            event.stopPropagation();

            const isOpen =
                dropdownMenu.classList.contains("show");

            if (isOpen) {
                closeMenu();
            } else {
                openMenu();
            }
        });

        // Close the menu when a navigation link is clicked
        const menuLinks = dropdownMenu.querySelectorAll("a");

        menuLinks.forEach(function (link) {
            link.addEventListener("click", function () {
                closeMenu();
            });
        });

        // Close the menu when clicking outside it
        document.addEventListener("click", function (event) {
            const clickedMenu = dropdownMenu.contains(event.target);
            const clickedButton = hamburger.contains(event.target);

            if (!clickedMenu && !clickedButton) {
                closeMenu();
            }
        });

        // Close the menu with the Escape key
        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                closeMenu();
            }
        });

        // Close the mobile menu when switching to desktop width
        window.addEventListener("resize", function () {
            if (window.innerWidth > 768) {
                closeMenu();
            }
        });
    }


    // ========================================
    // LEADERSHIP CATEGORY FILTERS
    // ========================================

    const filterButtons =
        document.querySelectorAll(".filter-btn");

    const leaderCards =
        document.querySelectorAll(".leader-card");

    const memberCount =
        document.getElementById("memberCount");

    const noResults =
        document.getElementById("noResults");

    function filterMembers(selectedFilter) {
        let visibleMembers = 0;

        leaderCards.forEach(function (card) {
            const category = card.getAttribute("data-category");

            const shouldShow =
                selectedFilter === "all" ||
                category === selectedFilter;

            card.classList.toggle("hidden", !shouldShow);

            if (shouldShow) {
                visibleMembers++;
            }
        });

        // Update selected filter button
        filterButtons.forEach(function (button) {
            const isActive =
                button.getAttribute("data-filter") === selectedFilter;

            button.classList.toggle("active", isActive);
            button.setAttribute("aria-pressed", String(isActive));
        });

        // Update visible member count
        if (memberCount) {
            memberCount.innerHTML =
                'Showing <span>' + visibleMembers + '</span> members';
        }

        // Show a message if no cards match
        if (noResults) {
            noResults.hidden = visibleMembers !== 0;
        }
    }

    filterButtons.forEach(function (button) {
        button.addEventListener("click", function () {
            const selectedFilter =
                button.getAttribute("data-filter");

            filterMembers(selectedFilter);
        });
    });


    // ========================================
    // AUTOMATIC COPYRIGHT YEAR
    // ========================================

    const currentYear =
        document.getElementById("currentYear");

    if (currentYear) {
        currentYear.textContent = new Date().getFullYear();
    }

});