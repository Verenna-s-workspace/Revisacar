// v2: a v1 guardava o index.html e servia sempre a versão antiga do app. Mudou o nome → o
// `activate` abaixo apaga o cache velho em quem já tinha o SW instalado.
const CACHE_NAME = 'revisacar-cache-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.svg',
  '/logo_maskable.svg',
  'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Fredoka:wght@300..700&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Lato:ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900&display=swap'
];

// Install Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching static assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch events interceptor
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const requestUrl = new URL(request.url);

  // Só mexe em GET do próprio site (+ fontes do Google). API (outra origem, ex.:
  // 127.0.0.1:8000), POST/PUT/DELETE e o resto passam direto pelo navegador —
  // antes a API caía no cache-first e, se o fetch falhava, respondia `undefined`
  // (erros de CORS/"respondWith" no console).
  const mesmaOrigem = requestUrl.origin === self.location.origin;
  const fonte = requestUrl.hostname === 'fonts.googleapis.com' || requestUrl.hostname === 'fonts.gstatic.com';
  if (request.method !== 'GET' || !(mesmaOrigem || fonte)) return;

  // Páginas (index.html): rede primeiro, cache só se estiver offline. Cache-first aqui
  // prendia o usuário no bundle antigo depois de cada deploy.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html').then((r) => r || Response.error()))
    );
    return;
  }

  // Arquivos com hash no nome (/assets/*), fontes e ícones: cache primeiro.
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && (networkResponse.type === 'basic' || fonte)) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseToCache));
        }
        return networkResponse;
      });
    }).catch(() => Response.error())
  );
});
