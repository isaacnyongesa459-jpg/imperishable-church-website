document.addEventListener("DOMContentLoaded", function () {

    /* =========================================
       HAMBURGER MENU
    ========================================= */

    const hamburger = document.getElementById("hamburger");
    const dropdownMenu = document.getElementById("dropdownMenu");

    hamburger.addEventListener("click", function (event) {

        event.stopPropagation();

        dropdownMenu.classList.toggle("show");

        const icon = hamburger.querySelector("i");

        if (dropdownMenu.classList.contains("show")) {
            icon.classList.remove("fa-bars");
            icon.classList.add("fa-xmark");
        } else {
            icon.classList.remove("fa-xmark");
            icon.classList.add("fa-bars");
        }

    });


    /* =========================================
       CLOSE MENU WHEN CLICKING OUTSIDE
    ========================================= */

    document.addEventListener("click", function (event) {

        if (
            !dropdownMenu.contains(event.target) &&
            !hamburger.contains(event.target)
        ) {

            dropdownMenu.classList.remove("show");

            const icon = hamburger.querySelector("i");

            icon.classList.remove("fa-xmark");
            icon.classList.add("fa-bars");
        }

    });


    /* =========================================
       CLOSE MENU AFTER CLICKING A LINK
    ========================================= */

    const menuLinks =
        document.querySelectorAll(".dropdown-item");

    menuLinks.forEach(function (link) {

        link.addEventListener("click", function () {

            dropdownMenu.classList.remove("show");

            const icon = hamburger.querySelector("i");

            icon.classList.remove("fa-xmark");
            icon.classList.add("fa-bars");

        });

    });


    /* =========================================
       GALLERY LIGHTBOX
    ========================================= */

    const galleryCards =
        document.querySelectorAll(".gallery-card");

    const modal =
        document.getElementById("lightboxModal");

    const lightboxImg =
        document.getElementById("lightboxImg");

    const lightboxCaption =
        document.getElementById("lightboxCaption");

    const closeLightbox =
        document.getElementById("closeLightbox");


    galleryCards.forEach(function (card) {

        card.addEventListener("click", function () {

            const image =
                card.querySelector(".gallery-img");

            const title =
                card.getAttribute("data-title");

            const description =
                card.getAttribute("data-desc");

            lightboxImg.src = image.src;

            lightboxImg.alt = image.alt;

            lightboxCaption.innerHTML =
                `<strong>${title}</strong><br>${description}`;

            modal.classList.add("show");

            document.body.style.overflow = "hidden";

        });

    });


    /* =========================================
       CLOSE LIGHTBOX
    ========================================= */

    closeLightbox.addEventListener("click", function (event) {

        event.stopPropagation();

        closeModal();

    });


    modal.addEventListener("click", function (event) {

        if (event.target === modal) {
            closeModal();
        }

    });


    function closeModal() {

        modal.classList.remove("show");

        document.body.style.overflow = "";

        lightboxImg.src = "";

        lightboxCaption.innerHTML = "";

    }


    /* =========================================
       ESC KEY CLOSES LIGHTBOX
    ========================================= */

    document.addEventListener("keydown", function (event) {

        if (event.key === "Escape") {

            closeModal();

            dropdownMenu.classList.remove("show");

        }

    });

});


/* =========================================
   IMAGE ERROR FALLBACK
========================================= */

function imageError(image) {

    image.src =
        "https://via.placeholder.com/400x280?text=✝+Image+Coming+Soon";

    image.classList.add("error-img");

    image.onerror = null;
}