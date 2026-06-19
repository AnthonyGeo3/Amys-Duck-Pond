// Little Duck Pond service worker.
// Bump CACHE when you change files to force a clean update (or just rely on the
// network-first strategy below, which always fetches the latest page when online).
var CACHE = 'duckpond-v1';
var ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){ return c.addAll(ASSETS); }).then(function(){ return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(k){ return k === CACHE ? null : caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(e){
  var req = e.request;
  if(req.method !== 'GET') return;

  var accept = req.headers.get('accept') || '';
  var isPage = req.mode === 'navigate' || accept.indexOf('text/html') !== -1;

  if(isPage){
    // Network-first for the page: you always get the latest when online,
    // and the cached copy when offline.
    e.respondWith(
      fetch(req).then(function(r){
        var copy = r.clone();
        caches.open(CACHE).then(function(c){ c.put('./index.html', copy); });
        return r;
      }).catch(function(){
        return caches.match('./index.html').then(function(r){ return r || caches.match('./'); });
      })
    );
  } else {
    // Cache-first for everything else (icons, manifest, fonts).
    e.respondWith(
      caches.match(req).then(function(cached){
        return cached || fetch(req).then(function(r){
          if(r && r.ok && req.url.indexOf(self.location.origin) === 0){
            var copy = r.clone();
            caches.open(CACHE).then(function(c){ c.put(req, copy); });
          }
          return r;
        });
      })
    );
  }
});
