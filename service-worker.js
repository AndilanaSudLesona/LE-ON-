// Service Worker for SDA Lesona App
// Version 2.0 - Silent Offline Support with Aggressive Caching

const CACHE_NAME = 'sda-lesona-v2';
const RUNTIME_CACHE = 'sda-runtime-v2';
const IMAGE_CACHE = 'sda-images-v2';

// Files to cache immediately on install (App Shell)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  // Add your main CSS/JS files here if you have them
];

// Maximum cache sizes
const MAX_RUNTIME_CACHE_SIZE = 100;
const MAX_IMAGE_CACHE_SIZE = 60;

// Cache timeout for network requests (5 seconds)
const CACHE_TIMEOUT = 5000;

// Install event - cache app shell
self.addEventListener('install', event => {
  console.log('[ServiceWorker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ServiceWorker] Caching app shell');
        return cache.addAll(PRECACHE_URLS);
      })
      .then(() => {
        console.log('[ServiceWorker] Installation complete');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('[ServiceWorker] Installation failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[ServiceWorker] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => {
              return cacheName.startsWith('sda-') && 
                     cacheName !== CACHE_NAME &&
                     cacheName !== RUNTIME_CACHE &&
                     cacheName !== IMAGE_CACHE;
            })
            .map(cacheName => {
              console.log('[ServiceWorker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => {
        console.log('[ServiceWorker] Activation complete');
        return self.clients.claim();
      })
  );
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome extensions and other protocols
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Handle different types of requests with appropriate strategies
  if (isImageRequest(request)) {
    event.respondWith(handleImageRequest(request));
  } else if (isHTMLRequest(request)) {
    event.respondWith(handleHTMLRequest(request));
  } else {
    event.respondWith(handleRuntimeRequest(request));
  }
});

// Strategy for images: Cache first, then network
async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);
  
  if (cached) {
    return cached;
  }

  try {
    const response = await fetchWithTimeout(request, CACHE_TIMEOUT);
    
    if (response && response.ok) {
      // Clone and cache the response
      cache.put(request, response.clone());
      
      // Clean up old images if cache is too large
      trimCache(IMAGE_CACHE, MAX_IMAGE_CACHE_SIZE);
    }
    
    return response;
  } catch (error) {
    console.log('[ServiceWorker] Image fetch failed:', error);
    
    // Return a placeholder or cached version if available
    const fallback = await cache.match(request);
    return fallback || new Response('Image not available offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Strategy for HTML: Network first, fallback to cache
async function handleHTMLRequest(request) {
  try {
    const response = await fetchWithTimeout(request, CACHE_TIMEOUT);
    
    if (response && response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[ServiceWorker] HTML fetch failed, using cache');
    
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    
    // Return offline page if available
    const offlinePage = await caches.match('/offline.html');
    return offlinePage || new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Strategy for runtime requests: Network first, fallback to cache
async function handleRuntimeRequest(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  
  try {
    const response = await fetchWithTimeout(request, CACHE_TIMEOUT);
    
    if (response && response.ok) {
      cache.put(request, response.clone());
      trimCache(RUNTIME_CACHE, MAX_RUNTIME_CACHE_SIZE);
    }
    
    return response;
  } catch (error) {
    console.log('[ServiceWorker] Runtime fetch failed, using cache');
    
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    
    // If it's a navigation request, return offline page
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match('/offline.html');
      return offlinePage || new Response('Offline', {
        status: 503,
        statusText: 'Service Unavailable'
      });
    }
    
    return new Response('Not available offline', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Helper: Fetch with timeout
function fetchWithTimeout(request, timeout) {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Network timeout')), timeout)
    )
  ]);
}

// Helper: Check if request is for an image
function isImageRequest(request) {
  const url = new URL(request.url);
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico'];
  
  return imageExtensions.some(ext => url.pathname.toLowerCase().endsWith(ext)) ||
         request.destination === 'image';
}

// Helper: Check if request is for HTML
function isHTMLRequest(request) {
  const url = new URL(request.url);
  return request.destination === 'document' || 
         url.pathname.endsWith('.html') ||
         (url.pathname.endsWith('/') && request.mode === 'navigate');
}

// Helper: Trim cache to max size
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxItems) {
    const toDelete = keys.slice(0, keys.length - maxItems);
    await Promise.all(toDelete.map(key => cache.delete(key)));
    console.log(`[ServiceWorker] Trimmed ${cacheName}: deleted ${toDelete.length} items`);
  }
}

// Message handler for cache management
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }).then(() => {
        console.log('[ServiceWorker] All caches cleared');
        return self.clients.matchAll();
      }).then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'CACHE_CLEARED' });
        });
      })
    );
  }
});

// Background sync for offline actions (if supported)
self.addEventListener('sync', event => {
  console.log('[ServiceWorker] Background sync:', event.tag);
  
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  console.log('[ServiceWorker] Syncing data...');
  // Add your sync logic here
  return Promise.resolve();
}

console.log('[ServiceWorker] Loaded successfully');
