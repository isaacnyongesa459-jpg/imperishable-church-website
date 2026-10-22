/* =====================================================
   IMPERISHABLE CROWN BIBLE BAPTIST CHURCH
   SERVICES JAVASCRIPT
   ===================================================== */


/* =====================================================
   NAVIGATION MENU
   ===================================================== */

document.addEventListener("DOMContentLoaded", function () {

    const hamburger = document.getElementById("hamburger");
    const dropdownMenu = document.getElementById("dropdownMenu");

    if (!hamburger || !dropdownMenu) {
        console.error("Navigation elements were not found.");
        return;
    }


    /* OPEN / CLOSE MENU */

    hamburger.addEventListener("click", function (event) {

        event.stopPropagation();

        dropdownMenu.classList.toggle("show");

        const icon = hamburger.querySelector("i");

        const isOpen = dropdownMenu.classList.contains("show");

        if (isOpen) {

            icon.classList.remove("fa-bars");
            icon.classList.add("fa-xmark");

            hamburger.setAttribute(
                "aria-expanded",
                "true"
            );

        } else {

            icon.classList.remove("fa-xmark");
            icon.classList.add("fa-bars");

            hamburger.setAttribute(
                "aria-expanded",
                "false"
            );

        }

    });


    /* CLOSE MENU AFTER CLICKING A LINK */

    const menuLinks =
        document.querySelectorAll(".dropdown-item");

    menuLinks.forEach(function (link) {

        link.addEventListener("click", function () {

            dropdownMenu.classList.remove("show");

            const icon = hamburger.querySelector("i");

            icon.classList.remove("fa-xmark");
            icon.classList.add("fa-bars");

            hamburger.setAttribute(
                "aria-expanded",
                "false"
            );

        });

    });


    /* CLOSE MENU WHEN CLICKING OUTSIDE */

    document.addEventListener("click", function (event) {

        if (
            !dropdownMenu.contains(event.target) &&
            !hamburger.contains(event.target)
        ) {

            dropdownMenu.classList.remove("show");

            const icon = hamburger.querySelector("i");

            icon.classList.remove("fa-xmark");
            icon.classList.add("fa-bars");

            hamburger.setAttribute(
                "aria-expanded",
                "false"
            );

        }

    });


    /* CLOSE MENU WITH ESCAPE KEY */

    document.addEventListener("keydown", function (event) {

        if (event.key === "Escape") {

            dropdownMenu.classList.remove("show");

            const icon = hamburger.querySelector("i");

            icon.classList.remove("fa-xmark");
            icon.classList.add("fa-bars");

            hamburger.setAttribute(
                "aria-expanded",
                "false"
            );

        }

    });

});


/* =====================================================
   SERVICE MODAL
   ===================================================== */

function openModal(serviceName) {

    const modal =
        document.getElementById("serviceModal");

    const modalTitle =
        document.getElementById("modalTitle");

    if (!modal || !modalTitle) {
        return;
    }

    modalTitle.textContent = serviceName;

    modal.classList.add("show");

    document.body.style.overflow = "hidden";

}


/* CLOSE MODAL */

function closeModal() {

    const modal =
        document.getElementById("serviceModal");

    if (!modal) {
        return;
    }

    modal.classList.remove("show");

    document.body.style.overflow = "";

}


/* =====================================================
   MODAL CONTROLS
   ===================================================== */

document.addEventListener("DOMContentLoaded", function () {

    const modal =
        document.getElementById("serviceModal");

    const closeButton =
        document.getElementById("modalClose");

    const cancelButton =
        document.getElementById("cancelModal");


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            closeModal
        );

    }


    if (cancelButton) {

        cancelButton.addEventListener(
            "click",
            closeModal
        );

    }


    /* CLICK OUTSIDE MODAL */

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


    /* ESCAPE KEY */

    document.addEventListener(
        "keydown",
        function (event) {

            if (event.key === "Escape") {
                closeModal();
            }

        }
    );

});


/* =====================================================
   VISITOR FORM
   ===================================================== */

document.addEventListener("DOMContentLoaded", function () {

    const visitForm =
        document.getElementById("visitForm");


    if (!visitForm) {
        return;
    }


    visitForm.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();


            const name =
                document.getElementById(
                    "visitorName"
                ).value.trim();


            const phone =
                document.getElementById(
                    "visitorPhone"
                ).value.trim();


            if (!name || !phone) {

                alert(
                    "Please enter your name and phone number."
                );

                return;

            }


            alert(
                "Thank you, " +
                name +
                "! Your request has been received. " +
                "We will contact you on " +
                phone +
                "."
            );


            visitForm.reset();

            closeModal();

        }
    );

});


/* =====================================================
   CURRENT YEAR
   ===================================================== */

document.addEventListener("DOMContentLoaded", function () {

    const year =
        document.getElementById("currentYear");

    if (year) {

        year.textContent =
            new Date().getFullYear();

    }

});
// ================= NAVIGATION MENU =================

const hamburger = document.getElementById("hamburger");
const dropdownMenu = document.getElementById("dropdownMenu");

// Open and close menu
hamburger.addEventListener("click", function () {

    dropdownMenu.classList.toggle("show");

    // Change hamburger icon
    const icon = hamburger.querySelector("i");

    if (dropdownMenu.classList.contains("show")) {
        icon.classList.remove("fa-bars");
        icon.classList.add("fa-times");
        hamburger.setAttribute("aria-expanded", "true");
    } else {
        icon.classList.remove("fa-times");
        icon.classList.add("fa-bars");
        hamburger.setAttribute("aria-expanded", "false");
    }

});


// Close menu when a navigation link is clicked
const menuLinks = document.querySelectorAll(".dropdown-item");

menuLinks.forEach(function (link) {

    link.addEventListener("click", function () {

        dropdownMenu.classList.remove("show");

        const icon = hamburger.querySelector("i");

        icon.classList.remove("fa-times");
        icon.classList.add("fa-bars");

        hamburger.setAttribute("aria-expanded", "false");

    });

});


// Close menu when clicking outside
document.addEventListener("click", function (event) {

    if (
        !hamburger.contains(event.target) &&
        !dropdownMenu.contains(event.target)
    ) {

        dropdownMenu.classList.remove("show");

        const icon = hamburger.querySelector("i");

        icon.classList.remove("fa-times");
        icon.classList.add("fa-bars");

        hamburger.setAttribute("aria-expanded", "false");

    }

});


// ================= SERVICE MODAL =================

function openModal(serviceName) {

    const modal = document.getElementById("serviceModal");
    const modalTitle = document.getElementById("modalTitle");

    modalTitle.textContent = serviceName;

    modal.style.display = "flex";

    document.body.style.overflow = "hidden";
}


function closeModal() {

    const modal = document.getElementById("serviceModal");

    modal.style.display = "none";

    document.body.style.overflow = "auto";
}


// Close modal when clicking outside
const serviceModal = document.getElementById("serviceModal");

if (serviceModal) {

    serviceModal.addEventListener("click", function (event) {

        if (event.target === serviceModal) {
            closeModal();
        }

    });

}


// ================= VISIT FORM =================

const visitForm = document.getElementById("visitForm");

if (visitForm) {

    visitForm.addEventListener("submit", function (event) {

        event.preventDefault();

        const name = document.getElementById("visitorName").value;
        const phone = document.getElementById("visitorPhone").value;

        alert(
            "Thank you, " + name +
            "! We will contact you on " + phone + "."
        );

        visitForm.reset();

        closeModal();

    });

}