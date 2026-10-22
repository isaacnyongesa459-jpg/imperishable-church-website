/* =====================================================
   IMPERISHABLE CROWN - SERVICES JAVASCRIPT
   ===================================================== */


/* ================= NAVIGATION ================= */

const hamburger = document.getElementById("hamburger");
const dropdownMenu = document.getElementById("dropdownMenu");


/*
    When the three-line button is clicked,
    add/remove the "show" class.
*/

hamburger.addEventListener("click", function (event) {

    event.stopPropagation();

    dropdownMenu.classList.toggle("show");

    const isOpen = dropdownMenu.classList.contains("show");

    hamburger.setAttribute(
        "aria-expanded",
        isOpen
    );

    /* Change hamburger icon to X */

    const icon = hamburger.querySelector("i");

    if (isOpen) {

        icon.classList.remove("fa-bars");
        icon.classList.add("fa-times");

    } else {

        icon.classList.remove("fa-times");
        icon.classList.add("fa-bars");

    }

});


/*
    Close menu when clicking anywhere
    outside the navigation menu.
*/

document.addEventListener("click", function (event) {

    const clickedInsideMenu =
        dropdownMenu.contains(event.target);

    const clickedHamburger =
        hamburger.contains(event.target);


    if (
        !clickedInsideMenu &&
        !clickedHamburger
    ) {

        closeNavigation();

    }

});


/*
    Close menu when a navigation link
    is clicked.
*/

const navigationLinks =
    document.querySelectorAll(".dropdown-item");


navigationLinks.forEach(function (link) {

    link.addEventListener("click", function () {

        closeNavigation();

    });

});


/*
    Navigation close function
*/

function closeNavigation() {

    dropdownMenu.classList.remove("show");

    hamburger.setAttribute(
        "aria-expanded",
        "false"
    );

    const icon = hamburger.querySelector("i");

    icon.classList.remove("fa-times");
    icon.classList.add("fa-bars");

}


/* ================= SERVICE MODAL ================= */

const serviceModal =
    document.getElementById("serviceModal");

const modalTitle =
    document.getElementById("modalTitle");


/*
    Open service modal
*/

function openModal(serviceName) {

    modalTitle.textContent =
        serviceName;

    serviceModal.classList.add("show");

    document.body.style.overflow = "hidden";

}


/*
    Close service modal
*/

function closeModal() {

    serviceModal.classList.remove("show");

    document.body.style.overflow = "";

}


/*
    Close modal when clicking
    outside the modal content.
*/

serviceModal.addEventListener("click", function (event) {

    if (event.target === serviceModal) {

        closeModal();

    }

});


/*
    Close modal using ESC key.
*/

document.addEventListener("keydown", function (event) {

    if (event.key === "Escape") {

        closeNavigation();

        closeModal();

    }

});


/* ================= VISIT FORM ================= */

const visitForm =
    document.getElementById("visitForm");


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


/* ================= PAGE LOADED ================= */

console.log(
    "Imperishable Crown Services page loaded successfully."
);

console.log(
    "Navigation menu JavaScript is working."
);