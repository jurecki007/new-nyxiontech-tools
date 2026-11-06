// Service worker for the installed web app (PWA). It has one job: receive files
// that another app shares with this one (the share_target in site.webmanifest) and
// hand them to the page. There is no backend, so the POST the OS sends to
// /share-target has to be answered here.
//
// It caches nothing, stores nothing on disk and makes no network requests of its
// own. Shared files are held in memory only until the page picks them up (or for
// a minute at most), then dropped. Every other request goes to the network as if
// there were no service worker.

const SHARE_PATH = '/share-target';
const KEEP_MS = 60_000;

/** Shared files waiting for the page, by id. Memory only. */
const pending = new Map();

self.addEventListener('install', (event) => {
  // Where supported (Chrome 123+), let every request except a POST skip this
  // worker entirely, so normal page loads never wait for it to start.
  try {
    event.addRoutes?.({ condition: { not: { requestMethod: 'POST' } }, source: 'network' });
  } catch {
    // Older browsers: the fetch handler below lets those requests through.
  }
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'POST') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname !== SHARE_PATH) return;

  const id = crypto.randomUUID();
  let release;
  const pickedUp = new Promise((resolve) => (release = resolve));
  const timer = setTimeout(() => release(), KEEP_MS);
  pending.set(id, {
    files: [],
    done: () => {
      clearTimeout(timer);
      release();
    },
  });

  event.respondWith(
    (async () => {
      try {
        const form = await request.formData();
        pending.get(id).files = form.getAll('files').filter((f) => f instanceof File);
      } catch {
        // An unreadable body: the page then reports that nothing was shared.
      }
      return Response.redirect(`/?share-target=${id}`, 303);
    })(),
  );
  // Keep the worker (and the files in memory) alive until the page has them.
  event.waitUntil(pickedUp.then(() => pending.delete(id)));
});

// The page asks for its shared files with { type: 'share-target-files', id } and a
// MessagePort; the files are sent back once and then forgotten.
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'share-target-files' || typeof data.id !== 'string') return;
  const port = event.ports[0];
  const entry = pending.get(data.id);
  port?.postMessage({ files: entry ? entry.files : [] });
  if (entry) entry.done();
});
