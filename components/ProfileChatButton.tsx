"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { writeChatHistoryCache } from "@/lib/chat-history-cache";
import { prefetchDirectChatRoom } from "@/lib/chat-room-prefetch";
import type { ChatMessage, ChatUser } from "@/lib/chat-room-types";
import { saveDmRoomSeed } from "@/lib/dm-room-seed";

type DirectRoomMeta = {
  me?: ChatUser | null;
  other?: ChatUser | null;
  hasMore?: boolean;
  nextCursor?: string | null;
};

function buildDirectRoomId(userA?: string | null, userB?: string | null) {
  return [String(userA || "").trim(), String(userB || "").trim()]
    .filter(Boolean)
    .sort()
    .join("__");
}

export default function ProfileChatButton({
  currentUserId = "",
  currentUserName = "You",
  currentUserImage = "/avatar.png",
  targetUserId,
  targetUserName = "User",
  targetUserImage = "/avatar.png",
  className = "",
}: {
  currentUserId?: string;
  currentUserName?: string | null;
  currentUserImage?: string | null;
  targetUserId: string;
  targetUserName?: string;
  targetUserImage?: string;
  className?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isCreating, setIsCreating] = useState(false);
  const ensureInFlightRef = useRef<Promise<void> | null>(null);
  const profileBackHref = useMemo(
    () => `/profile/${targetUserId}`,
    [targetUserId]
  );
  const optimisticRoomId = useMemo(
    () => buildDirectRoomId(currentUserId, targetUserId),
    [currentUserId, targetUserId]
  );
  const targetHref = useMemo(
    () =>
      optimisticRoomId
        ? `/dm/${encodeURIComponent(optimisticRoomId)}?back=${encodeURIComponent(profileBackHref)}`
        : "",
    [optimisticRoomId, profileBackHref]
  );

  const primeChatShell = (roomId: string) => {
    const safeRoomId = String(roomId || "").trim();
    if (!safeRoomId || !targetUserId) return;

    const me: ChatUser | null = currentUserId
      ? {
          id: currentUserId,
          name: String(currentUserName || "").trim() || "You",
          image: String(currentUserImage || "").trim() || "/avatar.png",
        }
      : null;
    const other: ChatUser = {
      id: targetUserId,
      name: String(targetUserName || "").trim() || "User",
      image: String(targetUserImage || "").trim() || "/avatar.png",
    };

    saveDmRoomSeed(safeRoomId, {
      otherUserId: other.id,
      name: other.name,
      image: other.image,
    });

    writeChatHistoryCache<ChatMessage, DirectRoomMeta>("dm-room", safeRoomId, {
      messages: [],
      meta: {
        me,
        other,
        hasMore: false,
        nextCursor: null,
      },
      cachedAt: Date.now(),
    });
  };

  const ensureChatRoom = () => {
    if (!targetUserId) return Promise.resolve();
    if (ensureInFlightRef.current) return ensureInFlightRef.current;

    setIsCreating(true);
    setError("");

    const task = fetch("/api/dm/create-room", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user2: targetUserId,
        user2Name: targetUserName,
        user2Image: targetUserImage,
        legacyRoomId: optimisticRoomId || undefined,
      }),
      keepalive: true,
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.roomId) {
          throw new Error(String(data?.error || "เปิดแชทไม่สำเร็จ"));
        }

        const roomId = String(data.roomId || "").trim();
        if (!roomId) return;

        primeChatShell(roomId);
        void prefetchDirectChatRoom(roomId).catch(() => null);
      })
      .catch((err) => {
        setError(
          err instanceof Error && err.message
            ? err.message
            : "เปิดแชทไม่สำเร็จ"
        );
      })
      .finally(() => {
        setIsCreating(false);
        ensureInFlightRef.current = null;
      });

    ensureInFlightRef.current = task;
    return task;
  };

  useEffect(() => {
    router.prefetch("/dm");
    router.prefetch(profileBackHref);
    if (targetHref) {
      router.prefetch(targetHref);
    }
  }, [profileBackHref, router, targetHref]);

  const warmChat = () => {
    if (!optimisticRoomId || !targetHref) return;
    primeChatShell(optimisticRoomId);
    router.prefetch(targetHref);
    void ensureChatRoom();
  };

  const openChat = () => {
    if (!targetUserId || isPending) return;

    if (!optimisticRoomId || !targetHref) {
      void ensureChatRoom();
      return;
    }

    setError("");
    primeChatShell(optimisticRoomId);
    void ensureChatRoom();
    void prefetchDirectChatRoom(optimisticRoomId).catch(() => null);

    startTransition(() => {
      router.push(targetHref);
    });
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={openChat}
        onMouseEnter={warmChat}
        onTouchStart={warmChat}
        onFocus={warmChat}
        disabled={isPending}
        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-white/80 bg-white px-5 py-2.5 text-sm font-bold text-black transition hover:scale-[1.02] hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
      >
        <MessageCircle className="h-4 w-4" />
        {isPending ? "กำลังเปิดแชท..." : "แชท"}
      </button>

      {error && !isCreating ? (
        <div className="mt-2 text-xs text-red-300">{error}</div>
      ) : null}
    </div>
  );
}
