document.addEventListener("DOMContentLoaded", function () {

/* ==========================================
   HAMBURGER NAVIGATION
   ========================================== */

const hamburger = document.getElementById("hamburger");
const dropdownMenu = document.getElementById("dropdownMenu");

if (!hamburger || !dropdownMenu) {
    console.error("Navigation elements were not found.");
    return;
}


// Open / close navigation
hamburger.addEventListener("click", function (event) {

    // Prevent document click from immediately closing it
    event.stopPropagation();

    dropdownMenu.classList.toggle("show");

    const isOpen = dropdownMenu.classList.contains("show");

    hamburger.setAttribute(
        "aria-expanded",
        isOpen ? "true" : "false"
    );


    // Change bars to X
    const icon = hamburger.querySelector("i");

    if (isOpen) {

        icon.classList.remove("fa-bars");
        icon.classList.add("fa-times");

    } else {

        icon.classList.remove("fa-times");
        icon.classList.add("fa-bars");

    }

});


/* ==========================================
   NAVIGATION LINKS
   ========================================== */

const navigationLinks =
    document.querySelectorAll(".dropdown-item");

navigationLinks.forEach(function (link) {

    link.addEventListener("click", function () {

        dropdownMenu.classList.remove("show");

        hamburger.setAttribute(
            "aria-expanded",
            "false"
        );

        const icon = hamburger.querySelector("i");

        icon.classList.remove("fa-times");
        icon.classList.add("fa-bars");

    });

});


/* ==========================================
   CLOSE MENU WHEN CLICKING OUTSIDE
   ========================================== */

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

        icon.classList.remove("fa-times");
        icon.classList.add("fa-bars");

    }

});


/* ==========================================
   SERVICE MODAL
   ========================================== */

const modal =
    document.getElementById("serviceModal");

const modalTitle =
    document.getElementById("modalTitle");

const modalClose =
    document.getElementById("modalClose");

const modalCancel =
    document.getElementById("modalCancel");

const visitForm =
    document.getElementById("visitForm");


// All service buttons
const serviceButtons =
    document.querySelectorAll(".btn-join");


serviceButtons.forEach(function (button) {

    button.addEventListener("click", function () {

        const serviceName =
            button.getAttribute("data-service");

        modalTitle.textContent = serviceName;

        modal.classList.add("show");

        document.body.style.overflow = "hidden";

    });

});


// Close modal
function closeModal() {

    modal.classList.remove("show");

    document.body.style.overflow = "";

}


if (modalClose) {

    modalClose.addEventListener(
        "click",
        closeModal
    );

}


if (modalCancel) {

    modalCancel.addEventListener(
        "click",
        closeModal
    );

}


// Close modal when clicking background
modal.addEventListener("click", function (event) {

    if (event.target === modal) {

        closeModal();

    }

});


// Close modal using ESC
document.addEventListener("keydown", function (event) {

    if (event.key === "Escape") {

        closeModal();

        dropdownMenu.classList.remove("show");

    }

});


/* ==========================================
   VISITOR FORM
   ========================================== */

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
        "! We will contact you on " +
        phone +
        "."
    );


    visitForm.reset();

    closeModal();

});

});