// Service Worker for SDA Lesona App
// Version 2.1 - Enhanced offline support with proper external content handling

const CACHE_NAME = 'sda-lesona-v2.1';
const RUNTIME_CACHE = 'sda-runtime-v2.1';
const IMAGE_CACHE = 'sda-images-v2.1';
const EXTERNAL_CACHE = 'sda-external-v2.1';

// Files to cache immediately on install (App Shell)
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/images/lehibe.png',
  '/images/tanora.png',
  '/images/zatovo.png'
];

// Maximum cache sizes
const MAX_RUNTIME_CACHE_SIZE = 150;
const MAX_IMAGE_CACHE_SIZE = 80;
const MAX_EXTERNAL_CACHE_SIZE = 200;

// Cache timeout for network requests (8 seconds for external content)
const CACHE_TIMEOUT = 8000;
const EXTERNAL_TIMEOUT = 12000;

// Install event - cache app shell
self.addEventListener('install', event => {
  console.log('[ServiceWorker] Installing v2.1...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[ServiceWorker] Caching app shell');
        return cache.addAll(PRECACHE_URLS.map(url => new Request(url, {cache: 'reload'})));
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
  console.log('[ServiceWorker] Activating v2.1...');
  
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(cacheName => {
              return cacheName.startsWith('sda-') && 
                     cacheName !== CACHE_NAME &&
                     cacheName !== RUNTIME_CACHE &&
                     cacheName !== IMAGE_CACHE &&
                     cacheName !== EXTERNAL_CACHE;
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

// Fetch event - intelligent caching strategy
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

  // Handle different types of requests
  if (isExternalContent(url)) {
    event.respondWith(handleExternalContent(request));
  } else if (isImageRequest(request)) {
    event.respondWith(handleImageRequest(request));
  } else if (isHTMLRequest(request)) {
    event.respondWith(handleHTMLRequest(request));
  } else {
    event.respondWith(handleRuntimeRequest(request));
  }
});

// Check if request is for external content (sabbath-school.adventech.io)
function isExternalContent(url) {
  return url.hostname === 'sabbath-school.adventech.io' ||
         url.hostname === 'andilanasudlesona.github.io';
}

// Strategy for external content: Cache-First with network update
async function handleExternalContent(request) {
  const cache = await caches.open(EXTERNAL_CACHE);
  
  // Try cache first for offline capability
  const cachedResponse = await cache.match(request);
  
  // If offline or cached, return cached version
  if (cachedResponse) {
    console.log('[ServiceWorker] Serving external content from cache:', request.url);
    
    // Update cache in background if online
    fetchAndUpdateCache(request, cache, EXTERNAL_TIMEOUT);
    
    return cachedResponse;
  }

  // If not in cache, fetch from network
  try {
    console.log('[ServiceWorker] Fetching external content:', request.url);
    const response = await fetchWithTimeout(request, EXTERNAL_TIMEOUT);
    
    if (response && response.ok) {
      // Clone and cache the response
      cache.put(request, response.clone());
      
      // Clean up old entries
      trimCache(EXTERNAL_CACHE, MAX_EXTERNAL_CACHE_SIZE);
      
      // Notify clients that content was cached
      notifyClients({ action: 'cached', url: request.url });
    }
    
    return response;
  } catch (error) {
    console.log('[ServiceWorker] External fetch failed:', error);
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlinePage = await cache.match('/offline.html');
      return offlinePage || new Response('Offline - Content not available', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/html' }
      });
    }
    
    return new Response('Offline - Content not cached', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Fetch and update cache in background
async function fetchAndUpdateCache(request, cache, timeout) {
  try {
    const response = await fetchWithTimeout(request, timeout);
    if (response && response.ok) {
      cache.put(request, response.clone());
      console.log('[ServiceWorker] Updated cache:', request.url);
    }
  } catch (error) {
    console.log('[ServiceWorker] Background update failed:', error.message);
  }
}

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
      cache.put(request, response.clone());
      trimCache(IMAGE_CACHE, MAX_IMAGE_CACHE_SIZE);
    }
    
    return response;
  } catch (error) {
    console.log('[ServiceWorker] Image fetch failed:', error);
    
    const fallback = await cache.match(request);
    return fallback || new Response('', {
      status: 503,
      statusText: 'Image not available offline'
    });
  }
}

// Strategy for HTML: Network first, fallback to cache
async function handleHTMLRequest(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  
  try {
    const response = await fetchWithTimeout(request, CACHE_TIMEOUT);
    
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[ServiceWorker] HTML fetch failed, using cache');
    
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
    
    // Return offline page
    const offlinePage = await caches.match('/offline.html');
    return offlinePage || new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/html' }
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

// Helper: Notify clients
function notifyClients(message) {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage(message);
    });
  });
}

// Message handler
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
        notifyClients({ type: 'CACHE_CLEARED' });
      })
    );
  }
  
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

// Background sync
self.addEventListener('sync', event => {
  console.log('[ServiceWorker] Background sync:', event.tag);
  
  if (event.tag === 'sync-data') {
    event.waitUntil(syncData());
  }
});

async function syncData() {
  console.log('[ServiceWorker] Syncing data...');
  return Promise.resolve();
}

console.log('[ServiceWorker] v2.1 loaded successfully');
 
