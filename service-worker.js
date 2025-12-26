const CACHE_VERSION = 'lesona-v4.0';
const CACHE_STATIC = 'lesona-static-v4';
const CACHE_LESSONS = 'lesona-lessons-v4';
const CACHE_RESOURCES = 'lesona-resources-v4';

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

self.addEventListener('install', (event) => {
  console.log('[SW] Installation v4.0...');
  
  event.waitUntil(
    (async () => {
      try {
        const staticCache = await caches.open(CACHE_STATIC);
        
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
        
        for (const img of IMAGE_ASSETS) {
          try {
            const request = new Request(img, { cache: 'reload' });
            const response = await fetch(request);
            if (response && response.ok) {
              await staticCache.put(img, response);
              console.log('[SW] Image cached:', img);
            }
          } catch (err) {
            console.warn('[SW] Failed to cache image:', img);
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
  
  if (url.origin === location.origin) {
    event.respondWith(handleLocalResource(request));
  } else {
    event.respondWith(handleExternalResource(request));
  }
});

async function handleLocalResource(request) {
  const url = request.url;
  
  try {
    const cached = await caches.match(request);
    if (cached) {
      console.log('[SW] Local cache hit:', url);
      return cached;
    }
    
    console.log('[SW] Fetching local:', url);
    const response = await fetch(request);
    
    if (response && response.ok) {
      const cache = await caches.open(CACHE_STATIC);
      await cache.put(request, response.clone());
      console.log('[SW] Local cached:', url);
    }
    
    return response;
  } catch (error) {
    console.error('[SW] Local resource error:', url, error);
    
    const cached = await caches.match(request);
    if (cached) {
      console.log('[SW] Returning stale cache:', url);
      return cached;
    }
    
    return new Response('Resource unavailable', { 
      status: 503,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}

async function handleExternalResource(request) {
  const url = request.url;
  const isLesson = isLessonUrl(url);
  const cacheName = isLesson ? CACHE_LESSONS : CACHE_RESOURCES;
  
  try {
    const cached = await caches.match(request, { ignoreSearch: false });
    
    if (cached) {
      console.log('[SW] External cache hit:', url);
      
      if (self.navigator.onLine) {
        updateCacheInBackground(request, cacheName);
      }
      
      return cached;
    }
    
    console.log('[SW] Fetching external:', url);
    
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
      
      const responseToCache = response.clone();
      
      await cache.put(request, responseToCache);
      console.log('[SW] External resource cached:', url);
      
      notifyClients({ action: 'cached', url: url });
      
      return response;
    }
    
    return response;
    
  } catch (error) {
    console.error('[SW] External fetch error:', url, error.name);
    
    const cached = await caches.match(request, { ignoreSearch: false });
    if (cached) {
      console.log('[SW] Returning cached after error:', url);
      return cached;
    }
    
    if (isLesson) {
      return createOfflineErrorPage(url);
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

function isLessonUrl(url) {
  return url.includes('sabbath-school.adventech.io') ||
         url.includes('AndilanaSudLesona.github.io') ||
         url.includes('SDA/Zatovo');
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
          font-family: 'Lora', -apple-system, BlinkMacSystemFont, sans-serif;
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
  
  if (event.data && event.data.action === 'getCacheStatus') {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(CACHE_LESSONS);
        const keys = await cache.keys();
        const urls = keys.map(req => req.url);
        
        event.source.postMessage({
          action: 'cacheStatus',
          cachedUrls: urls
        });
      })()
    );
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'update-cache') {
    event.waitUntil(updateAllCaches());
  }
});

async function updateAllCaches() {
  console.log('[SW] Background sync: updating caches...');
  
  try {
    const lessonsCache = await caches.open(CACHE_LESSONS);
    const requests = await lessonsCache.keys();
    
    for (const request of requests) {
      try {
        const response = await fetch(request, { cache: 'reload' });
        if (response && response.ok) {
          await lessonsCache.put(request, response);
          console.log('[SW] Updated:', request.url);
        }
      } catch (error) {
        console.log('[SW] Failed to update:', request.url);
      }
    }
    
    console.log('[SW] Cache update complete');
  } catch (error) {
    console.error('[SW] Cache update error:', error);
  }
}

console.log('[SW] Service Worker loaded - Version', CACHE_VERSION); 
