// Service worker de topochito, escrito a mano (sin Serwist: su soporte de Turbopack es experimental).
// Estrategias:
//   - /_next/static/* e iconos: cache-first (los nombres llevan hash, nunca cambian).
//   - Navegaciones: network-first; sin red, la última versión vista de esa página o /offline.
//   - API de recetas, menú, hoy y bebé: stale-while-revalidate (se ve al instante y se refresca detrás).
// Los datos de la API son de una familia: la app borra la caché "api" al entrar o salir (clearPrivateCaches).
const VERSION = "v1";
const STATIC = `static-${VERSION}`;
const PAGES = `pages-${VERSION}`;
const API = `api-${VERSION}`;
const PRECACHE = [
  "/offline",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
];
const SWR_API = [
  /^\/api\/recipes(\/|$|\?)/,
  /^\/api\/menu$/,
  /^\/api\/today$/,
  /^\/api\/baby$/,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  const keep = new Set([STATIC, PAGES, API]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

const cacheable = (res) => res && res.ok && res.type === "basic";

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (cacheable(res)) (await caches.open(STATIC)).put(req, res.clone());
  return res;
}

async function networkFirstPage(req) {
  const cache = await caches.open(PAGES);
  try {
    const res = await fetch(req);
    // Solo páginas finales: una redirección (p. ej. a /acceso) no se guarda como si fuera la página.
    if (cacheable(res) && !res.redirected) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req)) || (await caches.match("/offline"));
  }
}

async function staleWhileRevalidate(event) {
  const cache = await caches.open(API);
  const hit = await cache.match(event.request);
  const fresh = fetch(event.request)
    .then((res) => {
      if (cacheable(res)) cache.put(event.request, res.clone());
      else if (res.status === 401) cache.delete(event.request);
      return res;
    })
    .catch(() => hit);
  if (hit) {
    event.waitUntil(fresh);
    return hit;
  }
  return fresh;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (
    url.pathname.startsWith("/_next/static/") ||
    /\.(png|svg|ico|woff2)$/.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(req));
  } else if (req.mode === "navigate") {
    event.respondWith(networkFirstPage(req));
  } else if (SWR_API.some((re) => re.test(url.pathname))) {
    event.respondWith(staleWhileRevalidate(event));
  }
});

// --- Avisos push (los envía /api/cron/reminders) ---
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "topochito", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag, // el mismo recordatorio reemplaza al anterior en vez de apilarse
      data: { url: data.url || "/hoy" },
    }),
  );
});

// Al tocar el aviso: abre la receta (reutiliza una pestaña de la app si ya hay una).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    event.notification.data?.url || "/hoy",
    self.location.origin,
  );
  if (target.origin !== self.location.origin) return; // solo enlaces propios
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((wins) => {
        const win = wins.find((w) => new URL(w.url).origin === target.origin);
        if (win) return win.focus().then(() => win.navigate(target.href));
        return self.clients.openWindow(target.href);
      }),
  );
});
