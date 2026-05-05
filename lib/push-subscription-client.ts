"use client";

type BrowserPushSubscriptionJson = {
  endpoint?: string;
  expirationTime?: number | null;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
};

export type PushSubscriptionSyncStatus =
  | "synced"
  | "unsupported"
  | "permission-missing"
  | "missing-key"
  | "unauthorized"
  | "failed";

type PushSubscriptionSyncOptions = {
  force?: boolean;
  retry?: boolean;
};

const VAPID_PUBLIC_KEY_STORAGE_KEY = "nexora:push:vapid-public-key";
const PUSH_SYNC_MIN_INTERVAL_MS = 30_000;

let syncPromise: Promise<PushSubscriptionSyncStatus> | null = null;
let lastSyncAt = 0;
let lastSyncStatus: PushSubscriptionSyncStatus | "" = "";

export function isSystemNotificationSupported() {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator
  );
}

export function isPushSubscriptionSupported() {
  return (
    isSystemNotificationSupported() &&
    "PushManager" in window &&
    "ServiceWorkerRegistration" in window &&
    "pushManager" in ServiceWorkerRegistration.prototype
  );
}

export function hasGrantedSystemNotificationPermission() {
  return isSystemNotificationSupported() && Notification.permission === "granted";
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = `${base64String}${padding}`
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function serializePushSubscription(subscription: PushSubscription) {
  return subscription.toJSON() as BrowserPushSubscriptionJson;
}

function getStoredVapidPublicKey() {
  try {
    return window.localStorage.getItem(VAPID_PUBLIC_KEY_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

function rememberVapidPublicKey(publicKey: string) {
  try {
    window.localStorage.setItem(VAPID_PUBLIC_KEY_STORAGE_KEY, publicKey);
  } catch {
    return;
  }
}

async function getPublicKey() {
  const res = await fetch("/api/push/public-key", {
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  const publicKey = String(data?.publicKey || "").trim();

  if (!res.ok || !publicKey) {
    return "";
  }

  return publicKey;
}

async function saveSubscription(subscription: PushSubscription) {
  const serialized = serializePushSubscription(subscription);

  if (
    !serialized.endpoint ||
    !serialized.keys?.p256dh ||
    !serialized.keys?.auth
  ) {
    return "failed" as const;
  }

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      subscription: serialized,
    }),
    cache: "no-store",
    credentials: "same-origin",
  });

  if (res.status === 401) {
    return "unauthorized" as const;
  }

  return res.ok ? ("synced" as const) : ("failed" as const);
}

export async function registerNexoraServiceWorker() {
  if (!isSystemNotificationSupported()) {
    return null;
  }

  return navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
}

export async function syncBrowserPushSubscription(
  registrationInput?: ServiceWorkerRegistration | null,
  options: PushSubscriptionSyncOptions = {}
): Promise<PushSubscriptionSyncStatus> {
  if (!isPushSubscriptionSupported()) {
    return "unsupported";
  }

  if (Notification.permission !== "granted") {
    return "permission-missing";
  }

  if (
    !options.force &&
    lastSyncStatus === "synced" &&
    Date.now() - lastSyncAt < PUSH_SYNC_MIN_INTERVAL_MS
  ) {
    return "synced";
  }

  if (syncPromise) {
    return syncPromise;
  }

  syncPromise = (async () => {
    try {
      const registration =
        registrationInput ||
        (await registerNexoraServiceWorker()) ||
        (await navigator.serviceWorker.ready);
      const publicKey = await getPublicKey();

      if (!publicKey) {
        return "missing-key" as const;
      }

      let subscription = await registration.pushManager.getSubscription();
      const storedPublicKey = getStoredVapidPublicKey();

      if (subscription && storedPublicKey && storedPublicKey !== publicKey) {
        await subscription.unsubscribe().catch(() => false);
        subscription = null;
      }

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }

      const status = await saveSubscription(subscription);
      if (status === "synced") {
        rememberVapidPublicKey(publicKey);
      }

      return status;
    } catch (error) {
      if (
        options.retry !== false &&
        error instanceof DOMException &&
        error.name === "InvalidStateError" &&
        registrationInput?.pushManager
      ) {
        const staleSubscription =
          await registrationInput.pushManager.getSubscription();
        await staleSubscription?.unsubscribe().catch(() => false);
        return syncBrowserPushSubscription(registrationInput, {
          ...options,
          force: true,
          retry: false,
        });
      }

      return "failed" as const;
    }
  })().finally(() => {
    syncPromise = null;
  });

  const status = await syncPromise;
  lastSyncAt = Date.now();
  lastSyncStatus = status;
  return status;
}

export async function requestSystemNotificationPermissionAndSync(
  registrationInput?: ServiceWorkerRegistration | null
) {
  if (!isSystemNotificationSupported()) {
    return "unsupported" as const;
  }

  if (Notification.permission === "default") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return "permission-missing" as const;
    }
  }

  return syncBrowserPushSubscription(registrationInput, {
    force: true,
  });
}
