// ========================================
// IMPERISHABLE CROWN BIBLE BAPTIST CHURCH
// LEADERSHIP PAGE JAVASCRIPT
// ========================================

document.addEventListener("DOMContentLoaded", () => {

    // ========================================
    // GET HTML ELEMENTS
    // ========================================

    const hamburger = document.getElementById("hamburger");
    const dropdownMenu = document.getElementById("dropdownMenu");

    const filterButtons = document.querySelectorAll(".filter-btn");
    const leaderCards = document.querySelectorAll(".leader-card");

    const memberCount = document.getElementById("memberCount");

    const lightboxModal = document.getElementById("lightboxModal");
    const closeLightbox = document.getElementById("closeLightbox");

    const modalImage = document.getElementById("modalImage");
    const modalName = document.getElementById("modalName");
    const modalPosition = document.getElementById("modalPosition");
    const modalBio = document.getElementById("modalBio");

    const year = document.getElementById("year");


    // ========================================
    // HAMBURGER MENU
    // ========================================

    hamburger.addEventListener("click", () => {

        const isOpen =
            dropdownMenu.classList.toggle("show");

        hamburger.setAttribute(
            "aria-expanded",
            isOpen
        );


        // Change hamburger icon
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

    menuLinks.forEach((link) => {

        link.addEventListener("click", () => {

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

    document.addEventListener("click", (event) => {

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

            const icon = hamburger.querySelector("i");

            icon.classList.remove("fa-xmark");
            icon.classList.add("fa-bars");

        }

    });


    // ========================================
    // FILTER MEMBERS
    // ========================================

    filterButtons.forEach((button) => {

        button.addEventListener("click", () => {

            // Get selected category
            const filter =
                button.getAttribute("data-filter");


            // Remove active from all buttons
            filterButtons.forEach((btn) => {
                btn.classList.remove("active");
            });


            // Add active to clicked button
            button.classList.add("active");


            // Count visible members
            let visibleCount = 0;


            // Check every leader card
            leaderCards.forEach((card) => {

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


            // Update member count
            memberCount.innerHTML =
                `Showing <span>${visibleCount}</span> members`;

        });

    });


    // ========================================
    // OPEN MEMBER DETAILS MODAL
    // ========================================

    leaderCards.forEach((card) => {

        card.addEventListener("click", (event) => {

            // Don't open modal when clicking
            // social media links
            if (event.target.closest(".social-icons a")) {
                return;
            }


            // Get information from data attributes
            const name =
                card.getAttribute("data-name");

            const position =
                card.getAttribute("data-position");

            const bio =
                card.getAttribute("data-bio");

            const image =
                card.getAttribute("data-image");


            // Put information into modal
            modalName.textContent = name;

            modalPosition.textContent = position;

            modalBio.textContent = bio;

            modalImage.src = image;

            modalImage.alt = name;


            // Open modal
            lightboxModal.classList.add("show");

            lightboxModal.setAttribute(
                "aria-hidden",
                "false"
            );


            // Prevent page from scrolling
            document.body.style.overflow = "hidden";

        });

    });


    // ========================================
    // CLOSE MEMBER MODAL
    // ========================================

    function closeModal() {

        lightboxModal.classList.remove("show");

        lightboxModal.setAttribute(
            "aria-hidden",
            "true"
        );

        document.body.style.overflow = "";

    }


    closeLightbox.addEventListener(
        "click",
        closeModal
    );


    // ========================================
    // CLOSE MODAL WHEN CLICKING BACKGROUND
    // ========================================

    lightboxModal.addEventListener("click", (event) => {

        if (event.target === lightboxModal) {
            closeModal();
        }

    });


    // ========================================
    // CLOSE MODAL WITH ESCAPE KEY
    // ========================================

    document.addEventListener("keydown", (event) => {

        if (
            event.key === "Escape" &&
            lightboxModal.classList.contains("show")
        ) {

            closeModal();

        }

    });


    // ========================================
    // CURRENT YEAR
    // ========================================

    if (year) {

        year.textContent =
            new Date().getFullYear();

    }


    // ========================================
    // IMAGE ERROR HANDLING
    // ========================================

    const leaderImages =
        document.querySelectorAll(".leader-img");


    leaderImages.forEach((image) => {

        image.addEventListener("error", () => {

            // Prevent infinite error loop
            if (image.dataset.fallback === "true") {
                return;
            }

            image.dataset.fallback = "true";

            image.src =
                "https://via.placeholder.com/600x600?text=Church+Member";

        });

    });

});