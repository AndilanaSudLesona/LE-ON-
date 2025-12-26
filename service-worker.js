// service-worker.js
const CACHE_VERSION = 'lesona-v2';
const RUNTIME_CACHE = 'lesona-runtime-v2';
const LESSON_CACHE = 'lesona-lessons-v2';

// Static assets - cached automatically
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/images/lehibe.png',
  '/images/tanora.png',
  '/images/zatovo.png',
  '/images/icon-192.png',
  '/images/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Lora:wght@400;600;700&display=swap',
  'https://fonts.gstatic.com/s/lora/v32/0QI6MX1D_JOuGQbT0gvTJPa787weuxJBkqg.woff2'
];

// Lesson URLs - pre-cache anatin'ny première visite
const LESSON_URLS = [
  'https://sabbath-school.adventech.io/resources/mg/ss/2025-04',
  'https://sabbath-school.adventech.io/resources/mg/ss/2025-04-cq',
  'https://AndilanaSudLesona.github.io/SDA/Zatovo/'
];

// Installation - cache everything
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(CACHE_VERSION).then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS).catch(err => {
          console.error('[SW] Failed to cache static assets:', err);
        });
      }),
      // Pre-cache lesson pages (ny principale)
      caches.open(LESSON_CACHE).then((cache) => {
        console.log('[SW] Pre-caching lesson pages');
        return Promise.all(
          LESSON_URLS.map(url => {
            return fetch(url, { mode: 'no-cors' })
              .then(response => {
                if (response.ok || response.type === 'opaque') {
                  return cache.put(url, response);
                }
              })
              .catch(err => console.log('[SW] Failed to pre-cache:', url));
          })
        );
      })
    ]).then(() => {
      console.log('[SW] Installation complete');
      return self.skipWaiting();
    })
  );
});

// Activation - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_VERSION && 
              cacheName !== RUNTIME_CACHE && 
              cacheName !== LESSON_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Activation complete');
      return self.clients.claim();
    })
  );
});

// Fetch Strategy: Cache First, Network Fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-HTTP requests
  if (!request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // Raha misy cache, miverina azy AVY HATRANY
      if (cachedResponse) {
        console.log('[SW] Serving from cache:', url.pathname);
        
        // Background update (tsy miandry)
        fetchAndCache(request).catch(() => {});
        
        return cachedResponse;
      }

      // Tsy misy cache - fetch sy cache
      console.log('[SW] Fetching from network:', url.pathname);
      return fetchAndCache(request);
    }).catch(() => {
      // Error handling - offline message
      if (request.destination === 'document') {
        return new Response(
          createOfflineHTML(),
          { headers: { 'Content-Type': 'text/html' } }
        );
      }
    })
  );
});

// Helper: Fetch and cache
function fetchAndCache(request) {
  return fetch(request).then((response) => {
    // Tsy cache raha error
    if (!response || response.status !== 200 && response.type !== 'opaque') {
      return response;
    }

    // Clone response ho an'ny cache
    const responseClone = response.clone();

    // Determine cache name
    const url = new URL(request.url);
    const isLesson = LESSON_URLS.some(lessonUrl => request.url.startsWith(lessonUrl));
    const cacheName = isLesson ? LESSON_CACHE : RUNTIME_CACHE;

    // Cache asynchronously
    caches.open(cacheName).then((cache) => {
      cache.put(request, responseClone).catch(err => {
        console.error('[SW] Failed to cache:', err);
      });
    });

    return response;
  });
}

// Create offline HTML page
function createOfflineHTML() {
  return `
    <!DOCTYPE html>
    <html lang="mg">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Offline</title>
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
        .container {
          max-width: 400px;
        }
        h1 {
          font-size: 48px;
          margin-bottom: 16px;
        }
        h2 {
          font-size: 24px;
          margin-bottom: 16px;
          font-weight: 600;
        }
        p {
          opacity: 0.7;
          line-height: 1.6;
          margin-bottom: 24px;
        }
        button {
          padding: 12px 32px;
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
      <div class="container">
        <h1>📱</h1>
        <h2>Tsy misy connexion</h2>
        <p>Tsy mbola nisy cache io pejy io. Mila connexion internet voalohany mba hamaky azy.</p>
        <button onclick="location.reload()">Hamerina</button>
      </div>
    </body>
    </html>
  `;
}

// Message handling ho an'ny manual updates
self.addEventListener('message', (event) => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
  
  if (event.data.action === 'clearCache') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
      })
    );
  }
});
