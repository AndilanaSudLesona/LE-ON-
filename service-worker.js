const CACHE_VERSION = 'lesona-v2.1';
const CACHE_ASSETS = 'lesona-assets-v2';
const CACHE_LESSONS = 'lesona-lessons-v2';
const CACHE_IMAGES = 'lesona-images-v2';

// Assets statiques à mettre en cache immédiatement
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/images/lehibe.png',
  '/images/tanora.png',
  '/images/zatovo.png',
  '/images/icon-192.png',
  '/images/icon-512.png'
];

// URLs des leçons à mettre en cache de manière agressive
const LESSON_URLS = [
  'https://sabbath-school.adventech.io/resources/mg/ss/2025-04',
  'https://sabbath-school.adventech.io/resources/mg/ss/2025-04-cq',
  'https://AndilanaSudLesona.github.io/SDA/Zatovo/'
];

// Installation - Cache les assets statiques
self.addEventListener('install', (event) => {
  console.log('[SW] Installation...');
  
  event.waitUntil(
    caches.open(CACHE_ASSETS).then((cache) => {
      console.log('[SW] Mise en cache des assets statiques');
      return cache.addAll(STATIC_ASSETS.map(url => new Request(url, {cache: 'reload'})));
    }).catch((error) => {
      console.error('[SW] Erreur lors de la mise en cache:', error);
    })
  );
  
  // Force l'activation immédiate
  self.skipWaiting();
});

// Activation - Nettoie les anciens caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return cacheName.startsWith('lesona-') && 
                   cacheName !== CACHE_VERSION &&
                   cacheName !== CACHE_ASSETS &&
                   cacheName !== CACHE_LESSONS &&
                   cacheName !== CACHE_IMAGES;
          })
          .map((cacheName) => {
            console.log('[SW] Suppression ancien cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    })
  );
  
  // Prend le contrôle immédiatement
  return self.clients.claim();
});

// Fetch - Stratégie cache-first avec fallback réseau
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignorer les requêtes non-GET
  if (request.method !== 'GET') {
    return;
  }
  
  // Ignorer les requêtes chrome-extension et autres protocoles
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Stratégie pour les leçons (cache-first, puis réseau)
  if (isLessonUrl(url.href)) {
    event.respondWith(handleLessonRequest(request));
    return;
  }
  
  // Stratégie pour les images (cache-first, très long cache)
  if (isImageRequest(request)) {
    event.respondWith(handleImageRequest(request));
    return;
  }
  
  // Stratégie pour les assets statiques (cache-first)
  if (isStaticAsset(url.href)) {
    event.respondWith(handleStaticAssetRequest(request));
    return;
  }
  
  // Autres requêtes - network-first avec fallback cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request);
      })
  );
});

// Gestion des requêtes de leçons
async function handleLessonRequest(request) {
  try {
    // Essayer le cache d'abord
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      console.log('[SW] Leçon trouvée en cache:', request.url);
      
      // Mettre à jour le cache en arrière-plan si en ligne
      if (navigator.onLine) {
        fetchAndCache(request, CACHE_LESSONS).catch(() => {});
      }
      
      return cachedResponse;
    }
    
    // Sinon, essayer le réseau
    console.log('[SW] Téléchargement leçon:', request.url);
    const networkResponse = await fetch(request, {
      mode: 'no-cors',
      cache: 'no-cache'
    });
    
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_LESSONS);
      cache.put(request, networkResponse.clone());
      console.log('[SW] Leçon mise en cache:', request.url);
    }
    
    return networkResponse;
    
  } catch (error) {
    console.error('[SW] Erreur requête leçon:', error);
    
    // Essayer de retourner n'importe quelle version en cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Retourner une page d'erreur simple
    return new Response(
      `<!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Pas de connexion</title>
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            background: #000;
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
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
          p {
            opacity: 0.7;
            line-height: 1.6;
          }
          button {
            margin-top: 24px;
            padding: 12px 24px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>📡</h1>
          <h2>Pas de connexion</h2>
          <p>Cette leçon n'est pas encore disponible hors ligne. Connectez-vous à internet pour la charger une première fois.</p>
          <button onclick="window.history.back()">← Retour</button>
        </div>
      </body>
      </html>`,
      {
        headers: { 'Content-Type': 'text/html' },
        status: 503
      }
    );
  }
}

// Gestion des requêtes d'images
async function handleImageRequest(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse && networkResponse.status === 200) {
      const cache = await caches.open(CACHE_IMAGES);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Retourner un placeholder SVG si l'image n'est pas disponible
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="#1a1a1a"/>
      <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#666" font-size="16">Image non disponible</text>
    </svg>`;
    
    return new Response(svg, {
      headers: { 'Content-Type': 'image/svg+xml' }
    });
  }
}

// Gestion des assets statiques
async function handleStaticAssetRequest(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    return await fetchAndCache(request, CACHE_ASSETS);
  } catch (error) {
    return cachedResponse || new Response('Asset not found', { status: 404 });
  }
}

// Fonction utilitaire pour fetch et cache
async function fetchAndCache(request, cacheName) {
  const response = await fetch(request);
  
  if (response && response.status === 200) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  
  return response;
}

// Vérifier si c'est une URL de leçon
function isLessonUrl(url) {
  return LESSON_URLS.some(lessonUrl => url.startsWith(lessonUrl)) ||
         url.includes('sabbath-school.adventech.io') ||
         url.includes('AndilanaSudLesona.github.io');
}

// Vérifier si c'est une requête d'image
function isImageRequest(request) {
  const url = new URL(request.url);
  return /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(url.pathname) ||
         request.destination === 'image';
}

// Vérifier si c'est un asset statique
function isStaticAsset(url) {
  return STATIC_ASSETS.some(asset => url.endsWith(asset));
}

// Message handler pour skipWaiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    console.log('[SW] skipWaiting demandé');
    self.skipWaiting();
  }
});

// Background sync pour mettre à jour les leçons
self.addEventListener('sync', (event) => {
  if (event.tag === 'update-lessons') {
    event.waitUntil(updateLessonsCache());
  }
});

async function updateLessonsCache() {
  console.log('[SW] Mise à jour des leçons en arrière-plan...');
  
  try {
    const cache = await caches.open(CACHE_LESSONS);
    
    await Promise.all(
      LESSON_URLS.map(async (url) => {
        try {
          const response = await fetch(url, { cache: 'reload' });
          if (response && response.status === 200) {
            await cache.put(url, response);
            console.log('[SW] Leçon mise à jour:', url);
          }
        } catch (error) {
          console.error('[SW] Erreur mise à jour:', url, error);
        }
      })
    );
    
    console.log('[SW] Mise à jour terminée');
  } catch (error) {
    console.error('[SW] Erreur mise à jour cache:', error);
  }
}

console.log('[SW] Service Worker chargé'); 
