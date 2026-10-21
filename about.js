document.addEventListener("DOMContentLoaded", () => {

    /* =====================================
       HAMBURGER MENU
    ===================================== */

    const hamburger =
        document.getElementById("hamburger");

    const dropdownMenu =
        document.getElementById("dropdownMenu");


    if (hamburger && dropdownMenu) {

        hamburger.addEventListener("click", (event) => {

            event.stopPropagation();

            dropdownMenu.classList.toggle("show");

            const icon =
                hamburger.querySelector("i");

            const isOpen =
                dropdownMenu.classList.contains("show");

            hamburger.setAttribute(
                "aria-expanded",
                isOpen
            );

            if (isOpen) {

                icon.classList.remove("fa-bars");
                icon.classList.add("fa-xmark");

            } else {

                icon.classList.remove("fa-xmark");
                icon.classList.add("fa-bars");

            }

        });


        document.addEventListener("click", (event) => {

            if (
                !dropdownMenu.contains(event.target) &&
                !hamburger.contains(event.target)
            ) {

                closeMenu();

            }

        });


        document
            .querySelectorAll(".dropdown-item")
            .forEach(link => {

                link.addEventListener("click", () => {

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


    /* =====================================
       GALLERY LIGHTBOX
    ===================================== */

    const cards =
        document.querySelectorAll(".gallery-card");

    const modal =
        document.getElementById("lightboxModal");

    const lightboxImg =
        document.getElementById("lightboxImg");

    const caption =
        document.getElementById("lightboxCaption");

    const closeButton =
        document.getElementById("closeLightbox");


    cards.forEach(card => {

        card.addEventListener("click", () => {

            const image =
                card.querySelector(".gallery-img");

            if (!image) return;

            const title =
                card.dataset.title || "";

            const description =
                card.dataset.desc || "";


            lightboxImg.src = image.src;

            lightboxImg.alt = image.alt;

            caption.innerHTML =
                `<strong>${title}</strong><br>${description}`;


            modal.classList.add("show");

            document.body.style.overflow = "hidden";

        });

    });


    /* =====================================
       CLOSE LIGHTBOX
    ===================================== */

    function closeLightbox() {

        modal.classList.remove("show");

        document.body.style.overflow = "";

        lightboxImg.src = "";

        caption.innerHTML = "";

    }


    closeButton.addEventListener(
        "click",
        closeLightbox
    );


    modal.addEventListener("click", event => {

        if (event.target === modal) {

            closeLightbox();

        }

    });


    document.addEventListener("keydown", event => {

        if (event.key === "Escape") {

            closeLightbox();

            if (dropdownMenu) {
                dropdownMenu.classList.remove("show");
            }

        }

    });

});


/* =====================================
   IMAGE ERROR
===================================== */

function imageError(image) {

    image.src =
        "https://via.placeholder.com/600x400?text=Image+Coming+Soon";

    image.classList.add("error-img");

    image.onerror = null;
}