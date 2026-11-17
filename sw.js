/* Service worker Day-Log BPS
   - Kerangka aplikasi (HTML/CSS/JS) di-cache agar cepat dibuka dan tetap tampil saat sinyal buruk.
   - Strategi network-first: selalu ambil versi terbaru bila online, cache hanya sebagai cadangan.
   - Permintaan ke Supabase (data) TIDAK pernah di-cache. */
const VERSION = 'day-log-v5';
const SHELL = [
  './', 'index.html', 'css/style.css', 'js/app.js', 'js/config.js',
  'js/vendor/supabase.js', 'js/vendor/jspdf.umd.min.js', 'js/vendor/jspdf.plugin.autotable.min.js',
  'manifest.webmanifest', 'assets/day-log-logo.jpg', 'assets/day-log-mark.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // data & font eksternal: biarkan langsung
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : undefined)))
  );
});
