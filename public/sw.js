self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }

  try {
    const payload = event.data.json();

    event.waitUntil(
      self.registration.showNotification(payload.title || "NEXORA", {
        body: payload.body || "",
        icon: payload.icon || "/icon-192.png",
        badge: "/icon-192.png",
        data: {
          href: payload.href || "/",
          id: payload.id || "",
        },
      })
    );
  } catch {
    return;
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const href = String(event.notification.data?.href || "/").trim() || "/";
  const targetUrl = new URL(href, self.location.origin).toString();

  event.waitUntil(
    self.clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }

        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }

        return undefined;
      })
  );
});
