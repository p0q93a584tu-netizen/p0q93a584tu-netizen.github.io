async function installCache() {
  const cache = await caches.open("v1");
  const boot = await fetch("_framework/blazor.boot.json");
  const bootjson = await boot.json();
  let resources = [
    "/",
    "/MILESTONE",
    "/_framework/blazor.boot.json",
    "/app.ico",
    "/backdrop.png",
    "/AndyBold.ttf",
    "/assets/index.js",
    "/assets/index.css",
    ...Object.keys(bootjson.resources.fingerprinting).map(
      (r) => "_framework/" + r,
    ),
  ];
  await cache.addAll(resources);
}

self.addEventListener("install", (event) => {
  // CRITICAL ADDITION: Forces the waiting service worker to become the active service worker
  self.skipWaiting(); 
  event.waitUntil(installCache());
  console.log("cache installed");
});

async function maybeFlushCache() {
  const cachedmilestone = await caches.match("/MILESTONE");
  const response = await fetch("/MILESTONE");
  const milestone = await response.text();
  if (cachedmilestone) {
    const cachedmilestoneText = await cachedmilestone.text();
    if (cachedmilestoneText === milestone) {
      console.log("cache up to date");
      return;
    }
  }

  caches.keys().then((cacheNames) => {
    console.log("flushing cache");
    return Promise.all(cacheNames.map((name) => caches.delete(name)));
  });
}

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // CRITICAL ADDITION: Claims the clients immediately so headers apply on the first load
    await self.clients.claim(); 
    await maybeFlushCache();
  })());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    (async () => {
      try {
        if (new URL(event.request.url).pathname === "/") {
          maybeFlushCache();
        }

        // 1. Get the response (try cache first, fallback to network)
        let response = await caches.match(event.request);
        if (!response) {
          response = await fetch(event.request);
        }

        // 2. Check for opaque responses (3rd party cross-origin requests without CORS)
        // We cannot read or modify headers of opaque responses, so pass them through.
        if (response.status === 0 || response.type === "opaque") {
          return response;
        }

        // 3. Inject headers into EVERYTHING (both cache hits and network hits)
        const newHeaders = new Headers(response.headers);
        newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
        newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");

        // Return the modified response
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      } catch (e) {
        console.log("error", e);
        return new Response("Worker error", {
          status: 500,
          statusText: "Network error",
        });
      }
    })(),
  );
});
