const CACHE_NAME = 'mybudgetpro-v2';
const OFFLINE_URL = '/offline.html';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/public/navigation.js',
  '/navigation.js',
  '/styles.css',
  '/manifest.json',
  '/favicon.ico',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Function to get the correct path for the navigation script
function getNavigationScriptPath() {
  // Try different possible paths
  const paths = [
    '/public/navigation.js',
    '/navigation.js',
    'navigation.js',
    '../public/navigation.js',
    './public/navigation.js'
  ];
  
  // For service worker, we need to use absolute URLs
  return paths.map(path => new URL(path, self.location.origin).pathname);
}

// Install event - cache static assets and offline page
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching app shell and offline page');
        return cache.addAll([
          '/',
          '/index.html',
          '/offline.html',
          '/offline-test.html',
          '/styles/main.css',
          '/scripts/app.js',
          '/scripts/navigation.js',
          '/images/logo.png',
          '/favicon.ico',
          '/manifest.json',
          '/register-sw.js'
          // Add other static assets to cache
        ]);
      })
      .then(() => {
        console.log('All resources have been cached successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Error during service worker installation:', error);
        throw error;
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating and cleaning up old caches');
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old caches that aren't in the whitelist
          if (!cacheWhitelist.includes(cacheName)) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all pages under this service worker's scope immediately
      return self.clients.claim();
    }).then(() => {
      // Ensure the service worker is the active one
      if (self.registration.navigationPreload) {
        return self.registration.navigationPreload.enable();
      }
    })
  );
});

// Function to handle navigation requests
function handleNavigationRequest(event) {
  // Always try network first for navigation requests
  return fetch(event.request)
    .then((response) => {
      // If response is valid, cache it and return
      if (response && response.status === 200) {
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
      }
      return response;
    })
    .catch(() => {
      // If network fails, try to serve from cache
      return caches.match(event.request).then((cachedResponse) => {
        // If found in cache, return it
        if (cachedResponse) {
          return cachedResponse;
        }
        // If not in cache and it's a navigation request, show offline page
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
        return new Response('No internet connection', {
          status: 408,
          statusText: 'Network request failed',
          headers: { 'Content-Type': 'text/plain' }
        });
      });
    });
}

// Fetch event - serve from cache, falling back to network
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Handle navigation script specially
  if (requestUrl.pathname.endsWith('navigation.js')) {
    event.respondWith(handleNavigationRequest(event));
    return;
  }

  // For other requests, try cache first, then network
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached response if found
      if (response) {
        return response;
      }

      // Clone the request
      const fetchRequest = event.request.clone();

      return fetch(fetchRequest).then((networkResponse) => {
        // Check if we received a valid response
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        // Clone the response
        const responseToCache = networkResponse.clone();

        caches.open(CACHE_NAME).then((cache) => {
          // Don't cache the response if it's a navigation request
          if (event.request.method === 'GET' && 
              networkResponse.type === 'basic' &&
              !event.request.url.includes('/api/')) {
            cache.put(event.request, responseToCache);
          }
        });

        return networkResponse;
      }).catch(() => {
        // If both cache and network fail, show offline page for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
        return new Response('No internet connection', {
          status: 408,
          statusText: 'Network request failed'
        });
      });
    })
  );
});

// Push notification event
self.addEventListener('push', (event) => {
  const title = 'MyBudgetPro';
  const options = {
    body: event.data.text(),
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png'
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});
