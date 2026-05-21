import { prisma } from "@/lib/prisma";
import {
  resolveTriadTurn,
  type TriadTriangle,
  type TriadTurn,
  type TriadTurnResult,
} from "@/lib/triad-dominion";

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
  updatedAt: number;
  seats: {
    host: TriadRoomParticipant | null;
    challenger: TriadRoomParticipant | null;
  };
  spectators: TriadRoomParticipant[];
  game: TriadRoomGame;
};

export type TriadRoomGame = {
  decks: {
    host: string[];
    challenger: string[];
  };
  deckReady: {
    host: boolean;
    challenger: boolean;
  };
  deckStartedAt: number;
  triangles: {
    host: TriadTriangle;
    challenger: TriadTriangle;
  };
  turns: TriadTurnResult[];
  activeTurn: TriadTurn;
  fightNo: number;
  turnStartedAt: number;
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
  updatedAt: Date | string;
  seats: unknown;
  spectators: unknown;
  game: unknown;
};

const SPECTATOR_LIMIT = 10;
const TURN_TIMEOUT_MS = 120_000;
const DECK_SELECT_TIMEOUT_MS = 5 * 60_000;
const WAITING_ROOM_TTL_MS = 15 * 60_000;
const PLAYING_ROOM_TTL_MS = 30 * 60_000;

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

function emptyTriangle(): TriadTriangle {
  return { top: "", left: "", right: "" };
}

function normalizeDeck(value: unknown) {
  return Array.isArray(value) ? value.map((item) => cleanText(item)).filter(Boolean).slice(0, 9) : [];
}

function normalizeGame(value: unknown): TriadRoomGame {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const decks = raw.decks && typeof raw.decks === "object" ? (raw.decks as Record<string, unknown>) : {};
  const deckReady = raw.deckReady && typeof raw.deckReady === "object" ? (raw.deckReady as Record<string, unknown>) : {};
  const triangles = raw.triangles && typeof raw.triangles === "object" ? (raw.triangles as Record<string, unknown>) : {};
  const activeTurn = Number(raw.activeTurn || 1);
  return {
    decks: {
      host: normalizeDeck(decks.host),
      challenger: normalizeDeck(decks.challenger),
    },
    deckReady: {
      host: Boolean(deckReady.host),
      challenger: Boolean(deckReady.challenger),
    },
    deckStartedAt: Number(raw.deckStartedAt || Date.now()),
    triangles: {
      host: { ...emptyTriangle(), ...((triangles.host as TriadTriangle | undefined) || {}) },
      challenger: { ...emptyTriangle(), ...((triangles.challenger as TriadTriangle | undefined) || {}) },
    },
    turns: Array.isArray(raw.turns) ? (raw.turns as TriadTurnResult[]) : [],
    activeTurn: activeTurn === 2 || activeTurn === 3 ? activeTurn : 1,
    fightNo: Math.max(1, Math.min(4, Number(raw.fightNo || 1))),
    turnStartedAt: Number(raw.turnStartedAt || Date.now()),
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
    updatedAt: new Date(row.updatedAt || row.createdAt).getTime(),
    seats: normalizeSeats(row.seats),
    spectators: normalizeSpectators(row.spectators),
    game: normalizeGame(row.game),
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
          "game" JSONB NOT NULL DEFAULT '{"decks":{"host":[],"challenger":[]},"deckReady":{"host":false,"challenger":false},"deckStartedAt":0,"triangles":{"host":{"top":"","left":"","right":""},"challenger":{"top":"","left":"","right":""}},"turns":[],"activeTurn":1,"fightNo":1,"turnStartedAt":0}'::jsonb,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TriadRoom_status_idx" ON "TriadRoom" ("status")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TriadRoom_createdAt_idx" ON "TriadRoom" ("createdAt" DESC)`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "TriadRoom" ADD COLUMN IF NOT EXISTS "game" JSONB NOT NULL DEFAULT '{"decks":{"host":[],"challenger":[]},"deckReady":{"host":false,"challenger":false},"deckStartedAt":0,"triangles":{"host":{"top":"","left":"","right":""},"challenger":{"top":"","left":"","right":""}},"turns":[],"activeTurn":1,"fightNo":1,"turnStartedAt":0}'::jsonb`);
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
      "updatedAt",
      "seats",
      "spectators"
      ,"game"
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
        "updatedAt",
        "seats",
        "spectators"
        ,"game"
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
      INSERT INTO "TriadRoom" ("code", "access", "password", "status", "hostId", "seats", "spectators", "game", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, to_timestamp($9 / 1000.0), NOW())
      ON CONFLICT ("code") DO UPDATE SET
        "access" = EXCLUDED."access",
        "password" = EXCLUDED."password",
        "status" = EXCLUDED."status",
        "hostId" = EXCLUDED."hostId",
        "seats" = EXCLUDED."seats",
        "spectators" = EXCLUDED."spectators",
        "game" = EXCLUDED."game",
        "updatedAt" = NOW()
    `,
    room.code,
    room.access,
    room.password,
    room.status,
    room.hostId,
    JSON.stringify(room.seats),
    JSON.stringify(room.spectators),
    JSON.stringify(room.game),
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
  room.updatedAt = Date.now();
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
  room.updatedAt = Date.now();
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

function roomIsEmpty(room: StoredTriadRoom) {
  return !room.seats.host && !room.seats.challenger && room.spectators.length === 0;
}

function roomExpired(room: StoredTriadRoom, now = Date.now()) {
  if (roomIsEmpty(room)) return true;
  const idleMs = now - Number(room.updatedAt || room.createdAt);
  if (room.status === "waiting") return idleMs > WAITING_ROOM_TTL_MS;
  return idleMs > PLAYING_ROOM_TTL_MS;
}

async function pruneExpiredRooms(rooms: StoredTriadRoom[]) {
  const now = Date.now();
  const alive: StoredTriadRoom[] = [];
  for (const room of rooms) {
    if (roomExpired(room, now)) {
      await deleteStoredRoom(room.code);
    } else {
      alive.push(room);
    }
  }
  return alive;
}

export async function listTriadRooms() {
  const storedRooms = await withRoomStore("list", dbListRooms, memoryListRooms);
  const aliveRooms = await pruneExpiredRooms(storedRooms);
  for (const room of aliveRooms) {
    if (deckSelectExpired(room) && finalizeDeckSelection(room)) {
      await upsertStoredRoom(room);
    }
  }
  return aliveRooms.map(publicRoom);
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
    updatedAt: Date.now(),
    seats: {
      host: input.participant,
      challenger: null,
    },
    spectators: [],
    game: normalizeGame(null),
  };

  await upsertStoredRoom(room);
  return publicRoom(room);
}

function sideForParticipant(room: StoredTriadRoom, participantId: string): "host" | "challenger" | null {
  if (room.seats.host?.id === participantId) return "host";
  if (room.seats.challenger?.id === participantId) return "challenger";
  return null;
}

function participantInStoredRoom(room: StoredTriadRoom, participantId: string) {
  return Boolean(sideForParticipant(room, participantId) || room.spectators.some((viewer) => viewer.id === participantId));
}

function laneForTurn(turn: TriadTurn): keyof TriadTriangle {
  if (turn === 1) return "top";
  if (turn === 2) return "left";
  return "right";
}

function metricForTurn(turn: TriadTurn): TriadTurnResult["metric"] {
  if (turn === 1) return "total";
  if (turn === 2) return "attack";
  return "support";
}

function freshGame(): TriadRoomGame {
  const now = Date.now();
  return normalizeGame({ deckStartedAt: now, turnStartedAt: now });
}

function deckSelectExpired(room: StoredTriadRoom, now = Date.now()) {
  return room.status === "playing" && now - Number(room.game.deckStartedAt || room.createdAt) >= DECK_SELECT_TIMEOUT_MS;
}

function battleDecksReady(room: StoredTriadRoom) {
  return Boolean(room.game.deckReady.host && room.game.deckReady.challenger);
}

function finalizeDeckSelection(room: StoredTriadRoom) {
  if (battleDecksReady(room)) return false;
  room.game.deckReady = { host: true, challenger: true };
  room.game.turnStartedAt = Date.now();
  return true;
}

function resolveIfBothLocked(room: StoredTriadRoom) {
  const turn = room.game.activeTurn;
  const lane = laneForTurn(turn);
  if (!room.game.triangles.host[lane] || !room.game.triangles.challenger[lane]) return;
  const opener = getOpeningSide(room);
  const rawResult = resolveTriadTurn({
    turn,
    player: room.game.triangles[opener],
    opponent: room.game.triangles[opener === "host" ? "challenger" : "host"],
  });
  const result = opener === "host" ? rawResult : flipResultToHostPerspective(rawResult);
  room.game.turns = [...room.game.turns.filter((item) => item.turn !== turn), result].sort((a, b) => a.turn - b.turn);
}

function resolveTimeout(room: StoredTriadRoom) {
  const turn = room.game.activeTurn;
  const lane = laneForTurn(turn);
  const hostLocked = Boolean(room.game.triangles.host[lane]);
  const challengerLocked = Boolean(room.game.triangles.challenger[lane]);
  if (room.game.turns.some((item) => item.turn === turn)) return;
  if (hostLocked && challengerLocked) {
    resolveIfBothLocked(room);
    return;
  }

  const winner = hostLocked && !challengerLocked ? "player" : challengerLocked && !hostLocked ? "opponent" : "draw";
  const hostTotal = winner === "player" ? 1 : 0;
  const challengerTotal = winner === "opponent" ? 1 : 0;
  const result: TriadTurnResult = {
    turn,
    metric: metricForTurn(turn),
    playerTotal: hostTotal,
    opponentTotal: challengerTotal,
    winner,
    effectivePlayer: room.game.triangles.host,
    effectiveOpponent: room.game.triangles.challenger,
    playerBreakdown: [
      hostLocked
        ? "Card locked before timeout. Waiting side wins this turn."
        : "No card locked before timeout.",
    ],
    opponentBreakdown: [
      challengerLocked
        ? "Card locked before timeout. Waiting side wins this turn."
        : "No card locked before timeout.",
    ],
    unresolvedSkills: [],
    skillEvents: [],
  };
  room.game.turns = [...room.game.turns.filter((item) => item.turn !== turn), result].sort((a, b) => a.turn - b.turn);
}

function getOpeningSide(room: StoredTriadRoom): "host" | "challenger" {
  if (room.game.activeTurn === 1) return "host";
  const previousTurn = (room.game.activeTurn - 1) as TriadTurn;
  const previousResult = room.game.turns.find((turn) => turn.turn === previousTurn);
  if (!previousResult || previousResult.winner === "draw") return "host";
  return previousResult.winner === "player" ? "host" : "challenger";
}

function flipResultToHostPerspective(result: TriadTurnResult): TriadTurnResult {
  return {
    ...result,
    playerTotal: result.opponentTotal,
    opponentTotal: result.playerTotal,
    winner:
      result.winner === "player"
        ? "opponent"
        : result.winner === "opponent"
          ? "player"
          : "draw",
    effectivePlayer: result.effectiveOpponent,
    effectiveOpponent: result.effectivePlayer,
    playerBreakdown: result.opponentBreakdown,
    opponentBreakdown: result.playerBreakdown,
    skillEvents: result.skillEvents.map((event) => ({
      ...event,
      side: event.side === "player" ? "opponent" : "player",
    })),
  };
}

export async function setTriadRoomDeck(code: string, participantId: string, deck: string[]) {
  const room = await getStoredRoom(code);
  if (!room) return { ok: false as const, reason: "not_found" as const };
  const side = sideForParticipant(room, participantId);
  if (!side) return { ok: false as const, reason: "not_player" as const, room: publicRoom(room) };
  if (room.game.deckReady[side]) {
    return { ok: false as const, reason: "deck_locked" as const, room: publicRoom(room), battleReady: battleDecksReady(room) };
  }
  room.game.decks[side] = normalizeDeck(deck);
  if (deckSelectExpired(room)) {
    finalizeDeckSelection(room);
  }
  await upsertStoredRoom(room);
  return { ok: true as const, room: publicRoom(room), battleReady: battleDecksReady(room) };
}

export async function readyTriadRoomDeck(code: string, participantId: string, deck: string[]) {
  const room = await getStoredRoom(code);
  if (!room) return { ok: false as const, reason: "not_found" as const };
  const side = sideForParticipant(room, participantId);
  if (!side) return { ok: false as const, reason: "not_player" as const, room: publicRoom(room) };
  if (!room.game.deckReady[side]) {
    room.game.decks[side] = normalizeDeck(deck);
    room.game.deckReady[side] = true;
  }
  if (battleDecksReady(room) || deckSelectExpired(room)) {
    finalizeDeckSelection(room);
  }
  await upsertStoredRoom(room);
  return { ok: true as const, room: publicRoom(room), battleReady: battleDecksReady(room) };
}

export async function lockTriadRoomCard(code: string, participantId: string, cardNo: string) {
  const room = await getStoredRoom(code);
  if (!room) return { ok: false as const, reason: "not_found" as const };
  const side = sideForParticipant(room, participantId);
  if (!side) return { ok: false as const, reason: "not_player" as const, room: publicRoom(room) };
  const lane = laneForTurn(room.game.activeTurn);
  const existingCard = room.game.triangles[side][lane];
  const turnResolved = room.game.turns.some((turn) => turn.turn === room.game.activeTurn);
  if (existingCard) {
    const sameCard = existingCard === cleanText(cardNo);
    return {
      ok: sameCard,
      reason: sameCard ? undefined : ("already_locked" as const),
      room: publicRoom(room),
      resolved: turnResolved,
    };
  }
  if (turnResolved) {
    return { ok: false as const, reason: "already_resolved" as const, room: publicRoom(room), resolved: true };
  }
  room.game.triangles[side][lane] = cleanText(cardNo);
  resolveIfBothLocked(room);
  await upsertStoredRoom(room);
  return {
    ok: true as const,
    room: publicRoom(room),
    resolved: room.game.turns.some((turn) => turn.turn === room.game.activeTurn),
  };
}

export async function advanceTriadRoomTurn(code: string, participantId: string) {
  const room = await getStoredRoom(code);
  if (!room) return { ok: false as const, reason: "not_found" as const };
  if (room.hostId !== participantId) return { ok: false as const, reason: "not_host" as const, room: publicRoom(room) };
  if (!room.game.turns.some((turn) => turn.turn === room.game.activeTurn)) {
    return { ok: false as const, reason: "turn_not_resolved" as const, room: publicRoom(room) };
  }
  if (room.game.activeTurn < 3) {
    room.game.activeTurn = (room.game.activeTurn + 1) as TriadTurn;
    room.game.turnStartedAt = Date.now();
  } else {
    room.game.fightNo = Math.min(4, room.game.fightNo + 1);
    room.game.activeTurn = 1;
    room.game.triangles = { host: emptyTriangle(), challenger: emptyTriangle() };
    room.game.turns = [];
    room.game.turnStartedAt = Date.now();
  }
  await upsertStoredRoom(room);
  return { ok: true as const, room: publicRoom(room) };
}

export async function timeoutTriadRoomTurn(code: string, participantId: string) {
  const room = await getStoredRoom(code);
  if (!room) return { ok: false as const, reason: "not_found" as const };
  if (!participantId || !participantInStoredRoom(room, participantId)) {
    return { ok: false as const, reason: "not_in_room" as const, room: publicRoom(room) };
  }
  if (room.status !== "playing" || room.game.decks.host.length !== 9 || room.game.decks.challenger.length !== 9) {
    return { ok: false as const, reason: "not_playing" as const, room: publicRoom(room) };
  }
  if (room.game.turns.some((turn) => turn.turn === room.game.activeTurn)) {
    return { ok: true as const, room: publicRoom(room), resolved: true };
  }
  if (Date.now() - room.game.turnStartedAt < TURN_TIMEOUT_MS) {
    return { ok: false as const, reason: "too_early" as const, room: publicRoom(room) };
  }

  resolveTimeout(room);
  await upsertStoredRoom(room);
  return { ok: true as const, room: publicRoom(room), resolved: true };
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
  if (slot === "host") cleanRoom.hostId = participant.id;
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
  room.game = freshGame();
  await upsertStoredRoom(room);
  return { ok: true as const, room: publicRoom(room) };
}

export async function resetTriadRoomBattle(code: string, participantId: string) {
  const room = await getStoredRoom(code);
  if (!room) return { ok: false as const, reason: "not_found" as const };
  if (room.hostId !== participantId) return { ok: false as const, reason: "not_host" as const, room: publicRoom(room) };
  room.status = "waiting";
  room.game = freshGame();
  await upsertStoredRoom(room);
  return { ok: true as const, room: publicRoom(room) };
}

export async function disbandTriadRoom(code: string, participantId: string) {
  const room = await getStoredRoom(code);
  if (!room) return { ok: true as const };
  if (room.hostId !== participantId) return { ok: false as const, reason: "not_host" as const, room: publicRoom(room) };
  await deleteStoredRoom(room.code);
  return { ok: true as const, disbanded: true as const };
}

export async function leaveTriadRoom(code: string, participantId: string) {
  const room = await getStoredRoom(code);
  if (!room) return { ok: true as const };
  const cleanRoom = removeParticipant(room, participantId);
  if (!cleanRoom.seats.host && !cleanRoom.seats.challenger && cleanRoom.spectators.length === 0) {
    await deleteStoredRoom(room.code);
    return { ok: true as const };
  }
  if (!cleanRoom.seats.host && cleanRoom.seats.challenger) {
    cleanRoom.seats.host = cleanRoom.seats.challenger;
    cleanRoom.seats.challenger = null;
    cleanRoom.hostId = cleanRoom.seats.host.id;
  } else if (!cleanRoom.seats.host && cleanRoom.spectators.length > 0) {
    const [nextHost, ...remainingSpectators] = cleanRoom.spectators;
    cleanRoom.seats.host = nextHost;
    cleanRoom.spectators = remainingSpectators;
    cleanRoom.hostId = nextHost.id;
  } else if (cleanRoom.seats.host) {
    cleanRoom.hostId = cleanRoom.seats.host.id;
  }
  if (cleanRoom.status === "playing" && (!cleanRoom.seats.host || !cleanRoom.seats.challenger)) {
    cleanRoom.status = "waiting";
    cleanRoom.game = freshGame();
  }
  await upsertStoredRoom(cleanRoom);
  return { ok: true as const, room: publicRoom(cleanRoom) };
}
