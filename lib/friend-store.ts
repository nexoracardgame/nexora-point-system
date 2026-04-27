import { prisma } from "@/lib/prisma";
import {
  ensureLocalStoreFile,
  readLocalStoreJson,
  writeLocalStoreJson,
} from "@/lib/local-store-dir";
import { getAllLocalProfiles, getLocalProfileByUserId } from "@/lib/local-profile-store";

export type FriendRequestStatus = "pending" | "accepted" | "rejected";

export type FriendRequestRecord = {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: FriendRequestStatus;
  createdAt: string;
  updatedAt: string;
};

export type FriendshipRecord = {
  id: string;
  userA: string;
  userB: string;
  createdAt: string;
};

async function readRequests() {
  await ensureLocalStoreFile("local-friend-requests.json");
  return readLocalStoreJson<FriendRequestRecord>("local-friend-requests.json");
}

async function writeRequests(items: FriendRequestRecord[]) {
  await writeLocalStoreJson(
    "local-friend-requests.json",
    JSON.stringify(items, null, 2)
  );
}

async function readFriendships() {
  await ensureLocalStoreFile("local-friendships.json");
  return readLocalStoreJson<FriendshipRecord>("local-friendships.json");
}

async function writeFriendships(items: FriendshipRecord[]) {
  await writeLocalStoreJson(
    "local-friendships.json",
    JSON.stringify(items, null, 2)
  );
}

function sortPair(a: string, b: string) {
  return [a, b].sort((x, y) => x.localeCompare(y)) as [string, string];
}

function friendshipKey(a: string, b: string) {
  const [left, right] = sortPair(a, b);
  return `${left}::${right}`;
}

export async function areFriends(userId: string, otherUserId: string) {
  const items = await readFriendships();
  const key = friendshipKey(userId, otherUserId);
  return items.some((item) => friendshipKey(item.userA, item.userB) === key);
}

export async function getFriendRelation(userId: string, otherUserId: string) {
  if (!userId || !otherUserId || userId === otherUserId) {
    return { status: "self" as const, requestId: null as string | null };
  }

  if (await areFriends(userId, otherUserId)) {
    return { status: "friends" as const, requestId: null as string | null };
  }

  const requests = await readRequests();
  const pending = requests
    .filter((item) => item.status === "pending")
    .filter(
      (item) =>
        (item.fromUserId === userId && item.toUserId === otherUserId) ||
        (item.fromUserId === otherUserId && item.toUserId === userId)
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  if (!pending) {
    return { status: "none" as const, requestId: null as string | null };
  }

  if (pending.fromUserId === userId) {
    return { status: "outgoing" as const, requestId: pending.id };
  }

  return { status: "incoming" as const, requestId: pending.id };
}

export async function createFriendRequestRecord(fromUserId: string, toUserId: string) {
  if (!fromUserId || !toUserId || fromUserId === toUserId) {
    throw new Error("ไม่สามารถส่งคำขอเพื่อนรายการนี้ได้");
  }

  if (await areFriends(fromUserId, toUserId)) {
    throw new Error("เป็นเพื่อนกันอยู่แล้ว");
  }

  const requests = await readRequests();
  const now = new Date().toISOString();

  const existingIncoming = requests.find(
    (item) =>
      item.status === "pending" &&
      item.fromUserId === toUserId &&
      item.toUserId === fromUserId
  );

  if (existingIncoming) {
    return existingIncoming;
  }

  const existingOutgoing = requests.find(
    (item) =>
      item.fromUserId === fromUserId &&
      item.toUserId === toUserId
  );

  if (existingOutgoing) {
    const next = requests.map((item) =>
      item.id === existingOutgoing.id
        ? { ...item, status: "pending" as const, updatedAt: now, createdAt: now }
        : item
    );
    await writeRequests(next);
    return next.find((item) => item.id === existingOutgoing.id)!;
  }

  const nextRequest: FriendRequestRecord = {
    id: `friend-request-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fromUserId,
    toUserId,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  await writeRequests([nextRequest, ...requests]);
  return nextRequest;
}

export async function respondToFriendRequest(
  requestId: string,
  targetUserId: string | string[],
  action: "accept" | "reject"
) {
  const requests = await readRequests();
  const request = requests.find((item) => item.id === requestId);
  const targetUserIds = Array.isArray(targetUserId)
    ? targetUserId.filter(Boolean)
    : [targetUserId].filter(Boolean);

  if (!request || !targetUserIds.includes(request.toUserId)) {
    throw new Error("ไม่พบคำขอเพื่อนนี้");
  }

  if (request.status !== "pending") {
    throw new Error("คำขอนี้ถูกดำเนินการแล้ว");
  }

  const now = new Date().toISOString();
  const nextRequests = requests.map((item) =>
    item.id === requestId
      ? {
          ...item,
          status: action === "accept" ? "accepted" as const : "rejected" as const,
          updatedAt: now,
        }
      : item
  );

  await writeRequests(nextRequests);

  if (action === "accept") {
    const friendships = await readFriendships();
    const [userA, userB] = sortPair(request.fromUserId, request.toUserId);
    const key = friendshipKey(userA, userB);
    const exists = friendships.some(
      (item) => friendshipKey(item.userA, item.userB) === key
    );

    if (!exists) {
      const nextFriendship: FriendshipRecord = {
        id: `friendship-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        userA,
        userB,
        createdAt: now,
      };
      await writeFriendships([nextFriendship, ...friendships]);
      return { request: nextRequests.find((item) => item.id === requestId)!, friendship: nextFriendship };
    }
  }

  return { request: nextRequests.find((item) => item.id === requestId)!, friendship: null };
}

export async function removeFriendship(userId: string, otherUserId: string) {
  const friendships = await readFriendships();
  const key = friendshipKey(userId, otherUserId);
  const next = friendships.filter(
    (item) => friendshipKey(item.userA, item.userB) !== key
  );
  await writeFriendships(next);
}

export async function listIncomingFriendRequests(
  userId: string,
  aliases: string[] = []
) {
  const userIds = Array.from(new Set([userId, ...aliases].filter(Boolean)));
  const requests = await readRequests();
  const incoming = requests
    .filter((item) => item.status === "pending" && userIds.includes(item.toUserId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return Promise.all(
    incoming.map(async (request) => {
      const profile = await getLocalProfileByUserId(request.fromUserId);
      return {
        id: request.id,
        fromUserId: request.fromUserId,
        createdAt: request.createdAt,
        displayName: profile?.displayName || "NEXORA User",
        username: profile?.username || null,
        image: profile?.image || "/avatar.png",
        bio: profile?.bio || "",
      };
    })
  );
}

export async function listFriendsForUser(userId: string) {
  const friendships = await readFriendships();
  const mine = friendships
    .filter((item) => item.userA === userId || item.userB === userId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const friendIds = mine.map((item) => (item.userA === userId ? item.userB : item.userA));
  const uniqueFriendIds = Array.from(new Set(friendIds));

  const entries = await Promise.all(
    uniqueFriendIds.map(async (friendId) => {
      const profile = await getLocalProfileByUserId(friendId);
      return [friendId, profile] as const;
    })
  );

  const profileMap = new Map(entries);

  return mine.map((item) => {
    const friendId = item.userA === userId ? item.userB : item.userA;
    const profile = profileMap.get(friendId);
    return {
      id: item.id,
      friendId,
      createdAt: item.createdAt,
      displayName: profile?.displayName || "NEXORA User",
      username: profile?.username || null,
      image: profile?.image || "/avatar.png",
      bio: profile?.bio || "",
    };
  });
}

export async function searchCommunityUsers(currentUserId: string, query: string) {
  const term = String(query || "").trim().toLowerCase();
  const dbUsers = await prisma.user.findMany({
    select: {
      id: true,
      lineId: true,
      name: true,
      displayName: true,
      image: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const localProfiles = await getAllLocalProfiles();
  const localMap = new Map(localProfiles.map((item) => [item.userId, item]));

  const dbCandidates = dbUsers.map((user) => {
      const local = localMap.get(user.id);
      const displayName =
        local?.displayName || user.displayName || user.name || "NEXORA User";
      const username = local?.username || null;
      return {
        id: user.id,
        displayName,
        username,
        image: local?.image || user.image || "/avatar.png",
        bio: local?.bio || "",
      };
    });

  const candidateMap = new Map(dbCandidates.map((user) => [user.id, user]));

  localProfiles.forEach((profile) => {
    if (!profile.userId || candidateMap.has(profile.userId)) {
      return;
    }

    candidateMap.set(profile.userId, {
      id: profile.userId,
      displayName: profile.displayName || "NEXORA User",
      username: profile.username || null,
      image: profile.image || "/avatar.png",
      bio: profile.bio || "",
    });
  });

  const candidates = Array.from(candidateMap.values()).filter(
    (user) => user.id !== currentUserId
  );

  const filtered = term
    ? candidates.filter((user) => {
        const haystacks = [
          user.displayName,
          user.username || "",
          user.bio || "",
        ].map((value) => value.toLowerCase());
        return haystacks.some((value) => value.includes(term));
      })
    : candidates;

  const relations = await Promise.all(
    filtered.slice(0, 50).map(async (user) => ({
      user,
      relation: await getFriendRelation(currentUserId, user.id),
    }))
  );

  return relations.map(({ user, relation }) => ({
    ...user,
    relation: relation.status,
    requestId: relation.requestId,
  }));
}
