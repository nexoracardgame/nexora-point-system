"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

function getInternalHref(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return "";
  }

  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) {
    return "";
  }

  if (
    anchor.target ||
    anchor.hasAttribute("download") ||
    anchor.getAttribute("rel")?.includes("external")
  ) {
    return "";
  }

  try {
    const url = new URL(anchor.href);
    if (url.origin !== window.location.origin || url.hash) {
      return "";
    }

    return `${url.pathname}${url.search}`;
  } catch {
    return "";
  }
}

function getRouteLabel(href: string) {
  if (href.startsWith("/profile")) return "Profile";
  if (href.startsWith("/market")) return "Market";
  if (href.startsWith("/buy-market")) return "Buy Market";
  if (href.startsWith("/box-market")) return "Box Market";
  if (href.startsWith("/dm")) return "Chat";
  if (href.startsWith("/wallet")) return "Wallet";
  if (href.startsWith("/community")) return "Community";
  if (href.startsWith("/collections")) return "Collection";
  return "NEXORA";
}

export default function InstantNavigationFeedback() {
  const pathname = usePathname() || "";
  const [targetHref, setTargetHref] = useState("");
  const timeoutRef = useRef<number | null>(null);
  const targetRef = useRef("");

  useEffect(() => {
    targetRef.current = targetHref;
  }, [targetHref]);

  useEffect(() => {
    if (!targetHref) {
      return;
    }

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      setTargetHref("");
      timeoutRef.current = null;
    }, 1800);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [targetHref]);

  useEffect(() => {
    setTargetHref("");
  }, [pathname]);

  useEffect(() => {
    const startNavigation = (event: Event) => {
      if (
        event instanceof MouseEvent &&
        (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      ) {
        return;
      }

      const href = getInternalHref(event.target);
      if (!href || href === pathname || href.startsWith("/api/")) {
        return;
      }

      if (targetRef.current === href) {
        return;
      }

      setTargetHref(href);
    };

    const options: AddEventListenerOptions = {
      capture: true,
      passive: true,
    };

    window.addEventListener("click", startNavigation, options);
    window.addEventListener("pointerdown", startNavigation, options);
    window.addEventListener("touchstart", startNavigation, options);
    window.addEventListener("pageshow", () => setTargetHref(""), options);

    return () => {
      window.removeEventListener("click", startNavigation, options);
      window.removeEventListener("pointerdown", startNavigation, options);
      window.removeEventListener("touchstart", startNavigation, options);
    };
  }, [pathname]);

  if (!targetHref) {
    return null;
  }

  const label = getRouteLabel(targetHref);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[2100] overflow-hidden bg-[#08090d] text-white"
      aria-hidden="true"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(250,204,21,0.20),transparent_30%),linear-gradient(180deg,#101117_0%,#08090d_58%,#050507_100%)]" />
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-7xl flex-col gap-4 px-3 py-4 sm:px-6">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
          <div className="h-full w-2/3 animate-[nexora-route-progress_0.7s_ease-out_infinite] rounded-full bg-[linear-gradient(90deg,#f6b73c,#fff1ad,#f6b73c)] shadow-[0_0_24px_rgba(250,204,21,0.55)]" />
        </div>
        <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.045] shadow-[0_24px_90px_rgba(0,0,0,0.5)]">
          <div className="h-[210px] animate-pulse bg-white/[0.055] sm:h-[310px]" />
          <div className="space-y-4 p-4 sm:p-6">
            <div className="flex items-end gap-4">
              <div className="h-20 w-20 shrink-0 animate-pulse rounded-full bg-white/12 sm:h-28 sm:w-28" />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="h-3 w-24 rounded-full bg-amber-200/40" />
                <div className="h-8 w-2/3 animate-pulse rounded-2xl bg-white/12" />
                <div className="h-4 w-1/2 animate-pulse rounded-full bg-white/8" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="h-20 animate-pulse rounded-2xl bg-white/[0.06]" />
              ))}
            </div>
          </div>
        </div>
        <div className="text-center text-xs font-black uppercase tracking-[0.28em] text-amber-100/70">
          {label}
        </div>
      </div>
    </div>
  );
}
