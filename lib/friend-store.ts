import { prisma } from "@/lib/prisma";
import {
  ensureLocalStoreFile,
  readLocalStoreJson,
  writeLocalStoreJson,
} from "@/lib/local-store-dir";
import {
  getAllLocalProfiles,
  getLocalProfilesByUserIds,
} from "@/lib/local-profile-store";

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

type FriendRelation = {
  status: "none" | "incoming" | "outgoing" | "friends" | "self";
  requestId: string | null;
};

type UserIdentity = {
  canonicalId: string;
  lineId: string | null;
  aliases: string[];
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

function uniqueStrings(values: string[]) {
  return Array.from(
    new Set(values.map((value) => String(value || "").trim()).filter(Boolean))
  );
}

function buildInClause(values: string[], startIndex = 1) {
  return values.map((_, index) => `$${startIndex + index}`).join(", ");
}

async function getUserIdentityMap(userIds: string[]) {
  const safeUserIds = uniqueStrings(userIds);
  const identityMap = new Map<string, UserIdentity>();

  if (safeUserIds.length === 0) {
    return identityMap;
  }

  try {
    await ensureCommunitySchema();
    const placeholders = buildInClause(safeUserIds);
    const rows = await prisma.$queryRawUnsafe<
      Array<{ id: string; lineId: string | null }>
    >(
      `SELECT "id", "lineId" FROM "User" WHERE "id" IN (${placeholders}) OR "lineId" IN (${placeholders})`,
      ...safeUserIds
    );

    rows.forEach((row) => {
      const canonicalId = String(row.id || "").trim();
      const lineId = String(row.lineId || "").trim() || null;
      if (!canonicalId) return;

      const identity: UserIdentity = {
        canonicalId,
        lineId,
        aliases: uniqueStrings([canonicalId, lineId || ""]),
      };

      identity.aliases.forEach((alias) => {
        identityMap.set(alias, identity);
      });
    });
  } catch {
    // Fall back to the provided identifiers as canonical values.
  }

  safeUserIds.forEach((userId) => {
    if (identityMap.has(userId)) return;

    identityMap.set(userId, {
      canonicalId: userId,
      lineId: null,
      aliases: [userId],
    });
  });

  return identityMap;
}

function getCanonicalUserId(
  identityMap: Map<string, UserIdentity>,
  userId: string
) {
  const safeUserId = String(userId || "").trim();
  return identityMap.get(safeUserId)?.canonicalId || safeUserId;
}

function getUserAliases(identityMap: Map<string, UserIdentity>, userId: string) {
  const safeUserId = String(userId || "").trim();
  return identityMap.get(safeUserId)?.aliases || (safeUserId ? [safeUserId] : []);
}

async function readDbFriendshipsForUsers(userIds: string[]) {
  const safeUserIds = uniqueStrings(userIds);

  if (safeUserIds.length === 0) {
    return [];
  }

  await ensureCommunitySchema();

  const userClause = buildInClause(safeUserIds);
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM "Friendship" WHERE "userA" IN (${userClause}) OR "userB" IN (${userClause}) ORDER BY "createdAt" ASC LIMIT 500`,
    ...safeUserIds
  );

  return rows.map(normalizeDbFriendship);
}

async function readFriendshipsForUsers(userIds: string[]) {
  const safeUserIds = uniqueStrings(userIds);

  if (safeUserIds.length === 0) {
    return [];
  }

  try {
    return await readDbFriendshipsForUsers(safeUserIds);
  } catch {
    const userSet = new Set(safeUserIds);
    const items = await readFriendships();
    return items.filter(
      (item) => userSet.has(item.userA) || userSet.has(item.userB)
    );
  }
}

async function readDbIncomingRequestsForUsers(userIds: string[]) {
  const safeUserIds = uniqueStrings(userIds);

  if (safeUserIds.length === 0) {
    return [];
  }

  await ensureCommunitySchema();

  const userClause = buildInClause(safeUserIds);
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM "FriendRequest" WHERE "status" = 'pending' AND "toUserId" IN (${userClause}) ORDER BY "createdAt" DESC LIMIT 120`,
    ...safeUserIds
  );

  return rows.map(normalizeDbRequest);
}

async function readIncomingRequestsForUsers(userIds: string[]) {
  const safeUserIds = uniqueStrings(userIds);

  if (safeUserIds.length === 0) {
    return [];
  }

  try {
    return await readDbIncomingRequestsForUsers(safeUserIds);
  } catch {
    const userSet = new Set(safeUserIds);
    const requests = await readRequests();
    return requests
      .filter((item) => item.status === "pending" && userSet.has(item.toUserId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

async function readPendingRequestsBetween(
  currentUserIds: string[],
  otherUserIds: string[]
) {
  const mine = uniqueStrings(currentUserIds);
  const others = uniqueStrings(otherUserIds);

  if (mine.length === 0 || others.length === 0) {
    return [];
  }

  try {
    await ensureCommunitySchema();

    const mineClause = buildInClause(mine);
    const otherClause = buildInClause(others, mine.length + 1);
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM "FriendRequest" WHERE "status" = 'pending' AND (("fromUserId" IN (${mineClause}) AND "toUserId" IN (${otherClause})) OR ("fromUserId" IN (${otherClause}) AND "toUserId" IN (${mineClause}))) ORDER BY "createdAt" DESC LIMIT 240`,
      ...mine,
      ...others
    );

    return rows.map(normalizeDbRequest);
  } catch {
    const mineSet = new Set(mine);
    const otherSet = new Set(others);
    const requests = await readRequests();
    return requests
      .filter((item) => item.status === "pending")
      .filter(
        (item) =>
          (mineSet.has(item.fromUserId) && otherSet.has(item.toUserId)) ||
          (otherSet.has(item.fromUserId) && mineSet.has(item.toUserId))
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
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
  if (!userId || !otherUserId) {
    return false;
  }

  const seedIdentityMap = await getUserIdentityMap([userId, otherUserId]);
  const userAliases = getUserAliases(seedIdentityMap, userId);
  const otherAliases = getUserAliases(seedIdentityMap, otherUserId);
  const userCanonicalId = getCanonicalUserId(seedIdentityMap, userId);
  const otherCanonicalId = getCanonicalUserId(seedIdentityMap, otherUserId);

  if (userCanonicalId === otherCanonicalId) {
    return true;
  }

  try {
    await ensureCommunitySchema();
    const userClause = buildInClause(userAliases);
    const otherClause = buildInClause(otherAliases, userAliases.length + 1);
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "Friendship" WHERE (("userA" IN (${userClause}) AND "userB" IN (${otherClause})) OR ("userA" IN (${otherClause}) AND "userB" IN (${userClause}))) LIMIT 1`,
      ...userAliases,
      ...otherAliases
    );
    return rows.length > 0;
  } catch {
    // Local fallback below.
  }

  const items = await readFriendshipsForUsers([...userAliases, ...otherAliases]);
  const allIds = uniqueStrings([
    ...userAliases,
    ...otherAliases,
    ...items.flatMap((item) => [item.userA, item.userB]),
  ]);
  const identityMap = await getUserIdentityMap(allIds);
  const expectedKey = friendshipKey(userCanonicalId, otherCanonicalId);

  return items.some((item) => {
    const left = getCanonicalUserId(identityMap, item.userA);
    const right = getCanonicalUserId(identityMap, item.userB);
    return friendshipKey(left, right) === expectedKey;
  });
}

export async function getFriendRelation(userId: string, otherUserId: string) {
  if (!userId || !otherUserId) {
    return { status: "none" as const, requestId: null as string | null };
  }

  if (userId === otherUserId) {
    return { status: "self" as const, requestId: null as string | null };
  }

  const relations = await getFriendRelationsForUsers(userId, [otherUserId]);
  return (
    relations.get(otherUserId) || {
      status: "none" as const,
      requestId: null as string | null,
    }
  );
}

export async function createFriendRequestRecord(
  fromUserId: string,
  toUserId: string
): Promise<FriendRequestWithNotify> {
  const identityMap = await getUserIdentityMap([fromUserId, toUserId]);
  const fromCanonicalId = getCanonicalUserId(identityMap, fromUserId);
  const toCanonicalId = getCanonicalUserId(identityMap, toUserId);
  const fromAliases = getUserAliases(identityMap, fromUserId);
  const toAliases = getUserAliases(identityMap, toUserId);

  if (!fromCanonicalId || !toCanonicalId || fromCanonicalId === toCanonicalId) {
    throw new Error("ไม่สามารถส่งคำขอเพื่อนรายการนี้ได้");
  }

  if (await areFriends(fromCanonicalId, toCanonicalId)) {
    throw new Error("เป็นเพื่อนกันอยู่แล้ว");
  }

  const now = new Date().toISOString();
  try {
    await ensureCommunitySchema();
    const fromClause = buildInClause(fromAliases);
    const toClause = buildInClause(toAliases, fromAliases.length + 1);
    const existingRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM "FriendRequest" WHERE (("fromUserId" IN (${fromClause}) AND "toUserId" IN (${toClause})) OR ("fromUserId" IN (${toClause}) AND "toUserId" IN (${fromClause}))) ORDER BY "createdAt" DESC`,
      ...fromAliases,
      ...toAliases
    );
    const existing = existingRows.map(normalizeDbRequest);
    const existingIncoming = existing.find(
      (item) =>
        item.status === "pending" &&
        getCanonicalUserId(identityMap, item.fromUserId) === toCanonicalId &&
        getCanonicalUserId(identityMap, item.toUserId) === fromCanonicalId
    );

    if (existingIncoming) {
      return { ...existingIncoming, shouldNotify: false };
    }

    const existingOutgoing = existing.find(
      (item) =>
        getCanonicalUserId(identityMap, item.fromUserId) === fromCanonicalId &&
        getCanonicalUserId(identityMap, item.toUserId) === toCanonicalId
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
      fromCanonicalId,
      toCanonicalId
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
      getCanonicalUserId(identityMap, item.fromUserId) === toCanonicalId &&
      getCanonicalUserId(identityMap, item.toUserId) === fromCanonicalId
  );

  if (existingIncoming) {
    return { ...existingIncoming, shouldNotify: false };
  }

  const existingOutgoing = requests.find(
    (item) =>
      getCanonicalUserId(identityMap, item.fromUserId) === fromCanonicalId &&
      getCanonicalUserId(identityMap, item.toUserId) === toCanonicalId
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
    fromUserId: fromCanonicalId,
    toUserId: toCanonicalId,
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
      if (request.status === "accepted" && action === "accept") {
        const identityMap = await getUserIdentityMap([
          request.fromUserId,
          request.toUserId,
        ]);
        const [userA, userB] = sortPair(
          getCanonicalUserId(identityMap, request.fromUserId),
          getCanonicalUserId(identityMap, request.toUserId)
        );
        const friendshipId = `friendship-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const friendshipRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
          'INSERT INTO "Friendship" ("id", "userA", "userB", "createdAt") VALUES ($1, $2, $3, NOW()) ON CONFLICT ("userA", "userB") DO UPDATE SET "userA" = EXCLUDED."userA" RETURNING *',
          friendshipId,
          userA,
          userB
        );
        return {
          request,
          friendship: friendshipRows[0]
            ? normalizeDbFriendship(friendshipRows[0])
            : null,
        };
      }

      if (request.status === "rejected" && action === "reject") {
        return { request, friendship: null };
      }

      throw new Error("คำขอนี้ถูกดำเนินการแล้ว");
    }

    const updatedRows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      'UPDATE "FriendRequest" SET "status" = $2, "updatedAt" = NOW() WHERE "id" = $1 RETURNING *',
      requestId,
      action === "accept" ? "accepted" : "rejected"
    );
    const updatedRequest = normalizeDbRequest(updatedRows[0]);

    if (action === "accept") {
      const identityMap = await getUserIdentityMap([
        request.fromUserId,
        request.toUserId,
      ]);
      const [userA, userB] = sortPair(
        getCanonicalUserId(identityMap, request.fromUserId),
        getCanonicalUserId(identityMap, request.toUserId)
      );
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
    if (request.status === "accepted" && action === "accept") {
      const friendships = await readFriendships();
      const identityMap = await getUserIdentityMap([
        request.fromUserId,
        request.toUserId,
      ]);
      const [userA, userB] = sortPair(
        getCanonicalUserId(identityMap, request.fromUserId),
        getCanonicalUserId(identityMap, request.toUserId)
      );
      const key = friendshipKey(userA, userB);
      const existing = friendships.find(
        (item) => friendshipKey(item.userA, item.userB) === key
      );

      if (existing) {
        return { request, friendship: existing };
      }

      const nextFriendship: FriendshipRecord = {
        id: `friendship-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        userA,
        userB,
        createdAt: new Date().toISOString(),
      };
      await writeFriendships([nextFriendship, ...friendships]);
      return { request, friendship: nextFriendship };
    }

    if (request.status === "rejected" && action === "reject") {
      return { request, friendship: null };
    }

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
    const identityMap = await getUserIdentityMap([
      request.fromUserId,
      request.toUserId,
    ]);
    const [userA, userB] = sortPair(
      getCanonicalUserId(identityMap, request.fromUserId),
      getCanonicalUserId(identityMap, request.toUserId)
    );
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
  const identityMap = await getUserIdentityMap([userId, otherUserId]);
  const userAliases = getUserAliases(identityMap, userId);
  const otherAliases = getUserAliases(identityMap, otherUserId);
  const canonicalKey = friendshipKey(
    getCanonicalUserId(identityMap, userId),
    getCanonicalUserId(identityMap, otherUserId)
  );

  try {
    await ensureCommunitySchema();
    const userClause = buildInClause(userAliases);
    const otherClause = buildInClause(otherAliases, userAliases.length + 1);
    await prisma.$executeRawUnsafe(
      `DELETE FROM "Friendship" WHERE ("userA" IN (${userClause}) AND "userB" IN (${otherClause})) OR ("userA" IN (${otherClause}) AND "userB" IN (${userClause}))`,
      ...userAliases,
      ...otherAliases
    );
    return;
  } catch {
    // Local fallback below.
  }

  const friendships = await readFriendships();
  const allIds = uniqueStrings([
    ...userAliases,
    ...otherAliases,
    ...friendships.flatMap((item) => [item.userA, item.userB]),
  ]);
  const fallbackIdentityMap = await getUserIdentityMap(allIds);
  const next = friendships.filter((item) => {
    const left = getCanonicalUserId(fallbackIdentityMap, item.userA);
    const right = getCanonicalUserId(fallbackIdentityMap, item.userB);
    return friendshipKey(left, right) !== canonicalKey;
  });
  await writeFriendships(next);
}

export async function listIncomingFriendRequests(
  userId: string,
  aliases: string[] = []
) {
  const seedIds = uniqueStrings([userId, ...aliases]);
  const seedIdentityMap = await getUserIdentityMap(seedIds);
  const userLookupIds = uniqueStrings(
    seedIds.flatMap((id) => getUserAliases(seedIdentityMap, id))
  );
  const incoming = await readIncomingRequestsForUsers(userLookupIds);
  const allIds = uniqueStrings([
    ...userLookupIds,
    ...incoming.flatMap((request) => [request.fromUserId, request.toUserId]),
  ]);
  const identityMap = await getUserIdentityMap(allIds);
  const selfCanonicalSet = new Set(
    userLookupIds.map((id) => getCanonicalUserId(identityMap, id))
  );
  const requestBySender = new Map<string, FriendRequestRecord>();

  incoming.forEach((request) => {
    const senderId = getCanonicalUserId(identityMap, request.fromUserId);
    const receiverId = getCanonicalUserId(identityMap, request.toUserId);
    if (!senderId || selfCanonicalSet.has(senderId) || !selfCanonicalSet.has(receiverId)) {
      return;
    }

    const previous = requestBySender.get(senderId);
    if (!previous || previous.createdAt < request.createdAt) {
      requestBySender.set(senderId, request);
    }
  });

  const uniqueIncoming = Array.from(requestBySender.entries()).map(
    ([fromUserId, request]) => ({
      ...request,
      fromUserId,
      toUserId: getCanonicalUserId(identityMap, request.toUserId),
    })
  );
  const profileMap = await getLocalProfilesByUserIds(
    uniqueIncoming.map((request) => request.fromUserId)
  );

  return uniqueIncoming.map((request) => {
    const profile = profileMap.get(request.fromUserId);

    return {
      id: request.id,
      fromUserId: request.fromUserId,
      createdAt: request.createdAt,
      displayName: profile?.displayName || "NEXORA User",
      username: profile?.username || null,
      image: profile?.image || "/avatar.png",
      bio: profile?.bio || "",
    };
  });
}

export async function listFriendsForUser(userId: string, aliases: string[] = []) {
  const seedIds = uniqueStrings([userId, ...aliases]);
  const seedIdentityMap = await getUserIdentityMap(seedIds);
  const userLookupIds = uniqueStrings(
    seedIds.flatMap((id) => getUserAliases(seedIdentityMap, id))
  );
  const friendships = await readFriendshipsForUsers(userLookupIds);
  const allIds = uniqueStrings([
    ...userLookupIds,
    ...friendships.flatMap((item) => [item.userA, item.userB]),
  ]);
  const identityMap = await getUserIdentityMap(allIds);
  const selfCanonicalSet = new Set(
    userLookupIds.map((id) => getCanonicalUserId(identityMap, id))
  );
  const friendById = new Map<string, FriendshipRecord & { friendId: string }>();

  friendships
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .forEach((item) => {
      const userA = getCanonicalUserId(identityMap, item.userA);
      const userB = getCanonicalUserId(identityMap, item.userB);
      const userAIsMe = selfCanonicalSet.has(userA);
      const userBIsMe = selfCanonicalSet.has(userB);
      const friendId = userAIsMe ? userB : userBIsMe ? userA : "";

      if (!friendId || selfCanonicalSet.has(friendId) || friendById.has(friendId)) {
        return;
      }

      friendById.set(friendId, {
        ...item,
        friendId,
      });
    });

  const mine = Array.from(friendById.values());
  const uniqueFriendIds = mine.map((item) => item.friendId);
  const profileMap = await getLocalProfilesByUserIds(uniqueFriendIds);

  return mine.map((item) => {
    const friendId = item.friendId;
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

export async function getFriendRelationsForUsers(
  currentUserId: string,
  targetUserIds: string[],
  currentUserAliases: string[] = []
) {
  const seedSelfIds = uniqueStrings([currentUserId, ...currentUserAliases]);
  const targets = uniqueStrings(targetUserIds);
  const seedIdentityMap = await getUserIdentityMap([...seedSelfIds, ...targets]);
  const selfIds = uniqueStrings(
    seedSelfIds.flatMap((id) => getUserAliases(seedIdentityMap, id))
  );
  const targetLookupIds = uniqueStrings(
    targets.flatMap((id) => getUserAliases(seedIdentityMap, id))
  );
  const relations = new Map<string, FriendRelation>();
  const targetByCanonicalId = new Map<string, string>();
  const selfCanonicalSet = new Set(
    selfIds.map((id) => getCanonicalUserId(seedIdentityMap, id))
  );

  targets.forEach((targetUserId) => {
    const canonicalTargetId = getCanonicalUserId(seedIdentityMap, targetUserId);
    targetByCanonicalId.set(canonicalTargetId, targetUserId);
    relations.set(targetUserId, {
      status: selfCanonicalSet.has(canonicalTargetId) ? "self" : "none",
      requestId: null,
    });
  });

  const relationTargets = targetLookupIds.filter((targetUserId) => {
    const canonicalTargetId = getCanonicalUserId(seedIdentityMap, targetUserId);
    return !selfCanonicalSet.has(canonicalTargetId);
  });

  if (selfIds.length === 0 || relationTargets.length === 0) {
    return relations;
  }

  const [friendships, pendingRequests] = await Promise.all([
    readFriendshipsForUsers(selfIds),
    readPendingRequestsBetween(selfIds, relationTargets),
  ]);
  const allIds = uniqueStrings([
    ...selfIds,
    ...relationTargets,
    ...friendships.flatMap((item) => [item.userA, item.userB]),
    ...pendingRequests.flatMap((item) => [item.fromUserId, item.toUserId]),
  ]);
  const identityMap = await getUserIdentityMap(allIds);
  const canonicalSelfSet = new Set(
    selfIds.map((id) => getCanonicalUserId(identityMap, id))
  );

  friendships.forEach((item) => {
    const userA = getCanonicalUserId(identityMap, item.userA);
    const userB = getCanonicalUserId(identityMap, item.userB);
    const friendId = canonicalSelfSet.has(userA)
      ? userB
      : canonicalSelfSet.has(userB)
        ? userA
        : "";
    const targetId = targetByCanonicalId.get(friendId);

    if (!targetId) {
      return;
    }

    relations.set(targetId, {
      status: "friends",
      requestId: null,
    });
  });

  pendingRequests.forEach((request) => {
    const fromUserId = getCanonicalUserId(identityMap, request.fromUserId);
    const toUserId = getCanonicalUserId(identityMap, request.toUserId);

    if (canonicalSelfSet.has(fromUserId)) {
      const targetId = targetByCanonicalId.get(toUserId);
      if (!targetId) return;
      const current = relations.get(targetId);

      if (current?.status !== "friends") {
        relations.set(targetId, {
          status: "outgoing",
          requestId: request.id,
        });
      }
    }

    if (canonicalSelfSet.has(toUserId)) {
      const targetId = targetByCanonicalId.get(fromUserId);
      if (!targetId) return;
      const current = relations.get(targetId);

      if (current?.status !== "friends") {
        relations.set(targetId, {
          status: "incoming",
          requestId: request.id,
        });
      }
    }
  });

  return relations;
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
    'SELECT "id", "lineId", "name", "displayName", "username", "image", "createdAt" FROM "User" ORDER BY "createdAt" DESC, "id" ASC'
  ).catch(() => []);
  const localProfiles = await getAllLocalProfiles();
  const localMap = new Map(localProfiles.map((item) => [item.userId, item]));
  const dbCanonicalByLookupId = new Map<string, string>();

  const dbCandidates = dbUsers.map((user) => {
      const canonicalId = String(user.id || "").trim();
      const lineId = String(user.lineId || "").trim();
      [canonicalId, lineId].filter(Boolean).forEach((lookupId) => {
        dbCanonicalByLookupId.set(lookupId, canonicalId);
      });
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
    const canonicalId = dbCanonicalByLookupId.get(profile.userId) || profile.userId;

    if (!canonicalId) {
      return;
    }

    const existing = candidateMap.get(canonicalId);
    if (existing) {
      candidateMap.set(canonicalId, {
        ...existing,
        displayName: profile.displayName || existing.displayName,
        username: profile.username || existing.username,
        image: profile.image || existing.image,
        bio: profile.bio || existing.bio,
      });
      return;
    }

    candidateMap.set(canonicalId, {
      id: canonicalId,
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

  const candidates = Array.from(candidateMap.values());
  const totalUsers = candidates.length;

  const scored = candidates
    .map((user) => ({
      user,
      score: scoreCommunityCandidate(user, term),
    }))
    .filter((item) => !term || item.score > 0);

  const filtered = scored
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.user.displayName.localeCompare(b.user.displayName);
    })
    .map((item) => item.user);

  const relationMap = await getFriendRelationsForUsers(
    currentUserId,
    filtered.map((user) => user.id),
    currentUserAliases
  );

  return {
    users: filtered.map((user) => {
      const relation = relationMap.get(user.id) || {
        status: selfIds.has(user.id) ? ("self" as const) : ("none" as const),
        requestId: null as string | null,
      };

      return {
        ...user,
        relation: relation.status,
        requestId: relation.requestId,
      };
    }),
    resultCount: filtered.length,
    totalUsers,
  };
}
