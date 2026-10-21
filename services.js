/* =====================================================
   MOBILE NAVIGATION
===================================================== */

document.addEventListener("DOMContentLoaded", function () {

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

                icon.classList.add("fa-times");

            } else {

                icon.classList.remove("fa-times");

                icon.classList.add("fa-bars");
            }

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


        /* Close menu after clicking a link */

        const menuLinks =
            dropdownMenu.querySelectorAll(".dropdown-item");

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

    }

});


/* =====================================================
   SERVICE MODAL
===================================================== */

const modal =
    document.getElementById("serviceModal");

const modalTitle =
    document.getElementById("modalTitle");


function openModal(serviceName) {

    if (!modal) return;

    modalTitle.textContent =
        "Join " + serviceName;

    modal.classList.add("show");

    document.body.style.overflow = "hidden";

    const nameInput =
        document.getElementById("visitorName");

    if (nameInput) {

        setTimeout(function () {

            nameInput.focus();

        }, 100);

    }
}


function closeModal() {

    if (!modal) return;

    modal.classList.remove("show");

    document.body.style.overflow = "";

}


/* =====================================================
   CLOSE MODAL WHEN CLICKING BACKGROUND
===================================================== */

if (modal) {

    modal.addEventListener("click", function (event) {

        if (event.target === modal) {

            closeModal();

        }

    });

}


/* =====================================================
   ESC KEY CLOSES MODAL
===================================================== */

document.addEventListener("keydown", function (event) {

    if (event.key === "Escape") {

        closeModal();

    }

});


/* =====================================================
   FORM
===================================================== */

const visitForm =
    document.getElementById("visitForm");


if (visitForm) {

    visitForm.addEventListener("submit", function (event) {

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
            "! We look forward to welcoming you."
        );


        visitForm.reset();

        closeModal();

    });

}