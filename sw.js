self.addEventListener("fetch", (event) => {
  event.respondWith(
    (async () => {
      try {
        let req = await caches.match(event.request);
        if (req) {
          let headers = new Headers(req.headers);
          if (headers.get("Cross-Origin-Embedder-Policy") != "require-corp")
            headers.append("Cross-Origin-Embedder-Policy", "require-corp");
          if (headers.get("Cross-Origin-Opener-Policy") != "same-origin")
            headers.append("Cross-Origin-Opener-Policy", "same-origin");

          return new Response(req.body, {
            status: req.status,
            statusText: req.statusText,
            headers: headers,
          });
        }
        req = await fetch(event.request);
        return req;
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
  self.skipWaiting();
  event.waitUntil(installCache());
  console.log("cache installed");
});

async function maybeFlushCache() {
  const cachedmilestone = await caches.match("/MILESTONE");
  let response;
  try {
    response = await fetch("/MILESTONE");
  } catch (e) {
    console.log("MILESTONE fetch failed, skipping flush check", e);
    return;
  }
  if (!response.ok) {
    console.log("MILESTONE fetch not ok, skipping flush check", response.status);
    return;
  }
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
  event.waitUntil(Promise.all([maybeFlushCache(), self.clients.claim()]));
});
