"use client";

import { signOut } from "next-auth/react";

let logoutInFlight = false;

function clearClientState() {
  try {
    sessionStorage.clear();
  } catch {
    // Ignore browsers that block storage access.
  }

  try {
    localStorage.setItem("nexora:force-logout", String(Date.now()));
  } catch {
    // Storage is only a best-effort broadcast between tabs.
  }

  try {
    if ("caches" in window) {
      void caches.keys().then((keys) => {
        keys
          .filter((key) => key.toLowerCase().includes("nexora"))
          .forEach((key) => void caches.delete(key));
      });
    }
  } catch {
    return;
  }
}

export async function performSecureLogout(options?: { server?: boolean }) {
  if (logoutInFlight) {
    return;
  }

  logoutInFlight = true;
  const shouldCallServer = options?.server !== false;

  clearClientState();

  if (shouldCallServer) {
    await fetch("/api/auth/logout", {
      method: "POST",
      cache: "no-store",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    }).catch(() => undefined);
  }

  await signOut({
    redirect: false,
    callbackUrl: "/login",
  }).catch(() => undefined);

  window.location.replace("/login?loggedOut=1");
}
