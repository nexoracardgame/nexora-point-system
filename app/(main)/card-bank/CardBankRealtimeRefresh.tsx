"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function CardBankRealtimeRefresh({
  initialVersion,
}: {
  initialVersion: string;
}) {
  const router = useRouter();
  const latestVersionRef = useRef(initialVersion);
  const refreshTimerRef = useRef<number | null>(null);

  useEffect(() => {
    latestVersionRef.current = initialVersion;
  }, [initialVersion]);

  useEffect(() => {
    const refreshSoon = () => {
      if (refreshTimerRef.current) return;
      refreshTimerRef.current = window.setTimeout(() => {
        refreshTimerRef.current = null;
        router.refresh();
      }, 120);
    };

    const checkState = async () => {
      try {
        const response = await fetch("/api/card-bank/state", {
          cache: "no-store",
        });
        const data = (await response.json().catch(() => ({}))) as {
          ok?: boolean;
          version?: string;
        };

        if (response.ok && data.ok && data.version && data.version !== latestVersionRef.current) {
          latestVersionRef.current = data.version;
          refreshSoon();
        }
      } catch {
        // EventSource is the primary live path; polling simply waits for the next tick.
      }
    };

    const source = new EventSource("/api/card-bank/stream");
    source.addEventListener("card-bank-update", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as {
          version?: string;
        };
        if (payload.version && payload.version !== latestVersionRef.current) {
          latestVersionRef.current = payload.version;
        }
      } catch {
        // The refresh is still correct even if the event payload cannot be parsed.
      }
      refreshSoon();
    });
    source.addEventListener("error", () => {
      void checkState();
    });

    const poll = window.setInterval(checkState, 2500);
    const handleVisibility = () => {
      if (!document.hidden) void checkState();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      source.close();
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", handleVisibility);
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
    };
  }, [router]);

  return null;
}
