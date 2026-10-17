self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||url.searchParams.has('patch'))return;
  let asset=url.pathname;
  if(asset==='/_next/image'){try{const source=new URL(url.searchParams.get('url')||'',url.origin);if(source.origin!==url.origin)return;asset=source.pathname}catch{return;}}
  if(!/^\/(images|cards|videos|audio|fonts)\//.test(asset))return;
  event.respondWith((async()=>{
    const pointer=await (await caches.open('nexora-game-release')).match('/game/release-pointer');
    let cached;
    if(pointer){const {cacheName}=await pointer.json();if(cacheName)cached=await (await caches.open(cacheName)).match(asset);}
    if(!cached&&/^\/cards\/thumbnails\/[0-9]+-[a-f0-9]+\.webp$/.test(asset))cached=await (await caches.open('nexora-card-art-v1')).match(asset);
    if(cached){
      const range=event.request.headers.get('range');
      if(range){const blob=await cached.blob(),match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{'Content-Range':`bytes */${blob.size}`}});const start=match[1]?Number(match[1]):Math.max(0,blob.size-Number(match[2])),end=match[1]?(match[2]?Math.min(Number(match[2]),blob.size-1):blob.size-1):blob.size-1;if(start>=blob.size||start>end)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${blob.size}`}});return new Response(blob.slice(start,end+1),{status:206,headers:{'Content-Type':cached.headers.get('Content-Type')||'application/octet-stream','Content-Range':`bytes ${start}-${end}/${blob.size}`,'Content-Length':String(end-start+1),'Accept-Ranges':'bytes'}})}
      return cached;
    }
    return fetch(event.request);
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

const DEFAULT_NOTIFICATION_ICON = "/icon-512.png";
const DEFAULT_NOTIFICATION_BADGE = "/icon-192.png";

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
  const title = String(payload.title || "NEXORA TCG").trim() || "NEXORA TCG";
  const body = String(payload.body || "").trim();
  const id = String(payload.id || "").trim();
  const href = String(payload.href || "/").trim() || "/";
  const icon = DEFAULT_NOTIFICATION_ICON;
  const image = String(payload.image || payload.icon || "").trim();
  const tag = String(payload.tag || id || href || "nexora-push").trim();

  await self.registration.showNotification(title, {
    body,
    icon,
    badge: DEFAULT_NOTIFICATION_BADGE,
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
