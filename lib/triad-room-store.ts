import { prisma } from "@/lib/prisma";
import {
  getTriadCardRpsChoice,
  resolveTriadTurn,
  triadCardByNo,
  triadCards,
  triadSkillRuleByNo,
  type TriadLane,
  type TriadRpsChoice,
  type TriadTriangle,
  type TriadTurn,
  type TriadTurnResult,
} from "@/lib/triad-dominion";

export type TriadRoomAccess = "public" | "private";
export type TriadRoomStatus = "waiting" | "playing";
export type TriadRoomSlot = "host" | "challenger";
export type TriadDeckMode = "all" | "monster" | "skill";
type TriadBlessingChoice = "draw-skill" | "reroll-own" | "reroll-opponent";

export type TriadOpeningTieBreak = {
  fightNo: number;
  turn: TriadTurn;
  status: "idle" | "waiting" | "resolved";
  reason: "first_turn_score_draw" | "";
  choices: Partial<Record<TriadRoomSlot, TriadRpsChoice>>;
  revealChoices?: Partial<Record<TriadRoomSlot, TriadRpsChoice>>;
  winner: TriadRoomSlot | "";
  source: "card-icon" | "manual" | "";
  message: string;
};

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

export type TriadRoomChatMessage = {
  id: string;
  roomCode: string;
  senderId: string;
  senderName: string;
  senderImage: string;
  text: string;
  createdAt: number;
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
  usedCards: {
    host: string[];
    challenger: string[];
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
  openerTieBreak: TriadOpeningTieBreak;
  turns: TriadTurnResult[];
  turnReady: {
    host: boolean;
    challenger: boolean;
  };
  activeTurn: TriadTurn;
  fightNo: number;
  turnStartedAt: number;
  matchWinner: TriadRoomSlot | "";
  surrenderedBy: TriadRoomSlot | "";
  matchEndedAt: number;
  chat: TriadRoomChatMessage[];
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
const TRIAD_DECK_SIZE = 20;
const TRIAD_MONSTER_DECK_SIZE = 20;
const TRIAD_SKILL_MODE_MONSTERS = 10;
const TRIAD_SKILL_MODE_SKILLS = 10;
const TURN_TIMEOUT_MS = 120_000;
const SKILL_CHOICE_TIMEOUT_MS = 30_000;
const WAITING_ROOM_TTL_MS = 15 * 60_000;
const PLAYING_ROOM_TTL_MS = 30 * 60_000;
const TRIAD_CHAT_LIMIT = 80;
const TRIAD_CHAT_MAX_LENGTH = 240;
const TRIAD_BOT_ID = "triad-bot-level-99";
const TRIAD_BOT_NAME = "BOT Level.99";
const TRIAD_BOT_IMAGE = "/avatar.png";

const globalForTriadRooms = globalThis as {
  nexoraTriadRooms?: StoredTriadRoom[];
  nexoraTriadRoomSchemaPromise?: Promise<void>;
  nexoraTriadRoomMutationLocks?: Map<string, Promise<void>>;
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

function triadBotParticipant(): TriadRoomParticipant {
  return {
    id: TRIAD_BOT_ID,
    name: TRIAD_BOT_NAME,
    image: TRIAD_BOT_IMAGE,
    joinedAt: Date.now(),
  };
}

function isTriadBotParticipant(participant?: TriadRoomParticipant | null) {
  return participant?.id === TRIAD_BOT_ID;
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

function emptyOpeningTieBreak(): TriadOpeningTieBreak {
  return {
    fightNo: 1,
    turn: 1,
    status: "idle",
    reason: "",
    choices: {},
    winner: "",
    source: "",
    message: "",
  };
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

  if (counts.total !== TRIAD_DECK_SIZE) {
    errors.push(`เด็คต้องมีการ์ดทั้งหมด ${TRIAD_DECK_SIZE} ใบ`);
  }

  if (mode === "all") {
    if (counts.monsters < 3) errors.push("โหมด ALL IN ONE ต้องมีการ์ดมอนสเตอร์อย่างน้อย 3 ใบ");
    return { ok: errors.length === 0, errors };
  }

  if (mode === "monster") {
    if (counts.monsters !== TRIAD_MONSTER_DECK_SIZE || counts.skills > 0) {
      errors.push(`โหมด MONSTER ต้องใช้การ์ดมอนสเตอร์ครบ ${TRIAD_MONSTER_DECK_SIZE} ใบ`);
    }
    return { ok: errors.length === 0, errors };
  }

  if (counts.monsters !== TRIAD_SKILL_MODE_MONSTERS || counts.skills !== TRIAD_SKILL_MODE_SKILLS) {
    errors.push(`โหมด SKILL ต้องมีการ์ดมอนสเตอร์ ${TRIAD_SKILL_MODE_MONSTERS} ใบ และการ์ดสกิล ${TRIAD_SKILL_MODE_SKILLS} ใบ`);
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

function normalizeChatMessages(value: unknown, roomCode = ""): TriadRoomChatMessage[] {
  if (!Array.isArray(value)) return [];
  const messages: TriadRoomChatMessage[] = [];
  for (const item of value) {
    const raw = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    const senderId = cleanText(raw.senderId);
    const text = cleanText(raw.text).slice(0, TRIAD_CHAT_MAX_LENGTH);
    if (!senderId || !text) continue;
    const createdAt = Number(raw.createdAt || Date.now());
    messages.push({
      id: cleanText(raw.id) || `${createdAt}-${senderId}`,
      roomCode: cleanText(raw.roomCode) || roomCode,
      senderId,
      senderName: cleanText(raw.senderName) || "PLAYER",
      senderImage: cleanText(raw.senderImage) || "/avatar.png",
      text,
      createdAt,
    });
  }
  return messages
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(-TRIAD_CHAT_LIMIT);
}

function normalizeRpsChoice(value: unknown): TriadRpsChoice {
  return value === "rock" || value === "scissors" || value === "paper" ? value : "unknown";
}

function normalizeOpeningTieBreak(value: unknown): TriadOpeningTieBreak {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const choices = raw.choices && typeof raw.choices === "object" ? (raw.choices as Record<string, unknown>) : {};
  const revealChoices =
    raw.revealChoices && typeof raw.revealChoices === "object"
      ? (raw.revealChoices as Record<string, unknown>)
      : null;
  const status = raw.status === "waiting" || raw.status === "resolved" ? raw.status : "idle";
  return {
    fightNo: Number(raw.fightNo || 1),
    turn: raw.turn === 2 || raw.turn === 3 ? raw.turn : 1,
    status,
    reason: raw.reason === "first_turn_score_draw" ? "first_turn_score_draw" : "",
    choices: {
      host: normalizeRpsChoice(choices.host),
      challenger: normalizeRpsChoice(choices.challenger),
    },
    ...(revealChoices
      ? {
          revealChoices: {
            host: normalizeRpsChoice(revealChoices.host),
            challenger: normalizeRpsChoice(revealChoices.challenger),
          },
        }
      : {}),
    winner: raw.winner === "host" || raw.winner === "challenger" ? raw.winner : "",
    source: raw.source === "card-icon" || raw.source === "manual" ? raw.source : "",
    message: cleanText(raw.message),
  };
}

function normalizeGame(value: unknown): TriadRoomGame {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const decks = raw.decks && typeof raw.decks === "object" ? (raw.decks as Record<string, unknown>) : {};
  const deckReady = raw.deckReady && typeof raw.deckReady === "object" ? (raw.deckReady as Record<string, unknown>) : {};
  const usedCards = raw.usedCards && typeof raw.usedCards === "object" ? (raw.usedCards as Record<string, unknown>) : {};
  const triangles = raw.triangles && typeof raw.triangles === "object" ? (raw.triangles as Record<string, unknown>) : {};
  const turnReady = raw.turnReady && typeof raw.turnReady === "object" ? (raw.turnReady as Record<string, unknown>) : {};
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
    usedCards: {
      host: normalizeDeck(usedCards.host),
      challenger: normalizeDeck(usedCards.challenger),
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
    openerTieBreak: normalizeOpeningTieBreak(raw.openerTieBreak),
    turns: Array.isArray(raw.turns) ? (raw.turns as TriadTurnResult[]) : [],
    turnReady: {
      host: Boolean(turnReady.host),
      challenger: Boolean(turnReady.challenger),
    },
    activeTurn: activeTurn === 2 || activeTurn === 3 ? activeTurn : 1,
    fightNo: Math.max(1, Math.min(4, Number(raw.fightNo || 1))),
    turnStartedAt: Number(raw.turnStartedAt || Date.now()),
    matchWinner: raw.matchWinner === "host" || raw.matchWinner === "challenger" ? raw.matchWinner : "",
    surrenderedBy: raw.surrenderedBy === "host" || raw.surrenderedBy === "challenger" ? raw.surrenderedBy : "",
    matchEndedAt: Number(raw.matchEndedAt || 0),
    chat: normalizeChatMessages(raw.chat),
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

async function withRoomMutationLock<T>(code: string, action: () => Promise<T>): Promise<T> {
  const lockKey = cleanText(code);
  if (!globalForTriadRooms.nexoraTriadRoomMutationLocks) {
    globalForTriadRooms.nexoraTriadRoomMutationLocks = new Map();
  }
  const locks = globalForTriadRooms.nexoraTriadRoomMutationLocks;
  const previous = locks.get(lockKey) || Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => current, () => current);
  locks.set(lockKey, queued);
  await previous.catch(() => null);
  try {
    return await action();
  } finally {
    release();
    if (locks.get(lockKey) === queued) {
      locks.delete(lockKey);
    }
  }
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
    const choicesExpired = markExpiredSkillChoices(room);
    const hadResult = room.game.turns.some((turn) => turn.turn === room.game.activeTurn);
    resolveIfBothLocked(room);
    const botChanged = runBotBrain(room);
    const resolvedAfterChoiceTimeout = !hadResult && room.game.turns.some((turn) => turn.turn === room.game.activeTurn);
    if (choicesExpired || resolvedAfterChoiceTimeout || botChanged) {
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
  playWithBot?: boolean;
}) {
  const existingRooms = await withRoomStore("list", dbListRooms, memoryListRooms);
  const code = roomCode(existingRooms);
  const deckMode = normalizeDeckMode(input.deckMode);
  const selectionPools = buildSelectionPools(deckMode, code);
  const room: StoredTriadRoom = {
    code,
    access: input.access,
    password: input.access === "private" ? cleanText(input.password) : "",
    status: input.playWithBot ? "playing" : "waiting",
    hostId: input.participant.id,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    seats: {
      host: input.participant,
      challenger: input.playWithBot ? triadBotParticipant() : null,
    },
    spectators: [],
    game: normalizeGame({
      deckMode,
      selectionPools,
    }),
  };
  if (input.playWithBot) {
    room.game = {
      ...freshGame(),
      deckMode,
      selectionPools,
    };
    ensureBotDeckReady(room);
  }

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

function randomCardNoByKind(kind: "monster" | "skill", excludedCardNos: string[] = []) {
  const excluded = new Set(excludedCardNos.map(cleanText).filter(Boolean));
  const pool = triadCards.filter((card) => card.kind === kind && !excluded.has(card.cardNo));
  const card = pool[Math.floor(Math.random() * Math.max(1, pool.length))];
  return card?.cardNo || "";
}

function blessingRandomExcludedCards(room: StoredTriadRoom, extra: string[] = []) {
  const triangles = [
    room.game.triangles.host.top,
    room.game.triangles.host.left,
    room.game.triangles.host.right,
    room.game.triangles.challenger.top,
    room.game.triangles.challenger.left,
    room.game.triangles.challenger.right,
  ];
  const blessingCards = room.game.skillChoices.flatMap((choice) => [
    choice.blessingDrawCardNo || "",
    choice.blessingPreviewTopNo || "",
  ]);
  return Array.from(new Set([
    ...room.game.decks.host,
    ...room.game.decks.challenger,
    ...room.game.usedCards.host,
    ...room.game.usedCards.challenger,
    ...triangles,
    ...blessingCards,
    ...extra,
  ].map(cleanText).filter(Boolean)));
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

function botDeckScore(cardNo: string) {
  const card = triadCardByNo.get(cleanText(cardNo));
  if (!card) return 0;
  if (card.kind === "monster") return card.attack + card.support + Math.max(card.attack, card.support) * 0.35;
  const rule = triadSkillRuleByNo.get(card.cardNo);
  if (!rule) return card.kind === "skill" ? 2500 : 0;
  const effectScore = rule.effects.reduce((sum, effect) => sum + Math.abs(effect.delta), 0);
  const shapeBonus: Record<string, number> = {
    "skill-cancel": 7200,
    "swap-control": 6800,
    "block-stat-gain": 5600,
    "element-transform": 3800,
    stat: 3600,
    unparsed: 2400,
  };
  return (shapeBonus[rule.shape] || 2200) + effectScore;
}

function chooseBotDeckForMode(mode: TriadDeckMode, pool: string[]) {
  const uniquePool = Array.from(new Set(pool.map(cleanText).filter(Boolean)));
  const monsters = uniquePool
    .filter((cardNo) => triadCardByNo.get(cardNo)?.kind === "monster")
    .sort((a, b) => botDeckScore(b) - botDeckScore(a));
  const skills = uniquePool
    .filter((cardNo) => triadCardByNo.get(cardNo)?.kind === "skill")
    .sort((a, b) => botDeckScore(b) - botDeckScore(a));

  if (mode === "monster") return monsters.slice(0, TRIAD_MONSTER_DECK_SIZE);
  if (mode === "skill") {
    return [
      ...monsters.slice(0, TRIAD_SKILL_MODE_MONSTERS),
      ...skills.slice(0, TRIAD_SKILL_MODE_SKILLS),
    ].slice(0, TRIAD_DECK_SIZE);
  }

  const deck = [...monsters.slice(0, 8), ...skills.slice(0, 12)];
  if (deck.length < TRIAD_DECK_SIZE) {
    deck.push(...uniquePool.filter((cardNo) => !deck.includes(cardNo)).sort((a, b) => botDeckScore(b) - botDeckScore(a)));
  }
  return deck.slice(0, TRIAD_DECK_SIZE);
}

function ensureBotDeckReady(room: StoredTriadRoom) {
  if (!isTriadBotParticipant(room.seats.challenger)) return false;
  const mode = room.game.deckMode || "all";
  const botDeck = chooseBotDeckForMode(mode, room.game.selectionPools.challenger || []);
  const validation = validateDeckForMode(mode, botDeck);
  if (!validation.ok) return false;
  const currentDeck = room.game.decks.challenger || [];
  const changed = !room.game.deckReady.challenger || currentDeck.join("|") !== botDeck.join("|");
  room.game.decks.challenger = botDeck;
  room.game.deckReady.challenger = true;
  return changed;
}

function botTargetToken(side: TriadRoomSlot, targetSide: TriadRoomSlot) {
  if (side === "host") return targetSide === "host" ? "player-top" : "bot-top";
  return targetSide === "challenger" ? "player-top" : "bot-top";
}

function chooseBotSkillTarget(room: StoredTriadRoom, choice: TriadRoomSkillChoice) {
  const opponentSide: TriadRoomSlot = choice.side === "host" ? "challenger" : "host";
  const ownSide = choice.side;
  if (choice.cardNo === "254") {
    const ownTop = triadCardByNo.get(room.game.triangles[ownSide].top);
    const opponentTop = triadCardByNo.get(room.game.triangles[opponentSide].top);
    if ((opponentTop?.attack || 0) + (opponentTop?.support || 0) > (ownTop?.attack || 0) + (ownTop?.support || 0)) {
      return "reroll-opponent";
    }
    return "draw-skill";
  }
  if (choice.cardNo === "227") {
    const target = gravityFieldTargets(room).find((side) => side === opponentSide) || gravityFieldTargets(room)[0];
    return target ? botTargetToken(choice.side, target) : "";
  }
  if (choice.cardNo === "231") {
    const target = metalSwordTargets(room).find((side) => side === opponentSide) || metalSwordTargets(room)[0];
    return target ? botTargetToken(choice.side, target) : "";
  }
  if (choice.cardNo === "232") {
    return room.game.triangles[opponentSide].top && room.game.triangles[ownSide].top
      ? `${botTargetToken(choice.side, opponentSide)}>${botTargetToken(choice.side, ownSide)}`
      : "";
  }
  if (room.game.triangles[opponentSide].top) return botTargetToken(choice.side, opponentSide);
  if (room.game.triangles[ownSide].top) return botTargetToken(choice.side, ownSide);
  return "";
}

function applyBotSkillChoice(room: StoredTriadRoom) {
  if (!isTriadBotParticipant(room.seats.challenger)) return false;
  ensureSkillChoices(room);
  const choice = currentTurnChoices(room).find(
    (item) => item.side === "challenger" && !item.selectedTarget && !item.skipped
  );
  if (!choice) return false;
  const selectedTarget = chooseBotSkillTarget(room, choice);
  if (!selectedTarget) {
    choice.skipped = true;
    resolveIfBothLocked(room);
    return true;
  }
  if (choice.cardNo === "254") {
    choice.selectedTarget = selectedTarget;
    choice.blessingChoice = selectedTarget as TriadBlessingChoice;
    if (selectedTarget === "draw-skill") {
      const drawn = randomCardNoByKind("skill", blessingRandomExcludedCards(room, ["254"]));
      if (drawn) {
        choice.blessingDrawCardNo = drawn;
        room.game.usedCards.challenger = Array.from(new Set([...(room.game.usedCards.challenger || []), drawn]));
      }
    } else {
      const drawn = randomCardNoByKind("monster", blessingRandomExcludedCards(room));
      if (drawn) choice.blessingPreviewTopNo = drawn;
    }
  } else {
    choice.selectedTarget = selectedTarget;
  }
  resolveIfBothLocked(room);
  return true;
}

function botCardScore(room: StoredTriadRoom, cardNo: string) {
  const turn = room.game.activeTurn;
  const lane = laneForTurn(turn);
  const candidateTriangles = {
    ...room.game.triangles,
    challenger: {
      ...room.game.triangles.challenger,
      [lane]: cardNo,
    },
  };
  const opener = getOpeningSide({
    ...room,
    game: {
      ...room.game,
      triangles: candidateTriangles,
    },
  });
  if (room.game.triangles.host[lane] && opener) {
    const rawResult = resolveTriadTurn({
      turn,
      player: opener === "host" ? candidateTriangles.host : candidateTriangles.challenger,
      opponent: opener === "host" ? candidateTriangles.challenger : candidateTriangles.host,
      prioritySide: "player",
      skillTargets: selectedSkillTargets({ ...room, game: { ...room.game, triangles: candidateTriangles } }, opener),
    });
    const result = opener === "host" ? rawResult : flipResultToHostPerspective(rawResult);
    const pointScore = result.winner === "opponent" ? 100_000 : result.winner === "draw" ? 25_000 : -100_000;
    return pointScore + result.opponentTotal - result.playerTotal;
  }
  const card = triadCardByNo.get(cardNo);
  if (!card) return 0;
  if (turn === 1) return card.attack + card.support;
  if (turn === 2) return card.kind === "monster" ? card.attack : botDeckScore(cardNo);
  return card.kind === "monster" ? card.support : botDeckScore(cardNo);
}

function chooseBotCardForTurn(room: StoredTriadRoom) {
  const turn = room.game.activeTurn;
  const lane = laneForTurn(turn);
  const alreadyPlaced = new Set([
    room.game.triangles.challenger.top,
    room.game.triangles.challenger.left,
    room.game.triangles.challenger.right,
    ...(room.game.usedCards.challenger || []),
  ].filter(Boolean));
  const mode = room.game.deckMode || "all";
  const requiredKind: "monster" | "skill" | "any" =
    lane === "top" ? "monster" : mode === "monster" ? "monster" : mode === "skill" ? "skill" : "any";
  const playable = (room.game.decks.challenger || []).filter((cardNo) => {
    if (alreadyPlaced.has(cardNo)) return false;
    const kind = triadCardByNo.get(cardNo)?.kind;
    if (requiredKind === "any") return kind === "monster" || kind === "skill";
    return kind === requiredKind;
  });
  return playable
    .map((cardNo) => ({ cardNo, score: botCardScore(room, cardNo) }))
    .sort((a, b) => b.score - a.score)[0]?.cardNo || "";
}

function lockBotCard(room: StoredTriadRoom) {
  if (!isTriadBotParticipant(room.seats.challenger)) return false;
  const lane = laneForTurn(room.game.activeTurn);
  if (room.game.triangles.challenger[lane]) return false;
  if (!room.game.triangles.host[lane]) return false;
  const cardNo = chooseBotCardForTurn(room);
  if (!cardNo) return false;
  room.game.triangles.challenger[lane] = cardNo;
  room.game.usedCards.challenger = Array.from(new Set([...(room.game.usedCards.challenger || []), cardNo]));
  resolveIfBothLocked(room);
  return true;
}

function botChooseOpeningTieBreak(room: StoredTriadRoom) {
  if (!isTriadBotParticipant(room.seats.challenger)) return false;
  const tieBreak = room.game.openerTieBreak;
  if (tieBreak.status !== "waiting" || (tieBreak.choices.challenger || "unknown") !== "unknown") return false;
  const hostChoice = tieBreak.choices.host || "unknown";
  const choice: TriadRpsChoice =
    hostChoice === "rock" ? "paper" :
    hostChoice === "paper" ? "scissors" :
    hostChoice === "scissors" ? "rock" :
    (["rock", "paper", "scissors"] as TriadRpsChoice[])[Math.floor(Math.random() * 3)];
  const nextChoices = { ...tieBreak.choices, challenger: choice };
  const winner = rpsWinner(nextChoices.host || "unknown", nextChoices.challenger || "unknown");
  room.game.openerTieBreak = {
    ...tieBreak,
    choices: nextChoices,
    status: winner === "host" || winner === "challenger" ? "resolved" : "waiting",
    winner: winner === "host" || winner === "challenger" ? winner : "",
    source: "manual",
    revealChoices: winner === "draw" ? nextChoices : undefined,
  };
  if (winner === "draw") room.game.openerTieBreak.choices = {};
  if (winner === "host" || winner === "challenger") {
    room.game.activeTurn = 2;
    room.game.turnReady = { host: false, challenger: false };
    room.game.turnStartedAt = Date.now();
  }
  resolveIfBothLocked(room);
  return true;
}

function readyBotForAdvance(room: StoredTriadRoom) {
  if (!isTriadBotParticipant(room.seats.challenger)) return false;
  if (!room.game.turns.some((turn) => turn.turn === room.game.activeTurn)) return false;
  if (room.game.activeTurn === 1 && room.game.turns.find((turn) => turn.turn === 1)?.winner === "draw" && room.game.openerTieBreak.status !== "resolved") {
    return false;
  }
  if (room.game.turnReady.challenger) return false;
  room.game.turnReady = { ...room.game.turnReady, challenger: true };
  if (!room.game.turnReady.host) return true;
  if (room.game.activeTurn < 3) {
    room.game.activeTurn = (room.game.activeTurn + 1) as TriadTurn;
    room.game.turnReady = { host: false, challenger: false };
    room.game.turnStartedAt = Date.now();
  } else {
    room.game.fightNo = Math.min(4, room.game.fightNo + 1);
    room.game.activeTurn = 1;
    room.game.triangles = { host: emptyTriangle(), challenger: emptyTriangle() };
    room.game.turns = [];
    room.game.turnReady = { host: false, challenger: false };
    room.game.openerTieBreak = emptyOpeningTieBreak();
    room.game.turnStartedAt = Date.now();
  }
  return true;
}

function runBotBrain(room: StoredTriadRoom) {
  if (!isTriadBotParticipant(room.seats.challenger)) return false;
  let changed = false;
  if (room.status === "playing") {
    changed = ensureBotDeckReady(room) || changed;
    if (room.game.deckReady.host && room.game.deckReady.challenger) {
      const wasReady = battleDecksReady(room);
      finalizeDeckSelection(room);
      changed = !wasReady || changed;
      for (let index = 0; index < 4; index += 1) {
        const before = JSON.stringify({
          triangles: room.game.triangles,
          choices: room.game.skillChoices,
          turns: room.game.turns,
          ready: room.game.turnReady,
          activeTurn: room.game.activeTurn,
          fightNo: room.game.fightNo,
          tie: room.game.openerTieBreak,
        });
        changed = botChooseOpeningTieBreak(room) || changed;
        changed = applyBotSkillChoice(room) || changed;
        changed = lockBotCard(room) || changed;
        changed = applyBotSkillChoice(room) || changed;
        changed = readyBotForAdvance(room) || changed;
        const after = JSON.stringify({
          triangles: room.game.triangles,
          choices: room.game.skillChoices,
          turns: room.game.turns,
          ready: room.game.turnReady,
          activeTurn: room.game.activeTurn,
          fightNo: room.game.fightNo,
          tie: room.game.openerTieBreak,
        });
        if (before === after) break;
      }
    }
  }
  return changed;
}

function freshGame(): TriadRoomGame {
  const now = Date.now();
  return normalizeGame({ deckStartedAt: now, turnStartedAt: now });
}

function battleDecksReady(room: StoredTriadRoom) {
  return Boolean(room.game.deckReady.host && room.game.deckReady.challenger);
}

function finalizeDeckSelection(room: StoredTriadRoom, force = false) {
  if (battleDecksReady(room) && !force) return false;
  room.game.deckReady = { host: true, challenger: true };
  room.game.usedCards = { host: [], challenger: [] };
  room.game.triangles = { host: emptyTriangle(), challenger: emptyTriangle() };
  room.game.turns = [];
  room.game.turnReady = { host: false, challenger: false };
  room.game.openerTieBreak = emptyOpeningTieBreak();
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

function monsterHasUnequalStats(cardNo: string) {
  const card = triadCardByNo.get(cleanText(cardNo));
  return Boolean(card?.kind === "monster" && card.attack !== card.support);
}

function metalSwordTargets(room: StoredTriadRoom) {
  return [
    monsterHasUnequalStats(room.game.triangles.host.top) ? ("host" as const) : null,
    monsterHasUnequalStats(room.game.triangles.challenger.top) ? ("challenger" as const) : null,
  ].filter((side): side is TriadRoomSlot => Boolean(side));
}

function monsterHasGravityFieldStat(cardNo: string) {
  const card = triadCardByNo.get(cleanText(cardNo));
  return Boolean(card?.kind === "monster" && (card.attack >= 7000 || card.support >= 7000));
}

function gravityFieldTargets(room: StoredTriadRoom) {
  return [
    monsterHasGravityFieldStat(room.game.triangles.host.top) ? ("host" as const) : null,
    monsterHasGravityFieldStat(room.game.triangles.challenger.top) ? ("challenger" as const) : null,
  ].filter((side): side is TriadRoomSlot => Boolean(side));
}

function parseBoardTargetSequence(value = "") {
  return value
    .split(">")
    .map((item) => item.trim())
    .filter((item): item is "player-top" | "bot-top" => item === "player-top" || item === "bot-top");
}

function canUseManualSkillChoice(room: StoredTriadRoom, cardNo: string) {
  if (cleanText(cardNo) === "227") return gravityFieldTargets(room).length > 0;
  if (cleanText(cardNo) === "231") return metalSwordTargets(room).length > 0;
  return skillNeedsManualChoice(cardNo);
}

function currentTurnChoices(room: StoredTriadRoom) {
  return room.game.skillChoices.filter(
    (choice) => choice.fightNo === room.game.fightNo && choice.turn === room.game.activeTurn
  );
}

function skillChoiceOrder(room: StoredTriadRoom): TriadRoomSlot[] {
  const opener = getOpeningSide(room);
  if (opener === "challenger") return ["challenger", "host"];
  return ["host", "challenger"];
}

function orderedSkillChoiceCandidates(room: StoredTriadRoom) {
  const turn = room.game.activeTurn;
  const lane = laneForTurn(turn);
  return skillChoiceOrder(room)
    .map((side) => {
      const cardNo = room.game.triangles[side][lane];
      return cardNo && canUseManualSkillChoice(room, cardNo)
        ? {
            side,
            cardNo,
          }
        : null;
    })
    .filter((choice): choice is { side: TriadRoomSlot; cardNo: string } => Boolean(choice));
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
      if (choice.blessingDrawCardNo) {
        sideTriangle[choice.lane] = choice.blessingDrawCardNo;
      }
      events.push({
        choice,
        summary: choice.blessingDrawCardNo
          ? `No.254 ขอพรศักดิ์สิทธิ์: เปิดสกิลเพิ่ม No.${choice.blessingDrawCardNo} แทน No.254 เฉพาะตานี้`
          : "No.254 ขอพรศักดิ์สิทธิ์: สุ่มสกิลเพิ่มไม่สำเร็จ",
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

function targetTokenToHostPerspective(side: TriadRoomSlot, target: "player-top" | "bot-top") {
  if (side === "host") return target;
  return target === "player-top" ? "bot-top" : "player-top";
}

function targetToHostPerspective(choice: TriadRoomSkillChoice): string {
  const targets = parseBoardTargetSequence(choice.selectedTarget);
  if (targets.length === 0) return "";
  return targets.map((target) => targetTokenToHostPerspective(choice.side, target)).join(">");
}

function selectedTargetSlot(side: TriadRoomSlot, selectedTarget: string): TriadRoomSlot | "" {
  if (selectedTarget !== "player-top" && selectedTarget !== "bot-top") return "";
  if (side === "host") return selectedTarget === "player-top" ? "host" : "challenger";
  return selectedTarget === "player-top" ? "challenger" : "host";
}

function selectedSkillTargets(room: StoredTriadRoom, opener: TriadRoomSlot) {
  return currentTurnChoices(room).reduce<NonNullable<Parameters<typeof resolveTriadTurn>[0]["skillTargets"]>>(
    (targets, choice) => {
      const hostPerspectiveTarget = targetToHostPerspective(choice);
      if (!hostPerspectiveTarget) return targets;
      const side = choice.side === opener ? "player" : "opponent";
      const target =
        opener === "host"
          ? hostPerspectiveTarget
          : parseBoardTargetSequence(hostPerspectiveTarget)
              .map((item) => (item === "player-top" ? "bot-top" : "player-top"))
              .join(">");
      targets[side] = {
        ...(targets[side] || {}),
        [choice.cardNo]: target,
      };
      return targets;
    },
    {}
  );
}

function ensureSkillChoices(room: StoredTriadRoom) {
  const turn = room.game.activeTurn;
  const lane = laneForTurn(turn);
  const now = Date.now();
  const existingChoices = currentTurnChoices(room);
  const nextChoices: TriadRoomSkillChoice[] = [];
  for (const candidate of orderedSkillChoiceCandidates(room)) {
    const existing = existingChoices.find((choice) => choice.side === candidate.side && choice.cardNo === candidate.cardNo);
    if (existing) {
      nextChoices.push(existing);
      if (!existing.selectedTarget && !existing.skipped) break;
      continue;
    }
    nextChoices.push({
      fightNo: room.game.fightNo,
      turn,
      side: candidate.side,
      lane,
      cardNo: candidate.cardNo,
      startedAt: now,
      deadlineAt: now + SKILL_CHOICE_TIMEOUT_MS,
      selectedTarget: "",
      skipped: false,
    });
    break;
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
  markExpiredSkillChoices(room);
  const choices = ensureSkillChoices(room);
  return choices.every((choice) => choice.selectedTarget || choice.skipped);
}

function rpsWinner(hostChoice: TriadRpsChoice, challengerChoice: TriadRpsChoice): TriadRoomSlot | "draw" | "" {
  if (hostChoice === "unknown" || challengerChoice === "unknown") return "";
  if (hostChoice === challengerChoice) return "draw";
  if (
    (hostChoice === "rock" && challengerChoice === "scissors") ||
    (hostChoice === "scissors" && challengerChoice === "paper") ||
    (hostChoice === "paper" && challengerChoice === "rock")
  ) {
    return "host";
  }
  return "challenger";
}

function updateOpeningTieBreakAfterResult(room: StoredTriadRoom, result: TriadTurnResult) {
  if (room.game.activeTurn !== 1 || result.winner !== "draw") {
    room.game.openerTieBreak = emptyOpeningTieBreak();
    return;
  }

  const hostChoice = getTriadCardRpsChoice(room.game.triangles.host.top);
  const challengerChoice = getTriadCardRpsChoice(room.game.triangles.challenger.top);
  const winner = rpsWinner(hostChoice, challengerChoice);
  const base = {
    fightNo: room.game.fightNo,
    turn: 1 as TriadTurn,
    reason: "first_turn_score_draw" as const,
    choices: { host: hostChoice, challenger: challengerChoice },
  };

  if (winner === "host" || winner === "challenger") {
    room.game.openerTieBreak = {
      ...base,
      status: "resolved",
      winner,
      source: "card-icon",
      message: "ตาแรกคะแนนเสมอแล้ว จึงใช้สัญลักษณ์เป่ายิงฉุบบนขวาของการ์ดเพื่อเลือกฝ่ายเปิดสกิลในตาถัดไปเท่านั้น คะแนนตาแรกยังเป็นเสมอ",
    };
    return;
  }

  room.game.openerTieBreak = {
    ...base,
    status: "waiting",
    choices: {},
    winner: "",
    source: "manual",
    message: "ตาแรกคะแนนเสมอ และสัญลักษณ์เป่ายิงฉุบบนการ์ดตัดสินไม่ได้ ให้ทั้งสองฝ่ายเลือก ค้อน กรรไกร หรือกระดาษ จนกว่าจะมีผู้ชนะ ผู้ชนะจะได้เปิดสกิลก่อนในตาถัดไปเท่านั้น",
  };
}

function resolveIfBothLocked(room: StoredTriadRoom) {
  const turn = room.game.activeTurn;
  if (room.game.turns.some((item) => item.turn === turn)) return;
  const lane = laneForTurn(turn);
  if (!room.game.triangles.host[lane] || !room.game.triangles.challenger[lane]) return;
  if (!skillChoicesResolved(room)) return;
  const opener = getOpeningSide(room);
  if (!opener) return;
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
    prioritySide: "player",
    skippedSkillCardNos,
    skillTargets: selectedSkillTargets(room, opener),
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
  const nextResult = { ...result, skillEvents: [...blessingEvents, ...result.skillEvents] };
  room.game.turns = [...room.game.turns.filter((item) => item.turn !== turn), nextResult].sort((a, b) => a.turn - b.turn);
  updateOpeningTieBreakAfterResult(room, nextResult);
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
    prioritySide: "player",
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

function getOpeningSide(room: StoredTriadRoom): "host" | "challenger" | null {
  if (room.game.activeTurn === 1) return "host";
  const previousTurn = (room.game.activeTurn - 1) as TriadTurn;
  const previousResult = room.game.turns.find((turn) => turn.turn === previousTurn);
  if (!previousResult) return "host";
  if (previousResult.winner === "draw") {
    if (previousTurn === 1 && room.game.openerTieBreak.status === "resolved" && room.game.openerTieBreak.winner) {
      return room.game.openerTieBreak.winner;
    }
    if (previousTurn === 1) return null;
    const latestResolvedWinner = room.game.turns
      .filter((turn) => turn.turn < previousTurn && turn.winner !== "draw")
      .sort((a, b) => b.turn - a.turn)[0];
    if (latestResolvedWinner) return latestResolvedWinner.winner === "player" ? "host" : "challenger";
    return "host";
  }
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
    prioritySide: result.prioritySide === "player" ? "opponent" : "player",
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
  if (!wasBattleReady && battleDecksReady(room)) {
    finalizeDeckSelection(room, true);
  }
  runBotBrain(room);
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
  if (!turnResolved && Date.now() - room.game.turnStartedAt >= TURN_TIMEOUT_MS) {
    resolveTimeout(room);
    runBotBrain(room);
    await upsertStoredRoom(room);
    return { ok: false as const, reason: "turn_expired" as const, room: publicRoom(room), resolved: true };
  }
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
  const cleanedCardNo = cleanText(cardNo);
  if ((room.game.usedCards?.[side] || []).includes(cleanedCardNo)) {
    return { ok: false as const, reason: "already_played" as const, room: publicRoom(room), resolved: turnResolved };
  }
  const alreadyPlayed = (["top", "left", "right"] as TriadLane[]).some(
    (item) => item !== lane && room.game.triangles[side][item] === cleanedCardNo
  );
  if (alreadyPlayed) {
    return { ok: false as const, reason: "already_played" as const, room: publicRoom(room), resolved: turnResolved };
  }
  room.game.triangles[side][lane] = cleanedCardNo;
  room.game.usedCards = {
    ...room.game.usedCards,
    [side]: Array.from(new Set([...(room.game.usedCards?.[side] || []), cleanedCardNo])),
  };
  resolveIfBothLocked(room);
  runBotBrain(room);
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
      const drawn = randomCardNoByKind("skill", blessingRandomExcludedCards(room, ["254"]));
      if (drawn) {
        choice.blessingDrawCardNo = drawn;
        room.game.usedCards[side] = Array.from(new Set([...(room.game.usedCards[side] || []), drawn]));
      }
    } else {
      const drawn = randomCardNoByKind("monster", blessingRandomExcludedCards(room));
      if (drawn) {
        choice.blessingPreviewTopNo = drawn;
      }
    }
  } else {
    if (choice.cardNo === "227") {
      const targetSlot = selectedTargetSlot(side, cleanTarget);
      if (!targetSlot || !gravityFieldTargets(room).includes(targetSlot)) {
        return { ok: false as const, reason: "invalid_target" as const, room: publicRoom(room) };
      }
    } else if (choice.cardNo === "231") {
      const targetSlot = selectedTargetSlot(side, cleanTarget);
      if (!targetSlot || !metalSwordTargets(room).includes(targetSlot)) {
        return { ok: false as const, reason: "invalid_target" as const, room: publicRoom(room) };
      }
    } else if (choice.cardNo === "232") {
      const targetSequence = parseBoardTargetSequence(cleanTarget);
      const uniqueTargets = new Set(targetSequence);
      if (targetSequence.length !== 2 || uniqueTargets.size !== 2) {
        return { ok: false as const, reason: "invalid_target" as const, room: publicRoom(room) };
      }
      const targetSlots = targetSequence.map((target) => selectedTargetSlot(side, target));
      if (targetSlots.some((slot) => !slot || !room.game.triangles[slot].top)) {
        return { ok: false as const, reason: "invalid_target" as const, room: publicRoom(room) };
      }
    }
    choice.selectedTarget = cleanTarget || "selected";
  }
  resolveIfBothLocked(room);
  runBotBrain(room);
  await upsertStoredRoom(room);
  return {
    ok: true as const,
    room: publicRoom(room),
    resolved: room.game.turns.some((item) => item.turn === room.game.activeTurn),
  };
}

export async function chooseTriadRoomOpeningTieBreak(code: string, participantId: string, choice: TriadRpsChoice) {
  const room = await getStoredRoom(code);
  if (!room) return { ok: false as const, reason: "not_found" as const };
  const side = sideForParticipant(room, participantId);
  if (!side) return { ok: false as const, reason: "not_player" as const, room: publicRoom(room) };
  const cleanChoice = normalizeRpsChoice(choice);
  if (cleanChoice === "unknown") return { ok: false as const, reason: "invalid_choice" as const, room: publicRoom(room) };
  const tieBreak = room.game.openerTieBreak;
  if (tieBreak.status !== "waiting" || tieBreak.fightNo !== room.game.fightNo) {
    return { ok: false as const, reason: "not_waiting" as const, room: publicRoom(room) };
  }

  const nextChoices = { ...tieBreak.choices, [side]: cleanChoice };
  const winner = rpsWinner(nextChoices.host || "unknown", nextChoices.challenger || "unknown");
  room.game.openerTieBreak = {
    ...tieBreak,
    choices: nextChoices,
    status: winner === "host" || winner === "challenger" ? "resolved" : "waiting",
    winner: winner === "host" || winner === "challenger" ? winner : "",
    source: "manual",
    message:
      winner === "draw"
        ? "เป่ายิงฉุบเสมออีกครั้ง เลือกใหม่จนกว่าจะมีผู้ชนะ ผู้ชนะจะได้เปิดสกิลก่อนในตาถัดไปเท่านั้น"
        : tieBreak.message,
    revealChoices: winner === "draw" ? nextChoices : undefined,
  };

  if (winner === "draw") {
    room.game.openerTieBreak.choices = {};
  }

  if (winner === "host" || winner === "challenger") {
    room.game.activeTurn = 2;
    room.game.turnReady = { host: false, challenger: false };
    room.game.turnStartedAt = Date.now();
  }

  resolveIfBothLocked(room);
  runBotBrain(room);
  await upsertStoredRoom(room);
  return { ok: true as const, room: publicRoom(room), resolved: room.game.openerTieBreak.status === "resolved" };
}

export async function advanceTriadRoomTurn(
  code: string,
  participantId: string,
  context: { fightNo?: number; turn?: TriadTurn } = {}
) {
  return withRoomMutationLock(code, async () => {
  const room = await getStoredRoom(code);
  if (!room) return { ok: false as const, reason: "not_found" as const };
  const side = sideForParticipant(room, participantId);
  if (!side && !participantInStoredRoom(room, participantId)) {
    return { ok: false as const, reason: "not_player" as const, room: publicRoom(room) };
  }

  if (
    context.fightNo &&
    context.turn &&
    (room.game.fightNo !== context.fightNo || room.game.activeTurn !== context.turn)
  ) {
    return { ok: true as const, room: publicRoom(room), advanced: true as const, stale: true as const };
  }

  const activeResult = room.game.turns.find((turn) => turn.turn === room.game.activeTurn);
  if (!activeResult) {
    return { ok: false as const, reason: "turn_not_resolved" as const, room: publicRoom(room) };
  }
  if (
    room.game.activeTurn === 1 &&
    activeResult.winner === "draw" &&
    room.game.openerTieBreak.status !== "resolved"
  ) {
    return { ok: false as const, reason: "opener_tiebreak_waiting" as const, room: publicRoom(room) };
  }
  if (
    room.game.activeTurn === 1 &&
    activeResult.winner === "draw" &&
    room.game.openerTieBreak.status === "resolved" &&
    room.game.openerTieBreak.winner
  ) {
    room.game.activeTurn = 2;
    room.game.turnReady = { host: false, challenger: false };
    room.game.turnStartedAt = Date.now();
    runBotBrain(room);
    await upsertStoredRoom(room);
    return { ok: true as const, room: publicRoom(room), advanced: true as const };
  }
  if (!side) return { ok: false as const, reason: "not_player" as const, room: publicRoom(room) };
  room.game.turnReady = {
    host: Boolean(room.game.turnReady?.host),
    challenger: Boolean(room.game.turnReady?.challenger),
    [side]: true,
  };
  if (!room.game.turnReady.host || !room.game.turnReady.challenger) {
    runBotBrain(room);
    await upsertStoredRoom(room);
    return { ok: true as const, room: publicRoom(room), waitingReady: true as const };
  }
  if (room.game.activeTurn < 3) {
    room.game.activeTurn = (room.game.activeTurn + 1) as TriadTurn;
    room.game.turnReady = { host: false, challenger: false };
    room.game.turnStartedAt = Date.now();
  } else {
    room.game.fightNo = Math.min(4, room.game.fightNo + 1);
    room.game.activeTurn = 1;
    room.game.triangles = { host: emptyTriangle(), challenger: emptyTriangle() };
    room.game.turns = [];
    room.game.turnReady = { host: false, challenger: false };
    room.game.openerTieBreak = emptyOpeningTieBreak();
    room.game.turnStartedAt = Date.now();
  }
  runBotBrain(room);
  await upsertStoredRoom(room);
  return { ok: true as const, room: publicRoom(room), advanced: true as const };
  });
}

export async function timeoutTriadRoomTurn(code: string, participantId: string) {
  const room = await getStoredRoom(code);
  if (!room) return { ok: false as const, reason: "not_found" as const };
  if (!participantId || !participantInStoredRoom(room, participantId)) {
    return { ok: false as const, reason: "not_in_room" as const, room: publicRoom(room) };
  }
  if (room.status !== "playing" || room.game.decks.host.length < TRIAD_DECK_SIZE || room.game.decks.challenger.length < TRIAD_DECK_SIZE) {
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

export async function setTriadRoomBotOpponent(code: string, participantId: string, enabled: boolean) {
  return withRoomMutationLock(code, async () => {
    const room = await getStoredRoom(code);
    if (!room) return { ok: false as const, reason: "not_found" as const };
    if (!canControlStoredRoom(room, participantId)) {
      return { ok: false as const, reason: "not_host" as const, room: publicRoom(room) };
    }
    if (room.status === "playing" && !room.game.matchWinner) {
      return { ok: false as const, reason: "already_playing" as const, room: publicRoom(room) };
    }

    if (enabled) {
      if (room.seats.challenger && !isTriadBotParticipant(room.seats.challenger)) {
        return { ok: false as const, reason: "slot_taken" as const, room: publicRoom(room) };
      }
      room.seats.challenger = triadBotParticipant();
      room.spectators = room.spectators.filter((viewer) => viewer.id !== TRIAD_BOT_ID);
      room.status = "waiting";
      room.game = {
        ...freshGame(),
        deckMode: room.game.deckMode || "all",
        selectionPools: buildSelectionPools(room.game.deckMode || "all", `${room.code}:bot:${Date.now()}`),
        chat: room.game.chat,
      };
    } else {
      if (!isTriadBotParticipant(room.seats.challenger)) {
        return { ok: true as const, room: publicRoom(room), enabled: false as const };
      }
      room.seats.challenger = null;
      room.status = "waiting";
      room.game = {
        ...freshGame(),
        deckMode: room.game.deckMode || "all",
        selectionPools: buildSelectionPools(room.game.deckMode || "all", `${room.code}:human:${Date.now()}`),
        chat: room.game.chat,
      };
    }

    await upsertStoredRoom(room);
    return { ok: true as const, room: publicRoom(room), enabled };
  });
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
  if (isTriadBotParticipant(room.seats.challenger)) {
    ensureBotDeckReady(room);
  }
  await upsertStoredRoom(room);
  return { ok: true as const, room: publicRoom(room) };
}

export async function runTriadRoomBot(code: string, participantId: string) {
  return withRoomMutationLock(code, async () => {
    const room = await getStoredRoom(code);
    if (!room) return { ok: false as const, reason: "not_found" as const };
    if (!participantInStoredRoom(room, participantId) && !canControlStoredRoom(room, participantId)) {
      return { ok: false as const, reason: "not_in_room" as const, room: publicRoom(room) };
    }
    if (!isTriadBotParticipant(room.seats.challenger)) {
      return { ok: false as const, reason: "no_bot" as const, room: publicRoom(room) };
    }
    const changed = runBotBrain(room);
    if (changed) await upsertStoredRoom(room);
    return { ok: true as const, room: publicRoom(room), changed };
  });
}

export async function resetTriadRoomBattle(code: string, participantId: string) {
  const room = await getStoredRoom(code);
  if (!room) return { ok: false as const, reason: "not_found" as const };
  if (!canControlStoredRoom(room, participantId)) return { ok: false as const, reason: "not_host" as const, room: publicRoom(room) };
  const chat = room.game.chat;
  room.status = "waiting";
  room.game = {
    ...freshGame(),
    deckMode: room.game.deckMode || "all",
    selectionPools: buildSelectionPools(room.game.deckMode || "all", `${room.code}:${Date.now()}`),
    chat,
  };
  await upsertStoredRoom(room);
  return { ok: true as const, room: publicRoom(room) };
}

export async function sendTriadRoomChatMessage(code: string, participant: TriadRoomParticipant, textInput: string) {
  const room = await getStoredRoom(code);
  if (!room) return { ok: false as const, reason: "not_found" as const };
  if (!participantInStoredRoom(room, participant.id)) {
    return { ok: false as const, reason: "not_in_room" as const, room: publicRoom(room) };
  }

  const text = cleanText(textInput).replace(/\s+/g, " ").slice(0, TRIAD_CHAT_MAX_LENGTH);
  if (!text) return { ok: false as const, reason: "empty_message" as const, room: publicRoom(room) };

  const now = Date.now();
  const message: TriadRoomChatMessage = {
    id: `${now}-${participant.id}-${Math.random().toString(36).slice(2, 8)}`,
    roomCode: room.code,
    senderId: participant.id,
    senderName: cleanText(participant.name) || "PLAYER",
    senderImage: cleanText(participant.image) || "/avatar.png",
    text,
    createdAt: now,
  };

  room.game.chat = [...normalizeChatMessages(room.game.chat, room.code), message].slice(-TRIAD_CHAT_LIMIT);
  await upsertStoredRoom(room);
  return { ok: true as const, room: publicRoom(room), message };
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
  if (room.hostId === participantId && isTriadBotParticipant(cleanRoom.seats.challenger)) {
    await deleteStoredRoom(room.code);
    return { ok: true as const };
  }
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
