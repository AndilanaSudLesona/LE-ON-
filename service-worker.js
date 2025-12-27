const CACHE_VERSION = 'lesona-v5.0';
const CACHE_STATIC = 'lesona-static-v5';
const CACHE_LESSONS = 'lesona-lessons-v5';
const CACHE_RESOURCES = 'lesona-resources-v5';

// Assets statiques à mettre en cache immédiatement
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Lora:wght@400;600;700&display=swap'
];

const IMAGE_ASSETS = [
  '/images/lehibe.png',
  '/images/tanora.png',
  '/images/zatovo.png',
  '/images/icon-192.png',
  '/images/icon-512.png'
];

// URLs des leçons externes à mettre en cache
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

self.addEventListener('install', (event) => {
  console.log('[SW v5.0] Installation...');
  
  event.waitUntil(
    (async () => {
      try {
        const staticCache = await caches.open(CACHE_STATIC);
        
        // Cache static assets
        for (const asset of STATIC_ASSETS) {
          try {
            const request = new Request(asset, { cache: 'reload' });
            const response = await fetch(request);
            if (response && response.ok) {
              await staticCache.put(asset, response);
              console.log('[SW] Cached:', asset);
            }
          } catch (err) {
            console.warn('[SW] Failed to cache:', asset);
          }
        }
        
        // Cache images
        for (const img of IMAGE_ASSETS) {
          try {
            const request = new Request(img, { cache: 'reload' });
            const response = await fetch(request);
            if (response && response.ok) {
              await staticCache.put(img, response);
            }
          } catch (err) {
            console.warn('[SW] Failed to cache image:', img);
          }
        }
        
        // Pre-cache local lesson files
        const lessonsCache = await caches.open(CACHE_LESSONS);
        for (const lessonFile of LOCAL_LESSON_FILES) {
          try {
            const request = new Request(lessonFile, { cache: 'reload' });
            const response = await fetch(request);
            if (response && response.ok) {
              await lessonsCache.put(lessonFile, response);
              console.log('[SW] Pre-cached lesson:', lessonFile);
            }
          } catch (err) {
            console.warn('[SW] Failed to pre-cache lesson:', lessonFile);
          }
        }
        
        console.log('[SW] Installation terminée');
      } catch (error) {
        console.error('[SW] Installation error:', error);
      }
    })()
  );
  
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activation...');
  
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      const validCaches = [CACHE_STATIC, CACHE_LESSONS, CACHE_RESOURCES, CACHE_VERSION];
      
      const oldCaches = cacheNames.filter(name => 
        name.startsWith('lesona-') && !validCaches.includes(name)
      );
      
      await Promise.all(
        oldCaches.map(name => {
          console.log('[SW] Deleting old cache:', name);
          return caches.delete(name);
        })
      );
      
      console.log('[SW] Activation complete');
    })()
  );
  
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  if (request.method !== 'GET') {
    return;
  }
  
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // Stratégie selon le type de ressource
  if (url.origin === location.origin) {
    event.respondWith(handleLocalResource(request, url));
  } else {
    event.respondWith(handleExternalResource(request, url));
  }
});

async function handleLocalResource(request, url) {
  const pathname = url.pathname;
  
  try {
    // Vérifier si c'est un fichier de leçon Zatovo
    const isLesson = pathname.includes('/Zatovo/') && pathname.endsWith('.html');
    const cacheName = isLesson ? CACHE_LESSONS : CACHE_STATIC;
    
    // Essayer le cache d'abord
    const cached = await caches.match(request);
    if (cached) {
      console.log('[SW] Cache hit:', pathname);
      
      // Mettre à jour en arrière-plan si en ligne
      if (self.navigator.onLine && isLesson) {
        updateCacheInBackground(request, cacheName);
      }
      
      return cached;
    }
    
    // Sinon, fetch et cache
    console.log('[SW] Fetching:', pathname);
    const response = await fetch(request);
    
    if (response && response.ok) {
      const cache = await caches.open(cacheName);
      await cache.put(request, response.clone());
      console.log('[SW] Cached new resource:', pathname);
      
      // Notifier les clients
      notifyClients({ action: 'cached', url: pathname });
    }
    
    return response;
  } catch (error) {
    console.error('[SW] Local resource error:', pathname, error);
    
    // Essayer de retourner du cache en cas d'erreur
    const cached = await caches.match(request);
    if (cached) {
      console.log('[SW] Returning stale cache:', pathname);
      return cached;
    }
    
    // Page d'erreur pour les leçons
    if (pathname.includes('/Zatovo/') && pathname.endsWith('.html')) {
      return createOfflineErrorPage(pathname);
    }
    
    return new Response('Resource unavailable', { 
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

async function handleExternalResource(request, url) {
  const urlString = url.href;
  const isLesson = isExternalLessonUrl(urlString);
  const cacheName = isLesson ? CACHE_LESSONS : CACHE_RESOURCES;
  
  try {
    // Cache first pour toutes les ressources
    const cached = await caches.match(request, { ignoreSearch: false });
    
    if (cached) {
      console.log('[SW] External cache hit:', urlString);
      
      // Mise à jour en arrière-plan si en ligne
      if (self.navigator.onLine) {
        updateCacheInBackground(request, cacheName);
      }
      
      return cached;
    }
    
    // Si pas en cache, essayer de fetch
    console.log('[SW] Fetching external:', urlString);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
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
      console.log('[SW] Cached external resource:', urlString);
      
      notifyClients({ action: 'cached', url: urlString });
      
      return response;
    }
    
    return response;
    
  } catch (error) {
    console.error('[SW] External fetch error:', urlString, error.name);
    
    // Essayer le cache en cas d'erreur
    const cached = await caches.match(request, { ignoreSearch: false });
    if (cached) {
      console.log('[SW] Returning cached after error:', urlString);
      return cached;
    }
    
    if (isLesson) {
      return createOfflineErrorPage(urlString);
    }
    
    return new Response('Resource unavailable offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

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
      console.log('[SW] Background update complete:', request.url);
    }
  } catch (error) {
    console.log('[SW] Background update failed:', request.url);
  }
}

function notifyClients(message) {
  self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then(clients => {
      clients.forEach(client => {
        client.postMessage(message);
      });
    });
}

function isExternalLessonUrl(url) {
  return EXTERNAL_LESSON_URLS.some(lessonUrl => url.startsWith(lessonUrl)) ||
         url.includes('sabbath-school.adventech.io') ||
         url.includes('AndilanaSudLesona.github.io');
}

function createOfflineErrorPage(url) {
  const html = `
    <!DOCTYPE html>
    <html lang="mg">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Tsy misy connexion</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #000;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 24px;
          text-align: center;
        }
        .container {
          max-width: 400px;
        }
        .icon {
          font-size: 64px;
          margin-bottom: 24px;
        }
        h1 {
          font-size: 24px;
          margin-bottom: 16px;
          font-weight: 600;
        }
        p {
          opacity: 0.8;
          line-height: 1.6;
          margin-bottom: 32px;
          font-size: 15px;
        }
        button {
          padding: 14px 32px;
          background: #4CAF50;
          color: white;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 16px;
          cursor: pointer;
          font-family: inherit;
        }
        button:active {
          transform: scale(0.95);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">📡</div>
        <h1>Tsy misy connexion</h1>
        <p>Ity lesona ity tsy mbola voatahiry ho offline. Mila connexion internet ianao mba haka azy amin'ny voalohany.</p>
        <button onclick="window.history.back()">← Hiverina</button>
      </div>
      <script>
        setTimeout(() => {
          if (navigator.onLine) {
            window.location.reload();
          }
        }, 1000);
      </script>
    </body>
    </html>
  `;
  
  return new Response(html, {
    status: 503,
    headers: { 
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    }
  });
}

self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    console.log('[SW] skipWaiting requested');
    self.skipWaiting();
  }
  
  if (event.data && event.data.action === 'clearCache') {
    event.waitUntil(
      caches.keys().then(names => {
        return Promise.all(
          names.filter(name => name.startsWith('lesona-'))
               .map(name => {
                 console.log('[SW] Clearing cache:', name);
                 return caches.delete(name);
               })
        );
      }).then(() => {
        console.log('[SW] All caches cleared');
        notifyClients({ action: 'cacheCleared' });
      })
    );
  }
});

console.log('[SW] Service Worker v5.0 loaded - Multi-lesson support'); 
