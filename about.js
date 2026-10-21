document.addEventListener("DOMContentLoaded", function () {

    /* ==========================================
       HAMBURGER MENU
    ========================================== */

    const hamburger = document.getElementById("hamburger");
    const dropdownMenu = document.getElementById("dropdownMenu");

    if (hamburger && dropdownMenu) {

        hamburger.addEventListener("click", function (event) {

            event.stopPropagation();

            const isOpen =
                dropdownMenu.classList.toggle("show");

            hamburger.setAttribute(
                "aria-expanded",
                isOpen
            );

            const icon =
                hamburger.querySelector("i");

            if (isOpen) {

                icon.classList.remove("fa-bars");
                icon.classList.add("fa-xmark");

            } else {

                icon.classList.remove("fa-xmark");
                icon.classList.add("fa-bars");

            }

        });


        /* Close menu when clicking outside */

        document.addEventListener("click", function (event) {

            if (
                !dropdownMenu.contains(event.target) &&
                !hamburger.contains(event.target)
            ) {

                closeMenu();

            }

        });


        /* Close menu after selecting a link */

        const menuLinks =
            document.querySelectorAll(".dropdown-item");

        menuLinks.forEach(function (link) {

            link.addEventListener("click", function () {

                closeMenu();

            });

        });


        function closeMenu() {

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


    /* ==========================================
       LIGHTBOX
    ========================================== */

    const modal =
        document.getElementById("lightboxModal");

    const lightboxImg =
        document.getElementById("lightboxImg");

    const lightboxCaption =
        document.getElementById("lightboxCaption");

    const closeLightbox =
        document.getElementById("closeLightbox");

    const galleryCards =
        document.querySelectorAll(".gallery-card");


    galleryCards.forEach(function (card) {

        card.addEventListener("click", function () {

            const image =
                card.querySelector(".gallery-img");

            const title =
                card.dataset.title;

            const description =
                card.dataset.desc;


            if (!image || !modal) {
                return;
            }


            lightboxImg.src = image.src;

            lightboxImg.alt = image.alt;


            lightboxCaption.innerHTML =
                `<strong>${title}</strong><br>${description}`;


            modal.classList.add("show");

            document.body.style.overflow = "hidden";

        });

    });


    /* ==========================================
       CLOSE LIGHTBOX
    ========================================== */

    function closeModal() {

        if (!modal) {
            return;
        }

        modal.classList.remove("show");

        document.body.style.overflow = "";

        lightboxImg.src = "";

        lightboxCaption.innerHTML = "";

    }


    if (closeLightbox) {

        closeLightbox.addEventListener(
            "click",
            function (event) {

                event.stopPropagation();

                closeModal();

            }
        );

    }


    if (modal) {

        modal.addEventListener(
            "click",
            function (event) {

                if (event.target === modal) {

                    closeModal();

                }

            }
        );

    }


    /* ==========================================
       ESC KEY
    ========================================== */

    document.addEventListener(
        "keydown",
        function (event) {

            if (event.key === "Escape") {

                closeModal();

            }

        }
    );

});


/* ==========================================
   IMAGE ERROR HANDLER
========================================== */

function imageError(image) {

    if (!image) {
        return;
    }

    image.src =
        "https://via.placeholder.com/600x400?text=✝+Image+Coming+Soon";

    image.classList.add("error-img");

    image.onerror = null;
}