"use client";

import { useEffect, useState, useTransition } from "react";
import { Check, Clock3, UserPlus, Users, X } from "lucide-react";

type FriendRelation = "self" | "none" | "outgoing" | "incoming" | "friends";

type RelationResponse = {
  relation?: {
    status?: FriendRelation;
    requestId?: string | null;
  };
};

export default function ProfileFriendButton({
  targetUserId,
  className = "",
}: {
  targetUserId: string;
  className?: string;
}) {
  const [relation, setRelation] = useState<FriendRelation>("none");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    const loadRelation = async () => {
      try {
        const res = await fetch(`/api/community/status/${encodeURIComponent(targetUserId)}`, {
          cache: "no-store",
        });
        const data = (await res.json().catch(() => ({}))) as RelationResponse;
        if (cancelled) return;

        setRelation((data.relation?.status || "none") as FriendRelation);
        setRequestId(String(data.relation?.requestId || "").trim() || null);
      } catch {
        if (!cancelled) {
          setRelation("none");
        }
      }
    };

    if (targetUserId) {
      void loadRelation();
    }

    return () => {
      cancelled = true;
    };
  }, [targetUserId]);

  const submitAction = (payload: Record<string, unknown>, next?: Partial<{ relation: FriendRelation; requestId: string | null }>) => {
    startTransition(() => {
      void (async () => {
        try {
          setError("");
          const res = await fetch("/api/community/friends", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await res.json().catch(() => ({}));

          if (!res.ok) {
            setError(String(data?.error || "ดำเนินการไม่สำเร็จ"));
            return;
          }

          if (next?.relation) setRelation(next.relation);
          if ("requestId" in (next || {})) setRequestId(next?.requestId ?? null);

          if (data?.relation?.status) {
            setRelation(data.relation.status as FriendRelation);
            setRequestId(String(data.relation.requestId || "").trim() || null);
          }

          if (data?.status === "accepted") {
            setRelation("friends");
            setRequestId(null);
          }

          if (data?.status === "rejected") {
            setRelation("none");
            setRequestId(null);
          }
        } catch {
          setError("ดำเนินการไม่สำเร็จ");
        }
      })();
    });
  };

  if (relation === "self") {
    return null;
  }

  if (relation === "incoming" && requestId) {
    return (
      <div className={`flex flex-wrap items-center gap-3 ${className}`}>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            submitAction(
              { action: "respond", requestId, decision: "accept" },
              { relation: "friends", requestId: null }
            )
          }
          className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[17px] border border-emerald-300/24 bg-emerald-400/12 px-4 text-sm font-black text-emerald-100 transition hover:scale-[1.03] hover:bg-emerald-400/18 disabled:opacity-60"
        >
          <Check className="h-4 w-4" />
          รับเพื่อน
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            submitAction(
              { action: "respond", requestId, decision: "reject" },
              { relation: "none", requestId: null }
            )
          }
          className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[17px] border border-red-300/18 bg-red-500/10 px-4 text-sm font-black text-red-200 transition hover:scale-[1.03] hover:bg-red-500/16 disabled:opacity-60"
        >
          <X className="h-4 w-4" />
          ปฏิเสธ
        </button>
        {error ? <div className="w-full text-xs text-red-300">{error}</div> : null}
      </div>
    );
  }

  if (relation === "friends") {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[17px] border border-violet-300/22 bg-violet-400/10 px-4 text-sm font-black text-violet-100">
          <Users className="h-4 w-4" />
          เป็นเพื่อนแล้ว
        </div>
      </div>
    );
  }

  if (relation === "outgoing") {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[17px] border border-amber-300/22 bg-amber-300/10 px-4 text-sm font-black text-amber-100">
          <Clock3 className="h-4 w-4" />
          ส่งคำขอแล้ว
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <button
        type="button"
        disabled={isPending}
        onClick={() =>
          submitAction(
            { action: "request", targetUserId },
            { relation: "outgoing" }
          )
        }
        className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[17px] border border-cyan-300/24 bg-cyan-400/10 px-4 text-sm font-black text-cyan-100 shadow-[0_16px_35px_rgba(34,211,238,0.10)] transition hover:scale-[1.03] hover:bg-cyan-400/18 disabled:opacity-60"
      >
        <UserPlus className="h-4 w-4" />
        {isPending ? "กำลังส่ง..." : "เพิ่มเพื่อน"}
      </button>
      {error ? <div className="text-xs text-red-300">{error}</div> : null}
    </div>
  );
}
