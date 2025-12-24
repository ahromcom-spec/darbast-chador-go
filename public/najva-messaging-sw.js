importScripts('https://van.najva.com/static/js/service-worker.js');

// Ensure Chromium browsers consider the app installable as a PWA.
// If this worker is registered at scope '/', missing a fetch handler can block installability.
self.addEventListener('fetch', () => {});

