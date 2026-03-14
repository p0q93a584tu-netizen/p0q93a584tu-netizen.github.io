self.addEventListener("install", (event) => {
  event.waitUntil(installCache());
  self.skipWaiting();
  console.log("cache installed");
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  try {
    if (new URL(request.url).pathname === "/") {
      maybeFlushCache();
    }

    const cache = await caches.open("v1");
    let response = await cache.match(request);

    if (!response) {
      response = await fetch(request);

      if (request.method === "GET" && response.ok) {
        cache.put(request, response.clone());
      }
    }

    const headers = new Headers(response.headers);
    headers.set("Cross-Origin-Embedder-Policy", "require-corp");
    headers.set("Cross-Origin-Opener-Policy", "same-origin");

    return new Response(await response.blob(), {
      status: response.status,
      statusText: response.statusText,
      headers: headers,
    });

  } catch (e) {
    console.log("error", e);
    return new Response("Worker error", {
      status: 500,
      statusText: "Network error",
    });
  }
}

async function installCache() {
  const cache = await caches.open("v1");

  const boot = await fetch("/web/_framework/blazor.boot.json");
  const bootjson = await boot.json();

  const resources = [
    "/",
    "/web/",
    "/MILESTONE",
    "/web/_framework/blazor.boot.json",
    "/web/app.ico",
    "/web/backdrop.png",
    "/web/AndyBold.ttf",
    "/web/assets/index.js",
    "/web/assets/index.css",
    ...Object.keys(bootjson.resources.fingerprinting).map(
      (r) => "/web/_framework/" + r
    ),
  ];

  await cache.addAll(resources);
}

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
