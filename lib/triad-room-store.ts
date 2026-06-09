import { prisma } from "@/lib/prisma";
import {
  resolveTriadTurn,
  triadCardByNo,
  triadCards,
  triadSkillRuleByNo,
  type TriadTriangle,
  type TriadTurn,
  type TriadTurnResult,
} from "@/lib/triad-dominion";

export type TriadRoomAccess = "public" | "private";
export type TriadRoomStatus = "waiting" | "playing";
export type TriadRoomSlot = "host" | "challenger";
export type TriadDeckMode = "all" | "monster" | "skill";
type TriadBlessingChoice = "draw-skill" | "reroll-own" | "reroll-opponent";

export type TriadRoomSkillChoice = {
  fightNo: number;
  turn: TriadTurn;
  side: TriadRoomSlot;
  lane: keyof TriadTriangle;
  cardNo: string;
  startedAt: number;
  deadlineAt: number;
  selectedTarget: string;
  skipped: boolean;
  blessingChoice?: TriadBlessingChoice;
  blessingDrawCardNo?: string;
  blessingPreviewTopNo?: string;
};

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
  deckMode: TriadDeckMode;
  selectionPools: {
    host: string[];
    challenger: string[];
  };
  deckStartedAt: number;
  triangles: {
    host: TriadTriangle;
    challenger: TriadTriangle;
  };
  skillChoices: TriadRoomSkillChoice[];
  turns: TriadTurnResult[];
  activeTurn: TriadTurn;
  fightNo: number;
  turnStartedAt: number;
  matchWinner: TriadRoomSlot | "";
  surrenderedBy: TriadRoomSlot | "";
  matchEndedAt: number;
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
const SKILL_CHOICE_TIMEOUT_MS = 30_000;
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
  return Array.isArray(value) ? value.map((item) => cleanText(item)).filter(Boolean).slice(0, 40) : [];
}

function normalizeDeckMode(value: unknown): TriadDeckMode {
  if (value === "monster") return "monster";
  if (value === "skill") return "skill";
  return "all";
}

function deckCardCounts(deck: string[]) {
  return deck.reduce(
    (counts, cardNo) => {
      const card = triadCardByNo.get(cardNo);
      if (!card || card.kind === "unknown") return counts;
      counts.total += 1;
      if (card.kind === "monster") counts.monsters += 1;
      if (card.kind === "skill") counts.skills += 1;
      return counts;
    },
    { total: 0, monsters: 0, skills: 0 }
  );
}

function normalizeDeckForMode(mode: TriadDeckMode, deck: unknown) {
  const cards = normalizeDeck(deck);
  if (mode !== "monster") return cards;
  return cards.filter((cardNo) => triadCardByNo.get(cardNo)?.kind === "monster");
}

function validateDeckForMode(mode: TriadDeckMode, deck: string[]) {
  const counts = deckCardCounts(deck);
  const errors: string[] = [];

  if (counts.total !== 13) {
    errors.push("เด็คต้องมีการ์ดทั้งหมด 13 ใบ");
  }

  if (mode === "all") {
    if (counts.monsters < 3) errors.push("โหมด ALL IN ONE ต้องมีการ์ดมอนสเตอร์อย่างน้อย 3 ใบ");
    return { ok: errors.length === 0, errors };
  }

  if (mode === "monster") {
    if (counts.monsters !== 13 || counts.skills > 0) {
      errors.push("โหมด MONSTER ต้องใช้การ์ดมอนสเตอร์ครบ 13 ใบ");
    }
    return { ok: errors.length === 0, errors };
  }

  if (counts.monsters !== 5 || counts.skills !== 8) {
    errors.push("โหมด SKILL ต้องมีการ์ดมอนสเตอร์ 5 ใบ และการ์ดสกิล 8 ใบ");
  }

  return { ok: errors.length === 0, errors };
}

function normalizeSkillChoices(value: unknown): TriadRoomSkillChoice[] {
  if (!Array.isArray(value)) return [];
  const mapped: Array<TriadRoomSkillChoice | null> = value
    .map((item) => {
      const raw = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const turn = Number(raw.turn || 1);
      const side = raw.side === "challenger" ? "challenger" : raw.side === "host" ? "host" : "";
      const lane = raw.lane === "left" || raw.lane === "right" || raw.lane === "top" ? raw.lane : "";
      const cardNo = cleanText(raw.cardNo);
      if (!side || !lane || !cardNo || (turn !== 1 && turn !== 2 && turn !== 3)) return null;
      return {
        fightNo: Number(raw.fightNo || 1),
        turn: turn as TriadTurn,
        side,
        lane,
        cardNo,
        startedAt: Number(raw.startedAt || Date.now()),
        deadlineAt: Number(raw.deadlineAt || Date.now() + SKILL_CHOICE_TIMEOUT_MS),
        selectedTarget: cleanText(raw.selectedTarget),
        skipped: Boolean(raw.skipped),
        blessingChoice:
          raw.blessingChoice === "draw-skill" || raw.blessingChoice === "reroll-own" || raw.blessingChoice === "reroll-opponent"
            ? raw.blessingChoice
            : undefined,
        blessingDrawCardNo: cleanText(raw.blessingDrawCardNo),
        blessingPreviewTopNo: cleanText(raw.blessingPreviewTopNo),
      };
    });
  return mapped.filter((item): item is TriadRoomSkillChoice => item !== null);
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
    deckMode: normalizeDeckMode(raw.deckMode),
    selectionPools: {
      host: normalizeDeck((raw.selectionPools as Record<string, unknown> | undefined)?.host),
      challenger: normalizeDeck((raw.selectionPools as Record<string, unknown> | undefined)?.challenger),
    },
    deckStartedAt: Number(raw.deckStartedAt || Date.now()),
    triangles: {
      host: { ...emptyTriangle(), ...((triangles.host as TriadTriangle | undefined) || {}) },
      challenger: { ...emptyTriangle(), ...((triangles.challenger as TriadTriangle | undefined) || {}) },
    },
    skillChoices: normalizeSkillChoices(raw.skillChoices),
    turns: Array.isArray(raw.turns) ? (raw.turns as TriadTurnResult[]) : [],
    activeTurn: activeTurn === 2 || activeTurn === 3 ? activeTurn : 1,
    fightNo: Math.max(1, Math.min(4, Number(raw.fightNo || 1))),
    turnStartedAt: Number(raw.turnStartedAt || Date.now()),
    matchWinner: raw.matchWinner === "host" || raw.matchWinner === "challenger" ? raw.matchWinner : "",
    surrenderedBy: raw.surrenderedBy === "host" || raw.surrenderedBy === "challenger" ? raw.surrenderedBy : "",
    matchEndedAt: Number(raw.matchEndedAt || 0),
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
          "game" JSONB NOT NULL DEFAULT '{"decks":{"host":[],"challenger":[]},"deckReady":{"host":false,"challenger":false},"deckStartedAt":0,"triangles":{"host":{"top":"","left":"","right":""},"challenger":{"top":"","left":"","right":""}},"turns":[],"activeTurn":1,"fightNo":1,"turnStartedAt":0,"matchWinner":"","surrenderedBy":"","matchEndedAt":0}'::jsonb,
          "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TriadRoom_status_idx" ON "TriadRoom" ("status")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TriadRoom_createdAt_idx" ON "TriadRoom" ("createdAt" DESC)`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "TriadRoom" ADD COLUMN IF NOT EXISTS "game" JSONB NOT NULL DEFAULT '{"decks":{"host":[],"challenger":[]},"deckReady":{"host":false,"challenger":false},"deckStartedAt":0,"triangles":{"host":{"top":"","left":"","right":""},"challenger":{"top":"","left":"","right":""}},"turns":[],"activeTurn":1,"fightNo":1,"turnStartedAt":0,"matchWinner":"","surrenderedBy":"","matchEndedAt":0}'::jsonb`);
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
    const deckFinalized = deckSelectExpired(room) && finalizeDeckSelection(room);
    const choicesExpired = markExpiredSkillChoices(room);
    const hadResult = room.game.turns.some((turn) => turn.turn === room.game.activeTurn);
    resolveIfBothLocked(room);
    const resolvedAfterChoiceTimeout = !hadResult && room.game.turns.some((turn) => turn.turn === room.game.activeTurn);
    if (deckFinalized || choicesExpired || resolvedAfterChoiceTimeout) {
      await upsertStoredRoom(room);
    }
  }
  return aliveRooms.map(publicRoom);
}

export async function createTriadRoom(input: {
  access: TriadRoomAccess;
  password?: string;
  participant: TriadRoomParticipant;
  deckMode?: TriadDeckMode;
}) {
  const existingRooms = await withRoomStore("list", dbListRooms, memoryListRooms);
  const code = roomCode(existingRooms);
  const deckMode = normalizeDeckMode(input.deckMode);
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
    game: normalizeGame({
      deckMode,
      selectionPools: buildSelectionPools(deckMode, code),
    }),
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

function canControlStoredRoom(room: StoredTriadRoom, participantId: string) {
  return Boolean(participantId && (room.hostId === participantId || room.seats.host?.id === participantId));
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

function shuffled<T>(items: T[], seed: string) {
  const next = [...items];
  let state = seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) || 1;
  for (let index = next.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const swapIndex = state % (index + 1);
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function pairedMonsterPools(seed: string) {
  const monsters = triadCards
    .filter((card) => card.kind === "monster")
    .sort((a, b) => a.attack + a.support - (b.attack + b.support));
  const buckets = 5;
  const perBucket = 4;
  const host: string[] = [];
  const challenger: string[] = [];
  for (let bucket = 0; bucket < buckets; bucket += 1) {
    const start = Math.floor((monsters.length / buckets) * bucket);
    const end = Math.floor((monsters.length / buckets) * (bucket + 1));
    const bucketCards = shuffled(monsters.slice(start, end), `${seed}:monster:${bucket}`).slice(0, perBucket * 2);
    host.push(...bucketCards.slice(0, perBucket).map((card) => card.cardNo));
    challenger.push(...bucketCards.slice(perBucket, perBucket * 2).map((card) => card.cardNo));
  }
  return {
    host: shuffled(host, `${seed}:host:monster:final`).slice(0, 20),
    challenger: shuffled(challenger, `${seed}:challenger:monster:final`).slice(0, 20),
  };
}

function randomSkillPool(seed: string) {
  return shuffled(
    triadCards.filter((card) => card.kind === "skill"),
    `${seed}:skill`
  ).slice(0, 20).map((card) => card.cardNo);
}

function randomCardNoByKind(kind: "monster" | "skill") {
  const pool = triadCards.filter((card) => card.kind === kind);
  const card = pool[Math.floor(Math.random() * Math.max(1, pool.length))];
  return card?.cardNo || "";
}

function buildSelectionPools(mode: TriadDeckMode, seed: string): TriadRoomGame["selectionPools"] {
  const allCards = shuffled(
    triadCards.filter((card) => card.kind !== "unknown").map((card) => card.cardNo),
    `${seed}:all`
  );
  if (mode === "all") {
    return {
      host: shuffled(allCards, `${seed}:host:all`),
      challenger: shuffled(allCards, `${seed}:challenger:all`),
    };
  }
  const monsters = pairedMonsterPools(seed);
  if (mode === "monster") {
    return {
      host: monsters.host,
      challenger: monsters.challenger,
    };
  }
  return {
    host: [...monsters.host, ...randomSkillPool(`${seed}:host`)],
    challenger: [...monsters.challenger, ...randomSkillPool(`${seed}:challenger`)],
  };
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

function finalizeDeckSelection(room: StoredTriadRoom, force = false) {
  if (battleDecksReady(room) && !force) return false;
  room.game.deckReady = { host: true, challenger: true };
  room.game.triangles = { host: emptyTriangle(), challenger: emptyTriangle() };
  room.game.turns = [];
  room.game.activeTurn = 1;
  room.game.fightNo = 1;
  room.game.matchWinner = "";
  room.game.surrenderedBy = "";
  room.game.matchEndedAt = 0;
  room.game.turnStartedAt = Date.now();
  return true;
}

function skillNeedsManualChoice(cardNo: string) {
  const rule = triadSkillRuleByNo.get(cleanText(cardNo));
  if (!rule) return false;
  return /เลือก|choose|target/i.test(rule.text) || rule.target === "own-one" || rule.target === "opponent-one" || rule.target === "any-one";
}

function currentTurnChoices(room: StoredTriadRoom) {
  return room.game.skillChoices.filter(
    (choice) => choice.fightNo === room.game.fightNo && choice.turn === room.game.activeTurn
  );
}

function currentTurnBlessings(room: StoredTriadRoom) {
  return currentTurnChoices(room).filter((choice) => choice.cardNo === "254" && choice.selectedTarget && !choice.skipped);
}

function applyTurnBlessings(room: StoredTriadRoom) {
  const hostTriangle = { ...room.game.triangles.host };
  const challengerTriangle = { ...room.game.triangles.challenger };
  const events: { choice: TriadRoomSkillChoice; summary: string }[] = [];
  for (const choice of currentTurnBlessings(room)) {
    const sideTriangle = choice.side === "host" ? hostTriangle : challengerTriangle;
    const opponentTriangle = choice.side === "host" ? challengerTriangle : hostTriangle;
    if (choice.selectedTarget === "draw-skill") {
      events.push({
        choice,
        summary: choice.blessingDrawCardNo
          ? `No.254 ขอพรศักดิ์สิทธิ์: สุ่มสกิลเพิ่ม No.${choice.blessingDrawCardNo}`
          : "No.254 ขอพรศักดิ์สิทธิ์: สุ่มสกิลเพิ่ม",
      });
      continue;
    }
    if (choice.selectedTarget === "reroll-own") {
      if (choice.blessingPreviewTopNo) {
        sideTriangle.top = choice.blessingPreviewTopNo;
      }
      events.push({
        choice,
        summary: choice.blessingPreviewTopNo
          ? `No.254 ขอพรศักดิ์สิทธิ์: เปลี่ยนมอนสเตอร์หลักฝั่ง${choice.side === "host" ? "เรา" : "ตรงข้าม"}เป็น No.${choice.blessingPreviewTopNo}`
          : `No.254 ขอพรศักดิ์สิทธิ์: เปลี่ยนมอนสเตอร์หลักฝั่ง${choice.side === "host" ? "เรา" : "ตรงข้าม"}`,
      });
      continue;
    }
    if (choice.selectedTarget === "reroll-opponent") {
      if (choice.blessingPreviewTopNo) {
        opponentTriangle.top = choice.blessingPreviewTopNo;
      }
      events.push({
        choice,
        summary: choice.blessingPreviewTopNo
          ? `No.254 ขอพรศักดิ์สิทธิ์: เปลี่ยนมอนสเตอร์หลักฝั่ง${choice.side === "host" ? "ตรงข้าม" : "เรา"}เป็น No.${choice.blessingPreviewTopNo}`
          : `No.254 ขอพรศักดิ์สิทธิ์: เปลี่ยนมอนสเตอร์หลักฝั่ง${choice.side === "host" ? "ตรงข้าม" : "เรา"}`,
      });
    }
  }
  return { player: hostTriangle, opponent: challengerTriangle, events };
}

function ensureSkillChoices(room: StoredTriadRoom) {
  const turn = room.game.activeTurn;
  const lane = laneForTurn(turn);
  const now = Date.now();
  const nextChoices = currentTurnChoices(room);
  for (const side of ["host", "challenger"] as const) {
    const cardNo = room.game.triangles[side][lane];
    if (!cardNo || !skillNeedsManualChoice(cardNo)) continue;
    if (nextChoices.some((choice) => choice.side === side && choice.cardNo === cardNo)) continue;
    nextChoices.push({
      fightNo: room.game.fightNo,
      turn,
      side,
      lane,
      cardNo,
      startedAt: now,
      deadlineAt: now + SKILL_CHOICE_TIMEOUT_MS,
      selectedTarget: "",
      skipped: false,
    });
  }
  room.game.skillChoices = [
    ...room.game.skillChoices.filter(
      (choice) => choice.fightNo !== room.game.fightNo || choice.turn !== room.game.activeTurn
    ),
    ...nextChoices,
  ];
  return nextChoices;
}

function markExpiredSkillChoices(room: StoredTriadRoom) {
  const now = Date.now();
  let changed = false;
  room.game.skillChoices = room.game.skillChoices.map((choice) => {
    if (choice.fightNo !== room.game.fightNo || choice.turn !== room.game.activeTurn || choice.selectedTarget || choice.skipped) {
      return choice;
    }
    if (now < choice.deadlineAt) return choice;
    changed = true;
    return { ...choice, skipped: true };
  });
  return changed;
}

function skillChoicesResolved(room: StoredTriadRoom) {
  const choices = ensureSkillChoices(room);
  markExpiredSkillChoices(room);
  return choices.every((choice) => choice.selectedTarget || choice.skipped);
}

function resolveIfBothLocked(room: StoredTriadRoom) {
  const turn = room.game.activeTurn;
  const lane = laneForTurn(turn);
  if (!room.game.triangles.host[lane] || !room.game.triangles.challenger[lane]) return;
  if (!skillChoicesResolved(room)) return;
  const opener = getOpeningSide(room);
  const skippedSkillCardNos = currentTurnChoices(room)
    .filter((choice) => choice.skipped && !choice.selectedTarget)
    .map((choice) => choice.cardNo);
  skippedSkillCardNos.push(...currentTurnBlessings(room).map(() => "254"));
  const blessingState = applyTurnBlessings(room);
  const playerTriangles = blessingState.player;
  const opponentTriangles = blessingState.opponent;
  const rawResult = resolveTriadTurn({
    turn,
    player: opener === "host" ? playerTriangles : opponentTriangles,
    opponent: opener === "host" ? opponentTriangles : playerTriangles,
    skippedSkillCardNos,
  });
  const result = opener === "host" ? rawResult : flipResultToHostPerspective(rawResult);
  const blessingEvents = blessingState.events.map(({ choice, summary }) => ({
    cardNo: choice.cardNo,
    name: triadCards.find((card) => card.cardNo === choice.cardNo)?.name || "ขอพรศักดิ์สิทธิ์",
    side: choice.side === opener ? "player" as const : "opponent" as const,
    type: "unparsed" as const,
    text: triadCards.find((card) => card.cardNo === choice.cardNo)?.skillText || "",
    summary,
  }));
  room.game.turns = [...room.game.turns.filter((item) => item.turn !== turn), { ...result, skillEvents: [...blessingEvents, ...result.skillEvents] }].sort((a, b) => a.turn - b.turn);
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
  room.game.decks[side] = normalizeDeckForMode(room.game.deckMode || "all", deck);
  if (deckSelectExpired(room)) {
    finalizeDeckSelection(room, true);
  }
  await upsertStoredRoom(room);
  return { ok: true as const, room: publicRoom(room), battleReady: battleDecksReady(room) };
}

export async function readyTriadRoomDeck(code: string, participantId: string, deck: string[]) {
  const room = await getStoredRoom(code);
  if (!room) return { ok: false as const, reason: "not_found" as const };
  const side = sideForParticipant(room, participantId);
  if (!side) return { ok: false as const, reason: "not_player" as const, room: publicRoom(room) };
  const wasBattleReady = battleDecksReady(room);
  if (!room.game.deckReady[side]) {
    room.game.decks[side] = normalizeDeckForMode(room.game.deckMode || "all", deck);
    const validation = validateDeckForMode(room.game.deckMode || "all", room.game.decks[side]);
    if (!validation.ok) {
      return {
        ok: false as const,
        reason: "invalid_deck" as const,
        room: publicRoom(room),
        battleReady: battleDecksReady(room),
      };
    }
    room.game.deckReady[side] = true;
  }
  if ((!wasBattleReady && battleDecksReady(room)) || deckSelectExpired(room)) {
    finalizeDeckSelection(room, true);
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

export async function chooseTriadRoomSkillTarget(code: string, participantId: string, selectedTarget: string) {
  const room = await getStoredRoom(code);
  if (!room) return { ok: false as const, reason: "not_found" as const };
  const side = sideForParticipant(room, participantId);
  if (!side) return { ok: false as const, reason: "not_player" as const, room: publicRoom(room) };
  const turn = room.game.activeTurn;
  const lane = laneForTurn(turn);
  ensureSkillChoices(room);
  markExpiredSkillChoices(room);
  const choice = room.game.skillChoices.find(
    (item) => item.fightNo === room.game.fightNo && item.turn === turn && item.side === side && item.lane === lane
  );
  if (!choice) return { ok: false as const, reason: "no_choice" as const, room: publicRoom(room) };
  if (choice.skipped || Date.now() > choice.deadlineAt) {
    choice.skipped = true;
    resolveIfBothLocked(room);
    await upsertStoredRoom(room);
    return { ok: false as const, reason: "choice_expired" as const, room: publicRoom(room) };
  }
  const cleanTarget = cleanText(selectedTarget);
  if (choice.cardNo === "254") {
    if (!["draw-skill", "reroll-own", "reroll-opponent"].includes(cleanTarget)) {
      return { ok: false as const, reason: "invalid_target" as const, room: publicRoom(room) };
    }
    choice.selectedTarget = cleanTarget;
    choice.blessingChoice = cleanTarget as TriadBlessingChoice;
    if (cleanTarget === "draw-skill") {
      const drawn = randomCardNoByKind("skill");
      if (drawn) {
        choice.blessingDrawCardNo = drawn;
        room.game.decks[side] = [...room.game.decks[side], drawn];
      }
    } else {
      const drawn = randomCardNoByKind("monster");
      if (drawn) {
        choice.blessingPreviewTopNo = drawn;
      }
    }
  } else {
    choice.selectedTarget = cleanTarget || "selected";
  }
  resolveIfBothLocked(room);
  await upsertStoredRoom(room);
  return {
    ok: true as const,
    room: publicRoom(room),
    resolved: room.game.turns.some((item) => item.turn === room.game.activeTurn),
  };
}

export async function advanceTriadRoomTurn(code: string, participantId: string) {
  const room = await getStoredRoom(code);
  if (!room) return { ok: false as const, reason: "not_found" as const };
  if (!canControlStoredRoom(room, participantId)) return { ok: false as const, reason: "not_host" as const, room: publicRoom(room) };
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
  if (room.status !== "playing" || room.game.decks.host.length < 13 || room.game.decks.challenger.length < 13) {
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

export async function surrenderTriadRoom(code: string, participantId: string) {
  const room = await getStoredRoom(code);
  if (!room) return { ok: false as const, reason: "not_found" as const };
  const side = sideForParticipant(room, participantId);
  if (!side) return { ok: false as const, reason: "not_player" as const, room: publicRoom(room) };
  if (room.status !== "playing") return { ok: false as const, reason: "not_playing" as const, room: publicRoom(room) };

  const winner: TriadRoomSlot = side === "host" ? "challenger" : "host";
  room.game.surrenderedBy = side;
  room.game.matchWinner = winner;
  room.game.matchEndedAt = Date.now();
  room.game.fightNo = 4;
  await upsertStoredRoom(room);
  return { ok: true as const, room: publicRoom(room), surrenderedBy: side, winner };
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
  const mustSpectate = Boolean(
    input.forceSpectator ||
    cleanRoom.status === "playing" ||
    (cleanRoom.seats.host && cleanRoom.seats.challenger)
  );
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
  if (!cleanRoom.hostId || !participantInStoredRoom(cleanRoom, cleanRoom.hostId)) {
    cleanRoom.hostId = cleanRoom.seats.host?.id || participant.id;
  }
  await upsertStoredRoom(cleanRoom);
  return { ok: true as const, room: publicRoom(cleanRoom) };
}

export async function startTriadRoom(code: string, participantId: string) {
  const room = await getStoredRoom(code);
  if (!room) return { ok: false as const, reason: "not_found" as const };
  if (!canControlStoredRoom(room, participantId)) return { ok: false as const, reason: "not_host" as const, room: publicRoom(room) };
  if (!room.seats.host || !room.seats.challenger) {
    return { ok: false as const, reason: "need_two_players" as const, room: publicRoom(room) };
  }

  room.status = "playing";
  const deckMode = room.game.deckMode || "all";
  room.game = {
    ...freshGame(),
    deckMode,
    selectionPools: buildSelectionPools(deckMode, `${room.code}:${Date.now()}`),
  };
  await upsertStoredRoom(room);
  return { ok: true as const, room: publicRoom(room) };
}

export async function resetTriadRoomBattle(code: string, participantId: string) {
  const room = await getStoredRoom(code);
  if (!room) return { ok: false as const, reason: "not_found" as const };
  if (!canControlStoredRoom(room, participantId)) return { ok: false as const, reason: "not_host" as const, room: publicRoom(room) };
  room.status = "waiting";
  room.game = {
    ...freshGame(),
    deckMode: room.game.deckMode || "all",
    selectionPools: buildSelectionPools(room.game.deckMode || "all", `${room.code}:${Date.now()}`),
  };
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

export async function clearTriadRooms() {
  const rooms = await withRoomStore("list", dbListRooms, memoryListRooms);
  for (const room of rooms) {
    await deleteStoredRoom(room.code);
  }
  globalForTriadRooms.nexoraTriadRooms = [];
  return { ok: true as const, cleared: rooms.length };
}

export async function leaveTriadRoom(code: string, participantId: string) {
  const room = await getStoredRoom(code);
  if (!room) return { ok: true as const };
  const cleanRoom = removeParticipant(room, participantId);
  if (!cleanRoom.seats.host && !cleanRoom.seats.challenger && cleanRoom.spectators.length === 0) {
    await deleteStoredRoom(room.code);
    return { ok: true as const };
  }
  const ownerStillPresent = participantInStoredRoom(cleanRoom, cleanRoom.hostId);
  if (!cleanRoom.seats.host && cleanRoom.seats.challenger) {
    cleanRoom.seats.host = cleanRoom.seats.challenger;
    cleanRoom.seats.challenger = null;
  } else if (!cleanRoom.seats.host && cleanRoom.spectators.length > 0) {
    const [nextHost, ...remainingSpectators] = cleanRoom.spectators;
    cleanRoom.seats.host = nextHost;
    cleanRoom.spectators = remainingSpectators;
  }

  if (ownerStillPresent) {
    cleanRoom.hostId = room.hostId;
  } else if (cleanRoom.seats.host) {
    cleanRoom.hostId = cleanRoom.seats.host.id;
  } else if (cleanRoom.seats.challenger) {
    cleanRoom.hostId = cleanRoom.seats.challenger.id;
  } else if (cleanRoom.spectators.length > 0) {
    cleanRoom.hostId = cleanRoom.spectators[0].id;
  }
  if (cleanRoom.status === "playing" && (!cleanRoom.seats.host || !cleanRoom.seats.challenger)) {
    cleanRoom.status = "waiting";
    cleanRoom.game = freshGame();
  }
  await upsertStoredRoom(cleanRoom);
  return { ok: true as const, room: publicRoom(cleanRoom) };
}
