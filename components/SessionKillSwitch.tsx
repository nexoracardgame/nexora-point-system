"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { performSecureLogout } from "@/lib/secure-logout";

export default function SessionKillSwitch() {
  const { data: session, status } = useSession();
  const sessionRevoked = Boolean(session?.user?.sessionRevoked);

  useEffect(() => {
    if (status === "authenticated" && sessionRevoked) {
      void performSecureLogout({ server: false });
    }
  }, [sessionRevoked, status]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "nexora:force-logout" && event.newValue) {
        void performSecureLogout({ server: false });
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return null;
}
