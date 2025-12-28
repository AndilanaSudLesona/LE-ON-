const CACHE_VERSION = 'lesona-v6.0';
const CACHE_STATIC = 'lesona-static-v6';
const CACHE_LESSONS = 'lesona-lessons-v6';
const CACHE_RESOURCES = 'lesona-resources-v6';
const CACHE_IMAGES = 'lesona-images-v6';

// Assets statiques essentiels
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

// Polices externes
const FONT_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap',
  'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2',
  'https://fonts.gstatic.com/s/playfairdisplay/v30/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKdFvUDQZNLo_U2r.woff2'
];

// Images de l'application
const IMAGE_ASSETS = [
  '/images/lehibe.png',
  '/images/tanora.png',
  '/images/zatovo.png',
  '/images/icon-192.png',
  '/images/icon-512.png'
];

// URLs des leçons externes
const EXTERNAL_LESSON_URLS = [
  'https://sabbath-school.adventech.io/resources/mg/ss/2025-04',
  'https://sabbath-school.adventech.io/resources/mg/ss/2025-04-cq',
  'https://AndilanaSudLesona.github.io/SDA/Zatovo/'
];

// Fichiers locaux des leçons Zatovo
const LOCAL_LESSON_FILES = [
  '/Zatovo/index.html',
  '/Zatovo/lesona1.html',
  '/Zatovo/lesona2.html',
  '/Zatovo/lesona3.html',
  '/Zatovo/lesona4.html',
  '/Zatovo/lesona5.html',
  '/Zatovo/lesona6.html',
  '/Zatovo/lesona7.html',
  '/Zatovo/lesona8.html',
  '/Zatovo/lesona9.html',
  '/Zatovo/lesona10.html',
  '/Zatovo/lesona11.html',
  '/Zatovo/lesona12.html',
  '/Zatovo/lesona13.html'
];

// Limites de cache pour éviter la croissance illimitée
const MAX_CACHE_SIZE = {
  lessons: 100,
  resources: 150,
  images: 50
};

// Installation du Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW v6.0] Installation en cours...');
  
  event.waitUntil(
    (async () => {
      try {
        const staticCache = await caches.open(CACHE_STATIC);
        const imageCache = await caches.open(CACHE_IMAGES);
        const lessonsCache = await caches.open(CACHE_LESSONS);
        
        // Cache des assets statiques avec gestion d'erreur individuelle
        console.log('[SW] Caching static assets...');
        for (const asset of STATIC_ASSETS) {
          try {
            const request = new Request(asset, { cache: 'reload' });
            const response = await fetch(request);
            if (response && response.ok) {
              await staticCache.put(asset, response);
              console.log('[SW] ✓ Cached:', asset);
            }
          } catch (err) {
            console.warn('[SW] ⚠ Failed to cache:', asset);
          }
        }
        
        // Cache des polices
        console.log('[SW] Caching fonts...');
        for (const font of FONT_ASSETS) {
          try {
            const request = new Request(font, { cache: 'reload' });
            const response = await fetch(request);
            if (response && response.ok) {
              await staticCache.put(font, response);
              console.log('[SW] ✓ Cached font:', font);
            }
          } catch (err) {
            console.warn('[SW] ⚠ Failed to cache font:', font);
          }
        }
        
        // Cache des images
        console.log('[SW] Caching images...');
        for (const img of IMAGE_ASSETS) {
          try {
            const request = new Request(img, { cache: 'reload' });
            const response = await fetch(request);
            if (response && response.ok) {
              await imageCache.put(img, response);
              console.log('[SW] ✓ Cached image:', img);
            }
          } catch (err) {
            console.warn('[SW] ⚠ Failed to cache image:', img);
          }
        }
        
        // Pre-cache des leçons locales Zatovo
        console.log('[SW] Pre-caching local lessons...');
        let cachedLessons = 0;
        for (const lessonFile of LOCAL_LESSON_FILES) {
          try {
            const request = new Request(lessonFile, { cache: 'reload' });
            const response = await fetch(request);
            if (response && response.ok) {
              await lessonsCache.put(lessonFile, response);
              cachedLessons++;
              console.log('[SW] ✓ Pre-cached lesson:', lessonFile);
            }
          } catch (err) {
            console.warn('[SW] ⚠ Failed to pre-cache lesson:', lessonFile);
          }
        }
        
        console.log(`[SW] Installation terminée - ${cachedLessons}/${LOCAL_LESSON_FILES.length} leçons en cache`);
        
      } catch (error) {
        console.error('[SW] Installation error:', error);
      }
    })()
  );
  
  self.skipWaiting();
});

// Activation et nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activation en cours...');
  
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        const validCaches = [
          CACHE_STATIC, 
          CACHE_LESSONS, 
          CACHE_RESOURCES, 
          CACHE_IMAGES,
          CACHE_VERSION
        ];
        
        const oldCaches = cacheNames.filter(name => 
          name.startsWith('lesona-') && !validCaches.includes(name)
        );
        
        if (oldCaches.length > 0) {
          console.log(`[SW] Nettoyage de ${oldCaches.length} ancien(s) cache(s)`);
          await Promise.all(
            oldCaches.map(name => {
              console.log('[SW] Suppression cache:', name);
              return caches.delete(name);
            })
          );
        }
        
        // Gérer les tailles de cache
        await manageCacheSizes();
        
        console.log('[SW] Activation terminée');
        
      } catch (error) {
        console.error('[SW] Activation error:', error);
      }
    })()
  );
  
  return self.clients.claim();
});

// Gestion des requêtes fetch
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Ignorer les requêtes non-GET
  if (request.method !== 'GET') {
    return;
  }
  
  // Ignorer les protocoles non-HTTP
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Ignorer les extensions Chrome
  if (url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Stratégie selon l'origine
  if (url.origin === location.origin) {
    event.respondWith(handleLocalResource(request, url));
  } else {
    event.respondWith(handleExternalResource(request, url));
  }
});

// Gestion des ressources locales
async function handleLocalResource(request, url) {
  const pathname = url.pathname;
  
  try {
    // Déterminer le type de ressource
    const isLesson = pathname.includes('/Zatovo/') && pathname.endsWith('.html');
    const isImage = /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(pathname);
    
    let cacheName;
    if (isLesson) {
      cacheName = CACHE_LESSONS;
    } else if (isImage) {
      cacheName = CACHE_IMAGES;
    } else {
      cacheName = CACHE_STATIC;
    }
    
    // Stratégie Cache First avec mise à jour en arrière-plan
    const cached = await caches.match(request);
    
    if (cached) {
      console.log('[SW] Cache hit:', pathname);
      
      // Mise à jour en arrière-plan si en ligne et si c'est une leçon
      if (self.navigator.onLine && isLesson) {
        updateCacheInBackground(request, cacheName);
      }
      
      return cached;
    }
    
    // Fetch et cache
    console.log('[SW] Fetching:', pathname);
    const response = await fetch(request);
    
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
      console.log('[SW] Nouvelle ressource en cache:', pathname);
      
      // Gérer la taille du cache
      await manageCacheSize(cacheName, getCacheLimit(cacheName));
      
      // Notifier les clients
      notifyClients({ action: 'cached', url: pathname });
    }
    
    return response;
    
  } catch (error) {
    console.error('[SW] Erreur ressource locale:', pathname, error);
    
    // Fallback sur le cache en cas d'erreur
    const cached = await caches.match(request);
    if (cached) {
      console.log('[SW] Retour du cache après erreur:', pathname);
      return cached;
    }
    
    // Page d'erreur pour les leçons
    if (pathname.includes('/Zatovo/') && pathname.endsWith('.html')) {
      return createOfflineErrorPage(pathname);
    }
    
    return new Response('Ressource non disponible', { 
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

// Gestion des ressources externes
async function handleExternalResource(request, url) {
  const urlString = url.href;
  const isLesson = isExternalLessonUrl(urlString);
  const isFont = url.hostname.includes('fonts.googleapis.com') || 
                 url.hostname.includes('fonts.gstatic.com');
  
  let cacheName;
  if (isLesson) {
    cacheName = CACHE_LESSONS;
  } else if (isFont) {
    cacheName = CACHE_STATIC;
  } else {
    cacheName = CACHE_RESOURCES;
  }
  
  try {
    // Stratégie Cache First pour toutes les ressources externes
    const cached = await caches.match(request, { 
      ignoreSearch: false,
      ignoreVary: true 
    });
    
    if (cached) {
      console.log('[SW] Cache hit externe:', urlString);
      
      // Mise à jour en arrière-plan si en ligne
      if (self.navigator.onLine && !isFont) {
        updateCacheInBackground(request, cacheName);
      }
      
      return cached;
    }
    
    // Fetch avec timeout
    console.log('[SW] Fetching externe:', urlString);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    
    const response = await fetch(request, {
      signal: controller.signal,
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store'
    });
    
    clearTimeout(timeoutId);
    
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
      console.log('[SW] Ressource externe en cache:', urlString);
      
      // Gérer la taille du cache
      await manageCacheSize(cacheName, getCacheLimit(cacheName));
      
      notifyClients({ action: 'cached', url: urlString });
    }
    
    return response;
    
  } catch (error) {
    console.error('[SW] Erreur fetch externe:', urlString, error.name);
    
    // Fallback sur le cache
    const cached = await caches.match(request, { 
      ignoreSearch: false,
      ignoreVary: true 
    });
    
    if (cached) {
      console.log('[SW] Retour du cache après erreur:', urlString);
      return cached;
    }
    
    // Page d'erreur pour les leçons
    if (isLesson) {
      return createOfflineErrorPage(urlString);
    }
    
    return new Response('Ressource non disponible hors ligne', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

// Mise à jour du cache en arrière-plan
async function updateCacheInBackground(request, cacheName) {
  try {
    const response = await fetch(request, {
      cache: 'reload',
      mode: 'cors',
      credentials: 'omit'
    });
    
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response);
      console.log('[SW] Mise à jour arrière-plan réussie:', request.url);
      notifyClients({ action: 'backgroundUpdate', url: request.url });
    }
  } catch (error) {
    console.log('[SW] Mise à jour arrière-plan échouée:', request.url);
  }
}

// Gestion de la taille des caches
async function manageCacheSize(cacheName, maxSize) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    
    if (keys.length > maxSize) {
      const keysToDelete = keys.slice(0, keys.length - maxSize);
      await Promise.all(keysToDelete.map(key => cache.delete(key)));
      console.log(`[SW] Cache ${cacheName} réduit de ${keys.length} à ${maxSize} entrées`);
    }
  } catch (error) {
    console.error('[SW] Erreur gestion taille cache:', error);
  }
}

// Gérer toutes les tailles de cache
async function manageCacheSizes() {
  await Promise.all([
    manageCacheSize(CACHE_LESSONS, MAX_CACHE_SIZE.lessons),
    manageCacheSize(CACHE_RESOURCES, MAX_CACHE_SIZE.resources),
    manageCacheSize(CACHE_IMAGES, MAX_CACHE_SIZE.images)
  ]);
}

// Obtenir la limite de cache appropriée
function getCacheLimit(cacheName) {
  if (cacheName === CACHE_LESSONS) return MAX_CACHE_SIZE.lessons;
  if (cacheName === CACHE_RESOURCES) return MAX_CACHE_SIZE.resources;
  if (cacheName === CACHE_IMAGES) return MAX_CACHE_SIZE.images;
  return 50;
}

// Vérifier si c'est une URL de leçon externe
function isExternalLessonUrl(url) {
  return EXTERNAL_LESSON_URLS.some(lessonUrl => url.startsWith(lessonUrl)) ||
         url.includes('sabbath-school.adventech.io') ||
         url.includes('AndilanaSudLesona.github.io');
}

// Notifier les clients
function notifyClients(message) {
  self.clients.matchAll({ 
    type: 'window', 
    includeUncontrolled: true 
  }).then(clients => {
    clients.forEach(client => {
      client.postMessage(message);
    });
  });
}

// Créer une page d'erreur offline élégante
function createOfflineErrorPage(url) {
  const html = `
    <!DOCTYPE html>
    <html lang="mg">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="theme-color" content="#FFFFFF">
      <title>Connexion requise</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: linear-gradient(135deg, #F5F7FA 0%, #E8EEF5 100%);
          color: #2C3E50;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 24px;
          text-align: center;
        }
        .container {
          max-width: 400px;
          background: white;
          padding: 48px 32px;
          border-radius: 24px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
        }
        .icon {
          font-size: 72px;
          margin-bottom: 24px;
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        h1 {
          font-size: 24px;
          margin-bottom: 16px;
          font-weight: 700;
          color: #1A202C;
          letter-spacing: -0.5px;
        }
        p {
          color: #718096;
          line-height: 1.6;
          margin-bottom: 32px;
          font-size: 15px;
        }
        button {
          padding: 14px 32px;
          background: linear-gradient(135deg, #6C63FF 0%, #5A52D5 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-weight: 600;
          font-size: 16px;
          cursor: pointer;
          font-family: inherit;
          box-shadow: 0 4px 12px rgba(108, 99, 255, 0.3);
          transition: transform 0.2s ease;
        }
        button:active {
          transform: scale(0.98);
        }
        .url-info {
          margin-top: 24px;
          padding: 12px;
          background: #F7FAFC;
          border-radius: 8px;
          font-size: 12px;
          color: #A0AEC0;
          word-break: break-all;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">📡</div>
        <h1>Connexion requise</h1>
        <p>Cette leçon n'est pas encore disponible hors ligne. Une connexion Internet est nécessaire pour la charger la première fois.</p>
        <button onclick="window.history.back()">← Retour</button>
        <div class="url-info">Une fois chargée, cette leçon sera disponible hors ligne</div>
      </div>
      <script>
        // Vérifier la connexion périodiquement
        setInterval(() => {
          if (navigator.onLine) {
            console.log('Connexion détectée, rechargement...');
            window.location.reload();
          }
        }, 2000);
        
        // Écouter les changements de statut en ligne
        window.addEventListener('online', () => {
          window.location.reload();
        });
      </script>
    </body>
    </html>
  `;
  
  return new Response(html, {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    }
  });
}

// Gestion des messages
self.addEventListener('message', (event) => {
  const data = event.data;
  
  if (data && data.action === 'skipWaiting') {
    console.log('[SW] skipWaiting demandé');
    self.skipWaiting();
  }
  
  if (data && data.action === 'clearCache') {
    event.waitUntil(
      caches.keys().then(names => {
        return Promise.all(
          names.filter(name => name.startsWith('lesona-'))
               .map(name => {
                 console.log('[SW] Nettoyage cache:', name);
                 return caches.delete(name);
               })
        );
      }).then(() => {
        console.log('[SW] Tous les caches nettoyés');
        notifyClients({ action: 'cacheCleared' });
      })
    );
  }
  
  if (data && data.action === 'getCacheStatus') {
    event.waitUntil(
      (async () => {
        const cacheNames = await caches.keys();
        const status = {};
        
        for (const name of cacheNames) {
          const cache = await caches.open(name);
          const keys = await cache.keys();
          status[name] = keys.length;
        }
        
        notifyClients({ 
          action: 'cacheStatus', 
          status: status 
        });
      })()
    );
  }
});

// Synchronisation en arrière-plan
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-lessons') {
    console.log('[SW] Synchronisation des leçons démarrée');
    event.waitUntil(syncLessons());
  }
});

async function syncLessons() {
  try {
    const cache = await caches.open(CACHE_LESSONS);
    
    for (const url of EXTERNAL_LESSON_URLS) {
      try {
        const response = await fetch(url, {
          mode: 'cors',
          credentials: 'omit'
        });
        
        if (response && response.ok) {
          await cache.put(url, response);
          console.log('[SW] Leçon synchronisée:', url);
        }
      } catch (error) {
        console.log('[SW] Échec synchronisation:', url);
      }
    }
    
    notifyClients({ action: 'syncComplete' });
    
  } catch (error) {
    console.error('[SW] Erreur synchronisation:', error);
  }
}

console.log('[SW] Service Worker v6.0 chargé - Support multi-leçons avec cache maximum');
 
