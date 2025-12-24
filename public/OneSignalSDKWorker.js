importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

// Ensure Chromium browsers consider the app installable as a PWA.
// If this worker becomes the active registration (common with push SDKs),
// lacking a fetch handler can prevent the install prompt from appearing.
self.addEventListener('fetch', () => {});

