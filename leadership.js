// ========================================
// IMPERISHABLE CROWN BIBLE BAPTIST CHURCH
// LEADERSHIP PAGE JAVASCRIPT
// ========================================


document.addEventListener("DOMContentLoaded", function () {


    // ========================================
    // NAVIGATION
    // ========================================

    const hamburger =
        document.getElementById("hamburger");

    const dropdownMenu =
        document.getElementById("dropdownMenu");


    // Check that navigation exists

    if (hamburger && dropdownMenu) {


        // ========================================
        // OPEN / CLOSE MENU
        // ========================================

        hamburger.addEventListener("click", function () {

            dropdownMenu.classList.toggle("show");


            const menuIsOpen =
                dropdownMenu.classList.contains("show");


            hamburger.setAttribute(
                "aria-expanded",
                menuIsOpen
            );


            // Change hamburger icon

            const icon =
                hamburger.querySelector("i");


            if (menuIsOpen) {

                icon.classList.remove("fa-bars");

                icon.classList.add("fa-xmark");

            } else {

                icon.classList.remove("fa-xmark");

                icon.classList.add("fa-bars");

            }

        });


        // ========================================
        // CLOSE MENU AFTER CLICKING A LINK
        // ========================================

        const menuLinks =
            document.querySelectorAll(".dropdown-item");


        menuLinks.forEach(function (link) {

            link.addEventListener("click", function () {

                dropdownMenu.classList.remove("show");

                hamburger.setAttribute(
                    "aria-expanded",
                    "false"
                );


                const icon =
                    hamburger.querySelector("i");


                icon.classList.remove("fa-xmark");

                icon.classList.add("fa-bars");

            });

        });


        // ========================================
        // CLOSE MENU WHEN CLICKING OUTSIDE
        // ========================================

        document.addEventListener(
            "click",
            function (event) {

                if (
                    !dropdownMenu.contains(event.target) &&
                    !hamburger.contains(event.target)
                ) {

                    dropdownMenu.classList.remove("show");

                    hamburger.setAttribute(
                        "aria-expanded",
                        "false"
                    );


                    const icon =
                        hamburger.querySelector("i");


                    icon.classList.remove("fa-xmark");

                    icon.classList.add("fa-bars");

                }

            }
        );

    }


    // ========================================
    // MEMBER FILTERING
    // ========================================

    const filterButtons =
        document.querySelectorAll(".filter-btn");

    const leaderCards =
        document.querySelectorAll(".leader-card");

    const memberCount =
        document.getElementById("memberCount");


    filterButtons.forEach(function (button) {

        button.addEventListener(
            "click",
            function () {


                const selectedFilter =
                    button.getAttribute("data-filter");


                // Remove active state

                filterButtons.forEach(
                    function (btn) {

                        btn.classList.remove("active");

                    }
                );


                // Activate selected button

                button.classList.add("active");


                let visibleMembers = 0;


                // Check every member

                leaderCards.forEach(
                    function (card) {


                        const category =
                            card.getAttribute(
                                "data-category"
                            );


                        if (
                            selectedFilter === "all" ||
                            category === selectedFilter
                        ) {

                            card.classList.remove(
                                "hidden"
                            );

                            visibleMembers++;

                        } else {

                            card.classList.add(
                                "hidden"
                            );

                        }

                    }
                );


                // Update member count

                if (memberCount) {

                    memberCount.innerHTML =
                        `Showing <span>${visibleMembers}</span> members`;

                }

            }
        );

    });


    // ========================================
    // MEMBER DETAILS MODAL
    // ========================================

    const lightboxModal =
        document.getElementById(
            "lightboxModal"
        );


    const closeLightbox =
        document.getElementById(
            "closeLightbox"
        );


    const modalImage =
        document.getElementById(
            "modalImage"
        );


    const modalName =
        document.getElementById(
            "modalName"
        );


    const modalPosition =
        document.getElementById(
            "modalPosition"
        );


    const modalBio =
        document.getElementById(
            "modalBio"
        );


    // ========================================
    // OPEN MEMBER MODAL
    // ========================================

    leaderCards.forEach(function (card) {

        card.addEventListener(
            "click",
            function (event) {


                // Don't open the modal if
                // social media icon was clicked

                if (
                    event.target.closest(
                        ".social-icons a"
                    )
                ) {

                    return;

                }


                // Get member information

                const name =
                    card.getAttribute(
                        "data-name"
                    );


                const position =
                    card.getAttribute(
                        "data-position"
                    );


                const bio =
                    card.getAttribute(
                        "data-bio"
                    );


                const image =
                    card.getAttribute(
                        "data-image"
                    );


                // Put information in modal

                modalName.textContent =
                    name;


                modalPosition.textContent =
                    position;


                modalBio.textContent =
                    bio;


                modalImage.src =
                    image;


                modalImage.alt =
                    name;


                // Show modal

                lightboxModal.classList.add(
                    "show"
                );


                lightboxModal.setAttribute(
                    "aria-hidden",
                    "false"
                );


                // Stop page scrolling

                document.body.style.overflow =
                    "hidden";

            }
        );

    });


    // ========================================
    // CLOSE MODAL FUNCTION
    // ========================================

    function closeModal() {

        lightboxModal.classList.remove(
            "show"
        );


        lightboxModal.setAttribute(
            "aria-hidden",
            "true"
        );


        document.body.style.overflow =
            "";

    }


    // ========================================
    // CLOSE BUTTON
    // ========================================

    if (closeLightbox) {

        closeLightbox.addEventListener(
            "click",
            closeModal
        );

    }


    // ========================================
    // CLICK OUTSIDE MODAL
    // ========================================

    if (lightboxModal) {

        lightboxModal.addEventListener(
            "click",
            function (event) {


                if (
                    event.target ===
                    lightboxModal
                ) {

                    closeModal();

                }

            }
        );

    }


    // ========================================
    // ESCAPE KEY
    // ========================================

    document.addEventListener(
        "keydown",
        function (event) {


            if (
                event.key === "Escape" &&
                lightboxModal &&
                lightboxModal.classList.contains(
                    "show"
                )
            ) {

                closeModal();

            }

        }
    );


    // ========================================
    // CURRENT YEAR
    // ========================================

    const year =
        document.getElementById("year");


    if (year) {

        year.textContent =
            new Date().getFullYear();

    }


});