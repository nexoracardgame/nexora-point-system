"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState, useTransition } from "react";
import { Check, Search, Trash2, UserPlus, Users, X } from "lucide-react";

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

  const loadFriends = async (silent = false) => {
    if (!silent) {
      setLoadingFriends(true);
    }
    try {
      const res = await fetch("/api/community/friends", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      setFriends(Array.isArray(data?.friends) ? data.friends : []);
      setRequests(Array.isArray(data?.requests) ? data.requests : []);
    } catch {
      setFriends([]);
      setRequests([]);
    } finally {
      if (!silent) {
        setLoadingFriends(false);
      }
    }
  };

  const runSearch = async (term: string, silent = false) => {
    if (!silent) {
      setLoadingResults(true);
    }
    try {
      const res = await fetch(`/api/community/search?q=${encodeURIComponent(term)}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      setResults(Array.isArray(data?.users) ? data.users : []);
    } catch {
      setResults([]);
    } finally {
      if (!silent) {
        setLoadingResults(false);
      }
    }
  };

  useEffect(() => {
    void Promise.all([loadFriends(), runSearch("")]);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadFriends(true);
      }
    }, 1500);

    const onFocus = () => {
      void loadFriends(true);
      void runSearch(query, true);
    };

    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [query]);

  useEffect(() => {
    const debounceId = window.setTimeout(() => {
      void runSearch(query, true);
    }, 260);

    return () => window.clearTimeout(debounceId);
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
          void loadFriends(true);
          void runSearch(query, true);
        } catch {
          setError("ดำเนินการไม่สำเร็จ");
        }
      })();
    });
  };

  const suggestionCount = Math.max(results.length - friends.length, 0);

  return (
    <div className="min-h-full overflow-hidden bg-[#f4f0f7] text-[#08080a]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(255,255,255,0.92),transparent_26%),radial-gradient(circle_at_78%_0%,rgba(255,217,102,0.22),transparent_22%),linear-gradient(180deg,#f8f5fb_0%,#e7e8f7_100%)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[38px] bg-[#f8f7fb] px-4 pb-7 pt-5 shadow-[0_28px_90px_rgba(60,50,80,0.16)] ring-1 ring-black/5 sm:rounded-[48px] sm:px-7 lg:px-10">
          <div className="pointer-events-none absolute -right-24 top-8 h-72 w-72 rounded-full bg-white/80 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-10 h-72 w-72 rounded-full bg-[#d9def8] blur-3xl" />

          <header className="relative flex items-center justify-between gap-4">
            <div className="relative flex items-center gap-3">
              <div className="relative">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-white shadow-[0_18px_36px_rgba(20,20,30,0.12)] ring-1 ring-black/5">
                  <Users className="h-7 w-7 text-black" />
                </div>
                {requests.length > 0 ? (
                  <div className="absolute -right-2 -top-1 grid h-9 w-9 place-items-center rounded-full bg-[#ff4b55] text-sm font-black text-white shadow-[0_12px_24px_rgba(255,75,85,0.32)]">
                    {requests.length}
                  </div>
                ) : null}
              </div>
              <div className="hidden sm:block">
                <div className="text-xs font-black uppercase tracking-[0.32em] text-black/35">
                  Nexora Social
                </div>
                <div className="mt-1 text-xl font-black">Community Hub</div>
              </div>
            </div>

            <div className="rounded-full bg-white px-5 py-3 text-center text-sm font-black shadow-[0_16px_34px_rgba(20,20,30,0.1)] ring-1 ring-black/5 sm:text-base">
              {friends.length} Friends
            </div>

            <button
              type="button"
              onClick={() => {
                const el = document.getElementById("community-search");
                el?.focus();
              }}
              className="grid h-16 w-16 place-items-center rounded-full bg-black text-white shadow-[0_20px_40px_rgba(0,0,0,0.18)] transition hover:scale-[1.03]"
            >
              <Search className="h-7 w-7" />
            </button>
          </header>

          <div className="relative mt-9 text-center">
            <div className="text-[13px] font-black uppercase tracking-[0.38em] text-black/35">
              Find Friends
            </div>
            <h1 className="mt-2 text-5xl font-black tracking-[-0.08em] text-black sm:text-6xl lg:text-7xl">
              Community
            </h1>
          </div>

          <div className="relative mt-8 grid gap-4 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
            <section className="rounded-[34px] bg-white p-4 shadow-[0_24px_54px_rgba(20,20,30,0.1)] sm:p-5 lg:rounded-[42px]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-black/40">Your Circle</div>
                  <div className="mt-1 text-3xl font-black tracking-[-0.05em]">
                    รายชื่อเพื่อน
                  </div>
                </div>
                <div className="rounded-full bg-[#eef0fb] px-4 py-2 text-sm font-black">
                  เก่า → ใหม่
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {loadingFriends ? (
                  <div className="rounded-[28px] bg-[#f2f1f7] px-5 py-8 text-sm font-bold text-black/45">
                    กำลังโหลดรายชื่อเพื่อน...
                  </div>
                ) : friends.length === 0 ? (
                  <div className="rounded-[28px] bg-[#f2f1f7] px-5 py-8 text-sm font-bold leading-6 text-black/45">
                    ยังไม่มีเพื่อนในระบบ ลองค้นหาชื่อหรือ username แล้วกดเพิ่มเพื่อนได้เลย
                  </div>
                ) : (
                  friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center gap-3 rounded-[30px] bg-[#f4f3f8] p-3 transition hover:-translate-y-0.5 hover:bg-[#eeedf5]"
                    >
                      <Link
                        href={`/profile/${friend.friendId}`}
                        className="flex min-w-0 flex-1 items-center gap-3"
                      >
                        <img
                          src={friend.image || "/avatar.png"}
                          alt={friend.displayName}
                          className="h-14 w-14 rounded-full object-cover shadow-md ring-4 ring-white"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-base font-black">
                            {friend.displayName}
                          </div>
                          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-xs font-bold text-black/42 sm:text-sm">
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
                            setFriends((prev) =>
                              prev.filter((item) => item.friendId !== friend.friendId)
                            );
                            applyRelation(friend.friendId, "none", null);
                          })
                        }
                        className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-red-500 shadow-sm ring-1 ring-black/5 transition hover:scale-[1.04] hover:bg-red-50 disabled:opacity-60"
                        aria-label="Remove friend"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>

            <div className="space-y-4">
              <section className="rounded-[34px] bg-white p-4 shadow-[0_24px_54px_rgba(20,20,30,0.1)] sm:p-5 lg:rounded-[42px]">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[28px] bg-[#f5c542] p-4">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-black/45">
                      Friends
                    </div>
                    <div className="mt-2 text-4xl font-black tracking-[-0.08em]">
                      {friends.length}
                    </div>
                  </div>
                  <div className="rounded-[28px] bg-[#e9eaf5] p-4">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-black/45">
                      Requests
                    </div>
                    <div className="mt-2 text-4xl font-black tracking-[-0.08em]">
                      {requests.length}
                    </div>
                  </div>
                  <div className="rounded-[28px] bg-black p-4 text-white">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-white/45">
                      Suggestions
                    </div>
                    <div className="mt-2 text-4xl font-black tracking-[-0.08em]">
                      {suggestionCount}
                    </div>
                  </div>
                </div>

                <form
                  onSubmit={handleSearch}
                  className="mt-5 flex min-h-[74px] items-center gap-3 rounded-full bg-black p-2 pl-5 text-white shadow-[0_18px_44px_rgba(0,0,0,0.22)]"
                >
                  <Search className="h-5 w-5 shrink-0 text-white/70" />
                  <input
                    id="community-search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="ค้นหาชื่อ หรือ username"
                    className="min-w-0 flex-1 bg-transparent text-base font-bold outline-none placeholder:text-white/45"
                  />
                  <button
                    type="submit"
                    disabled={isPending}
                    className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white text-black transition hover:scale-[1.04] disabled:opacity-60"
                    aria-label="Search friends"
                  >
                    <Search className="h-5 w-5" />
                  </button>
                </form>
              </section>

              {error ? (
                <div className="rounded-[28px] bg-red-50 px-5 py-4 text-sm font-black text-red-600 ring-1 ring-red-100">
                  {error}
                </div>
              ) : null}

              {requests.length > 0 ? (
                <section className="rounded-[34px] bg-white p-4 shadow-[0_24px_54px_rgba(20,20,30,0.1)] sm:p-5 lg:rounded-[42px]">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-black/40">Pending</div>
                      <div className="mt-1 text-3xl font-black tracking-[-0.05em]">
                        คำขอเป็นเพื่อน
                      </div>
                    </div>
                    <div className="grid h-11 w-11 place-items-center rounded-full bg-[#ff4b55] text-sm font-black text-white">
                      {requests.length}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    {requests.map((request) => (
                      <div key={request.id} className="rounded-[30px] bg-[#f4f3f8] p-3">
                        <Link
                          href={`/profile/${request.fromUserId}`}
                          className="flex min-w-0 items-center gap-3"
                        >
                          <img
                            src={request.image || "/avatar.png"}
                            alt={request.displayName}
                            className="h-14 w-14 rounded-full object-cover shadow-md ring-4 ring-white"
                          />
                          <div className="min-w-0">
                            <div className="truncate text-base font-black">
                              {request.displayName}
                            </div>
                            <div className="mt-1 text-sm font-bold text-black/42">
                              {request.username ? `@${request.username}` : "NEXORA User"}
                            </div>
                          </div>
                        </Link>

                        <div className="mt-3 grid grid-cols-2 gap-2">
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
                            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full bg-black px-4 text-sm font-black text-white transition hover:scale-[1.02] disabled:opacity-60"
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
                            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-black text-red-500 ring-1 ring-black/5 transition hover:scale-[1.02] disabled:opacity-60"
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
            </div>
          </div>

          <section className="relative mt-4 overflow-hidden rounded-[34px] bg-white p-4 shadow-[0_24px_54px_rgba(20,20,30,0.1)] sm:p-5 lg:rounded-[42px]">
            <div className="absolute left-1/2 top-0 h-12 w-28 -translate-x-1/2 rounded-b-[36px] bg-[#e9eaf5]" />
            <div className="relative flex items-center justify-between gap-3 pt-2">
              <div>
                <div className="text-sm font-bold text-black/40">Search Results</div>
                <div className="mt-1 text-3xl font-black tracking-[-0.05em]">
                  คนที่ค้นหาเจอ
                </div>
              </div>
              <div className="rounded-full bg-[#eef0fb] px-4 py-2 text-sm font-black">
                {results.length} คน
              </div>
            </div>

            <div className="relative mt-6 grid gap-3 lg:grid-cols-2">
              {loadingResults ? (
                <div className="rounded-[30px] bg-[#f4f3f8] px-5 py-8 text-sm font-bold text-black/45 lg:col-span-2">
                  กำลังค้นหา...
                </div>
              ) : results.length === 0 ? (
                <div className="rounded-[30px] bg-[#f4f3f8] px-5 py-8 text-sm font-bold text-black/45 lg:col-span-2">
                  ไม่พบผู้ใช้ที่ค้นหา
                </div>
              ) : (
                results.map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-col gap-4 rounded-[30px] bg-[#f4f3f8] p-3 transition hover:-translate-y-0.5 hover:bg-[#eeedf5] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <Link href={`/profile/${user.id}`} className="flex min-w-0 items-center gap-3">
                      <img
                        src={user.image || "/avatar.png"}
                        alt={user.displayName}
                        className="h-14 w-14 rounded-full object-cover shadow-md ring-4 ring-white"
                      />
                      <div className="min-w-0">
                        <div className="truncate text-base font-black">{user.displayName}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-black/42 sm:text-sm">
                          {user.username ? <span>@{user.username}</span> : null}
                          {user.bio ? <span className="line-clamp-1">{user.bio}</span> : null}
                        </div>
                      </div>
                    </Link>

                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      {user.relation === "self" ? (
                        <div className="inline-flex min-h-[46px] items-center justify-center rounded-full bg-white px-5 text-sm font-black text-black/45 ring-1 ring-black/5">
                          โปรไฟล์ของคุณ
                        </div>
                      ) : user.relation === "friends" ? (
                        <div className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-black text-black ring-1 ring-black/5">
                          <Users className="h-4 w-4" />
                          เป็นเพื่อนแล้ว
                        </div>
                      ) : user.relation === "outgoing" ? (
                        <div className="inline-flex min-h-[46px] items-center justify-center rounded-full bg-[#fff1c6] px-5 text-sm font-black text-black">
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
                            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full bg-black px-5 text-sm font-black text-white transition hover:scale-[1.02] disabled:opacity-60"
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
                            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-black text-red-500 ring-1 ring-black/5 transition hover:scale-[1.02] disabled:opacity-60"
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
                                  String(
                                    (data?.relation as { requestId?: string } | undefined)
                                      ?.requestId || ""
                                  )
                                )
                            )
                          }
                          className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full bg-black px-5 text-sm font-black text-white shadow-[0_16px_34px_rgba(0,0,0,0.16)] transition hover:scale-[1.02] disabled:opacity-60"
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
        </section>
      </div>
    </div>
  );
}
