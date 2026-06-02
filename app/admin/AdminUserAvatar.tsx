"use client";

import { useMemo, useState } from "react";

const FALLBACK_AVATAR = "/avatar.png";

function getSafeImage(src?: string | null) {
  const value = String(src || "").trim();
  if (!value || value.startsWith("data:image/")) return FALLBACK_AVATAR;
  return value;
}

function getInitials(name?: string | null) {
  const value = String(name || "").trim();
  if (!value) return "NX";
  return value.slice(0, 2).toUpperCase();
}

export default function AdminUserAvatar({
  src,
  name,
  size = "md",
}: {
  src?: string | null;
  name?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const [broken, setBroken] = useState(false);
  const safeSrc = useMemo(() => getSafeImage(src), [src]);
  const showFallback = broken || safeSrc === FALLBACK_AVATAR;
  const sizeClass =
    size === "lg"
      ? "h-20 w-20 text-xl"
      : size === "sm"
        ? "h-12 w-12 text-sm"
        : "h-14 w-14 text-base";

  return (
    <div
      className={`${sizeClass} relative shrink-0 overflow-hidden rounded-full border border-white/12 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.18),rgba(255,255,255,0.04)_42%,rgba(0,0,0,0.45))] ring-1 ring-black/40`}
    >
      {showFallback ? (
        <div className="flex h-full w-full items-center justify-center font-black text-white/74">
          {getInitials(name)}
        </div>
      ) : (
        <img
          src={safeSrc}
          alt={name ? `รูปโปรไฟล์ ${name}` : "รูปโปรไฟล์สมาชิก"}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      )}
      <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/10" />
    </div>
  );
}
