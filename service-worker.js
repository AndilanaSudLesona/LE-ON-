// service-worker.js
const CACHE_NAME = 'lesona-v1';
const RUNTIME_CACHE = 'lesona-runtime-v1';

// Fichiers tokony ho cached automatiquement
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/images/logosda.png',
  '/images/lehibe.png',
  '/images/tanora.png',
  '/images/zatovo.png',
  'https://fonts.googleapis.com/css2?family=Lora:wght@400;600;700&display=swap'
];

// Installation - cache static assets
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activation - clean old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch - strategy: Cache First, fallback to Network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Strategy ho an'ny external sites (sabbath-school.adventech.io)
  if (url.origin !== location.origin) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          // Raha misy cache, miverina azy
          if (cachedResponse) {
            // Update cache ao ambadika (background)
            fetch(request)
              .then((response) => {
                if (response && response.status === 200) {
                  cache.put(request, response.clone());
                }
              })
              .catch(() => {});
            return cachedResponse;
          }

          // Tsy misy cache, manandrana fetch
          return fetch(request)
            .then((response) => {
              if (!response || response.status !== 200) {
                return response;
              }
              // Cache ny response
              cache.put(request, response.clone());
              return response;
            })
            .catch(() => {
              // Offline ary tsy misy cache
              return new Response(
                `<html>
                  <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                      body {
                        font-family: system-ui, -apple-system, sans-serif;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        margin: 0;
                        background: #000;
                        color: #fff;
                        padding: 20px;
                        text-align: center;
                      }
                      .message {
                        max-width: 400px;
                      }
                      h1 { font-size: 24px; margin-bottom: 16px; }
                      p { opacity: 0.7; line-height: 1.6; }
                      button {
                        margin-top: 24px;
                        padding: 12px 24px;
                        background: #fff;
                        color: #000;
                        border: none;
                        border-radius: 8px;
                        font-size: 16px;
                        font-weight: 600;
                        cursor: pointer;
                      }
                    </style>
                  </head>
                  <body>
                    <div class="message">
                      <h1>📱 Tsy misy internet</h1>
                      <p>Tsy mbola nisy cache io pejy io. Mila connexion internet mba hamaky azy voalohany.</p>
                      <button onclick="window.history.back()">Hiverina</button>
                    </div>
                  </body>
                </html>`,
                {
                  headers: { 'Content-Type': 'text/html' }
                }
              );
            });
        });
      })
    );
    return;
  }

  // Strategy ho an'ny local files: Cache First
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        if (!response || response.status !== 200) {
          return response;
        }

        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone);
        });

        return response;
      });
    })
  );
});
