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
  const showDelayRef = useRef<number | null>(null);
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
    if (showDelayRef.current) {
      window.clearTimeout(showDelayRef.current);
      showDelayRef.current = null;
    }

    const timeoutId = window.setTimeout(() => {
      setTargetHref("");
    }, 0);

    return () => window.clearTimeout(timeoutId);
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

      if (showDelayRef.current) {
        window.clearTimeout(showDelayRef.current);
      }

      showDelayRef.current = window.setTimeout(() => {
        setTargetHref(href);
        showDelayRef.current = null;
      }, 180);
    };

    const clearNavigation = () => {
      if (showDelayRef.current) {
        window.clearTimeout(showDelayRef.current);
        showDelayRef.current = null;
      }
      setTargetHref("");
    };

    const options: AddEventListenerOptions = {
      capture: true,
      passive: true,
    };

    window.addEventListener("click", startNavigation, options);
    window.addEventListener("pageshow", clearNavigation, options);

    return () => {
      window.removeEventListener("click", startNavigation, options);
      window.removeEventListener("pageshow", clearNavigation, options);
      if (showDelayRef.current) {
        window.clearTimeout(showDelayRef.current);
        showDelayRef.current = null;
      }
    };
  }, [pathname]);

  if (!targetHref) {
    return null;
  }

  const label = getRouteLabel(targetHref);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[2100] px-3 pt-[calc(env(safe-area-inset-top)+8px)] text-white"
      aria-hidden="true"
    >
      <div className="mx-auto w-full max-w-md overflow-hidden rounded-full border border-amber-200/20 bg-black/78 p-1 shadow-[0_14px_42px_rgba(0,0,0,0.42)] backdrop-blur-xl">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
          <div className="h-full w-2/3 animate-[nexora-route-progress_0.72s_ease-out_infinite] rounded-full bg-[linear-gradient(90deg,#f6b73c,#fff1ad,#f6b73c)] shadow-[0_0_22px_rgba(250,204,21,0.52)]" />
        </div>
        <div className="px-3 py-1.5 text-center text-[10px] font-black uppercase tracking-[0.22em] text-amber-100/70">
          {label}
        </div>
      </div>
    </div>
  );
}
