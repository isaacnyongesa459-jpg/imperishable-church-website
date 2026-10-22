document.addEventListener("DOMContentLoaded", function () {

    /* =========================
       NAVIGATION
       ========================= */

    const hamburger = document.getElementById("hamburger");
    const dropdownMenu = document.getElementById("dropdownMenu");

    const menuLinks =
        document.querySelectorAll(".dropdown-item");


    function toggleMenu(forceState) {

        const shouldOpen =
            typeof forceState === "boolean"
                ? forceState
                : !dropdownMenu.classList.contains("open");


        dropdownMenu.classList.toggle(
            "open",
            shouldOpen
        );


        hamburger.setAttribute(
            "aria-expanded",
            String(shouldOpen)
        );


        const icon =
            hamburger.querySelector("i");


        if (shouldOpen) {

            icon.classList.remove("fa-bars");

            icon.classList.add("fa-xmark");

            hamburger.setAttribute(
                "aria-label",
                "Close navigation menu"
            );

        } else {

            icon.classList.remove("fa-xmark");

            icon.classList.add("fa-bars");

            hamburger.setAttribute(
                "aria-label",
                "Open navigation menu"
            );

        }

    }


    hamburger.addEventListener(
        "click",
        function (event) {

            event.stopPropagation();

            toggleMenu();

        }
    );


    /* Close menu after clicking a link */

    menuLinks.forEach(function (link) {

        link.addEventListener(
            "click",
            function () {

                toggleMenu(false);

            }
        );

    });


    /* Close menu when clicking outside */

    document.addEventListener(
        "click",
        function (event) {

            if (
                dropdownMenu.classList.contains("open") &&
                !dropdownMenu.contains(event.target) &&
                !hamburger.contains(event.target)
            ) {

                toggleMenu(false);

            }

        }
    );


    /* Close menu with Escape */

    document.addEventListener(
        "keydown",
        function (event) {

            if (event.key === "Escape") {

                toggleMenu(false);

            }

        }
    );



    /* =========================
       MEMBER FILTERING
       ========================= */

    const filterButtons =
        document.querySelectorAll(".filter-btn");

    const cards =
        document.querySelectorAll(".leader-card");

    const memberCount =
        document.getElementById("memberCount");


    function updateCount(number) {

        const word =
            number === 1
                ? "member"
                : "members";


        memberCount.innerHTML =
            `Showing <span>${number}</span> ${word}`;

    }


    function filterMembers(category) {

        let visibleCount = 0;


        cards.forEach(function (card) {

            const matches =
                category === "all" ||
                card.dataset.category === category;


            if (matches) {

                card.classList.remove("hidden");

                visibleCount++;

            } else {

                card.classList.add("hidden");

            }

        });


        updateCount(visibleCount);

    }


    filterButtons.forEach(function (button) {

        button.addEventListener(
            "click",
            function () {

                filterButtons.forEach(
                    function (btn) {

                        btn.classList.remove(
                            "active"
                        );

                    }
                );


                button.classList.add("active");


                filterMembers(
                    button.dataset.filter
                );

            }
        );

    });



    /* =========================
       MEMBER DETAILS MODAL
       ========================= */

    const modal =
        document.getElementById("lightboxModal");

    const closeModalButton =
        document.getElementById("closeLightbox");

    const modalImage =
        document.getElementById("modalImage");

    const modalName =
        document.getElementById("modalName");

    const modalPosition =
        document.getElementById("modalPosition");

    const modalBio =
        document.getElementById("modalBio");


    function openModal(card) {

        modalImage.src =
            card.dataset.image;

        modalImage.alt =
            card.dataset.name;

        modalName.textContent =
            card.dataset.name;

        modalPosition.textContent =
            card.dataset.position;

        modalBio.textContent =
            card.dataset.bio;


        modal.classList.add("open");

        modal.setAttribute(
            "aria-hidden",
            "false"
        );


        document.body.style.overflow =
            "hidden";


        closeModalButton.focus();

    }


    function closeModal() {

        modal.classList.remove("open");

        modal.setAttribute(
            "aria-hidden",
            "true"
        );


        document.body.style.overflow =
            "";


        setTimeout(function () {

            if (!modal.classList.contains("open")) {

                modalImage.src = "";

            }

        }, 250);

    }


    /* Open modal when member card is clicked */

    cards.forEach(function (card) {

        card.addEventListener(
            "click",
            function (event) {

                /*
                 Don't open the member modal
                 when clicking social icons.
                */

                if (
                    event.target.closest(
                        ".social-icons a"
                    )
                ) {

                    event.preventDefault();

                    return;

                }


                openModal(card);

            }
        );

    });


    /* Close modal */

    closeModalButton.addEventListener(
        "click",
        closeModal
    );


    /* Close by clicking dark background */

    modal.addEventListener(
        "click",
        function (event) {

            if (event.target === modal) {

                closeModal();

            }

        }
    );


    /* Close with Escape */

    document.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Escape" &&
                modal.classList.contains("open")
            ) {

                closeModal();

            }

        }
    );



    /* =========================
       CURRENT YEAR
       ========================= */

    const year =
        document.getElementById("year");


    if (year) {

        year.textContent =
            new Date().getFullYear();

    }

});