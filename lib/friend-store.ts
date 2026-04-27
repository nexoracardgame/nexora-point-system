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

type FriendRequestWithNotify = FriendRequestRecord & {
  shouldNotify?: boolean;
};

let schemaReadyPromise: Promise<void> | null = null;

function normalizeDbRequest(row: Record<string, unknown>): FriendRequestRecord {
  return {
    id: String(row.id || ""),
    fromUserId: String(row.fromUserId || row.fromuserid || ""),
    toUserId: String(row.toUserId || row.touserid || ""),
    status: String(row.status || "pending") as FriendRequestStatus,
    createdAt: new Date(String(row.createdAt || row.createdat || new Date().toISOString())).toISOString(),
    updatedAt: new Date(String(row.updatedAt || row.updatedat || new Date().toISOString())).toISOString(),
  };
}

function normalizeDbFriendship(row: Record<string, unknown>): FriendshipRecord {
  return {
    id: String(row.id || ""),
    userA: String(row.userA || row.usera || ""),
    userB: String(row.userB || row.userb || ""),
    createdAt: new Date(String(row.createdAt || row.createdat || new Date().toISOString())).toISOString(),
  };
}

async function ensureCommunitySchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      await prisma.$executeRawUnsafe(
        'ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT'
      );
      await prisma.$executeRawUnsafe(
        'CREATE TABLE IF NOT EXISTS "FriendRequest" ("id" TEXT PRIMARY KEY, "fromUserId" TEXT NOT NULL, "toUserId" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT \'pending\', "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW())'
      );
      await prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "FriendRequest_to_status_idx" ON "FriendRequest" ("toUserId", "status", "createdAt")'
      );
      await prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "FriendRequest_pair_idx" ON "FriendRequest" ("fromUserId", "toUserId", "status")'
      );
      await prisma.$executeRawUnsafe(
        'CREATE TABLE IF NOT EXISTS "Friendship" ("id" TEXT PRIMARY KEY, "userA" TEXT NOT NULL, "userB" TEXT NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(), CONSTRAINT "Friendship_pair_unique" UNIQUE ("userA", "userB"))'
      );
      await prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "Friendship_userA_idx" ON "Friendship" ("userA", "createdAt")'
      );
      await prisma.$executeRawUnsafe(
        'CREATE INDEX IF NOT EXISTS "Friendship_userB_idx" ON "Friendship" ("userB", "createdAt")'
      );
    })();
  }

  return schemaReadyPromise;
}

async function readDbRequests() {
  await ensureCommunitySchema();
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    'SELECT * FROM "FriendRequest" ORDER BY "createdAt" DESC'
  );
  return rows.map(normalizeDbRequest);
}

async function readDbFriendships() {
  await ensureCommunitySchema();
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    'SELECT * FROM "Friendship" ORDER BY "createdAt" ASC'
  );
  return rows.map(normalizeDbFriendship);
}

async function readRequests() {
  try {
    return await readDbRequests();
  } catch {
    await ensureLocalStoreFile("local-friend-requests.json");
    return readLocalStoreJson<FriendRequestRecord>("local-friend-requests.json");
  }
}

async function writeRequests(items: FriendRequestRecord[]) {
  await writeLocalStoreJson(
    "local-friend-requests.json",
    JSON.stringify(items, null, 2)
  );
}

async function readFriendships() {
  try {
    return await readDbFriendships();
  } catch {
    await ensureLocalStoreFile("local-friendships.json");
    return readLocalStoreJson<FriendshipRecord>("local-friendships.json");
  }
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

export async function createFriendRequestRecord(
  fromUserId: string,
  toUserId: string
): Promise<FriendRequestWithNotify> {
  if (!fromUserId || !toUserId || fromUserId === toUserId) {
    throw new Error("ไม่สามารถส่งคำขอเพื่อนรายการนี้ได้");
  }

  if (await areFriends(fromUserId, toUserId)) {
    throw new Error("เป็นเพื่อนกันอยู่แล้ว");
  }

  const now = new Date().toISOString();
  try {
    await ensureCommunitySchema();
    const existingRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      'SELECT * FROM "FriendRequest" WHERE (("fromUserId" = $1 AND "toUserId" = $2) OR ("fromUserId" = $2 AND "toUserId" = $1)) ORDER BY "createdAt" DESC',
      fromUserId,
      toUserId
    );
    const existing = existingRows.map(normalizeDbRequest);
    const existingIncoming = existing.find(
      (item) =>
        item.status === "pending" &&
        item.fromUserId === toUserId &&
        item.toUserId === fromUserId
    );

    if (existingIncoming) {
      return { ...existingIncoming, shouldNotify: false };
    }

    const existingOutgoing = existing.find(
      (item) => item.fromUserId === fromUserId && item.toUserId === toUserId
    );

    if (existingOutgoing) {
      if (existingOutgoing.status === "pending") {
        return { ...existingOutgoing, shouldNotify: false };
      }

      const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        'UPDATE "FriendRequest" SET "status" = \'pending\', "createdAt" = NOW(), "updatedAt" = NOW() WHERE "id" = $1 RETURNING *',
        existingOutgoing.id
      );
      return { ...normalizeDbRequest(rows[0]), shouldNotify: true };
    }

    const requestId = `friend-request-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      'INSERT INTO "FriendRequest" ("id", "fromUserId", "toUserId", "status", "createdAt", "updatedAt") VALUES ($1, $2, $3, \'pending\', NOW(), NOW()) RETURNING *',
      requestId,
      fromUserId,
      toUserId
    );
    return { ...normalizeDbRequest(rows[0]), shouldNotify: true };
  } catch {
    // Local fallback for development environments without DB migrations.
  }

  const requests = await readLocalStoreJson<FriendRequestRecord>("local-friend-requests.json").catch(async () => {
    await ensureLocalStoreFile("local-friend-requests.json");
    return readLocalStoreJson<FriendRequestRecord>("local-friend-requests.json");
  });

  const existingIncoming = requests.find(
    (item) =>
      item.status === "pending" &&
      item.fromUserId === toUserId &&
      item.toUserId === fromUserId
  );

  if (existingIncoming) {
    return { ...existingIncoming, shouldNotify: false };
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
    return { ...next.find((item) => item.id === existingOutgoing.id)!, shouldNotify: existingOutgoing.status !== "pending" };
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
  return { ...nextRequest, shouldNotify: true };
}

export async function respondToFriendRequest(
  requestId: string,
  targetUserId: string | string[],
  action: "accept" | "reject"
) {
  try {
    await ensureCommunitySchema();
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      'SELECT * FROM "FriendRequest" WHERE "id" = $1 LIMIT 1',
      requestId
    );
    const request = rows[0] ? normalizeDbRequest(rows[0]) : null;
    const targetUserIds = Array.isArray(targetUserId)
      ? targetUserId.filter(Boolean)
      : [targetUserId].filter(Boolean);

    if (!request || !targetUserIds.includes(request.toUserId)) {
      throw new Error("ไม่พบคำขอเพื่อนนี้");
    }

    if (request.status !== "pending") {
      throw new Error("คำขอนี้ถูกดำเนินการแล้ว");
    }

    const updatedRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      'UPDATE "FriendRequest" SET "status" = $2, "updatedAt" = NOW() WHERE "id" = $1 RETURNING *',
      requestId,
      action === "accept" ? "accepted" : "rejected"
    );
    const updatedRequest = normalizeDbRequest(updatedRows[0]);

    if (action === "accept") {
      const [userA, userB] = sortPair(request.fromUserId, request.toUserId);
      const friendshipId = `friendship-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const friendshipRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
        'INSERT INTO "Friendship" ("id", "userA", "userB", "createdAt") VALUES ($1, $2, $3, NOW()) ON CONFLICT ("userA", "userB") DO UPDATE SET "userA" = EXCLUDED."userA" RETURNING *',
        friendshipId,
        userA,
        userB
      );
      return {
        request: updatedRequest,
        friendship: friendshipRows[0] ? normalizeDbFriendship(friendshipRows[0]) : null,
      };
    }

    return { request: updatedRequest, friendship: null };
  } catch (error) {
    if (error instanceof Error && !error.message.includes("ไม่พบ") && !error.message.includes("ดำเนินการ")) {
      // Fall through to local fallback only for infrastructure issues.
    } else {
      throw error;
    }
  }

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
  try {
    await ensureCommunitySchema();
    const [userA, userB] = sortPair(userId, otherUserId);
    await prisma.$executeRawUnsafe(
      'DELETE FROM "Friendship" WHERE "userA" = $1 AND "userB" = $2',
      userA,
      userB
    );
    return;
  } catch {
    // Local fallback below.
  }

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

function normalizeSearchValue(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "");
}

function scoreCommunityCandidate(
  user: {
    displayName: string;
    username: string | null;
    bio: string;
  },
  term: string
) {
  if (!term) return 1;

  const normalizedTerm = normalizeSearchValue(term);
  const displayName = normalizeSearchValue(user.displayName);
  const username = normalizeSearchValue(user.username);
  const bio = normalizeSearchValue(user.bio);

  if (username && username === normalizedTerm) return 100;
  if (displayName === normalizedTerm) return 96;
  if (username && username.startsWith(normalizedTerm)) return 84;
  if (displayName.startsWith(normalizedTerm)) return 78;
  if (username && username.includes(normalizedTerm)) return 66;
  if (displayName.includes(normalizedTerm)) return 60;

  const pieces = normalizedTerm.split(/\s+/).filter(Boolean);
  if (
    pieces.length > 1 &&
    pieces.every(
      (piece) =>
        displayName.includes(piece) ||
        username.includes(piece) ||
        bio.includes(piece)
    )
  ) {
    return 48;
  }

  if (bio.includes(normalizedTerm)) return 24;

  return 0;
}

export async function searchCommunityUsers(
  currentUserId: string,
  query: string,
  currentUserAliases: string[] = []
) {
  const term = String(query || "").trim().toLowerCase();
  const normalizedTerm = normalizeSearchValue(query);
  await ensureCommunitySchema().catch(() => undefined);
  const dbUsers = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      lineId: string | null;
      name: string | null;
      displayName: string | null;
      username: string | null;
      image: string | null;
      createdAt: Date | string;
    }>
  >(
    'SELECT "id", "lineId", "name", "displayName", "username", "image", "createdAt" FROM "User" ORDER BY "createdAt" DESC LIMIT 500'
  ).catch(() => []);
  const localProfiles = await getAllLocalProfiles();
  const localMap = new Map(localProfiles.map((item) => [item.userId, item]));

  const dbCandidates = dbUsers.map((user) => {
      const local = localMap.get(user.id);
      const displayName =
        local?.displayName || user.displayName || user.name || "NEXORA User";
      const username = local?.username || user.username || null;
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

  const selfIds = new Set(
    [currentUserId, ...currentUserAliases]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
  );

  const candidates = Array.from(candidateMap.values()).filter(
    (user) => !selfIds.has(user.id)
  );

  const scored = candidates
    .map((user) => ({
      user,
      score: scoreCommunityCandidate(user, term),
    }))
    .filter((item) => !term || item.score > 0);

  const exactMatches = normalizedTerm
    ? scored.filter((item) => {
        const username = normalizeSearchValue(item.user.username);
        const displayName = normalizeSearchValue(item.user.displayName);
        return username === normalizedTerm || displayName === normalizedTerm;
      })
    : [];

  const filtered = (exactMatches.length === 1 ? exactMatches : scored)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.user.displayName.localeCompare(b.user.displayName);
    })
    .map((item) => item.user);

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
