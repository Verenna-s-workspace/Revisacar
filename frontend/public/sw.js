// v2: a v1 guardava o index.html e servia sempre a versão antiga do app. Mudou o nome → o
// `activate` abaixo apaga o cache velho em quem já tinha o SW instalado.
// v3: o app foi pra /app/ (a raiz virou a landing) e a lista tinha arquivos inexistentes
// (logo.svg) que faziam o addAll falhar e o SW não instalar.
const CACHE_NAME = 'revisacar-cache-v3';
const ASSETS_TO_CACHE = [
  '/app/index.html',
  '/manifest.json',
  '/Logorevisavermelha.svg',
  '/revisaLogoBG.svg',
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

// Sem internet: telas do app caem no app guardado; a landing só tem cópia se já foi aberta.
function paginaOffline(caminho) {
  return /^\/(app(\/|$)|o\/|f\/|reset-password)/.test(caminho) ? '/app/index.html' : caminho;
}

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
      fetch(request).catch(() => caches.match(paginaOffline(requestUrl.pathname)).then((r) => r || Response.error()))
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
