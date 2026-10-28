
/* ========================================
   IMPERISHABLE CROWN BIBLE BAPTIST CHURCH
   WELCOME PAGE JAVASCRIPT + PWA
======================================== */

document.addEventListener("DOMContentLoaded", () => {
    const joinButton = document.getElementById("joinButton");

    // Keep the welcome button functionality.
    if (joinButton) {
        joinButton.addEventListener("click", () => {
            joinButton.classList.add("clicked");
        });
    }
});

// Register the PWA service worker.
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js")
            .then((registration) => {
                console.log(
                    "PWA service worker registered:",
                    registration.scope
                );
            })
            .catch((error) => {
                console.error(
                    "PWA service worker registration failed:",
                    error
                );
            });
    });
}
