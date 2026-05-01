"use client";

import { useOnlinePresence } from "@/components/OnlinePresenceProvider";

export default function ProfilePresenceDot({
  userId,
  className = "",
}: {
  userId?: string | null;
  className?: string;
}) {
  const { isOnline } = useOnlinePresence();
  const online = isOnline(userId);

  return (
    <div
      aria-label={online ? "ออนไลน์" : "ออฟไลน์"}
      title={online ? "ออนไลน์" : "ออฟไลน์"}
      className={`${className} ${
        online
          ? "bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.78)]"
          : "bg-zinc-500 shadow-[0_0_12px_rgba(113,113,122,0.34)]"
      }`}
    />
  );
}
