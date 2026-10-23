/* ========================================
   IMPERISHABLE CROWN BIBLE BAPTIST CHURCH
   LEADERSHIP PAGE JAVASCRIPT
======================================== */

document.addEventListener("DOMContentLoaded", function () {

    /* ========================================
       HAMBURGER MENU
    ======================================== */

    const hamburger = document.getElementById("hamburger");
    const dropdownMenu = document.getElementById("dropdownMenu");

    if (hamburger && dropdownMenu) {

        hamburger.addEventListener("click", function () {

            const isOpen =
                dropdownMenu.classList.toggle("show");

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


        /* ========================================
           CLOSE MENU AFTER CLICKING A LINK
        ======================================== */

        const navigationLinks =
            dropdownMenu.querySelectorAll("a");

        navigationLinks.forEach(function (link) {

            link.addEventListener("click", function () {

                dropdownMenu.classList.remove("show");

                hamburger.setAttribute(
                    "aria-expanded",
                    "false"
                );

                hamburger.innerHTML =
                    '<i class="fas fa-bars"></i>';

            });

        });


        /* ========================================
           CLOSE MENU WHEN CLICKING OUTSIDE
        ======================================== */

        document.addEventListener("click", function (event) {

            const clickedInsideMenu =
                dropdownMenu.contains(event.target);

            const clickedHamburger =
                hamburger.contains(event.target);

            if (
                !clickedInsideMenu &&
                !clickedHamburger &&
                dropdownMenu.classList.contains("show")
            ) {

                dropdownMenu.classList.remove("show");

                hamburger.setAttribute(
                    "aria-expanded",
                    "false"
                );

                hamburger.innerHTML =
                    '<i class="fas fa-bars"></i>';
            }

        });


        /* ========================================
           CLOSE MENU WITH ESCAPE KEY
        ======================================== */

        document.addEventListener("keydown", function (event) {

            if (
                event.key === "Escape" &&
                dropdownMenu.classList.contains("show")
            ) {

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


    /* ========================================
       LEADERSHIP FILTER
    ======================================== */

    const filterButtons =
        document.querySelectorAll(".filter-btn");

    const leaderCards =
        document.querySelectorAll(".leader-card");

    const memberCount =
        document.getElementById("memberCount");


    filterButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            const selectedFilter =
                button.getAttribute("data-filter");


            /* Remove active class */
            filterButtons.forEach(function (btn) {

                btn.classList.remove("active");

            });


            /* Add active class */
            button.classList.add("active");


            /* Count visible members */
            let visibleMembers = 0;


            /* Filter cards */
            leaderCards.forEach(function (card) {

                const category =
                    card.getAttribute("data-category");


                if (
                    selectedFilter === "all" ||
                    category === selectedFilter
                ) {

                    card.classList.remove("hidden");

                    visibleMembers++;

                } else {

                    card.classList.add("hidden");

                }

            });


            /* Update count */
            if (memberCount) {

                memberCount.innerHTML =
                    `Showing <span>${visibleMembers}</span> members`;

            }

        });

    }


    /* ========================================
       CURRENT YEAR
    ======================================== */

    const currentYear =
        document.getElementById("currentYear");

    if (currentYear) {

        currentYear.textContent =
            new Date().getFullYear();

    }


    /* ========================================
       PREVENT EMPTY # LINKS FROM JUMPING
    ======================================== */

    const emptyLinks =
        document.querySelectorAll('a[href="#"]');

    emptyLinks.forEach(function (link) {

        link.addEventListener("click", function (event) {

            event.preventDefault();

        });

    });

});