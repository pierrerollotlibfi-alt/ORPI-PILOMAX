// ─── SERVICE WORKER ORPI DÉCLIC IMMO ──────────────────────────────────────────
var CACHE = "orpi-sw-v1";

self.addEventListener("install", function(e) {
  self.skipWaiting();
});

self.addEventListener("activate", function(e) {
  e.waitUntil(self.clients.claim());
});

// Réception d'une notification push
self.addEventListener("push", function(e) {
  if (!e.data) return;
  var data = e.data.json();
  e.waitUntil(
    self.registration.showNotification(data.title || "ORPI Déclic", {
      body:    data.body    || "",
      icon:    data.icon    || "/logo192.png",
      badge:   "/logo192.png",
      tag:     data.tag     || "orpi-notif",
      data:    data.data    || {},
      vibrate: [200, 100, 200],
      requireInteraction: false,
    })
  );
});

// Clic sur une notification
self.addEventListener("notificationclick", function(e) {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function(clients) {
      if (clients.length > 0) { clients[0].focus(); return; }
      return self.clients.openWindow("/");
    })
  );
});
