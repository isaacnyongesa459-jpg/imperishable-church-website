/* =====================================================
   MOBILE NAVIGATION
===================================================== */

document.addEventListener("DOMContentLoaded", function () {

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

            const icon =
                hamburger.querySelector("i");

            if (isOpen) {

                icon.classList.remove("fa-bars");
                icon.classList.add("fa-times");

            } else {

                icon.classList.remove("fa-times");
                icon.classList.add("fa-bars");

            }

        });


        /* Close menu when clicking a link */

        const menuLinks =
            dropdownMenu.querySelectorAll("a");

        menuLinks.forEach(function (link) {

            link.addEventListener("click", function () {

                dropdownMenu.classList.remove("show");

                hamburger.setAttribute(
                    "aria-expanded",
                    "false"
                );

                const icon =
                    hamburger.querySelector("i");

                icon.classList.remove("fa-times");
                icon.classList.add("fa-bars");

            });

        });


        /* Close menu when clicking outside */

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

                const icon =
                    hamburger.querySelector("i");

                icon.classList.remove("fa-times");
                icon.classList.add("fa-bars");
            }

        });

    }

});


/* =====================================================
   MODAL
===================================================== */

function openModal(serviceName) {

    const modal =
        document.getElementById("joinModal");

    const modalTitle =
        document.getElementById("modalTitle");

    if (!modal) {
        return;
    }

    if (modalTitle) {

        modalTitle.textContent =
            "Join " + serviceName;

    }

    modal.classList.add("show");

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.style.overflow = "hidden";

}


/* =====================================================
   CLOSE MODAL
===================================================== */

function closeModal() {

    const modal =
        document.getElementById("joinModal");

    if (!modal) {
        return;
    }

    modal.classList.remove("show");

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.style.overflow = "";

}


/* =====================================================
   CLOSE MODAL BY CLICKING BACKGROUND
===================================================== */

document.addEventListener("DOMContentLoaded", function () {

    const modal =
        document.getElementById("joinModal");

    if (!modal) {
        return;
    }

    modal.addEventListener("click", function (event) {

        if (event.target === modal) {

            closeModal();

        }

    });

});


/* =====================================================
   ESCAPE KEY CLOSES MODAL
===================================================== */

document.addEventListener("keydown", function (event) {

    if (event.key === "Escape") {

        closeModal();

    }

});


/* =====================================================
   VISIT FORM
===================================================== */

document.addEventListener("DOMContentLoaded", function () {

    const form =
        document.getElementById("visitForm");

    if (!form) {
        return;
    }

    form.addEventListener("submit", function (event) {

        event.preventDefault();

        const name =
            document.getElementById("visitorName").value.trim();

        const phone =
            document.getElementById("visitorPhone").value.trim();


        if (!name || !phone) {

            alert("Please enter your name and phone number.");

            return;

        }


        alert(
            "Thank you, " +
            name +
            "! We will be happy to welcome you to church."
        );


        form.reset();

        closeModal();

    });

});