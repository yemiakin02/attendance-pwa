// ✅ ENHANCED SERVICE WORKER FOR FULL PWA FUNCTIONALITY
console.log('🚀 Service Worker: Loading...');

const CACHE_NAME = 'attendance-pwa-v1.2';
const STATIC_CACHE = 'attendance-static-v1.2';
const DYNAMIC_CACHE = 'attendance-dynamic-v1.2';

// ✅ RESOURCES TO CACHE IMMEDIATELY
const STATIC_RESOURCES = [
  './',
  './index.html',
  './manifest.json',
  './logo.png'
];

// ✅ GOOGLE APPS SCRIPT PATTERNS (don't cache these)
const GAS_PATTERNS = [
  /script\.google\.com/,
  /script\.googleapis\.com/,
  /googleusercontent\.com/
];

// ✅ INSTALL EVENT - Cache core resources
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Installing...');
  
  event.waitUntil(
    Promise.all([
      // Cache static resources
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('📦 Service Worker: Caching static resources');
        return cache.addAll(STATIC_RESOURCES.map(url => new Request(url, { cache: 'reload' })));
      }),
      // Initialize dynamic cache
      caches.open(DYNAMIC_CACHE)
    ]).then(() => {
      console.log('✅ Service Worker: Installation complete');
      return self.skipWaiting();
    }).catch((error) => {
      console.error('❌ Service Worker: Install failed:', error);
    })
  );
});

// ✅ ACTIVATE EVENT - Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🔧 Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE && 
              cacheName !== DYNAMIC_CACHE && 
              cacheName !== CACHE_NAME) {
            console.log('🗑️ Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker: Activation complete');
      return self.clients.claim();
    })
  );
});

// ✅ FETCH EVENT - Smart caching strategy
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip Google Apps Script requests (let them pass through)
  if (GAS_PATTERNS.some(pattern => pattern.test(url.href))) {
    console.log('🔄 Service Worker: Bypassing GAS request:', url.href);
    return;
  }
  
  // Skip chrome-extension and other special URLs
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }
  
  event.respondWith(handleRequest(request));
});

// ✅ SMART REQUEST HANDLING
async function handleRequest(request) {
  const url = new URL(request.url);
  
  try {
    // Strategy 1: Static resources - Cache first
    if (STATIC_RESOURCES.some(resource => url.pathname.endsWith(resource.replace('./', '')))) {
      return await cacheFirst(request);
    }
    
    // Strategy 2: HTML pages - Network first with fallback
    if (request.headers.get('accept')?.includes('text/html')) {
      return await networkFirstWithFallback(request);
    }
    
    // Strategy 3: Images and assets - Cache first with network fallback
    if (request.headers.get('accept')?.includes('image/')) {
      return await cacheFirst(request);
    }
    
    // Strategy 4: Everything else - Network first
    return await networkFirst(request);
    
  } catch (error) {
    console.error('❌ Service Worker: Request failed:', error);
    return await getOfflineFallback(request);
  }
}

// ✅ CACHE FIRST STRATEGY
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    console.log('📦 Service Worker: Cache hit for:', request.url);
    // Update cache in background
    fetch(request).then(response => {
      if (response.ok) {
        caches.open(STATIC_CACHE).then(cache => cache.put(request, response.clone()));
      }
    }).catch(() => {}); // Ignore background update failures
    
    return cachedResponse;
  }
  
  console.log('🌐 Service Worker: Network request for:', request.url);
  const networkResponse = await fetch(request);
  
  if (networkResponse.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, networkResponse.clone());
  }
  
  return networkResponse;
}

// ✅ NETWORK FIRST STRATEGY
async function networkFirst(request) {
  try {
    console.log('🌐 Service Worker: Network first for:', request.url);
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('📦 Service Worker: Network failed, trying cache for:', request.url);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

// ✅ NETWORK FIRST WITH OFFLINE FALLBACK
async function networkFirstWithFallback(request) {
  try {
    return await networkFirst(request);
  } catch (error) {
    // Return cached index.html for navigation requests
    if (request.mode === 'navigate') {
      const fallback = await caches.match('./index.html');
      if (fallback) {
        return fallback;
      }
    }
    throw error;
  }
}

// ✅ OFFLINE FALLBACK
async function getOfflineFallback(request) {
  if (request.mode === 'navigate') {
    // Return cached index page for navigation
    const cachedIndex = await caches.match('./index.html');
    if (cachedIndex) {
      return cachedIndex;
    }
  }
  
  // Return a basic offline response
  return new Response(
    JSON.stringify({ 
      error: 'Offline', 
      message: 'You are currently offline. Please check your connection.' 
    }),
    {
      status: 200,
      statusText: 'OK',
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );
}

// ✅ BACKGROUND SYNC (for future offline functionality)
self.addEventListener('sync', (event) => {
  console.log('🔄 Service Worker: Background sync triggered:', event.tag);
  
  if (event.tag === 'attendance-sync') {
    event.waitUntil(syncAttendanceData());
  }
});

// ✅ PUSH NOTIFICATIONS (for future notifications)
self.addEventListener('push', (event) => {
  console.log('🔔 Service Worker: Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'New notification from Attendance System',
    icon: './logo.png',
    badge: './logo.png',
    tag: 'attendance-notification',
    renotify: true,
    requireInteraction: false,
    actions: [
      {
        action: 'open',
        title: 'Open App',
        icon: './logo.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: './logo.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Attendance System', options)
  );
});

// ✅ NOTIFICATION CLICK HANDLING
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Service Worker: Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        // If app is already open, focus it
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Otherwise open new window
        if (clients.openWindow) {
          return clients.openWindow('./');
        }
      })
    );
  }
});

// ✅ MESSAGE HANDLING (for communication with main app)
self.addEventListener('message', (event) => {
  console.log('💬 Service Worker: Message received:', event.data);
  
  if (event.data && event.data.type) {
    switch (event.data.type) {
      case 'SKIP_WAITING':
