"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import type { LinkProps } from "next/link";

type PrefetchLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    children: ReactNode;
  };

type SerializableHref = {
  pathname?: string | null;
  query?: Record<
    string,
    | string
    | number
    | boolean
    | ReadonlyArray<string | number | boolean>
    | null
    | undefined
  > | null;
  hash?: string | null;
};

const PREFETCH_TTL_MS = 45000;
const MAX_PREFETCH_CACHE_SIZE = 80;
const prefetchedRoutes = new Map<string, number>();

function appendQueryValue(
  params: URLSearchParams,
  key: string,
  value: unknown
) {
  if (value === null || value === undefined) {
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => appendQueryValue(params, key, entry));
    return;
  }

  params.append(key, String(value));
}

function getPrefetchHref(href: LinkProps["href"]) {
  if (typeof href === "string") {
    return href;
  }

  if (!href || typeof href !== "object") {
    return String(href || "");
  }

  const route = href as SerializableHref;
  const pathname = String(route.pathname || "").trim();
  const params = new URLSearchParams();

  Object.entries(route.query || {}).forEach(([key, value]) => {
    appendQueryValue(params, key, value);
  });

  const query = params.toString();
  const rawHash = String(route.hash || "").trim();
  const hash = rawHash ? (rawHash.startsWith("#") ? rawHash : `#${rawHash}`) : "";

  return `${pathname}${query ? `?${query}` : ""}${hash}`;
}

function prunePrefetchCache(now: number) {
  if (prefetchedRoutes.size <= MAX_PREFETCH_CACHE_SIZE) {
    return;
  }

  const staleBefore = now - PREFETCH_TTL_MS;
  for (const [route, timestamp] of prefetchedRoutes) {
    if (timestamp < staleBefore || prefetchedRoutes.size > MAX_PREFETCH_CACHE_SIZE) {
      prefetchedRoutes.delete(route);
    }
  }
}

export default function PrefetchLink({
  href,
  onMouseEnter,
  onFocus,
  onPointerEnter,
  onPointerDown,
  onTouchStart,
  children,
  ...rest
}: PrefetchLinkProps) {
  const router = useRouter();
  const prefetchHref = useMemo(() => getPrefetchHref(href), [href]);

  const prefetchRoute = useCallback(() => {
    if (!prefetchHref || prefetchHref.startsWith("#")) {
      return;
    }

    const now = Date.now();
    const previousPrefetchAt = prefetchedRoutes.get(prefetchHref) || 0;
    if (now - previousPrefetchAt < PREFETCH_TTL_MS) {
      return;
    }

    prefetchedRoutes.set(prefetchHref, now);
    prunePrefetchCache(now);
    router.prefetch(prefetchHref);
  }, [prefetchHref, router]);

  return (
    <Link
      href={href}
      prefetch="auto"
      onPointerEnter={(event) => {
        prefetchRoute();
        onPointerEnter?.(event);
      }}
      onPointerDown={(event) => {
        onPointerDown?.(event);
      }}
      onTouchStart={(event) => {
        onTouchStart?.(event);
      }}
      onMouseEnter={(event) => {
        prefetchRoute();
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        prefetchRoute();
        onFocus?.(event);
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}
