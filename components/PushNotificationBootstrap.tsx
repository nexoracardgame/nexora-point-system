"use client";

import { useEffect, useRef } from "react";
import {
  hasGrantedSystemNotificationPermission,
  isSystemNotificationSupported,
  registerNexoraServiceWorker,
  syncBrowserPushSubscription,
} from "@/lib/push-subscription-client";

const PUSH_BOOTSTRAP_RETRY_MS = 45_000;

export default function PushNotificationBootstrap() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    if (!isSystemNotificationSupported()) {
      return;
    }

    let cancelled = false;

    const syncPush = async (force = false) => {
      if (cancelled || syncingRef.current) {
        return;
      }

      syncingRef.current = true;

      try {
        const registration =
          registrationRef.current || (await registerNexoraServiceWorker());
        if (cancelled || !registration) {
          return;
        }

        registrationRef.current = registration;

        if (hasGrantedSystemNotificationPermission()) {
          await syncBrowserPushSubscription(registration, {
            force,
          });
        }
      } catch {
        return;
      } finally {
        syncingRef.current = false;
      }
    };

    const syncIfActive = () => {
      if (document.visibilityState !== "hidden") {
        void syncPush(false);
      }
    };

    void syncPush(true);

    window.addEventListener("focus", syncIfActive);
    window.addEventListener("online", syncIfActive);
    document.addEventListener("visibilitychange", syncIfActive);

    const intervalId = window.setInterval(() => {
      if (hasGrantedSystemNotificationPermission()) {
        void syncPush(false);
      }
    }, PUSH_BOOTSTRAP_RETRY_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", syncIfActive);
      window.removeEventListener("online", syncIfActive);
      document.removeEventListener("visibilitychange", syncIfActive);
    };
  }, []);

  return null;
}
