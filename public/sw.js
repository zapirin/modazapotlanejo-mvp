const CACHE_NAME = 'modazapo-v1';

self.addEventListener('install', (event) => {
    // Skip waiting to activate immediately
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
    
    // Clear old caches if version changes
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET requests (Server actions or mutating API calls)
    if (event.request.method !== 'GET') return;

    // Skip third-party extensions or non-http protocols
    if (!url.protocol.startsWith('http')) return;

    // 1. Cache First for static assets (images, fonts)
    const isStaticAsset = url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|woff2|woff|ttf|mp3)$/i) || url.pathname.startsWith('/images/');
    
    // 2. Stale-While-Revalidate for Next.js build assets
    const isNextChunk = url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/_next/image');

    if (isStaticAsset || isNextChunk) {
        event.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(event.request).then((cachedResponse) => {
                    const fetchPromise = fetch(event.request).then((networkResponse) => {
                        // Only cache if successful response
                        if (networkResponse.ok) {
                            cache.put(event.request, networkResponse.clone());
                        }
                        return networkResponse;
                    }).catch(() => {
                        // Ignore errors on background fetches
                    });
                    
                    return cachedResponse || fetchPromise;
                });
            })
        );
        return;
    }

    // 3. Network First with Cache Fallback for HTML documents / Navigation requests
    event.respondWith(
        fetch(event.request).then((networkResponse) => {
            return caches.open(CACHE_NAME).then((cache) => {
                // Ignore API or 404s from caching as main documents
                if (networkResponse.ok && !url.pathname.startsWith('/api/')) {
                    cache.put(event.request, networkResponse.clone());
                }
                return networkResponse;
            });
        }).catch(() => {
            // If offline, serve from cache
            return caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) return cachedResponse;
                // If we don't have it in cache, we just fail gracefully (browser shows offline)
                throw new Error('Offline and not cached');
            });
        })
    );
});
