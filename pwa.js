"use strict";

if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker
            .register("./service-worker.js")
            .then((registration) => {
                console.log("Church PWA service worker registered:", registration.scope);
            })
            .catch((error) => {
                console.error("Service worker registration failed:", error);
            });
    });
}
