"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { saveDmRoomSeed } from "@/lib/dm-room-seed";

export default function ProfileChatButton({
  targetUserId,
  targetUserName = "User",
  targetUserImage = "/avatar.png",
  className = "",
}: {
  targetUserId: string;
  targetUserName?: string;
  targetUserImage?: string;
  className?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isCreating, setIsCreating] = useState(false);
  const profileBackHref = useMemo(
    () => `/profile/${targetUserId}`,
    [targetUserId]
  );

  useEffect(() => {
    router.prefetch("/dm");
    if (targetUserId) {
      router.prefetch(profileBackHref);
    }
  }, [profileBackHref, router, targetUserId]);

  const openChat = async () => {
    if (!targetUserId || isPending || isCreating) return;

    try {
      setError("");
      setIsCreating(true);

      const res = await fetch("/api/dm/create-room", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user2: targetUserId,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data?.roomId) {
        setError(String(data?.error || "เปิดแชทไม่สำเร็จ"));
        return;
      }

      saveDmRoomSeed(String(data.roomId), {
        name: targetUserName,
        image: targetUserImage,
      });

      const targetHref = `/dm/${data.roomId}?back=${encodeURIComponent(profileBackHref)}`;
      router.prefetch(targetHref);

      startTransition(() => {
        router.push(targetHref);
      });
    } catch {
      setError("เปิดแชทไม่สำเร็จ");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <button
        type="button"
        onClick={openChat}
        disabled={isPending || isCreating}
        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-white/18 bg-white/[0.1] px-5 py-2.5 text-sm font-bold text-white transition hover:scale-[1.02] hover:bg-white/[0.16] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
      >
        <MessageCircle className="h-4 w-4" />
        {isPending || isCreating ? "กำลังเปิดแชท..." : "แชท"}
      </button>

      {error ? <div className="text-xs text-red-300">{error}</div> : null}
    </div>
  );
}
