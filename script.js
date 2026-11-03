/* =================================
   IMPERISHABLE CROWN
   ENTRANCE ANIMATION + PWA
================================= */

document.addEventListener("DOMContentLoaded", () => {

    const joinButton = document.getElementById("joinButton");

    let isOpening = false;

    if (joinButton) {

        joinButton.addEventListener("click", (event) => {

            if (isOpening) {
                event.preventDefault();
                return;
            }

            isOpening = true;

            event.preventDefault();

            // Start opening the church doors.
            document.body.classList.add("is-opening");

            // Enter the actual website after animation.
            const delay = window.matchMedia(
                "(prefers-reduced-motion: reduce)"
            ).matches ? 100 : 1800;

            setTimeout(() => {
                window.location.href = joinButton.href;
            }, delay);

        });

    }

});


/* =================================
   PWA SERVICE WORKER
================================= */

if ("serviceWorker" in navigator) {

    window.addEventListener("load", () => {

        navigator.serviceWorker.register("./service-worker.js")

            .then((registration) => {

                console.log(
                    "Church website PWA registered:",
                    registration.scope
                );

            })

            .catch((error) => {

                console.error(
                    "Service worker registration failed:",
                    error
                );

            });

    });

}