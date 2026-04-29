"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Search, Trash2, UserPlus, Users, X } from "lucide-react";
import PrefetchLink from "@/components/PrefetchLink";
import {
  readClientViewCache,
  writeClientViewCache,
} from "@/lib/client-view-cache";
import { listenProfileSync, type ProfileSyncDetail } from "@/lib/profile-sync";
import { trackUiFetch } from "@/lib/ui-activity";

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

type CommunityCache = {
  friends: FriendItem[];
  requests: IncomingRequest[];
  results: SearchUser[];
  friendsLoadedAt?: number;
  resultsLoadedAt?: number;
};

type CommunitySnapshot = {
  friends: FriendItem[];
  requests: IncomingRequest[];
  results: SearchUser[];
};

const relationRank: Record<SearchUser["relation"], number> = {
  none: 0,
  outgoing: 1,
  incoming: 2,
  friends: 3,
  self: 4,
};

function dedupeBy<T>(items: T[], getKey: (item: T) => string) {
  const next = new Map<string, T>();

  items.forEach((item) => {
    const key = getKey(item);
    if (!key || next.has(key)) return;
    next.set(key, item);
  });

  return Array.from(next.values());
}

function normalizeFriends(items: FriendItem[]) {
  return dedupeBy(items, (item) => String(item.friendId || item.id || "").trim());
}

function normalizeRequests(items: IncomingRequest[]) {
  return dedupeBy(items, (item) => String(item.fromUserId || item.id || "").trim());
}

function normalizeResults(items: SearchUser[]) {
  const next = new Map<string, SearchUser>();

  items.forEach((item) => {
    const id = String(item.id || "").trim();
    if (!id) return;

    const current = next.get(id);
    if (!current) {
      next.set(id, item);
      return;
    }

    const relation =
      relationRank[item.relation] >= relationRank[current.relation]
        ? item.relation
        : current.relation;

    next.set(id, {
      ...current,
      ...item,
      relation,
      requestId: item.requestId || current.requestId || null,
    });
  });

  return Array.from(next.values());
}

function patchProfileItem<T extends { displayName: string; image: string; username?: string | null; bio?: string }>(
  item: T,
  detail: ProfileSyncDetail
) {
  return {
    ...item,
    displayName: detail.name?.trim() || item.displayName,
    username: detail.username ?? item.username ?? null,
    image: detail.image || item.image,
    bio: detail.bio ?? item.bio ?? "",
  };
}

export default function CommunityClient({
  initialFriends = [],
  initialRequests = [],
  hasInitialCommunityState = false,
}: {
  initialFriends?: FriendItem[];
  initialRequests?: IncomingRequest[];
  hasInitialCommunityState?: boolean;
}) {
  const cachedCommunityState = useMemo(
    () =>
      readClientViewCache<CommunityCache>("community-hub", {
        maxAgeMs: 180000,
      }),
    []
  );
  const cachedFriends = Array.isArray(cachedCommunityState?.data?.friends)
    ? normalizeFriends(cachedCommunityState.data.friends)
    : [];
  const cachedRequests = Array.isArray(cachedCommunityState?.data?.requests)
    ? normalizeRequests(cachedCommunityState.data.requests)
    : [];
  const cachedResults = Array.isArray(cachedCommunityState?.data?.results)
    ? normalizeResults(cachedCommunityState.data.results)
    : [];
  const cachedHasFriendsSnapshot = Boolean(
    cachedCommunityState?.data &&
      (typeof cachedCommunityState.data.friendsLoadedAt === "number" ||
        cachedFriends.length > 0 ||
        cachedRequests.length > 0)
  );
  const cachedHasResultsSnapshot = Boolean(
    cachedCommunityState?.data &&
      (typeof cachedCommunityState.data.resultsLoadedAt === "number" ||
        cachedResults.length > 0)
  );
  const hasReadyFriendsSnapshot =
    hasInitialCommunityState ||
    initialFriends.length > 0 ||
    initialRequests.length > 0 ||
    cachedHasFriendsSnapshot;
  const didBootstrapSuggestionsRef = useRef(
    cachedHasResultsSnapshot || cachedResults.length > 0
  );
  const previousQueryRef = useRef("");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>(cachedResults);
  const [friends, setFriends] = useState<FriendItem[]>(
    hasInitialCommunityState ? normalizeFriends(initialFriends) : cachedFriends
  );
  const [requests, setRequests] = useState<IncomingRequest[]>(
    hasInitialCommunityState ? normalizeRequests(initialRequests) : cachedRequests
  );
  const [loadingResults, setLoadingResults] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(!hasReadyFriendsSnapshot);
  const [friendsHydrated, setFriendsHydrated] = useState(
    hasReadyFriendsSnapshot
  );
  const [resultsHydrated, setResultsHydrated] = useState(
    cachedHasResultsSnapshot || cachedResults.length > 0
  );
  const [bootstrappingSuggestions, setBootstrappingSuggestions] = useState(
    !(cachedHasResultsSnapshot || cachedResults.length > 0)
  );
  const [error, setError] = useState("");
  const [pendingActions, setPendingActions] = useState<Record<string, boolean>>(
    {}
  );

  const loadFriends = async (silent = false) => {
    if (!silent) {
      setLoadingFriends(true);
    }

    try {
      const res = await (silent ? fetch : trackUiFetch)("/api/community/friends", {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      setFriends(
        Array.isArray(data?.friends) ? normalizeFriends(data.friends) : []
      );
      setRequests(
        Array.isArray(data?.requests) ? normalizeRequests(data.requests) : []
      );
      setFriendsHydrated(true);
    } catch {
      return;
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
      const res = await (silent ? fetch : trackUiFetch)(
        `/api/community/search?q=${encodeURIComponent(term)}`,
        {
          cache: "no-store",
        }
      );
      const data = await res.json().catch(() => ({}));
      setResults(Array.isArray(data?.users) ? normalizeResults(data.users) : []);
      setResultsHydrated(true);
    } catch {
      return;
    } finally {
      if (!silent) {
        setLoadingResults(false);
      }
    }
  };

  useEffect(() => {
    queueMicrotask(() => {
      void loadFriends(hasReadyFriendsSnapshot);
    });
  }, [hasReadyFriendsSnapshot]);

  useEffect(() => {
    if (
      !friendsHydrated ||
      didBootstrapSuggestionsRef.current ||
      query.trim()
    ) {
      return;
    }

    const bootstrapSuggestions = window.setTimeout(() => {
      didBootstrapSuggestionsRef.current = true;
      void (async () => {
        await runSearch("", true);
        setBootstrappingSuggestions(false);
      })();
    }, hasReadyFriendsSnapshot ? 220 : 520);

    return () => {
      window.clearTimeout(bootstrapSuggestions);
    };
  }, [friendsHydrated, hasReadyFriendsSnapshot, query]);

  useEffect(() => {
    if (
      initialFriends.length > 0 ||
      initialRequests.length > 0 ||
      results.length > 0 ||
      friendsHydrated
    ) {
      return;
    }

    const cached = readClientViewCache<CommunityCache>("community-hub", {
      maxAgeMs: 180000,
    });

    if (!cached?.data) {
      return;
    }

    queueMicrotask(() => {
      if (Array.isArray(cached.data.friends)) {
        setFriends(normalizeFriends(cached.data.friends));
      }

      if (Array.isArray(cached.data.requests)) {
        setRequests(normalizeRequests(cached.data.requests));
      }

      if (Array.isArray(cached.data.results) && cached.data.results.length > 0) {
        setResults(normalizeResults(cached.data.results));
        setBootstrappingSuggestions(false);
        setResultsHydrated(true);
      }

      if (typeof cached.data.friendsLoadedAt === "number") {
        setFriendsHydrated(true);
      }

      setLoadingFriends(false);
    });
  }, [
    friendsHydrated,
    initialFriends.length,
    initialRequests.length,
    results.length,
  ]);

  useEffect(() => {
    if (
      !friendsHydrated &&
      !resultsHydrated &&
      friends.length === 0 &&
      requests.length === 0 &&
      results.length === 0
    ) {
      return;
    }

    writeClientViewCache("community-hub", {
      friends,
      requests,
      results,
      friendsLoadedAt: friendsHydrated
        ? Date.now()
        : cachedCommunityState?.data?.friendsLoadedAt,
      resultsLoadedAt: resultsHydrated
        ? Date.now()
        : cachedCommunityState?.data?.resultsLoadedAt,
    } satisfies CommunityCache);
  }, [
    cachedCommunityState?.data?.friendsLoadedAt,
    cachedCommunityState?.data?.resultsLoadedAt,
    friends,
    friendsHydrated,
    requests,
    results,
    resultsHydrated,
  ]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void loadFriends(true);
        if (query.trim() || resultsHydrated) {
          void runSearch(query, true);
        }
      }
    }, 5000);

    const onFocus = () => {
      void loadFriends(true);
      if (query.trim() || resultsHydrated) {
        void runSearch(query, true);
      }
    };

    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [query, resultsHydrated]);

  useEffect(() => {
    return listenProfileSync((detail) => {
      const userId = String(detail.userId || "").trim();

      if (userId) {
        setFriends((prev) =>
          normalizeFriends(
            prev.map((friend) =>
              friend.friendId === userId ? patchProfileItem(friend, detail) : friend
            )
          )
        );
        setRequests((prev) =>
          normalizeRequests(
            prev.map((request) =>
              request.fromUserId === userId ? patchProfileItem(request, detail) : request
            )
          )
        );
        setResults((prev) =>
          normalizeResults(
            prev.map((user) =>
              user.id === userId ? patchProfileItem(user, detail) : user
            )
          )
        );
      }

      void loadFriends(true);
      if (query.trim() || resultsHydrated) {
        void runSearch(query, true);
      }
    });
  }, [query, resultsHydrated]);

  useEffect(() => {
    const cleanQuery = query.trim();
    const previousQuery = previousQueryRef.current.trim();
    previousQueryRef.current = query;

    if (!cleanQuery) {
      if (previousQuery) {
        const debounceId = window.setTimeout(() => {
          void runSearch("", true);
        }, 220);

        return () => {
          window.clearTimeout(debounceId);
        };
      }

      return;
    }

    if (cleanQuery) {
      queueMicrotask(() => setBootstrappingSuggestions(false));
    }

    const debounceId = window.setTimeout(() => {
      void runSearch(cleanQuery, true);
    }, 120);

    return () => {
      window.clearTimeout(debounceId);
    };
  }, [query]);

  useEffect(() => {
    [...friends, ...requests].forEach((item) => {
      const profileId = "friendId" in item ? item.friendId : item.fromUserId;
      router.prefetch(`/profile/${profileId}`);
    });
  }, [friends, requests, router]);

  useEffect(() => {
    results
      .filter((user) => user.relation !== "self")
      .slice(0, 12)
      .forEach((user) => {
        router.prefetch(`/profile/${user.id}`);
      });
  }, [results, router]);

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

  const createSnapshot = (): CommunitySnapshot => ({
    friends,
    requests,
    results,
  });

  const restoreSnapshot = (snapshot: CommunitySnapshot) => {
    setFriends(snapshot.friends);
    setRequests(snapshot.requests);
    setResults(snapshot.results);
  };

  const setPendingAction = (actionKey: string, active: boolean) => {
    setPendingActions((prev) => {
      const next = { ...prev };

      if (active) {
        next[actionKey] = true;
      } else {
        delete next[actionKey];
      }

      return next;
    });
  };

  const isActionPending = (actionKey: string) => Boolean(pendingActions[actionKey]);

  const submitAction = ({
    actionKey,
    payload,
    optimisticUpdate,
    onDone,
  }: {
    actionKey: string;
    payload: Record<string, unknown>;
    optimisticUpdate?: () => void;
    onDone?: (data: Record<string, unknown>) => void;
  }) => {
    const snapshot = createSnapshot();

    optimisticUpdate?.();
    setPendingAction(actionKey, true);

    void (async () => {
      try {
        setError("");
        const res = await trackUiFetch("/api/community/friends", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          restoreSnapshot(snapshot);
          setError(String(data?.error || "ดำเนินการไม่สำเร็จ"));
          return;
        }
        onDone?.(data as Record<string, unknown>);
        void loadFriends(true);
        void runSearch(query, true);
      } catch {
        restoreSnapshot(snapshot);
        setError("ดำเนินการไม่สำเร็จ");
      } finally {
        setPendingAction(actionKey, false);
      }
    })();
  };

  const friendIdSet = useMemo(
    () => new Set(friends.map((friend) => friend.friendId)),
    [friends]
  );
  const visibleResults = useMemo(() => {
    const hasQuery = Boolean(query.trim());

    return normalizeResults(results).filter((user) => {
      if (user.relation === "self") return false;
      if (hasQuery) return true;
      return user.relation !== "friends" && !friendIdSet.has(user.id);
    });
  }, [friendIdSet, query, results]);
  const suggestionCount = Math.max(visibleResults.length - friends.length, 0);

  return (
    <div className="min-h-full overflow-hidden bg-[#f4f0f7] text-[#08080a]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(255,255,255,0.92),transparent_26%),radial-gradient(circle_at_78%_0%,rgba(255,217,102,0.22),transparent_22%),linear-gradient(180deg,#f8f5fb_0%,#e7e8f7_100%)]" />
      <div className="relative mx-auto max-w-7xl px-0 py-0 sm:px-6 sm:py-5 lg:px-8">
        <section className="relative overflow-hidden rounded-[26px] bg-[#f8f7fb] px-3 pb-5 pt-4 shadow-[0_28px_90px_rgba(60,50,80,0.16)] ring-1 ring-black/5 sm:rounded-[48px] sm:px-7 sm:pb-7 sm:pt-5 lg:px-10">
          <div className="pointer-events-none absolute -right-24 top-8 h-72 w-72 rounded-full bg-white/80 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-10 h-72 w-72 rounded-full bg-[#d9def8] blur-3xl" />

          <header className="relative flex items-center justify-between gap-3">
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

            <div className="rounded-full bg-white px-4 py-2.5 text-center text-sm font-black shadow-[0_16px_34px_rgba(20,20,30,0.1)] ring-1 ring-black/5 sm:px-5 sm:py-3 sm:text-base">
              {friends.length} Friends
            </div>
          </header>

          <div className="relative mt-7 text-center sm:mt-9">
            <div className="text-[11px] font-black uppercase tracking-[0.28em] text-black/35 sm:text-[13px] sm:tracking-[0.38em]">
              Find Friends
            </div>
            <h1 className="mt-2 text-4xl font-black tracking-[-0.08em] text-black sm:text-6xl lg:text-7xl">
              Community
            </h1>
          </div>

          <div className="relative mt-8 grid gap-4 lg:grid-cols-[0.92fr_1.08fr] lg:items-start">
            <section className="rounded-[34px] bg-white p-4 shadow-[0_24px_54px_rgba(20,20,30,0.1)] sm:p-5 lg:rounded-[42px]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-black/40">Your Circle</div>
                  <div className="mt-1 text-3xl font-black tracking-[-0.05em]">รายชื่อเพื่อน</div>
                </div>
                <div className="shrink-0 rounded-full bg-[#eef0fb] px-3 py-2 text-xs font-black sm:px-4 sm:text-sm">
                  เก่า ไป ใหม่
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
                      <PrefetchLink
                        href={`/profile/${friend.friendId}`}
                        className="flex min-w-0 flex-1 items-center gap-3"
                      >
                        <img
                          src={friend.image || "/avatar.png"}
                          alt={friend.displayName}
                          className="h-14 w-14 rounded-full object-cover shadow-md ring-4 ring-white"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-base font-black">{friend.displayName}</div>
                          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-xs font-bold text-black/42 sm:text-sm">
                            {friend.username ? <span>@{friend.username}</span> : null}
                            {friend.bio ? <span className="line-clamp-1">{friend.bio}</span> : null}
                          </div>
                        </div>
                      </PrefetchLink>

                      {(() => {
                        const actionKey = `remove:${friend.friendId}`;

                        return (
                          <button
                            type="button"
                            disabled={isActionPending(actionKey)}
                            onClick={() =>
                              submitAction({
                                actionKey,
                                payload: {
                                  action: "remove",
                                  targetUserId: friend.friendId,
                                },
                                optimisticUpdate: () => {
                                  setFriends((prev) =>
                                    prev.filter(
                                      (item) => item.friendId !== friend.friendId
                                    )
                                  );
                                  applyRelation(friend.friendId, "none", null);
                                },
                              })
                            }
                            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-red-500 shadow-sm ring-1 ring-black/5 transition hover:scale-[1.04] hover:bg-red-50 disabled:opacity-60"
                            aria-label="Remove friend"
                          >
                            {isActionPending(actionKey) ? (
                              <LoaderCircle className="h-5 w-5 animate-spin" />
                            ) : (
                              <Trash2 className="h-5 w-5" />
                            )}
                          </button>
                        );
                      })()}
                    </div>
                  ))
                )}
              </div>
            </section>

            <div className="space-y-4">
              <section className="rounded-[34px] bg-white p-4 shadow-[0_24px_54px_rgba(20,20,30,0.1)] sm:p-5 lg:rounded-[42px]">
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  <div className="rounded-[22px] bg-[#f5c542] p-3 sm:rounded-[28px] sm:p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.12em] text-black/45 sm:text-xs sm:tracking-[0.18em]">
                      Friends
                    </div>
                    <div className="mt-2 text-2xl font-black tracking-[-0.08em] sm:text-4xl">{friends.length}</div>
                  </div>
                  <div className="rounded-[22px] bg-[#e9eaf5] p-3 sm:rounded-[28px] sm:p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.12em] text-black/45 sm:text-xs sm:tracking-[0.18em]">
                      Requests
                    </div>
                    <div className="mt-2 text-2xl font-black tracking-[-0.08em] sm:text-4xl">{requests.length}</div>
                  </div>
                  <div className="rounded-[22px] bg-black p-3 text-white sm:rounded-[28px] sm:p-4">
                    <div className="text-[10px] font-black uppercase tracking-[0.12em] text-white/45 sm:text-xs sm:tracking-[0.18em]">
                      Suggestions
                    </div>
                    <div className="mt-2 text-2xl font-black tracking-[-0.08em] sm:text-4xl">{suggestionCount}</div>
                  </div>
                </div>

                <form
                  onSubmit={handleSearch}
                  className="mt-5 flex min-h-[64px] items-center gap-2 rounded-full bg-black p-2 pl-4 text-white shadow-[0_18px_44px_rgba(0,0,0,0.22)] sm:min-h-[74px] sm:gap-3 sm:pl-5"
                >
                  <Search className="h-5 w-5 shrink-0 text-white/70" />
                  <input
                    id="community-search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="ค้นหาชื่อหรือ username"
                    className="min-w-0 flex-1 bg-transparent text-base font-bold outline-none placeholder:text-white/45"
                  />
                  <button
                    type="submit"
                    disabled={loadingResults}
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white text-black transition hover:scale-[1.04] disabled:opacity-60 sm:h-14 sm:w-14"
                    aria-label="Search friends"
                  >
                    {loadingResults ? (
                      <LoaderCircle className="h-5 w-5 animate-spin" />
                    ) : (
                      <Search className="h-5 w-5" />
                    )}
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
                      <div className="mt-1 text-3xl font-black tracking-[-0.05em]">คำขอเป็นเพื่อน</div>
                    </div>
                    <div className="grid h-11 w-11 place-items-center rounded-full bg-[#ff4b55] text-sm font-black text-white">
                      {requests.length}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    {requests.map((request) => (
                      <div key={request.id} className="rounded-[30px] bg-[#f4f3f8] p-3">
                        <PrefetchLink
                          href={`/profile/${request.fromUserId}`}
                          className="flex min-w-0 items-center gap-3"
                        >
                          <img
                            src={request.image || "/avatar.png"}
                            alt={request.displayName}
                            className="h-14 w-14 rounded-full object-cover shadow-md ring-4 ring-white"
                          />
                          <div className="min-w-0">
                            <div className="truncate text-base font-black">{request.displayName}</div>
                            <div className="mt-1 text-sm font-bold text-black/42">
                              {request.username ? `@${request.username}` : "NEXORA User"}
                            </div>
                          </div>
                        </PrefetchLink>

                        <div className="mt-3 grid grid-cols-2 gap-2">
                          {(() => {
                            const acceptActionKey = `respond:${request.id}:accept`;
                            const rejectActionKey = `respond:${request.id}:reject`;
                            const optimisticFriend: FriendItem = {
                              id: `accepted-${request.id}`,
                              friendId: request.fromUserId,
                              createdAt: new Date().toISOString(),
                              displayName: request.displayName,
                              username: request.username,
                              image: request.image,
                              bio: request.bio,
                            };

                            return (
                              <>
                                <button
                                  type="button"
                                  disabled={isActionPending(acceptActionKey)}
                                  onClick={() =>
                                    submitAction({
                                      actionKey: acceptActionKey,
                                      payload: {
                                        action: "respond",
                                        requestId: request.id,
                                        decision: "accept",
                                      },
                                      optimisticUpdate: () => {
                                        setRequests((prev) =>
                                          prev.filter((item) => item.id !== request.id)
                                        );
                                        setFriends((prev) =>
                                          prev.some(
                                            (item) =>
                                              item.friendId === request.fromUserId
                                          )
                                            ? prev
                                            : [optimisticFriend, ...prev]
                                        );
                                        applyRelation(
                                          request.fromUserId,
                                          "friends",
                                          null
                                        );
                                      },
                                    })
                                  }
                                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full bg-black px-4 text-sm font-black text-white transition hover:scale-[1.02] disabled:opacity-60"
                                >
                                  {isActionPending(acceptActionKey) ? (
                                    <LoaderCircle className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Check className="h-4 w-4" />
                                  )}
                                  {isActionPending(acceptActionKey)
                                    ? "กำลังรับ..."
                                    : "รับ"}
                                </button>
                                <button
                                  type="button"
                                  disabled={isActionPending(rejectActionKey)}
                                  onClick={() =>
                                    submitAction({
                                      actionKey: rejectActionKey,
                                      payload: {
                                        action: "respond",
                                        requestId: request.id,
                                        decision: "reject",
                                      },
                                      optimisticUpdate: () => {
                                        setRequests((prev) =>
                                          prev.filter((item) => item.id !== request.id)
                                        );
                                        applyRelation(
                                          request.fromUserId,
                                          "none",
                                          null
                                        );
                                      },
                                    })
                                  }
                                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-black text-red-500 ring-1 ring-black/5 transition hover:scale-[1.02] disabled:opacity-60"
                                >
                                  {isActionPending(rejectActionKey) ? (
                                    <LoaderCircle className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <X className="h-4 w-4" />
                                  )}
                                  {isActionPending(rejectActionKey)
                                    ? "กำลังปฏิเสธ..."
                                    : "ปฏิเสธ"}
                                </button>
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </div>

          <section className="relative mt-4 overflow-hidden rounded-[26px] bg-white p-3 shadow-[0_24px_54px_rgba(20,20,30,0.1)] sm:rounded-[34px] sm:p-5 lg:rounded-[42px]">
            <div className="absolute left-1/2 top-0 h-12 w-28 -translate-x-1/2 rounded-b-[36px] bg-[#e9eaf5]" />
            <div className="relative flex items-center justify-between gap-2 pt-2">
              <div className="min-w-0">
                <div className="text-sm font-bold text-black/40">Search Results</div>
                <div className="mt-1 truncate text-2xl font-black tracking-[-0.05em] sm:text-3xl">
                  คนที่ค้นหาเจอ
                </div>
              </div>
              <div className="shrink-0 rounded-full bg-[#eef0fb] px-3 py-2 text-xs font-black sm:px-4 sm:text-sm">
                {visibleResults.length} คน
              </div>
            </div>

            <div className="relative mt-6 grid gap-3 lg:grid-cols-2">
              {loadingResults || bootstrappingSuggestions ? (
                <div className="rounded-[30px] bg-[#f4f3f8] px-5 py-8 text-sm font-bold text-black/45 lg:col-span-2">
                  กำลังโหลดคำแนะนำ...
                </div>
              ) : visibleResults.length === 0 ? (
                <div className="rounded-[30px] bg-[#f4f3f8] px-5 py-8 text-sm font-bold text-black/45 lg:col-span-2">
                  ไม่พบผู้ใช้ที่ค้นหา
                </div>
              ) : (
                visibleResults.map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-col gap-4 rounded-[30px] bg-[#f4f3f8] p-3 transition hover:-translate-y-0.5 hover:bg-[#eeedf5] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <PrefetchLink href={`/profile/${user.id}`} className="flex min-w-0 items-center gap-3">
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
                    </PrefetchLink>

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
                          {(() => {
                            const acceptActionKey = `respond:${user.requestId}:accept`;
                            const rejectActionKey = `respond:${user.requestId}:reject`;
                            const optimisticFriend: FriendItem = {
                              id: `accepted-${user.requestId}`,
                              friendId: user.id,
                              createdAt: new Date().toISOString(),
                              displayName: user.displayName,
                              username: user.username,
                              image: user.image,
                              bio: user.bio,
                            };

                            return (
                              <>
                                <button
                                  type="button"
                                  disabled={isActionPending(acceptActionKey)}
                                  onClick={() =>
                                    submitAction({
                                      actionKey: acceptActionKey,
                                      payload: {
                                        action: "respond",
                                        requestId: user.requestId,
                                        decision: "accept",
                                      },
                                      optimisticUpdate: () => {
                                        setRequests((prev) =>
                                          prev.filter(
                                            (item) => item.id !== user.requestId
                                          )
                                        );
                                        setFriends((prev) =>
                                          prev.some((item) => item.friendId === user.id)
                                            ? prev
                                            : [optimisticFriend, ...prev]
                                        );
                                        applyRelation(user.id, "friends");
                                      },
                                    })
                                  }
                                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full bg-black px-5 text-sm font-black text-white transition hover:scale-[1.02] disabled:opacity-60"
                                >
                                  {isActionPending(acceptActionKey) ? (
                                    <LoaderCircle className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Check className="h-4 w-4" />
                                  )}
                                  {isActionPending(acceptActionKey)
                                    ? "กำลังรับ..."
                                    : "รับ"}
                                </button>
                                <button
                                  type="button"
                                  disabled={isActionPending(rejectActionKey)}
                                  onClick={() =>
                                    submitAction({
                                      actionKey: rejectActionKey,
                                      payload: {
                                        action: "respond",
                                        requestId: user.requestId,
                                        decision: "reject",
                                      },
                                      optimisticUpdate: () => {
                                        setRequests((prev) =>
                                          prev.filter(
                                            (item) => item.id !== user.requestId
                                          )
                                        );
                                        applyRelation(user.id, "none", null);
                                      },
                                    })
                                  }
                                  className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-black text-red-500 ring-1 ring-black/5 transition hover:scale-[1.02] disabled:opacity-60"
                                >
                                  {isActionPending(rejectActionKey) ? (
                                    <LoaderCircle className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <X className="h-4 w-4" />
                                  )}
                                  {isActionPending(rejectActionKey)
                                    ? "กำลังปฏิเสธ..."
                                    : "ปฏิเสธ"}
                                </button>
                              </>
                            );
                          })()}
                        </>
                      ) : (
                        (() => {
                          const requestActionKey = `request:${user.id}`;

                          return (
                            <button
                              type="button"
                              disabled={isActionPending(requestActionKey)}
                              onClick={() =>
                                submitAction({
                                  actionKey: requestActionKey,
                                  payload: {
                                    action: "request",
                                    targetUserId: user.id,
                                  },
                                  optimisticUpdate: () =>
                                    applyRelation(user.id, "outgoing", null),
                                  onDone: (data) =>
                                    applyRelation(
                                      user.id,
                                      "outgoing",
                                      String(
                                        (data?.relation as
                                          | { requestId?: string }
                                          | undefined)?.requestId || ""
                                      )
                                    ),
                                })
                              }
                              className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-full bg-black px-5 text-sm font-black text-white shadow-[0_16px_34px_rgba(0,0,0,0.16)] transition hover:scale-[1.02] disabled:opacity-60"
                            >
                              {isActionPending(requestActionKey) ? (
                                <LoaderCircle className="h-4 w-4 animate-spin" />
                              ) : (
                                <UserPlus className="h-4 w-4" />
                              )}
                              {isActionPending(requestActionKey)
                                ? "กำลังส่ง..."
                                : "เพิ่มเพื่อน"}
                            </button>
                          );
                        })()
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
