self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

async function readPushPayload(event) {
  if (!event.data) {
    return {};
  }

  try {
    return event.data.json();
  } catch {
    try {
      return JSON.parse(event.data.text());
    } catch {
      return {};
    }
  }
}

async function showPushNotification(payload) {
  const title = String(payload.title || "NEX POINT").trim() || "NEX POINT";
  const body = String(payload.body || "").trim();
  const id = String(payload.id || "").trim();
  const href = String(payload.href || "/").trim() || "/";
  const icon = String(payload.icon || payload.image || "/icon-192-nex-point.png").trim();
  const tag = String(payload.tag || id || href || "nexora-push").trim();

  await self.registration.showNotification(title, {
    body,
    icon: icon || "/icon-192-nex-point.png",
    badge: "/icon-192-nex-point.png",
    tag,
    renotify: true,
    timestamp: Date.now(),
    data: {
      href,
      id,
    },
  });
}

self.addEventListener("push", (event) => {
  event.waitUntil(
    readPushPayload(event).then((payload) => showPushNotification(payload || {}))
  );
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
