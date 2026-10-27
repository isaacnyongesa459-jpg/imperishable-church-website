
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then(() => {
        console.log("Church PWA service worker registered.");
      })
      .catch((error) => {
        console.error("Service worker registration failed:", error);
      });
  });
}
