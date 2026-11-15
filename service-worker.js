const CACHE_NAME = "imperishable-church-v7";
const START_PAGE = "./index.html";

const PRECACHE_FILES = [
    "./",
    "./index.html",
    "./styles.css",
    "./script.js",
    "./home.html",
    "./home.css",
    "./home.js",
    "./pwa.js",
    "./manifest.json",
    "./app-icon-192.png",
    "./file_00000000975082088f440ded4bccbf30.png",
    "./a_grand_cinematic_church_entrance_web_splash_page-1.png"
];

/* INSTALL: save the core files for offline use */
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(PRECACHE_FILES))
            .then(() => self.skipWaiting())
    );
});

/* ACTIVATE: remove old caches */
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter((key) =>
                            key.startsWith("imperishable-church-") &&
                            key !== CACHE_NAME
                        )
                        .map((key) => caches.delete(key))
                )
            )
            .then(() => self.clients.claim())
    );
});

/* FETCH */
self.addEventListener("fetch", (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Only handle GET requests from this same website
    if (request.method !== "GET" || url.origin !== self.location.origin) {
        return;
    }

    // Never interfere with API / M-PESA requests
    if (
        /\/api(?:\/|$)/i.test(url.pathname) ||
        /stkpush|callback|payment/i.test(url.pathname)
    ) {
        return;
    }

    // Pages: network first, then cache, then the start page
    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response && response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(() =>
                    caches.match(request).then((cached) => cached || caches.match(START_PAGE))
                )
        );
        return;
    }

    // CSS, JS, images: cache first, then network
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) {
                return cached;
            }

            return fetch(request).then((response) => {
                if (response && response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                }
                return response;
            });
        })
    );
});
