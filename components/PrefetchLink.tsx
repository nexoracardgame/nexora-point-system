"use client";

import Link, { LinkProps } from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import type { AnchorHTMLAttributes, ReactNode } from "react";

type PrefetchLinkProps = LinkProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    children: ReactNode;
  };

export default function PrefetchLink({
  href,
  onMouseEnter,
  onFocus,
  onTouchStart,
  children,
  ...rest
}: PrefetchLinkProps) {
  const router = useRouter();

  const prefetchRoute = useCallback(() => {
    router.prefetch(typeof href === "string" ? href : href.toString());
  }, [href, router]);

  return (
    <Link
      href={href}
      prefetch={true}
      onMouseEnter={(event) => {
        prefetchRoute();
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        prefetchRoute();
        onFocus?.(event);
      }}
      onTouchStart={(event) => {
        prefetchRoute();
        onTouchStart?.(event);
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}
