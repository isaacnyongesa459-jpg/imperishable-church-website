/* =====================================================
   IMPERISHABLE CROWN - SERVICES JAVASCRIPT
   ===================================================== */

document.addEventListener("DOMContentLoaded", function () {

    // ================= NAVIGATION =================

    const hamburger = document.getElementById("hamburger");
    const dropdownMenu = document.getElementById("dropdownMenu");

    if (hamburger && dropdownMenu) {
        hamburger.addEventListener("click", function (event) {
            event.stopPropagation();
            dropdownMenu.classList.toggle("show");

            const isOpen = dropdownMenu.classList.contains("show");
            hamburger.setAttribute("aria-expanded", isOpen);

            const icon = hamburger.querySelector("i");
            if (isOpen) {
                icon.classList.remove("fa-bars");
                icon.classList.add("fa-times");
                hamburger.setAttribute("aria-label", "Close navigation menu");
            } else {
                icon.classList.remove("fa-times");
                icon.classList.add("fa-bars");
                hamburger.setAttribute("aria-label", "Open navigation menu");
            }
        });

        document.addEventListener("click", function (event) {
            const clickedInsideMenu = dropdownMenu.contains(event.target);
            const clickedHamburger = hamburger.contains(event.target);

            if (!clickedInsideMenu && !clickedHamburger) {
                closeNavigation();
            }
        });

        const navigationLinks = dropdownMenu.querySelectorAll(".dropdown-item");
        navigationLinks.forEach(function (link) {
            link.addEventListener("click", function () {
                closeNavigation();
            });
        });

        window.addEventListener("resize", function () {
            if (window.innerWidth > 768) {
                closeNavigation();
            }
        });
    }

    function closeNavigation() {
        if (!dropdownMenu || !hamburger) return;

        dropdownMenu.classList.remove("show");
        hamburger.setAttribute("aria-expanded", "false");
        hamburger.setAttribute("aria-label", "Open navigation menu");

        const icon = hamburger.querySelector("i");
        if (icon) {
            icon.classList.remove("fa-times");
            icon.classList.add("fa-bars");
        }
    }


    // ================= SERVICE MODAL =================

    const serviceModal = document.getElementById("serviceModal");
    const modalTitle = document.getElementById("modalTitle");

    window.openModal = function (serviceName) {
        if (modalTitle) {
            modalTitle.textContent = serviceName;
        }
        if (serviceModal) {
            serviceModal.classList.add("show");
            document.body.style.overflow = "hidden";
        }
    };

    window.closeModal = function () {
        if (serviceModal) {
            serviceModal.classList.remove("show");
            document.body.style.overflow = "";
        }
    };

    if (serviceModal) {
        serviceModal.addEventListener("click", function (event) {
            if (event.target === serviceModal) {
                closeModal();
            }
        });
    }

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            closeNavigation();
            closeModal();
        }
    });


    // ================= VISIT FORM =================

    const visitForm = document.getElementById("visitForm");

    if (visitForm) {
        visitForm.addEventListener("submit", function (event) {
            event.preventDefault();

            const name = document.getElementById("visitorName").value.trim();
            const phone = document.getElementById("visitorPhone").value.trim();

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
    }

});
