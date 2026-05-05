self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

const DEFAULT_NOTIFICATION_ICON = "/icon-192-nex-point.png";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = self.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

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
  const icon = String(payload.icon || payload.image || DEFAULT_NOTIFICATION_ICON).trim();
  const image = String(payload.image || "").trim();
  const tag = String(payload.tag || id || href || "nexora-push").trim();

  await self.registration.showNotification(title, {
    body,
    icon: icon || DEFAULT_NOTIFICATION_ICON,
    badge: DEFAULT_NOTIFICATION_ICON,
    ...(image && image !== icon ? { image } : {}),
    tag,
    renotify: true,
    silent: false,
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

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keyRes = await fetch("/api/push/public-key", {
          cache: "no-store",
          credentials: "include",
        });
        const keyData = await keyRes.json();
        const publicKey = String(keyData?.publicKey || "").trim();

        if (!keyRes.ok || !publicKey) {
          return;
        }

        const subscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ subscription }),
          cache: "no-store",
          credentials: "include",
        });
      } catch {
        return;
      }
    })()
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
