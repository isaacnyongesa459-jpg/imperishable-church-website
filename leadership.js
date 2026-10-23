// ========================================
// IMPERISHABLE CROWN BIBLE BAPTIST CHURCH
// LEADERSHIP PAGE JAVASCRIPT
// ========================================

document.addEventListener("DOMContentLoaded", function () {

    // ========================================
    // NAVIGATION
    // ========================================

    const hamburger = document.getElementById("hamburger");
    const dropdownMenu = document.getElementById("dropdownMenu");

    if (hamburger && dropdownMenu) {

        hamburger.addEventListener("click", function (event) {

            event.stopPropagation();

            dropdownMenu.classList.toggle("show");

            const isOpen =
                dropdownMenu.classList.contains("show");

            hamburger.setAttribute(
                "aria-expanded",
                isOpen
            );

            // Change icon
            const icon = hamburger.querySelector("i");

            if (isOpen) {

                icon.classList.remove("fa-bars");
                icon.classList.add("fa-xmark");

            } else {

                icon.classList.remove("fa-xmark");
                icon.classList.add("fa-bars");

            }

        });


        // ========================================
        // CLOSE MENU WHEN LINK IS CLICKED
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

                const icon = hamburger.querySelector("i");

                icon.classList.remove("fa-xmark");
                icon.classList.add("fa-bars");

            });

        });


        // ========================================
        // CLOSE MENU WHEN CLICKING OUTSIDE
        // ========================================

        document.addEventListener("click", function (event) {

            if (
                !dropdownMenu.contains(event.target) &&
                !hamburger.contains(event.target)
            ) {

                dropdownMenu.classList.remove("show");

                hamburger.setAttribute(
                    "aria-expanded",
                    "false"
                );

                const icon = hamburger.querySelector("i");

                icon.classList.remove("fa-xmark");
                icon.classList.add("fa-bars");

            }

        });

    }


    // ========================================
    // MEMBER FILTER
    // ========================================

    const filterButtons =
        document.querySelectorAll(".filter-btn");

    const leaderCards =
        document.querySelectorAll(".leader-card");

    const memberCount =
        document.getElementById("memberCount");


    filterButtons.forEach(function (button) {

        button.addEventListener("click", function () {

            const filter =
                button.getAttribute("data-filter");

            // Remove active from all buttons
            filterButtons.forEach(function (btn) {

                btn.classList.remove("active");

            });

            // Activate selected button
            button.classList.add("active");


            let visibleCount = 0;


            leaderCards.forEach(function (card) {

                const category =
                    card.getAttribute("data-category");


                if (
                    filter === "all" ||
                    category === filter
                ) {

                    card.classList.remove("hidden");

                    visibleCount++;

                } else {

                    card.classList.add("hidden");

                }

            });


            // Update count
            if (memberCount) {

                memberCount.innerHTML =
                    `Showing <span>${visibleCount}</span> members`;

            }

        });

    });


    // ========================================
    // MEMBER DETAILS MODAL
    // ========================================

    const lightboxModal =
        document.getElementById("lightboxModal");

    const closeLightbox =
        document.getElementById("closeLightbox");

    const modalImage =
        document.getElementById("modalImage");

    const modalName =
        document.getElementById("modalName");

    const modalPosition =
        document.getElementById("modalPosition");

    const modalBio =
        document.getElementById("modalBio");


    leaderCards.forEach(function (card) {

        card.addEventListener("click", function (event) {

            // Don't open modal when clicking social links
            if (event.target.closest(".social-icons a")) {
                return;
            }


            const name =
                card.getAttribute("data-name");

            const position =
                card.getAttribute("data-position");

            const bio =
                card.getAttribute("data-bio");

            const image =
                card.getAttribute("data-image");


            modalName.textContent = name;

            modalPosition.textContent = position;

            modalBio.textContent = bio;

            modalImage.src = image;

            modalImage.alt = name;


            lightboxModal.classList.add("show");

            lightboxModal.setAttribute(
                "aria-hidden",
                "false"
            );

            document.body.style.overflow = "hidden";

        });

    });


    // ========================================
    // CLOSE MODAL
    // ========================================

    function closeModal() {

        lightboxModal.classList.remove("show");

        lightboxModal.setAttribute(
            "aria-hidden",
            "true"
        );

        document.body.style.overflow = "";

    }


    if (closeLightbox) {

        closeLightbox.addEventListener(
            "click",
            closeModal
        );

    }


    // ========================================
    // CLOSE MODAL BY CLICKING BACKGROUND
    // ========================================

    if (lightboxModal) {

        lightboxModal.addEventListener(
            "click",
            function (event) {

                if (event.target === lightboxModal) {

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
                lightboxModal.classList.contains("show")
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