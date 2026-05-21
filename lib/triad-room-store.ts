import { prisma } from "@/lib/prisma";

export type TriadRoomAccess = "public" | "private";
export type TriadRoomStatus = "waiting" | "playing";
export type TriadRoomSlot = "host" | "challenger";

export type TriadRoomParticipant = {
  id: string;
  name: string;
  image: string;
  joinedAt: number;
};

export type StoredTriadRoom = {
  code: string;
  access: TriadRoomAccess;
  password: string;
  status: TriadRoomStatus;
  hostId: string;
  createdAt: number;
  seats: {
    host: TriadRoomParticipant | null;
    challenger: TriadRoomParticipant | null;
  };
  spectators: TriadRoomParticipant[];
};

export type PublicTriadRoom = Omit<StoredTriadRoom, "password"> & {
  hasPassword: boolean;
};

type TriadRoomRow = {
  code: string;
  access: string;
  password: string | null;
  status: string;
  hostId: string;
  createdAt: Date | string;
  seats: unknown;
  spectators: unknown;
};

const SPECTATOR_LIMIT = 10;

const globalForTriadRooms = globalThis as {
  nexoraTriadRooms?: StoredTriadRoom[];
  nexoraTriadRoomSchemaPromise?: Promise<void>;
};

function memoryRooms() {
  if (!globalForTriadRooms.nexoraTriadRooms) {
    globalForTriadRooms.nexoraTriadRooms = [];
  }
  return globalForTriadRooms.nexoraTriadRooms;
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function normalizeAccess(value: unknown): TriadRoomAccess {
  return value === "private" ? "private" : "public";
}

function normalizeStatus(value: unknown): TriadRoomStatus {
  return value === "playing" ? "playing" : "waiting";
}

function normalizeParticipant(value: unknown): TriadRoomParticipant | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<TriadRoomParticipant>;
  const id = cleanText(item.id);
  if (!id) return null;
  return {
    id,
    name: cleanText(item.name) || "ADMIN",
    image: cleanText(item.image) || "/avatar.png",
    joinedAt: Number(item.joinedAt || Date.now()),
  };
}

function normalizeSpectators(value: unknown): TriadRoomParticipant[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeParticipant).filter((item): item is TriadRoomParticipant => Boolean(item)).slice(0, SPECTATOR_LIMIT);
}

function normalizeSeats(value: unknown): StoredTriadRoom["seats"] {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    host: normalizeParticipant(raw.host),
    challenger: normalizeParticipant(raw.challenger),
  };
}

function rowToRoom(row: TriadRoomRow): StoredTriadRoom {
  return {
    code: cleanText(row.code),
    access: normalizeAccess(row.access),
    password: cleanText(row.password),
    status: normalizeStatus(row.status),
    hostId: cleanText(row.hostId),
    createdAt: new Date(row.createdAt).getTime(),
    seats: normalizeSeats(row.seats),
    spectators: normalizeSpectators(row.spectators),
  };
}

function publicRoom(room: StoredTriadRoom): PublicTriadRoom {
  const { password, ...rest } = room;
  return {
    ...rest,
    hasPassword: Boolean(password),
  };
}

function removeParticipant(room: StoredTriadRoom, participantId: string): StoredTriadRoom {
  return {
    ...room,
    seats: {
      host: room.seats.host?.id === participantId ? null : room.seats.host,
      challenger: room.seats.challenger?.id === participantId ? null : room.seats.challenger,
    },
    spectators: room.spectators.filter((viewer) => viewer.id !== participantId),
  };
}

async function ensureTriadRoomSchema() {
  if (!globalForTriadRooms.nexoraTriadRoomSchemaPromise) {
    globalForTriadRooms.nexoraTriadRoomSchemaPromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "TriadRoom" (
          "code" TEXT PRIMARY KEY,
          "access" TEXT NOT NULL DEFAULT 'public',
          "password" TEXT NOT NULL DEFAULT '',
          "status" TEXT NOT NULL DEFAULT 'waiting',
          "hostId" TEXT NOT NULL,
          "seats" JSONB NOT NULL DEFAULT '{"host":null,"challenger":null}'::jsonb,
          "spectators" JSONB NOT NULL DEFAULT '[]'::jsonb,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TriadRoom_status_idx" ON "TriadRoom" ("status")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TriadRoom_createdAt_idx" ON "TriadRoom" ("createdAt" DESC)`);
    })().catch((error) => {
      globalForTriadRooms.nexoraTriadRoomSchemaPromise = undefined;
      throw error;
    });
  }

  await globalForTriadRooms.nexoraTriadRoomSchemaPromise;
}

async function dbListRooms() {
  await ensureTriadRoomSchema();
  const rows = await prisma.$queryRawUnsafe<TriadRoomRow[]>(`
    SELECT
      "code",
      "access",
      "password",
      "status",
      "hostId",
      "createdAt",
      "seats",
      "spectators"
    FROM "TriadRoom"
    ORDER BY "createdAt" DESC
    LIMIT 80
  `);
  return rows.map(rowToRoom);
}

async function dbGetRoom(code: string) {
  await ensureTriadRoomSchema();
  const rows = await prisma.$queryRawUnsafe<TriadRoomRow[]>(
    `
      SELECT
        "code",
        "access",
        "password",
        "status",
        "hostId",
        "createdAt",
        "seats",
        "spectators"
      FROM "TriadRoom"
      WHERE "code" = $1
      LIMIT 1
    `,
    cleanText(code)
  );
  return rows[0] ? rowToRoom(rows[0]) : null;
}

async function dbUpsertRoom(room: StoredTriadRoom) {
  await ensureTriadRoomSchema();
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "TriadRoom" ("code", "access", "password", "status", "hostId", "seats", "spectators", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, to_timestamp($8 / 1000.0), NOW())
      ON CONFLICT ("code") DO UPDATE SET
        "access" = EXCLUDED."access",
        "password" = EXCLUDED."password",
        "status" = EXCLUDED."status",
        "hostId" = EXCLUDED."hostId",
        "seats" = EXCLUDED."seats",
        "spectators" = EXCLUDED."spectators",
        "updatedAt" = NOW()
    `,
    room.code,
    room.access,
    room.password,
    room.status,
    room.hostId,
    JSON.stringify(room.seats),
    JSON.stringify(room.spectators),
    room.createdAt
  );
}

async function dbDeleteRoom(code: string) {
  await ensureTriadRoomSchema();
  await prisma.$executeRawUnsafe(`DELETE FROM "TriadRoom" WHERE "code" = $1`, cleanText(code));
}

function roomCode(existing: StoredTriadRoom[]) {
  const used = new Set(existing.map((room) => room.code));
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    if (!used.has(code)) return code;
  }
  return String(Date.now()).slice(-6);
}

function memoryListRooms() {
  return memoryRooms()
    .slice()
    .filter((room) => room.seats.host || room.seats.challenger || room.spectators.length > 0)
    .sort((a, b) => b.createdAt - a.createdAt);
}

function memoryUpsertRoom(room: StoredTriadRoom) {
  const current = memoryRooms();
  const index = current.findIndex((item) => item.code === room.code);
  if (index >= 0) current[index] = room;
  else current.push(room);
}

function memoryDeleteRoom(code: string) {
  globalForTriadRooms.nexoraTriadRooms = memoryRooms().filter((room) => room.code !== code);
}

async function withRoomStore<T>(operation: "list" | "write", dbAction: () => Promise<T>, memoryAction: () => T): Promise<T> {
  try {
    return await dbAction();
  } catch (error) {
    console.error(`TRIAD ROOM ${operation.toUpperCase()} DB FALLBACK:`, error);
    return memoryAction();
  }
}

async function getStoredRoom(code: string) {
  return withRoomStore(
    "list",
    async () => dbGetRoom(code),
    () => memoryListRooms().find((room) => room.code === cleanText(code)) || null
  );
}

async function upsertStoredRoom(room: StoredTriadRoom) {
  await withRoomStore(
    "write",
    async () => {
      await dbUpsertRoom(room);
      return null;
    },
    () => {
      memoryUpsertRoom(room);
      return null;
    }
  );
}

async function deleteStoredRoom(code: string) {
  await withRoomStore(
    "write",
    async () => {
      await dbDeleteRoom(code);
      return null;
    },
    () => {
      memoryDeleteRoom(code);
      return null;
    }
  );
}

export async function listTriadRooms() {
  const storedRooms = await withRoomStore("list", dbListRooms, memoryListRooms);
  return storedRooms.map(publicRoom);
}

export async function createTriadRoom(input: {
  access: TriadRoomAccess;
  password?: string;
  participant: TriadRoomParticipant;
}) {
  const existingRooms = await withRoomStore("list", dbListRooms, memoryListRooms);
  const code = roomCode(existingRooms);
  const room: StoredTriadRoom = {
    code,
    access: input.access,
    password: input.access === "private" ? cleanText(input.password) : "",
    status: "waiting",
    hostId: input.participant.id,
    createdAt: Date.now(),
    seats: {
      host: input.participant,
      challenger: null,
    },
    spectators: [],
  };

  await upsertStoredRoom(room);
  return publicRoom(room);
}

export async function joinTriadRoom(input: {
  code: string;
  password?: string;
  participant: TriadRoomParticipant;
  forceSpectator?: boolean;
}) {
  const room = await getStoredRoom(input.code);
  if (!room) return { ok: false as const, reason: "not_found" as const };
  if (room.access === "private" && room.password !== cleanText(input.password) && room.hostId !== input.participant.id) {
    return { ok: false as const, reason: "wrong_password" as const, room: publicRoom(room) };
  }

  const cleanRoom = removeParticipant(room, input.participant.id);
  const mustSpectate = Boolean(input.forceSpectator || cleanRoom.status === "playing" || cleanRoom.seats.challenger);
  if (mustSpectate) {
    if (cleanRoom.spectators.length >= SPECTATOR_LIMIT) {
      return { ok: false as const, reason: "spectators_full" as const, room: publicRoom(cleanRoom) };
    }
    cleanRoom.spectators = [...cleanRoom.spectators, input.participant].slice(0, SPECTATOR_LIMIT);
  } else if (!cleanRoom.seats.host) {
    cleanRoom.seats.host = input.participant;
  } else {
    cleanRoom.seats.challenger = input.participant;
  }

  await upsertStoredRoom(cleanRoom);
  return { ok: true as const, room: publicRoom(cleanRoom), joinedAs: mustSpectate ? "spectator" : "player" };
}

export async function moveTriadParticipantToSpectator(code: string, participant: TriadRoomParticipant) {
  const room = await getStoredRoom(code);
  if (!room) return { ok: false as const, reason: "not_found" as const };
  if (room.status === "playing") return { ok: false as const, reason: "already_playing" as const, room: publicRoom(room) };

  const cleanRoom = removeParticipant(room, participant.id);
  if (cleanRoom.spectators.length >= SPECTATOR_LIMIT) {
    return { ok: false as const, reason: "spectators_full" as const, room: publicRoom(cleanRoom) };
  }
  cleanRoom.spectators = [...cleanRoom.spectators, participant];
  await upsertStoredRoom(cleanRoom);
  return { ok: true as const, room: publicRoom(cleanRoom) };
}

export async function takeTriadRoomSlot(code: string, slot: TriadRoomSlot, participant: TriadRoomParticipant) {
  const room = await getStoredRoom(code);
  if (!room) return { ok: false as const, reason: "not_found" as const };
  if (room.status === "playing") return { ok: false as const, reason: "already_playing" as const, room: publicRoom(room) };
  if (room.seats[slot]) return { ok: false as const, reason: "slot_taken" as const, room: publicRoom(room) };

  const cleanRoom = removeParticipant(room, participant.id);
  cleanRoom.seats[slot] = participant;
  await upsertStoredRoom(cleanRoom);
  return { ok: true as const, room: publicRoom(cleanRoom) };
}

export async function startTriadRoom(code: string, participantId: string) {
  const room = await getStoredRoom(code);
  if (!room) return { ok: false as const, reason: "not_found" as const };
  if (room.hostId !== participantId) return { ok: false as const, reason: "not_host" as const, room: publicRoom(room) };
  if (!room.seats.host || !room.seats.challenger) {
    return { ok: false as const, reason: "need_two_players" as const, room: publicRoom(room) };
  }

  room.status = "playing";
  await upsertStoredRoom(room);
  return { ok: true as const, room: publicRoom(room) };
}

export async function leaveTriadRoom(code: string, participantId: string) {
  const room = await getStoredRoom(code);
  if (!room) return { ok: true as const };
  const cleanRoom = removeParticipant(room, participantId);
  if (!cleanRoom.seats.host && !cleanRoom.seats.challenger && cleanRoom.spectators.length === 0) {
    await deleteStoredRoom(room.code);
    return { ok: true as const };
  }
  await upsertStoredRoom(cleanRoom);
  return { ok: true as const, room: publicRoom(cleanRoom) };
}
