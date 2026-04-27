"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState, useTransition } from "react";
import {
  Check,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";

type SearchUser = {
  id: string;
  displayName: string;
  username: string | null;
  image: string;
  bio: string;
  relation: "none" | "incoming" | "outgoing" | "friends" | "self";
  requestId: string | null;
};

type FriendItem = {
  id: string;
  friendId: string;
  createdAt: string;
  displayName: string;
  username: string | null;
  image: string;
  bio: string;
};

type IncomingRequest = {
  id: string;
  fromUserId: string;
  createdAt: string;
  displayName: string;
  username: string | null;
  image: string;
  bio: string;
};

export default function CommunityClient() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [requests, setRequests] = useState<IncomingRequest[]>([]);
  const [loadingResults, setLoadingResults] = useState(true);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const loadFriends = async () => {
    setLoadingFriends(true);
    try {
      const res = await fetch("/api/community/friends", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      setFriends(Array.isArray(data?.friends) ? data.friends : []);
      setRequests(Array.isArray(data?.requests) ? data.requests : []);
    } catch {
      setFriends([]);
      setRequests([]);
    } finally {
      setLoadingFriends(false);
    }
  };

  const runSearch = async (term: string) => {
    setLoadingResults(true);
    try {
      const res = await fetch(`/api/community/search?q=${encodeURIComponent(term)}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      setResults(Array.isArray(data?.users) ? data.users : []);
    } catch {
      setResults([]);
    } finally {
      setLoadingResults(false);
    }
  };

  useEffect(() => {
    void Promise.all([loadFriends(), runSearch("")]);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadFriends();
      }
    }, 3000);

    const onFocus = () => {
      void loadFriends();
      void runSearch(query);
    };

    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [query]);

  const handleSearch = (event?: FormEvent) => {
    event?.preventDefault();
    void runSearch(query);
  };

  const applyRelation = (
    targetUserId: string,
    relation: SearchUser["relation"],
    requestId: string | null = null
  ) => {
    setResults((prev) =>
      prev.map((user) =>
        user.id === targetUserId ? { ...user, relation, requestId } : user
      )
    );
  };

  const submitAction = (
    payload: Record<string, unknown>,
    onDone?: (data: Record<string, unknown>) => void
  ) => {
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
          onDone?.(data as Record<string, unknown>);
          void loadFriends();
          void runSearch(query);
        } catch {
          setError("ดำเนินการไม่สำเร็จ");
        }
      })();
    });
  };

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top,#1f153b_0%,#0a0c14_42%,#06070b_100%)] text-white">
      <div className="mx-auto max-w-7xl space-y-5 px-3 py-3 sm:px-5 sm:py-5 xl:px-6">
        <section className="overflow-hidden rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(123,92,255,0.18),rgba(11,13,20,0.92)_55%,rgba(34,211,238,0.12))] p-5 shadow-[0_35px_120px_rgba(0,0,0,0.4)] backdrop-blur-2xl sm:rounded-[38px] sm:p-7">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/42">
                NEXORA COMMUNITY
              </div>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-5xl">
                ค้นหาเพื่อนและจัดการคอมมูนิตี้
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/68 sm:text-base">
                ค้นหาจากชื่อหรือ username, ส่งคำขอเพื่อน, รับคำขอจากกระดิ่ง และลบเพื่อนได้จากที่นี่ในหน้าเดียว
              </p>
            </div>

            <div className="rounded-[26px] border border-white/10 bg-black/24 px-5 py-4 backdrop-blur-xl">
              <div className="text-[11px] uppercase tracking-[0.24em] text-white/42">
                Friends
              </div>
              <div className="mt-2 flex items-center gap-3 text-3xl font-black text-amber-300">
                <Users className="h-7 w-7" />
                {friends.length}
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSearch}
            className="mt-6 flex flex-col gap-3 rounded-[28px] border border-white/10 bg-black/24 p-3 backdrop-blur-xl sm:flex-row sm:items-center sm:p-4"
          >
            <div className="flex min-h-[58px] flex-1 items-center gap-3 rounded-[22px] border border-white/10 bg-white/[0.04] px-4">
              <Search className="h-5 w-5 text-cyan-200/80" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ค้นหาจากชื่อหรือ username"
                className="h-full w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35 sm:text-base"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="inline-flex min-h-[58px] items-center justify-center gap-2 rounded-[22px] border border-amber-300/24 bg-[linear-gradient(180deg,rgba(251,191,36,0.2),rgba(251,191,36,0.08))] px-6 text-sm font-black text-amber-100 shadow-[0_18px_38px_rgba(251,191,36,0.12)] transition hover:scale-[1.02] hover:brightness-110 disabled:opacity-60"
            >
              <Search className="h-4 w-4" />
              ค้นหา
            </button>
          </form>
        </section>

        {error ? (
          <div className="rounded-[22px] border border-red-400/16 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {requests.length > 0 ? (
          <section className="rounded-[28px] border border-amber-300/14 bg-[linear-gradient(135deg,rgba(251,191,36,0.12),rgba(255,255,255,0.035))] p-4 shadow-[0_20px_70px_rgba(251,191,36,0.08)] backdrop-blur-2xl sm:rounded-[32px] sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-amber-100/48">
                  Pending Requests
                </div>
                <div className="mt-1 text-xl font-black text-white sm:text-2xl">
                  คำขอเป็นเพื่อนที่รออยู่
                </div>
              </div>
              <div className="rounded-full border border-amber-300/18 bg-amber-300/10 px-3 py-1 text-xs font-black text-amber-100">
                {requests.length}
              </div>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="flex flex-col gap-3 rounded-[22px] border border-white/10 bg-black/22 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <Link
                    href={`/profile/${request.fromUserId}`}
                    className="flex min-w-0 items-center gap-3"
                  >
                    <img
                      src={request.image || "/avatar.png"}
                      alt={request.displayName}
                      className="h-12 w-12 rounded-2xl object-cover ring-1 ring-white/10"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-white sm:text-base">
                        {request.displayName}
                      </div>
                      <div className="mt-1 text-xs text-white/50 sm:text-sm">
                        {request.username ? `@${request.username}` : "NEXORA User"}
                      </div>
                    </div>
                  </Link>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        submitAction(
                          {
                            action: "respond",
                            requestId: request.id,
                            decision: "accept",
                          },
                          () => {
                            setRequests((prev) =>
                              prev.filter((item) => item.id !== request.id)
                            );
                            applyRelation(request.fromUserId, "friends", null);
                          }
                        )
                      }
                      className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-[16px] border border-amber-300/24 bg-amber-300/12 px-4 text-sm font-black text-amber-100 transition hover:brightness-110 sm:flex-none"
                    >
                      <Check className="h-4 w-4" />
                      รับ
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        submitAction(
                          {
                            action: "respond",
                            requestId: request.id,
                            decision: "reject",
                          },
                          () => {
                            setRequests((prev) =>
                              prev.filter((item) => item.id !== request.id)
                            );
                            applyRelation(request.fromUserId, "none", null);
                          }
                        )
                      }
                      className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-[16px] border border-red-300/18 bg-red-500/10 px-4 text-sm font-black text-red-200 transition hover:bg-red-500/16 sm:flex-none"
                    >
                      <X className="h-4 w-4" />
                      ปฏิเสธ
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,18,28,0.92)_0%,rgba(9,10,16,0.86)_100%)] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:rounded-[34px] sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/38">
                  Search Result
                </div>
                <div className="mt-1 text-2xl font-black text-white">
                  คนที่ค้นหาเจอ
                </div>
              </div>
              <div className="rounded-full border border-cyan-300/16 bg-cyan-400/10 px-3 py-1.5 text-xs font-black text-cyan-100">
                {results.length} คน
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {loadingResults ? (
                <div className="rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-white/52">
                  กำลังค้นหา...
                </div>
              ) : results.length === 0 ? (
                <div className="rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-white/52">
                  ไม่พบผู้ใช้ที่ค้นหา
                </div>
              ) : (
                results.map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-col gap-4 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 transition hover:border-white/14 hover:bg-white/[0.045] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <Link href={`/profile/${user.id}`} className="flex min-w-0 items-center gap-4">
                      <img
                        src={user.image || "/avatar.png"}
                        alt={user.displayName}
                        className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/10"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-base font-black text-white">
                          {user.displayName}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-white/54">
                          {user.username ? <span>@{user.username}</span> : null}
                          {user.bio ? <span className="line-clamp-1">{user.bio}</span> : null}
                        </div>
                      </div>
                    </Link>

                    <div className="flex flex-wrap items-center gap-2">
                      {user.relation === "friends" ? (
                        <div className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[16px] border border-violet-300/22 bg-violet-400/10 px-4 text-sm font-black text-violet-100">
                          <Users className="h-4 w-4" />
                          เป็นเพื่อนแล้ว
                        </div>
                      ) : user.relation === "outgoing" ? (
                        <div className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[16px] border border-amber-300/22 bg-amber-300/10 px-4 text-sm font-black text-amber-100">
                          ส่งคำขอแล้ว
                        </div>
                      ) : user.relation === "incoming" && user.requestId ? (
                        <>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() =>
                              submitAction(
                                { action: "respond", requestId: user.requestId, decision: "accept" },
                                () => applyRelation(user.id, "friends")
                              )
                            }
                            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[16px] border border-emerald-300/24 bg-emerald-400/12 px-4 text-sm font-black text-emerald-100 transition hover:bg-emerald-400/18"
                          >
                            <Check className="h-4 w-4" />
                            รับ
                          </button>
                          <button
                            type="button"
                            disabled={isPending}
                            onClick={() =>
                              submitAction(
                                { action: "respond", requestId: user.requestId, decision: "reject" },
                                () => applyRelation(user.id, "none", null)
                              )
                            }
                            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[16px] border border-red-300/18 bg-red-500/10 px-4 text-sm font-black text-red-200 transition hover:bg-red-500/16"
                          >
                            <X className="h-4 w-4" />
                            ปฏิเสธ
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() =>
                            submitAction(
                              { action: "request", targetUserId: user.id },
                              (data) =>
                                applyRelation(
                                  user.id,
                                  "outgoing",
                                  String((data?.relation as { requestId?: string } | undefined)?.requestId || "")
                                )
                            )
                          }
                          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[16px] border border-cyan-300/24 bg-cyan-400/10 px-4 text-sm font-black text-cyan-100 shadow-[0_14px_30px_rgba(34,211,238,0.08)] transition hover:bg-cyan-400/18"
                        >
                          <UserPlus className="h-4 w-4" />
                          เพิ่มเพื่อน
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,18,28,0.92)_0%,rgba(9,10,16,0.86)_100%)] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:rounded-[34px] sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/38">
                  Friend List
                </div>
                <div className="mt-1 text-2xl font-black text-white">
                  รายชื่อเพื่อน
                </div>
              </div>
              <div className="rounded-full border border-amber-300/16 bg-amber-300/10 px-3 py-1.5 text-xs font-black text-amber-100">
                เก่าสุด → ใหม่สุด
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {loadingFriends ? (
                <div className="rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-white/52">
                  กำลังโหลดรายชื่อเพื่อน...
                </div>
              ) : friends.length === 0 ? (
                <div className="rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-6 text-sm text-white/52">
                  ยังไม่มีเพื่อนในระบบ ลองค้นหาแล้วกดเพิ่มเพื่อนได้เลย
                </div>
              ) : (
                friends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-white/[0.03] p-3"
                  >
                    <Link href={`/profile/${friend.friendId}`} className="flex min-w-0 flex-1 items-center gap-3">
                      <img
                        src={friend.image || "/avatar.png"}
                        alt={friend.displayName}
                        className="h-12 w-12 rounded-2xl object-cover ring-1 ring-white/10"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-white sm:text-base">
                          {friend.displayName}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/50 sm:text-sm">
                          {friend.username ? <span>@{friend.username}</span> : null}
                          {friend.bio ? <span className="line-clamp-1">{friend.bio}</span> : null}
                        </div>
                      </div>
                    </Link>

                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() =>
                        submitAction({ action: "remove", targetUserId: friend.friendId }, () => {
                          setFriends((prev) => prev.filter((item) => item.friendId !== friend.friendId));
                          applyRelation(friend.friendId, "none", null);
                        })
                      }
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-red-300/16 bg-red-500/10 text-red-200 transition hover:bg-red-500/16"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
