import { prisma } from "@/lib/prisma";
import {
  getTriadCardRpsChoice,
  resolveTriadTurn,
  triadCardByNo,
  triadCards,
  triadSkillElementConditionMatches,
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
  round?: number;
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

export type TriadRankKey = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "master" | "god-of-legends";

export type TriadRankProfile = {
  userId: string;
  name: string;
  image: string;
  wins: number;
  losses: number;
  rankKey: TriadRankKey;
  rankName: string;
  rankIndex: number;
  nextRankWins: number | null;
  updatedAt: number;
};

export type TriadRankUpEvent = {
  userId: string;
  name: string;
  image: string;
  previousRank: TriadRankKey;
  nextRank: TriadRankKey;
  rankName: string;
  wins: number;
  at: number;
};

type TriadBotMemoryEntry = {
  key: string;
  cardNo: string;
  context: string;
  plays: number;
  wins: number;
  losses: number;
  score: number;
  updatedAt: number;
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
  matchScore: {
    host: number;
    challenger: number;
  };
  activeTurn: TriadTurn;
  fightNo: number;
  turnStartedAt: number;
  matchWinner: TriadRoomSlot | "";
  surrenderedBy: TriadRoomSlot | "";
  matchEndedAt: number;
  rankedRecordedAt: number;
  rankUpEvents: TriadRankUpEvent[];
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
const TRIAD_SELECTION_POOL_SIZE = 293;
const DECK_SELECTION_TIMEOUT_MS = 5 * 60_000;
const TURN_TIMEOUT_MS = 120_000;
const SKILL_CHOICE_TIMEOUT_MS = 30_000;
const WAITING_ROOM_TTL_MS = 15 * 60_000;
const PLAYING_ROOM_TTL_MS = 30 * 60_000;
const TRIAD_CHAT_LIMIT = 80;
const TRIAD_CHAT_MAX_LENGTH = 240;
const TRIAD_BOT_ID = "triad-bot-level-99";
const TRIAD_BOT_NAME = "BOT Level.99";
const TRIAD_BOT_IMAGE = "/avatar.png";
const TRIAD_BOT_MEMORY_LIMIT = 1500;
type TriadBotStrategy = "killer" | "control" | "element" | "comeback" | "surprise";

const globalForTriadRooms = globalThis as {
  nexoraTriadRooms?: StoredTriadRoom[];
  nexoraTriadRankProfiles?: TriadRankProfile[];
  nexoraTriadBotMemory?: Map<string, TriadBotMemoryEntry>;
  nexoraTriadBotMemoryHydrated?: boolean;
  nexoraTriadRoomSchemaPromise?: Promise<void>;
  nexoraTriadRoomMutationLocks?: Map<string, Promise<void>>;
};

function memoryRooms() {
  if (!globalForTriadRooms.nexoraTriadRooms) {
    globalForTriadRooms.nexoraTriadRooms = [];
  }
  return globalForTriadRooms.nexoraTriadRooms;
}

function memoryBotMemory() {
  if (!globalForTriadRooms.nexoraTriadBotMemory) {
    globalForTriadRooms.nexoraTriadBotMemory = new Map();
  }
  return globalForTriadRooms.nexoraTriadBotMemory;
}

function cleanText(value: unknown) {
  return String(value || "").trim();
}

function cleanCardNo(value: unknown) {
  const raw = cleanText(value);
  const digits = raw.replace(/\D/g, "");
  return digits ? digits.padStart(3, "0").slice(-3) : raw;
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

const TRIAD_RANKS: Array<{ key: TriadRankKey; name: string; wins: number }> = [
  { key: "bronze", name: "Bronze", wins: 0 },
  { key: "silver", name: "Silver", wins: 100 },
  { key: "gold", name: "Gold", wins: 500 },
  { key: "platinum", name: "Platinum", wins: 1000 },
  { key: "diamond", name: "Diamond", wins: 3000 },
  { key: "master", name: "Master", wins: 5000 },
  { key: "god-of-legends", name: "God Of Legends", wins: 10000 },
];

function rankForWins(wins: number) {
  const safeWins = Math.max(0, Math.floor(Number(wins) || 0));
  let rankIndex = 0;
  for (let index = 0; index < TRIAD_RANKS.length; index += 1) {
    if (safeWins >= TRIAD_RANKS[index].wins) rankIndex = index;
  }
  const rank = TRIAD_RANKS[rankIndex] || TRIAD_RANKS[0];
  const nextRank = TRIAD_RANKS[rankIndex + 1] || null;
  return {
    rankKey: rank.key,
    rankName: rank.name,
    rankIndex,
    nextRankWins: nextRank ? nextRank.wins : null,
  };
}

function normalizeRankProfile(value: unknown): TriadRankProfile | null {
  const raw = value && typeof value === "object" ? (value as Partial<TriadRankProfile>) : {};
  const userId = cleanText(raw.userId);
  if (!userId || userId === TRIAD_BOT_ID) return null;
  const wins = Math.max(0, Math.floor(Number(raw.wins) || 0));
  const losses = Math.max(0, Math.floor(Number(raw.losses) || 0));
  const rank = rankForWins(wins);
  return {
    userId,
    name: cleanText(raw.name) || "PLAYER",
    image: cleanText(raw.image) || "/avatar.png",
    wins,
    losses,
    ...rank,
    updatedAt: Number(raw.updatedAt || Date.now()),
  };
}

function normalizeBotMemoryEntry(value: Partial<TriadBotMemoryEntry> & { key?: string; cardNo?: string; context?: string }): TriadBotMemoryEntry | null {
  const cardNo = cleanCardNo(value.cardNo);
  const context = cleanText(value.context);
  if (!cardNo || !context) return null;
  const key = cleanText(value.key) || `${context}:${cardNo}`;
  return {
    key,
    cardNo,
    context,
    plays: Math.max(0, Math.floor(Number(value.plays || 0))),
    wins: Math.max(0, Math.floor(Number(value.wins || 0))),
    losses: Math.max(0, Math.floor(Number(value.losses || 0))),
    score: Math.max(-500, Math.min(500, Number(value.score || 0))),
    updatedAt: Number(value.updatedAt || Date.now()),
  };
}

function botMemoryKey(context: string, cardNo: string) {
  return `${cleanText(context)}:${cleanCardNo(cardNo)}`;
}

function pruneBotMemory() {
  const memory = memoryBotMemory();
  if (memory.size <= TRIAD_BOT_MEMORY_LIMIT) return [];
  const entries = [...memory.values()].sort((a, b) => {
    const aValue = Math.abs(a.score) + a.plays * 0.35;
    const bValue = Math.abs(b.score) + b.plays * 0.35;
    return bValue - aValue || b.updatedAt - a.updatedAt;
  });
  const keep = new Set(entries.slice(0, TRIAD_BOT_MEMORY_LIMIT).map((entry) => entry.key));
  const removed: string[] = [];
  for (const key of memory.keys()) {
    if (keep.has(key)) continue;
    memory.delete(key);
    removed.push(key);
  }
  return removed;
}

function memoryRankProfiles() {
  if (!globalForTriadRooms.nexoraTriadRankProfiles) {
    globalForTriadRooms.nexoraTriadRankProfiles = [];
  }
  return globalForTriadRooms.nexoraTriadRankProfiles;
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
    round: 1,
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

function normalizeSelectionPool(value: unknown) {
  const limit = Math.max(TRIAD_SELECTION_POOL_SIZE, triadCards.length);
  return Array.isArray(value) ? value.map((item) => cleanText(item)).filter(Boolean).slice(0, limit) : [];
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

function normalizeRankUpEvents(value: unknown): TriadRankUpEvent[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((event) => {
      const raw = event && typeof event === "object" ? (event as Record<string, unknown>) : {};
      const userId = cleanText(raw.userId);
      const nextRank = cleanText(raw.nextRank) as TriadRankKey;
      const rank = TRIAD_RANKS.find((item) => item.key === nextRank);
      if (!userId || !rank) return null;
      const previousRank = cleanText(raw.previousRank) as TriadRankKey;
      return {
        userId,
        name: cleanText(raw.name) || "PLAYER",
        image: cleanText(raw.image) || "/avatar.png",
        previousRank: TRIAD_RANKS.some((item) => item.key === previousRank) ? previousRank : "bronze",
        nextRank,
        rankName: rank.name,
        wins: Math.max(0, Math.floor(Number(raw.wins) || 0)),
        at: Number(raw.at || Date.now()),
      } satisfies TriadRankUpEvent;
    })
    .filter((event): event is TriadRankUpEvent => Boolean(event))
    .slice(-4);
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
    round: Math.max(1, Number(raw.round || 1)),
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
      host: normalizeSelectionPool((raw.selectionPools as Record<string, unknown> | undefined)?.host),
      challenger: normalizeSelectionPool((raw.selectionPools as Record<string, unknown> | undefined)?.challenger),
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
    matchScore: {
      host: Math.max(0, Number((raw.matchScore as Record<string, unknown> | undefined)?.host || 0)),
      challenger: Math.max(0, Number((raw.matchScore as Record<string, unknown> | undefined)?.challenger || 0)),
    },
    activeTurn: activeTurn === 2 || activeTurn === 3 ? activeTurn : 1,
    fightNo: Math.max(1, Math.min(4, Number(raw.fightNo || 1))),
    turnStartedAt: Number(raw.turnStartedAt || Date.now()),
    matchWinner: raw.matchWinner === "host" || raw.matchWinner === "challenger" ? raw.matchWinner : "",
    surrenderedBy: raw.surrenderedBy === "host" || raw.surrenderedBy === "challenger" ? raw.surrenderedBy : "",
    matchEndedAt: Number(raw.matchEndedAt || 0),
    rankedRecordedAt: Number(raw.rankedRecordedAt || 0),
    rankUpEvents: normalizeRankUpEvents(raw.rankUpEvents),
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
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "TriadRankProfile" (
          "userId" TEXT PRIMARY KEY,
          "name" TEXT NOT NULL DEFAULT 'PLAYER',
          "image" TEXT NOT NULL DEFAULT '/avatar.png',
          "wins" INTEGER NOT NULL DEFAULT 0,
          "losses" INTEGER NOT NULL DEFAULT 0,
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TriadRankProfile_leaderboard_idx" ON "TriadRankProfile" ("wins" DESC, "losses" ASC, "updatedAt" ASC)`);
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "TriadBotMemory" (
          "key" TEXT PRIMARY KEY,
          "cardNo" TEXT NOT NULL,
          "context" TEXT NOT NULL,
          "plays" INTEGER NOT NULL DEFAULT 0,
          "wins" INTEGER NOT NULL DEFAULT 0,
          "losses" INTEGER NOT NULL DEFAULT 0,
          "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TriadBotMemory_card_context_idx" ON "TriadBotMemory" ("cardNo", "context")`);
      await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "TriadBotMemory_score_idx" ON "TriadBotMemory" ("score" DESC, "updatedAt" DESC)`);
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

type RankProfileRow = {
  userId: string;
  name: string;
  image: string;
  wins: number;
  losses: number;
  updatedAt: Date | string;
};

type BotMemoryRow = {
  key: string;
  cardNo: string;
  context: string;
  plays: number;
  wins: number;
  losses: number;
  score: number;
  updatedAt: Date | string;
};

function rowToRankProfile(row: RankProfileRow): TriadRankProfile {
  return normalizeRankProfile({
    userId: row.userId,
    name: row.name,
    image: row.image,
    wins: row.wins,
    losses: row.losses,
    updatedAt: new Date(row.updatedAt).getTime(),
  })!;
}

function rowToBotMemoryEntry(row: BotMemoryRow): TriadBotMemoryEntry | null {
  return normalizeBotMemoryEntry({
    key: row.key,
    cardNo: row.cardNo,
    context: row.context,
    plays: row.plays,
    wins: row.wins,
    losses: row.losses,
    score: row.score,
    updatedAt: new Date(row.updatedAt).getTime(),
  });
}

async function dbGetRankProfile(userId: string) {
  await ensureTriadRoomSchema();
  const rows = await prisma.$queryRawUnsafe<RankProfileRow[]>(
    `
      SELECT "userId", "name", "image", "wins", "losses", "updatedAt"
      FROM "TriadRankProfile"
      WHERE "userId" = $1
      LIMIT 1
    `,
    cleanText(userId)
  );
  return rows[0] ? rowToRankProfile(rows[0]) : null;
}

async function dbAddRankResult(participant: TriadRoomParticipant, result: "win" | "loss") {
  await ensureTriadRoomSchema();
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "TriadRankProfile" ("userId", "name", "image", "wins", "losses", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT ("userId") DO UPDATE SET
        "name" = EXCLUDED."name",
        "image" = EXCLUDED."image",
        "wins" = "TriadRankProfile"."wins" + EXCLUDED."wins",
        "losses" = "TriadRankProfile"."losses" + EXCLUDED."losses",
        "updatedAt" = NOW()
    `,
    participant.id,
    participant.name,
    participant.image || "/avatar.png",
    result === "win" ? 1 : 0,
    result === "loss" ? 1 : 0
  );
  return dbGetRankProfile(participant.id);
}

async function dbListRankProfiles() {
  await ensureTriadRoomSchema();
  const rows = await prisma.$queryRawUnsafe<RankProfileRow[]>(`
    SELECT "userId", "name", "image", "wins", "losses", "updatedAt"
    FROM "TriadRankProfile"
    ORDER BY "wins" DESC, "losses" ASC, "updatedAt" ASC
    LIMIT 500
  `);
  return rows.map(rowToRankProfile);
}

async function hydrateBotMemoryFromDb() {
  if (globalForTriadRooms.nexoraTriadBotMemoryHydrated) return;
  await ensureTriadRoomSchema();
  const rows = await prisma.$queryRawUnsafe<BotMemoryRow[]>(`
    SELECT "key", "cardNo", "context", "plays", "wins", "losses", "score", "updatedAt"
    FROM "TriadBotMemory"
    ORDER BY "updatedAt" DESC
    LIMIT 1500
  `);
  const memory = memoryBotMemory();
  for (const row of rows) {
    const entry = rowToBotMemoryEntry(row);
    if (entry) memory.set(entry.key, entry);
  }
  globalForTriadRooms.nexoraTriadBotMemoryHydrated = true;
}

async function dbUpsertBotMemoryEntry(entry: TriadBotMemoryEntry) {
  await ensureTriadRoomSchema();
  await prisma.$executeRawUnsafe(
    `
      INSERT INTO "TriadBotMemory" ("key", "cardNo", "context", "plays", "wins", "losses", "score", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, to_timestamp($8 / 1000.0))
      ON CONFLICT ("key") DO UPDATE SET
        "cardNo" = EXCLUDED."cardNo",
        "context" = EXCLUDED."context",
        "plays" = EXCLUDED."plays",
        "wins" = EXCLUDED."wins",
        "losses" = EXCLUDED."losses",
        "score" = EXCLUDED."score",
        "updatedAt" = EXCLUDED."updatedAt"
    `,
    entry.key,
    entry.cardNo,
    entry.context,
    entry.plays,
    entry.wins,
    entry.losses,
    entry.score,
    entry.updatedAt
  );
}

async function dbDeleteBotMemoryEntries(keys: string[]) {
  if (keys.length === 0) return;
  await ensureTriadRoomSchema();
  await prisma.$executeRawUnsafe(
    `DELETE FROM "TriadBotMemory" WHERE "key" = ANY($1::text[])`,
    keys
  );
}

async function warmBotMemory() {
  if (globalForTriadRooms.nexoraTriadBotMemoryHydrated) return;
  try {
    await hydrateBotMemoryFromDb();
  } catch (error) {
    console.error("TRIAD BOT MEMORY LOAD FALLBACK:", error);
    globalForTriadRooms.nexoraTriadBotMemoryHydrated = true;
  }
}

function memoryAddRankResult(participant: TriadRoomParticipant, result: "win" | "loss") {
  const profiles = memoryRankProfiles();
  const index = profiles.findIndex((profile) => profile.userId === participant.id);
  const current = profiles[index] || normalizeRankProfile({
    userId: participant.id,
    name: participant.name,
    image: participant.image,
    wins: 0,
    losses: 0,
  })!;
  const next = normalizeRankProfile({
    ...current,
    name: participant.name,
    image: participant.image || current.image,
    wins: current.wins + (result === "win" ? 1 : 0),
    losses: current.losses + (result === "loss" ? 1 : 0),
    updatedAt: Date.now(),
  })!;
  if (index >= 0) profiles[index] = next;
  else profiles.push(next);
  return next;
}

async function addRankResult(participant: TriadRoomParticipant, result: "win" | "loss") {
  if (!participant.id || isTriadBotParticipant(participant)) return null;
  try {
    const before = await dbGetRankProfile(participant.id);
    const after = await dbAddRankResult(participant, result);
    return { before, after };
  } catch (error) {
    console.error("TRIAD RANK DB FALLBACK:", error);
    const before = memoryRankProfiles().find((profile) => profile.userId === participant.id) || null;
    const after = memoryAddRankResult(participant, result);
    return { before, after };
  }
}

export async function listTriadRankProfiles() {
  try {
    return await dbListRankProfiles();
  } catch (error) {
    console.error("TRIAD RANK LIST DB FALLBACK:", error);
    return memoryRankProfiles()
      .slice()
      .sort((a, b) => b.wins - a.wins || a.losses - b.losses || a.updatedAt - b.updatedAt)
      .slice(0, 500);
  }
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

async function persistRankedMatchIfNeeded(room: StoredTriadRoom) {
  if (!room.game.matchEndedAt || room.game.rankedRecordedAt) return;
  learnFromBotMatch(room);
  room.game.rankedRecordedAt = Date.now();
  room.game.rankUpEvents = [];

  const host = room.seats.host;
  const challenger = room.seats.challenger;
  const humanPvp = Boolean(host && challenger && !isTriadBotParticipant(host) && !isTriadBotParticipant(challenger));
  if (!humanPvp || !room.game.matchWinner) return;

  const winner = room.game.matchWinner === "host" ? host : challenger;
  const loser = room.game.matchWinner === "host" ? challenger : host;
  if (!winner || !loser) return;

  const winnerResult = await addRankResult(winner, "win");
  await addRankResult(loser, "loss");
  const beforeRank = winnerResult?.before?.rankKey || "bronze";
  const afterProfile = winnerResult?.after || null;
  if (afterProfile && beforeRank !== afterProfile.rankKey) {
    room.game.rankUpEvents = [
      {
        userId: afterProfile.userId,
        name: afterProfile.name,
        image: afterProfile.image,
        previousRank: beforeRank,
        nextRank: afterProfile.rankKey,
        rankName: afterProfile.rankName,
        wins: afterProfile.wins,
        at: Date.now(),
      },
    ];
  }
}

async function upsertStoredRoom(room: StoredTriadRoom) {
  await persistRankedMatchIfNeeded(room);
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
  await warmBotMemory();
  const storedRooms = await withRoomStore("list", dbListRooms, memoryListRooms);
  const aliveRooms = await pruneExpiredRooms(storedRooms);
  for (const room of aliveRooms) {
    const selectionPoolsChanged = repairSelectionPools(room);
    const deckGateChanged = enforceDeckGate(room);
    const choicesExpired = markExpiredSkillChoices(room);
    const hadResult = room.game.turns.some((turn) => turn.turn === room.game.activeTurn);
    resolveIfBothLocked(room);
    const botChanged = runBotBrain(room);
    const stateHealed = healTriadRoomState(room);
    const resolvedAfterChoiceTimeout = !hadResult && room.game.turns.some((turn) => turn.turn === room.game.activeTurn);
    if (selectionPoolsChanged || deckGateChanged || choicesExpired || resolvedAfterChoiceTimeout || botChanged || stateHealed) {
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
  await warmBotMemory();
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

function normalizedParticipantName(participant?: Pick<TriadRoomParticipant, "name"> | null) {
  return cleanText(participant?.name || "").toLowerCase();
}

function participantsLookSame(
  seat: TriadRoomParticipant | null | undefined,
  participant: TriadRoomParticipant
) {
  if (!seat || isTriadBotParticipant(seat) || isTriadBotParticipant(participant)) return false;
  const seatName = normalizedParticipantName(seat);
  const participantName = normalizedParticipantName(participant);
  if (!seatName || seatName !== participantName) return false;
  const seatImage = cleanText(seat.image);
  const participantImage = cleanText(participant.image);
  return !seatImage || !participantImage || seatImage === participantImage;
}

function reconnectParticipantSeat(room: StoredTriadRoom, participant: TriadRoomParticipant) {
  const exactSide = sideForParticipant(room, participant.id);
  if (exactSide) return exactSide;
  const matchedSide = participantsLookSame(room.seats.host, participant)
    ? "host"
    : participantsLookSame(room.seats.challenger, participant)
      ? "challenger"
      : null;
  if (!matchedSide) return null;

  room.seats[matchedSide] = {
    ...room.seats[matchedSide],
    ...participant,
    joinedAt: room.seats[matchedSide]?.joinedAt || participant.joinedAt,
  };
  room.spectators = room.spectators.filter((viewer) => viewer.id !== participant.id);
  if (matchedSide === "host") room.hostId = participant.id;
  return matchedSide;
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

function requiredCardKindForTurn(mode: TriadDeckMode, turn: TriadTurn): "monster" | "skill" | "any" {
  if (turn === 1) return "monster";
  if (mode === "monster") return "monster";
  if (mode === "skill" || mode === "all") return "skill";
  return "any";
}

function cardAllowedForTurn(mode: TriadDeckMode, turn: TriadTurn, cardNo: string) {
  const card = triadCardByNo.get(cleanText(cardNo));
  if (!card) return false;
  const requiredKind = requiredCardKindForTurn(mode, turn);
  if (requiredKind === "any") return card.kind !== "unknown";
  return card.kind === requiredKind;
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
  const allCards = triadCards
    .filter((card) => card.kind !== "unknown")
    .map((card) => card.cardNo)
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  if (mode === "all") {
    return {
      host: allCards,
      challenger: allCards,
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

function expectedSelectionPoolSize(mode: TriadDeckMode) {
  if (mode === "all") return triadCards.filter((card) => card.kind !== "unknown").length;
  if (mode === "skill") return TRIAD_MONSTER_DECK_SIZE + 20;
  return TRIAD_MONSTER_DECK_SIZE;
}

function repairSelectionPools(room: StoredTriadRoom) {
  if (room.status !== "playing") return false;
  const mode = room.game.deckMode || "all";
  const expectedSize = expectedSelectionPoolSize(mode);
  if (
    (room.game.selectionPools.host || []).length >= expectedSize &&
    (room.game.selectionPools.challenger || []).length >= expectedSize
  ) {
    return false;
  }
  room.game.selectionPools = buildSelectionPools(mode, `${room.code}:selection:${room.game.deckStartedAt || room.createdAt}`);
  return true;
}

function botLearningContexts(room: StoredTriadRoom, cardNo: string, turn = room.game.activeTurn) {
  const mode = room.game.deckMode || "all";
  const lane = laneForTurn(turn);
  const ownTop = triadCardByNo.get(room.game.triangles.challenger.top);
  const opponentTop = triadCardByNo.get(room.game.triangles.host.top);
  const card = triadCardByNo.get(cleanCardNo(cardNo));
  return [
    `global:${cleanCardNo(cardNo)}`,
    `deck:${mode}`,
    `turn:${turn}`,
    `mode:${mode}:turn:${turn}`,
    `mode:${mode}:lane:${lane}`,
    ownTop?.element ? `own-element:${ownTop.element}:turn:${turn}` : "",
    opponentTop?.element ? `opp-element:${opponentTop.element}:turn:${turn}` : "",
    card?.kind ? `kind:${card.kind}:turn:${turn}` : "",
  ].filter(Boolean);
}

function botMemoryScore(cardNo: string, contexts: string[]) {
  const memory = memoryBotMemory();
  const normalizedCardNo = cleanCardNo(cardNo);
  return contexts.reduce((sum, context) => {
    const entry = memory.get(botMemoryKey(context, normalizedCardNo));
    if (!entry) return sum;
    const confidence = Math.min(1.8, Math.log2(entry.plays + 1) / 3);
    return sum + entry.score * confidence;
  }, 0);
}

function hashSeed(value: string) {
  return value.split("").reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 2166136261);
}

function botStrategyForRoom(room: StoredTriadRoom): TriadBotStrategy {
  const scoreDelta = (room.game.matchScore?.challenger || 0) - (room.game.matchScore?.host || 0);
  if (scoreDelta < 0) return "comeback";
  const seed = hashSeed([
    room.code,
    room.game.deckMode,
    room.game.fightNo,
    room.game.activeTurn,
    room.game.triangles.host.top,
    room.game.triangles.host.left,
    room.game.triangles.challenger.top,
    room.game.turns.map((turn) => turn.winner).join("-"),
  ].join(":"));
  const strategies: TriadBotStrategy[] = scoreDelta > 1
    ? ["control", "surprise", "element", "killer", "control"]
    : ["killer", "control", "element", "surprise", "killer"];
  return strategies[seed % strategies.length];
}

function botStrategyScore(room: StoredTriadRoom, cardNo: string, strategy: TriadBotStrategy) {
  const card = triadCardByNo.get(cleanCardNo(cardNo));
  const rule = triadSkillRuleByNo.get(cleanCardNo(cardNo));
  const turn = room.game.activeTurn;
  if (!card) return 0;
  if (strategy === "killer") {
    return card.kind === "monster"
      ? Math.max(card.attack, card.support) * 0.08
      : (rule?.effects || []).reduce((sum, effect) => sum + Math.max(0, effect.delta), 0) * 0.35;
  }
  if (strategy === "control") {
    if (!rule) return 0;
    const controlShape = rule.shape === "skill-cancel" || rule.shape === "block-stat-gain" || rule.shape === "swap-control";
    const debuff = rule.effects.reduce((sum, effect) => sum + Math.abs(Math.min(0, effect.delta)), 0);
    return (controlShape ? 9000 : 0) + debuff * 0.45;
  }
  if (strategy === "element") {
    return botSkillElementScore(room, "challenger", cardNo) * 1.15;
  }
  if (strategy === "comeback") {
    const pressure = Math.max(1, (room.game.matchScore?.host || 0) - (room.game.matchScore?.challenger || 0));
    const swing = rule?.effects.reduce((sum, effect) => sum + Math.abs(effect.delta), 0) || Math.max(card.attack, card.support);
    return pressure * Math.min(12000, swing * 0.5);
  }
  if (strategy === "surprise") {
    const contexts = botLearningContexts(room, cardNo, turn);
    const learned = botMemoryScore(cardNo, contexts);
    const playedPenalty = Math.min(8000, (room.game.usedCards.challenger || []).filter((usedNo) => usedNo === cleanCardNo(cardNo)).length * 2500);
    const rareShapeBonus = rule && (rule.shape === "swap-control" || rule.shape === "element-transform" || rule.shape === "unparsed") ? 7000 : 0;
    return learned * 0.8 + rareShapeBonus - playedPenalty;
  }
  return 0;
}

function pickBotCardFromRanked(room: StoredTriadRoom, ranked: Array<{ cardNo: string; score: number }>) {
  if (ranked.length === 0) return "";
  const strategy = botStrategyForRoom(room);
  if (strategy !== "surprise" && strategy !== "control" && strategy !== "element") return ranked[0].cardNo;
  const topScore = ranked[0].score;
  const windowSize = strategy === "surprise" ? 5 : 3;
  const candidates = ranked
    .slice(0, windowSize)
    .filter((item) => item.score >= topScore - (strategy === "surprise" ? 18000 : 9000));
  if (candidates.length <= 1) return ranked[0].cardNo;
  const seed = hashSeed(`${room.code}:${room.game.fightNo}:${room.game.activeTurn}:${strategy}:${room.game.triangles.host[laneForTurn(room.game.activeTurn)]}:${room.game.turns.length}`);
  const totalWeight = candidates.reduce((sum, item) => sum + Math.max(1, item.score - candidates[candidates.length - 1].score + 1), 0);
  let roll = seed % Math.max(1, Math.floor(totalWeight));
  for (const item of candidates) {
    roll -= Math.max(1, item.score - candidates[candidates.length - 1].score + 1);
    if (roll <= 0) return item.cardNo;
  }
  return candidates[0].cardNo;
}

function applyBotLearning(cardNo: string, contexts: string[], outcome: number, weight = 1) {
  const normalizedCardNo = cleanCardNo(cardNo);
  if (!normalizedCardNo) return;
  const memory = memoryBotMemory();
  const now = Date.now();
  for (const context of contexts) {
    const cleanContext = cleanText(context);
    if (!cleanContext) continue;
    const key = botMemoryKey(cleanContext, normalizedCardNo);
    const current = memory.get(key) || normalizeBotMemoryEntry({ key, cardNo: normalizedCardNo, context: cleanContext });
    if (!current) continue;
    const delta = Math.max(-18, Math.min(18, outcome * weight));
    const next = {
      ...current,
      plays: current.plays + 1,
      wins: current.wins + (outcome > 0 ? 1 : 0),
      losses: current.losses + (outcome < 0 ? 1 : 0),
      score: Math.max(-500, Math.min(500, current.score * 0.985 + delta)),
      updatedAt: now,
    };
    memory.set(key, next);
    void dbUpsertBotMemoryEntry(next).catch((error) => console.error("TRIAD BOT MEMORY DB FALLBACK:", error));
  }
  const removed = pruneBotMemory();
  if (removed.length > 0) {
    void dbDeleteBotMemoryEntries(removed).catch((error) => console.error("TRIAD BOT MEMORY PRUNE FALLBACK:", error));
  }
}

function learnFromBotTurn(room: StoredTriadRoom, result: TriadTurnResult) {
  if (!isTriadBotParticipant(room.seats.challenger)) return;
  const lane = laneForTurn(result.turn);
  const botCardNo = room.game.triangles.challenger[lane];
  if (!botCardNo) return;
  const margin = result.opponentTotal - result.playerTotal;
  const outcome = result.winner === "opponent" ? 1 : result.winner === "player" ? -1 : 0.15;
  const weight = 3 + Math.min(8, Math.abs(margin) / 1500);
  applyBotLearning(botCardNo, botLearningContexts(room, botCardNo, result.turn), outcome, weight);
}

function learnFromBotMatch(room: StoredTriadRoom) {
  if (!isTriadBotParticipant(room.seats.challenger) || !room.game.matchEndedAt) return;
  const outcome = room.game.matchWinner === "challenger" ? 1 : room.game.matchWinner === "host" ? -1 : 0.1;
  const weight = room.game.matchWinner ? 7 : 2;
  for (const cardNo of room.game.decks.challenger || []) {
    applyBotLearning(cardNo, [`match:${room.game.deckMode || "all"}`, `deck:${room.game.deckMode || "all"}`], outcome, weight);
  }
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

function chooseBotDeckForMode(mode: TriadDeckMode, pool: string[], seed = "") {
  const uniquePool = Array.from(new Set(pool.map(cleanText).filter(Boolean)));
  const strategySeed = hashSeed(`${mode}:${seed}:${uniquePool.join("|").slice(0, 80)}`);
  const strategy: TriadBotStrategy = (["killer", "control", "element", "surprise"][strategySeed % 4] || "killer") as TriadBotStrategy;
  const deckContextScore = (cardNo: string) => {
    const rule = triadSkillRuleByNo.get(cleanCardNo(cardNo));
    const memory = botMemoryScore(cardNo, [`deck:${mode}`, `match:${mode}`]);
    const controlBonus = strategy === "control" && rule && (rule.shape === "skill-cancel" || rule.shape === "block-stat-gain" || rule.shape === "swap-control") ? 9000 : 0;
    const elementBonus = strategy === "element" && rule?.elementCondition ? 6500 : 0;
    const surpriseBonus = strategy === "surprise" && rule && (rule.shape === "swap-control" || rule.shape === "element-transform" || rule.shape === "unparsed") ? 5500 : 0;
    return botDeckScore(cardNo) + memory + controlBonus + elementBonus + surpriseBonus;
  };
  const monsters = uniquePool
    .filter((cardNo) => triadCardByNo.get(cardNo)?.kind === "monster")
    .sort((a, b) => deckContextScore(b) - deckContextScore(a));
  const skills = uniquePool
    .filter((cardNo) => triadCardByNo.get(cardNo)?.kind === "skill")
    .sort((a, b) => deckContextScore(b) - deckContextScore(a));

  if (mode === "monster") return monsters.slice(0, TRIAD_MONSTER_DECK_SIZE);
  if (mode === "skill") {
    return [
      ...monsters.slice(0, TRIAD_SKILL_MODE_MONSTERS),
      ...skills.slice(0, TRIAD_SKILL_MODE_SKILLS),
    ].slice(0, TRIAD_DECK_SIZE);
  }

  const deck = [...monsters.slice(0, 8), ...skills.slice(0, 12)];
  if (deck.length < TRIAD_DECK_SIZE) {
    deck.push(...uniquePool.filter((cardNo) => !deck.includes(cardNo)).sort((a, b) => deckContextScore(b) - deckContextScore(a)));
  }
  return deck.slice(0, TRIAD_DECK_SIZE);
}

function autoCompleteDeckForMode(mode: TriadDeckMode, currentDeck: string[], pool: string[], seed = "") {
  const selected = Array.from(new Set(normalizeDeckForMode(mode, currentDeck)));
  const selectedSet = new Set(selected);
  const rankedPool = chooseBotDeckForMode(mode, pool, seed).filter((cardNo) => !selectedSet.has(cardNo));
  const fallbackPool = Array.from(new Set(pool.map(cleanText).filter(Boolean))).filter((cardNo) => !selectedSet.has(cardNo));
  const append = [...rankedPool, ...fallbackPool];

  if (mode === "monster") {
    return [
      ...selected.filter((cardNo) => triadCardByNo.get(cardNo)?.kind === "monster"),
      ...append.filter((cardNo) => triadCardByNo.get(cardNo)?.kind === "monster"),
    ].slice(0, TRIAD_MONSTER_DECK_SIZE);
  }

  if (mode === "skill") {
    const selectedMonsters = selected.filter((cardNo) => triadCardByNo.get(cardNo)?.kind === "monster").slice(0, TRIAD_SKILL_MODE_MONSTERS);
    const selectedSkills = selected.filter((cardNo) => triadCardByNo.get(cardNo)?.kind === "skill").slice(0, TRIAD_SKILL_MODE_SKILLS);
    const monsterAppend = append.filter((cardNo) => triadCardByNo.get(cardNo)?.kind === "monster" && !selectedMonsters.includes(cardNo));
    const skillAppend = append.filter((cardNo) => triadCardByNo.get(cardNo)?.kind === "skill" && !selectedSkills.includes(cardNo));
    return [
      ...selectedMonsters,
      ...monsterAppend.slice(0, Math.max(0, TRIAD_SKILL_MODE_MONSTERS - selectedMonsters.length)),
      ...selectedSkills,
      ...skillAppend.slice(0, Math.max(0, TRIAD_SKILL_MODE_SKILLS - selectedSkills.length)),
    ].slice(0, TRIAD_DECK_SIZE);
  }

  const deck = selected.slice(0, TRIAD_DECK_SIZE);
  for (const monsterCardNo of append.filter((cardNo) => triadCardByNo.get(cardNo)?.kind === "monster")) {
    if (deckCardCounts(deck).monsters >= 3) break;
    if (deck.includes(monsterCardNo)) continue;
    if (deck.length >= TRIAD_DECK_SIZE) {
      let removableIndex = -1;
      for (let index = deck.length - 1; index >= 0; index -= 1) {
        if (triadCardByNo.get(deck[index])?.kind !== "monster") {
          removableIndex = index;
          break;
        }
      }
      if (removableIndex >= 0) deck.splice(removableIndex, 1);
    }
    deck.push(monsterCardNo);
  }
  for (const cardNo of append) {
    if (deck.length >= TRIAD_DECK_SIZE) break;
    if (!deck.includes(cardNo)) deck.push(cardNo);
  }
  return deck.slice(0, TRIAD_DECK_SIZE);
}

function ensureBotDeckReady(room: StoredTriadRoom) {
  if (!isTriadBotParticipant(room.seats.challenger)) return false;
  const mode = room.game.deckMode || "all";
  const botDeck = chooseBotDeckForMode(mode, room.game.selectionPools.challenger || [], `${room.code}:${room.game.deckStartedAt}:${room.game.fightNo}`);
  const validation = validateDeckForMode(mode, botDeck);
  if (!validation.ok) return false;
  const currentDeck = room.game.decks.challenger || [];
  const changed = !room.game.deckReady.challenger || currentDeck.join("|") !== botDeck.join("|");
  room.game.decks.challenger = botDeck;
  room.game.deckReady.challenger = true;
  return changed;
}

function shouldAutoCompleteDeckForSide(room: StoredTriadRoom, side: TriadRoomSlot) {
  return isTriadBotParticipant(room.seats[side]);
}

function botTargetToken(side: TriadRoomSlot, targetSide: TriadRoomSlot) {
  if (side === "host") return targetSide === "host" ? "player-top" : "bot-top";
  return targetSide === "challenger" ? "player-top" : "bot-top";
}

function chooseBotSkillTarget(room: StoredTriadRoom, choice: TriadRoomSkillChoice) {
  const opponentSide: TriadRoomSlot = choice.side === "host" ? "challenger" : "host";
  const ownSide = choice.side;
  const rule = triadSkillRuleByNo.get(choice.cardNo);
  const topCardMatchesRule = (side: TriadRoomSlot) => {
    const card = triadCardByNo.get(room.game.triangles[side].top);
    if (!card) return false;
    if (!rule?.elementCondition) return true;
    const listed = rule.elementCondition.elements.includes(card.element);
    return rule.elementCondition.mode === "include" ? listed : !listed;
  };
  const preferredElementTarget = (() => {
    if (!rule) return "";
    const hasBuff = rule.effects.some((effect) => effect.delta > 0);
    const hasDebuff = rule.effects.some((effect) => effect.delta < 0);
    if (rule.target.startsWith("opponent")) return topCardMatchesRule(opponentSide) ? opponentSide : "";
    if (rule.target.startsWith("own")) return topCardMatchesRule(ownSide) ? ownSide : "";
    if (rule.target === "any-one") {
      if (hasDebuff && topCardMatchesRule(opponentSide)) return opponentSide;
      if (hasBuff && topCardMatchesRule(ownSide)) return ownSide;
      if (topCardMatchesRule(opponentSide)) return opponentSide;
      if (topCardMatchesRule(ownSide)) return ownSide;
    }
    return "";
  })();
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
  if (preferredElementTarget) return botTargetToken(choice.side, preferredElementTarget);
  if (rule?.elementCondition) return "";
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

function botSkillElementScore(room: StoredTriadRoom, side: TriadRoomSlot, cardNo: string) {
  const rule = triadSkillRuleByNo.get(cleanText(cardNo));
  const card = triadCardByNo.get(cleanText(cardNo));
  if (!rule || card?.kind !== "skill") return 0;

  if (!rule.allowedTurns.includes(room.game.activeTurn)) return -180_000;
  if (!rule.elementCondition) return 2_500;

  const opponentSide: TriadRoomSlot = side === "host" ? "challenger" : "host";
  const topMatches = (targetSide: TriadRoomSlot) => {
    const topCard = triadCardByNo.get(room.game.triangles[targetSide].top);
    if (!topCard || !rule.elementCondition) return false;
    const listed = rule.elementCondition.elements.includes(topCard.element);
    return rule.elementCondition.mode === "include" ? listed : !listed;
  };
  const countMatches = (slots: TriadRoomSlot[]) => slots.filter(topMatches).length;
  const hasBuff = rule.effects.some((effect) => effect.delta > 0);
  const hasDebuff = rule.effects.some((effect) => effect.delta < 0);

  let intendedSlots: TriadRoomSlot[] = [];
  if (rule.target.startsWith("own")) intendedSlots = [side];
  else if (rule.target.startsWith("opponent")) intendedSlots = [opponentSide];
  else if (rule.target === "all") intendedSlots = ["host", "challenger"];
  else if (rule.target === "any-one") {
    intendedSlots = hasDebuff ? [opponentSide] : hasBuff ? [side] : [opponentSide, side];
  } else {
    intendedSlots = [opponentSide, side];
  }

  const intendedMatches = countMatches(intendedSlots);
  if (intendedMatches > 0) return 35_000 + intendedMatches * 14_000;

  const fallbackSlots = (["host", "challenger"] as TriadRoomSlot[]).filter((slot) => !intendedSlots.includes(slot));
  const fallbackMatches = countMatches(fallbackSlots);
  if (fallbackMatches > 0 && rule.target === "any-one") return 8_000;

  return -260_000;
}

function simulatedRoomWithBotSkillChoice(room: StoredTriadRoom, candidateTriangles: StoredTriadRoom["game"]["triangles"]) {
  const simulatedRoom: StoredTriadRoom = {
    ...room,
    game: {
      ...room.game,
      triangles: candidateTriangles,
      skillChoices: room.game.skillChoices.map((choice) => ({ ...choice })),
    },
  };
  ensureSkillChoices(simulatedRoom);
  for (const choice of currentTurnChoices(simulatedRoom)) {
    if (choice.side !== "challenger" || choice.selectedTarget || choice.skipped) continue;
    const selectedTarget = chooseBotSkillTarget(simulatedRoom, choice);
    if (selectedTarget) choice.selectedTarget = selectedTarget;
  }
  return simulatedRoom;
}

function botResolvedSkillPenalty(result: TriadTurnResult, cardNo: string) {
  const rule = triadSkillRuleByNo.get(cleanText(cardNo));
  if (!rule?.elementCondition) return 0;
  const botEvents = result.skillEvents.filter((event) => event.side === "opponent" && event.cardNo === cleanText(cardNo));
  if (botEvents.length === 0) return -260_000;
  if (botEvents.some((event) => event.blocked)) return -320_000;
  return 80_000;
}

function botCanUseElementSkill(room: StoredTriadRoom, side: TriadRoomSlot, cardNo: string) {
  const rule = triadSkillRuleByNo.get(cleanText(cardNo));
  if (!rule?.elementCondition) return true;
  return botSkillElementScore(room, side, cardNo) > 0;
}

function botCardScore(room: StoredTriadRoom, cardNo: string) {
  const turn = room.game.activeTurn;
  const lane = laneForTurn(turn);
  const learnedScore = botMemoryScore(cardNo, botLearningContexts(room, cardNo, turn));
  const strategy = botStrategyForRoom(room);
  const strategyScore = botStrategyScore(room, cardNo, strategy);
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
  const elementScore = botSkillElementScore(
    { ...room, game: { ...room.game, triangles: candidateTriangles } },
    "challenger",
    cardNo
  );
  if (room.game.triangles.host[lane] && opener) {
    const simulatedRoom = simulatedRoomWithBotSkillChoice(room, candidateTriangles);
    const rawResult = resolveTriadTurn({
      turn,
      player: opener === "host" ? candidateTriangles.host : candidateTriangles.challenger,
      opponent: opener === "host" ? candidateTriangles.challenger : candidateTriangles.host,
      prioritySide: "player",
      skillTargets: selectedSkillTargets(simulatedRoom, opener),
    });
    const result = opener === "host" ? rawResult : flipResultToHostPerspective(rawResult);
    const pointScore = result.winner === "opponent" ? 100_000 : result.winner === "draw" ? 25_000 : -100_000;
    return pointScore + result.opponentTotal - result.playerTotal + elementScore + botResolvedSkillPenalty(result, cardNo) + learnedScore + strategyScore;
  }
  const card = triadCardByNo.get(cardNo);
  if (!card) return 0;
  if (turn === 1) return card.attack + card.support + learnedScore + strategyScore;
  if (turn === 2) return (card.kind === "monster" ? card.attack : botDeckScore(cardNo) + elementScore) + learnedScore + strategyScore;
  return (card.kind === "monster" ? card.support : botDeckScore(cardNo) + elementScore) + learnedScore + strategyScore;
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
  const requiredKind = requiredCardKindForTurn(mode, turn);
  const playable = (room.game.decks.challenger || []).filter((cardNo) => {
    if (alreadyPlaced.has(cardNo)) return false;
    const kind = triadCardByNo.get(cardNo)?.kind;
    if (requiredKind === "any") return kind === "monster" || kind === "skill";
    return kind === requiredKind;
  });
  const smartPlayable = playable.filter((cardNo) => {
    const candidateRoom: StoredTriadRoom = {
      ...room,
      game: {
        ...room.game,
        triangles: {
          ...room.game.triangles,
          challenger: {
            ...room.game.triangles.challenger,
            [lane]: cardNo,
          },
        },
      },
    };
    return botCanUseElementSkill(candidateRoom, "challenger", cardNo);
  });
  const scoringCards = smartPlayable.length > 0 ? smartPlayable : playable;
  const ranked = scoringCards
    .map((cardNo) => ({ cardNo, score: botCardScore(room, cardNo) }))
    .sort((a, b) => b.score - a.score);
  return pickBotCardFromRanked(room, ranked);
}

function lockBotCard(room: StoredTriadRoom) {
  if (!isTriadBotParticipant(room.seats.challenger)) return false;
  const lane = laneForTurn(room.game.activeTurn);
  if (room.game.triangles.challenger[lane]) return false;
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
  const choice = (["rock", "paper", "scissors"] as TriadRpsChoice[])[Math.floor(Math.random() * 3)];
  const nextChoices = { ...tieBreak.choices, challenger: choice };
  const winner = rpsWinner(nextChoices.host || "unknown", nextChoices.challenger || "unknown");
  room.game.openerTieBreak = {
    ...tieBreak,
    choices: nextChoices,
    round: winner === "draw" ? (tieBreak.round || 1) + 1 : tieBreak.round || 1,
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
  if (room.game.matchEndedAt) return false;
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
    if (finalizeNineTurnMatchIfNeeded(room, room.game.activeTurn)) return true;
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
    if (battleDecksReady(room)) {
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

function freshGameForRoom(room: StoredTriadRoom, seed: string | number = Date.now()) {
  const deckMode = room.game.deckMode || "all";
  return {
    ...freshGame(),
    deckMode,
    selectionPools: buildSelectionPools(deckMode, `${room.code}:${seed}`),
    chat: room.game.chat,
  };
}

function battleDecksReady(room: StoredTriadRoom) {
  const deckMode = room.game.deckMode || "all";
  return Boolean(
    room.game.deckReady.host &&
      room.game.deckReady.challenger &&
      validateDeckForMode(deckMode, room.game.decks.host).ok &&
      validateDeckForMode(deckMode, room.game.decks.challenger).ok
  );
}

function finalizeDeckSelection(room: StoredTriadRoom, force = false) {
  if (!battleDecksReady(room)) return false;
  if (!force) return false;
  room.game.deckReady = { host: true, challenger: true };
  room.game.usedCards = { host: [], challenger: [] };
  room.game.triangles = { host: emptyTriangle(), challenger: emptyTriangle() };
  room.game.turns = [];
  room.game.turnReady = { host: false, challenger: false };
  room.game.matchScore = { host: 0, challenger: 0 };
  room.game.openerTieBreak = emptyOpeningTieBreak();
  room.game.activeTurn = 1;
  room.game.fightNo = 1;
  room.game.matchWinner = "";
  room.game.surrenderedBy = "";
  room.game.matchEndedAt = 0;
  room.game.rankedRecordedAt = 0;
  room.game.rankUpEvents = [];
  room.game.turnStartedAt = Math.max(Date.now(), Number(room.game.deckStartedAt || 0) + 1);
  return true;
}

function enforceDeckGate(room: StoredTriadRoom) {
  if (room.status !== "playing") return false;
  const deckMode = room.game.deckMode || "all";
  const deckSelectionFinalized = Number(room.game.turnStartedAt || 0) > Number(room.game.deckStartedAt || 0);
  const deckSelectionExpired = Date.now() - Number(room.game.deckStartedAt || Date.now()) >= DECK_SELECTION_TIMEOUT_MS;
  if (!deckSelectionFinalized && deckSelectionExpired) {
    (["host", "challenger"] as TriadRoomSlot[]).forEach((side) => {
      if (!shouldAutoCompleteDeckForSide(room, side)) return;
      const autoDeck = autoCompleteDeckForMode(
        deckMode,
        room.game.decks[side],
        room.game.selectionPools[side] || [],
        `${room.code}:${room.game.deckStartedAt}:${side}:timeout`
      );
      if (validateDeckForMode(deckMode, autoDeck).ok) {
        room.game.decks[side] = autoDeck;
        room.game.deckReady[side] = true;
      }
    });
    if (battleDecksReady(room)) return finalizeDeckSelection(room, true);
  }
  const hostValid = validateDeckForMode(deckMode, room.game.decks.host).ok;
  const challengerValid = validateDeckForMode(deckMode, room.game.decks.challenger).ok;
  const nextReady = {
    host: Boolean(room.game.deckReady.host && hostValid),
    challenger: Boolean(room.game.deckReady.challenger && challengerValid),
  };
  const changedReady =
    nextReady.host !== room.game.deckReady.host ||
    nextReady.challenger !== room.game.deckReady.challenger;
  if (!deckSelectionFinalized && nextReady.host && nextReady.challenger) {
    room.game.deckReady = nextReady;
    return finalizeDeckSelection(room, true) || changedReady;
  }
  if (!changedReady && nextReady.host && nextReady.challenger) return false;

  room.game.deckReady = nextReady;
  room.game.triangles = { host: emptyTriangle(), challenger: emptyTriangle() };
  room.game.turns = [];
  room.game.turnReady = { host: false, challenger: false };
  room.game.openerTieBreak = emptyOpeningTieBreak();
  room.game.activeTurn = 1;
  room.game.fightNo = 1;
  room.game.matchScore = { host: 0, challenger: 0 };
  room.game.matchWinner = "";
  room.game.surrenderedBy = "";
  room.game.matchEndedAt = 0;
  room.game.rankedRecordedAt = 0;
  room.game.rankUpEvents = [];
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

function monsterHasGravityFieldStat(cardNo: string, turn?: TriadTurn) {
  const card = triadCardByNo.get(cleanText(cardNo));
  if (!card || card.kind !== "monster") return false;
  if (turn === 2) return card.attack > 7000;
  if (turn === 3) return card.support > 7000;
  return card.attack > 7000 || card.support > 7000;
}

function gravityFieldTargets(room: StoredTriadRoom) {
  return [
    monsterHasGravityFieldStat(room.game.triangles.host.top, room.game.activeTurn) ? ("host" as const) : null,
    monsterHasGravityFieldStat(room.game.triangles.challenger.top, room.game.activeTurn) ? ("challenger" as const) : null,
  ].filter((side): side is TriadRoomSlot => Boolean(side));
}

function parseBoardTargetSequence(value = "") {
  return value
    .split(">")
    .map((item) => item.trim())
    .filter((item): item is "player-top" | "bot-top" => item === "player-top" || item === "bot-top");
}

function canUseManualSkillChoice(room: StoredTriadRoom, cardNo: string) {
  if (cleanText(cardNo) === "265") return false;
  if (cleanText(cardNo) === "254") return true;
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
      const rule = cardNo ? triadSkillRuleByNo.get(cleanCardNo(cardNo)) : undefined;
      const hasLegalElementTarget = !cardNo || !rule?.elementCondition || legalManualSkillTargetSlots(room, side, cardNo).length > 0;
      return cardNo && canUseManualSkillChoice(room, cardNo) && hasLegalElementTarget
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
      if (choice.blessingPreviewTopNo) {
        events[events.length - 1].summary = `${events[events.length - 1].summary} จบตาจะกลับเป็นมอนสเตอร์เดิม`;
      }
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
      if (choice.blessingPreviewTopNo) {
        events[events.length - 1].summary = `${events[events.length - 1].summary} จบตาจะกลับเป็นมอนสเตอร์เดิม`;
      }
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

function skillTargetSlotMatchesElementCondition(cardNo: string, targetSlot: TriadRoomSlot, room: StoredTriadRoom) {
  const rule = triadSkillRuleByNo.get(cleanCardNo(cardNo));
  const targetCard = triadCardByNo.get(room.game.triangles[targetSlot].top);
  if (cleanCardNo(cardNo) === "225") {
    return Boolean(targetCard?.kind === "monster" && targetCard.attack <= 5000);
  }
  if (!rule?.elementCondition) return true;
  return Boolean(targetCard?.kind === "monster" && triadSkillElementConditionMatches(rule, targetCard));
}

function legalManualSkillTargetSlots(room: StoredTriadRoom, side: TriadRoomSlot, cardNo: string) {
  const rule = triadSkillRuleByNo.get(cleanCardNo(cardNo));
  if (!rule) return [] as TriadRoomSlot[];
  const opponentSide: TriadRoomSlot = side === "host" ? "challenger" : "host";
  const baseTargets: TriadRoomSlot[] =
    rule.target.startsWith("own")
      ? [side]
      : rule.target.startsWith("opponent")
        ? [opponentSide]
        : rule.target === "any-one" || rule.target === "all"
          ? [side, opponentSide]
          : [side];
  return baseTargets.filter((targetSlot) => skillTargetSlotMatchesElementCondition(cardNo, targetSlot, room));
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

function settleOpeningTieBreak(room: StoredTriadRoom) {
  if (room.game.activeTurn !== 1) return false;
  const firstTurnResult = room.game.turns.find((turn) => turn.turn === 1);
  if (firstTurnResult?.winner !== "draw") return false;
  const tieBreak = room.game.openerTieBreak;
  if (tieBreak.status !== "waiting") return false;
  if (tieBreak.fightNo !== room.game.fightNo || tieBreak.turn !== 1) return false;

  const hostChoice = tieBreak.choices.host || "unknown";
  const challengerChoice = tieBreak.choices.challenger || "unknown";
  const winner = rpsWinner(hostChoice, challengerChoice);
  if (!winner) return false;

  if (winner === "draw") {
    room.game.openerTieBreak = {
      ...tieBreak,
      choices: {},
      revealChoices: { host: hostChoice, challenger: challengerChoice },
      round: (tieBreak.round || 1) + 1,
      winner: "",
      status: "waiting",
      source: "manual",
      message:
        "เป่ายิงฉุบเสมออีกครั้ง เลือกใหม่ได้ทันทีจนกว่าจะมีผู้ชนะ ผู้ชนะจะได้เปิดสกิลก่อนในตาถัดไปเท่านั้น",
    };
    return true;
  }

  room.game.openerTieBreak = {
    ...tieBreak,
    choices: { host: hostChoice, challenger: challengerChoice },
    revealChoices: { host: hostChoice, challenger: challengerChoice },
    round: tieBreak.round || 1,
    status: "resolved",
    winner,
    source: "manual",
  };
  room.game.activeTurn = 2;
  room.game.turnReady = { host: false, challenger: false };
  room.game.turnStartedAt = Date.now();
  return true;
}

function healTriadRoomState(room: StoredTriadRoom) {
  let changed = false;
  changed = settleOpeningTieBreak(room) || changed;
  resolveIfBothLocked(room);
  changed = settleOpeningTieBreak(room) || changed;
  return changed;
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
    round: 1,
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
  recordResolvedTurnScore(room, nextResult);
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
  recordResolvedTurnScore(room, result);
}

function absoluteTurnNo(room: StoredTriadRoom, turn = room.game.activeTurn) {
  return (Math.max(1, room.game.fightNo) - 1) * 3 + turn;
}

function recordResolvedTurnScore(room: StoredTriadRoom, result: TriadTurnResult) {
  learnFromBotTurn(room, result);
  room.game.matchScore = room.game.matchScore || { host: 0, challenger: 0 };
  if (result.winner === "player") room.game.matchScore.host += 1;
  if (result.winner === "opponent") room.game.matchScore.challenger += 1;
  finalizeNineTurnMatchIfNeeded(room, result.turn);
}

function finalizeNineTurnMatchIfNeeded(room: StoredTriadRoom, turn = room.game.activeTurn) {
  if (room.game.matchEndedAt || absoluteTurnNo(room, turn) < 9) return false;
  const hostScore = room.game.matchScore?.host || 0;
  const challengerScore = room.game.matchScore?.challenger || 0;
  room.game.matchWinner = hostScore > challengerScore ? "host" : challengerScore > hostScore ? "challenger" : "";
  room.game.matchEndedAt = Date.now();
  room.game.turnReady = { host: false, challenger: false };
  return true;
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
  await warmBotMemory();
  const room = await getStoredRoom(code);
  if (!room) return { ok: false as const, reason: "not_found" as const };
  repairSelectionPools(room);
  enforceDeckGate(room);
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
  await warmBotMemory();
  const room = await getStoredRoom(code);
  if (!room) return { ok: false as const, reason: "not_found" as const };
  repairSelectionPools(room);
  enforceDeckGate(room);
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
  enforceDeckGate(room);
  const side = sideForParticipant(room, participantId);
  if (!side) return { ok: false as const, reason: "not_player" as const, room: publicRoom(room) };
  if (!battleDecksReady(room)) {
    await upsertStoredRoom(room);
    return { ok: false as const, reason: "deck_not_ready" as const, room: publicRoom(room), resolved: false };
  }
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
  if (!cardAllowedForTurn(room.game.deckMode || "all", room.game.activeTurn, cleanedCardNo)) {
    return { ok: false as const, reason: "invalid_card_kind" as const, room: publicRoom(room), resolved: turnResolved };
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
    } else {
      const targetSlot = selectedTargetSlot(side, cleanTarget);
      const legalTargetSlots = legalManualSkillTargetSlots(room, side, choice.cardNo);
      if (!targetSlot || !legalTargetSlots.includes(targetSlot)) {
        return { ok: false as const, reason: "invalid_target" as const, room: publicRoom(room) };
      }
    }
    choice.selectedTarget = cleanTarget || "selected";
  }
  resolveIfBothLocked(room);
  runBotBrain(room);
  healTriadRoomState(room);
  await upsertStoredRoom(room);
  return {
    ok: true as const,
    room: publicRoom(room),
    resolved: room.game.turns.some((item) => item.turn === room.game.activeTurn),
  };
}

export async function chooseTriadRoomOpeningTieBreak(
  code: string,
  participant: string | TriadRoomParticipant,
  choice: TriadRpsChoice
) {
  const room = await getStoredRoom(code);
  if (!room) return { ok: false as const, reason: "not_found" as const };
  const side =
    typeof participant === "string"
      ? sideForParticipant(room, participant)
      : reconnectParticipantSeat(room, participant);
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
    round: winner === "draw" ? (tieBreak.round || 1) + 1 : tieBreak.round || 1,
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
  healTriadRoomState(room);
  await upsertStoredRoom(room);
  return { ok: true as const, room: publicRoom(room), resolved: room.game.openerTieBreak.status === "resolved" };
}

export async function resetTriadRoomOpeningTieBreak(code: string, participant: string | TriadRoomParticipant) {
  return withRoomMutationLock(code, async () => {
    const room = await getStoredRoom(code);
    if (!room) return { ok: false as const, reason: "not_found" as const };
    const side =
      typeof participant === "string"
        ? sideForParticipant(room, participant)
        : reconnectParticipantSeat(room, participant);
    if (!side) return { ok: false as const, reason: "not_player" as const, room: publicRoom(room) };
    if (isTriadBotParticipant(room.seats[side])) {
      return { ok: false as const, reason: "bot_seat" as const, room: publicRoom(room) };
    }
    const firstTurnResult = room.game.turns.find((turn) => turn.turn === 1);
    if (room.status !== "playing" || firstTurnResult?.winner !== "draw") {
      return { ok: false as const, reason: "not_available" as const, room: publicRoom(room) };
    }

    const previousTieBreak = room.game.openerTieBreak;
    room.game.activeTurn = 1;
    room.game.turnReady = { host: false, challenger: false };
    room.game.turnStartedAt = Date.now();
    room.game.openerTieBreak = {
      fightNo: room.game.fightNo,
      turn: 1,
      round: Math.max(1, (previousTieBreak.round || 1) + 1),
      status: "waiting",
      reason: "first_turn_score_draw",
      choices: {},
      revealChoices: undefined,
      winner: "",
      source: "manual",
      message: "RPS was reset. Choose again.",
    };

    runBotBrain(room);
    healTriadRoomState(room);
    await upsertStoredRoom(room);
    return { ok: true as const, room: publicRoom(room) };
  });
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
  if (room.game.matchEndedAt) {
    return { ok: true as const, room: publicRoom(room), matchEnded: true as const };
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
    if (finalizeNineTurnMatchIfNeeded(room, room.game.activeTurn)) {
      runBotBrain(room);
      await upsertStoredRoom(room);
      return { ok: true as const, room: publicRoom(room), matchEnded: true as const };
    }
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
  enforceDeckGate(room);
  if (!participantId || !participantInStoredRoom(room, participantId)) {
    return { ok: false as const, reason: "not_in_room" as const, room: publicRoom(room) };
  }
  if (room.status !== "playing" || !battleDecksReady(room)) {
    await upsertStoredRoom(room);
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
  await warmBotMemory();
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
      room.game = freshGameForRoom(room, `bot:${Date.now()}`);
    } else {
      if (!isTriadBotParticipant(room.seats.challenger)) {
        return { ok: true as const, room: publicRoom(room), enabled: false as const };
      }
      room.seats.challenger = null;
      room.status = "waiting";
      room.game = freshGameForRoom(room, `human:${Date.now()}`);
    }

    await upsertStoredRoom(room);
    return { ok: true as const, room: publicRoom(room), enabled };
  });
}

export async function setTriadRoomDeckMode(code: string, participantId: string, deckModeInput: TriadDeckMode) {
  return withRoomMutationLock(code, async () => {
    const room = await getStoredRoom(code);
    if (!room) return { ok: false as const, reason: "not_found" as const };
    if (!canControlStoredRoom(room, participantId)) {
      return { ok: false as const, reason: "not_host" as const, room: publicRoom(room) };
    }
    if (room.status !== "waiting") {
      return { ok: false as const, reason: "already_playing" as const, room: publicRoom(room) };
    }

    const deckMode = normalizeDeckMode(deckModeInput);
    const chat = room.game.chat;
    room.game = {
      ...freshGame(),
      deckMode,
      selectionPools: buildSelectionPools(deckMode, `${room.code}:mode:${Date.now()}`),
      chat,
    };
    await upsertStoredRoom(room);
    return { ok: true as const, room: publicRoom(room), deckMode };
  });
}

export async function startTriadRoom(code: string, participantId: string) {
  await warmBotMemory();
  const room = await getStoredRoom(code);
  if (!room) return { ok: false as const, reason: "not_found" as const };
  if (!canControlStoredRoom(room, participantId)) return { ok: false as const, reason: "not_host" as const, room: publicRoom(room) };
  if (!room.seats.host || !room.seats.challenger) {
    return { ok: false as const, reason: "need_two_players" as const, room: publicRoom(room) };
  }

  room.status = "playing";
  room.game = freshGameForRoom(room);
  if (isTriadBotParticipant(room.seats.challenger)) {
    ensureBotDeckReady(room);
  }
  await upsertStoredRoom(room);
  return { ok: true as const, room: publicRoom(room) };
}

export async function runTriadRoomBot(code: string, participantId: string) {
  await warmBotMemory();
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
  return withRoomMutationLock(code, async () => {
    const room = await getStoredRoom(code);
    if (!room) return { ok: false as const, reason: "not_found" as const };
    if (room.status === "waiting") return { ok: true as const, room: publicRoom(room), alreadyWaiting: true as const };

    const matchEnded = Boolean(room.game.matchEndedAt || room.game.matchWinner);
    const canContinue = matchEnded
      ? participantInStoredRoom(room, participantId)
      : canControlStoredRoom(room, participantId);
    if (!canContinue) return { ok: false as const, reason: "not_host" as const, room: publicRoom(room) };

    const chat = room.game.chat;
    room.status = "waiting";
    room.game = {
      ...freshGameForRoom(room),
      chat,
    };
    await upsertStoredRoom(room);
    return { ok: true as const, room: publicRoom(room) };
  });
}

export async function gmResetTriadRoomDeckSelection(code: string) {
  await warmBotMemory();
  return withRoomMutationLock(code, async () => {
    const room = await getStoredRoom(code);
    if (!room) return { ok: false as const, reason: "not_found" as const };
    const chat = room.game.chat;
    room.status = "playing";
    room.game = {
      ...freshGameForRoom(room, `gm-reset:${Date.now()}`),
      chat,
    };
    if (isTriadBotParticipant(room.seats.challenger)) {
      ensureBotDeckReady(room);
    }
    await upsertStoredRoom(room);
    return { ok: true as const, room: publicRoom(room) };
  });
}

export async function gmRefreshTriadRoom(code: string) {
  await warmBotMemory();
  return withRoomMutationLock(code, async () => {
    const room = await getStoredRoom(code);
    if (!room) return { ok: false as const, reason: "not_found" as const };
    enforceDeckGate(room);
    markExpiredSkillChoices(room);
    resolveIfBothLocked(room);
    runBotBrain(room);
    await upsertStoredRoom(room);
    return { ok: true as const, room: publicRoom(room) };
  });
}

export async function gmRestartTriadRoomTurn(code: string) {
  await warmBotMemory();
  return withRoomMutationLock(code, async () => {
    const room = await getStoredRoom(code);
    if (!room) return { ok: false as const, reason: "not_found" as const };
    enforceDeckGate(room);
    if (room.status !== "playing" || !battleDecksReady(room)) {
      await upsertStoredRoom(room);
      return { ok: false as const, reason: "not_playing" as const, room: publicRoom(room) };
    }

    const turn = room.game.activeTurn;
    const lane = laneForTurn(turn);
    const removedResult = room.game.turns.find((item) => item.turn === turn);
    if (removedResult?.winner === "player") {
      room.game.matchScore.host = Math.max(0, (room.game.matchScore.host || 0) - 1);
    } else if (removedResult?.winner === "opponent") {
      room.game.matchScore.challenger = Math.max(0, (room.game.matchScore.challenger || 0) - 1);
    }

    const hostCard = room.game.triangles.host[lane];
    const challengerCard = room.game.triangles.challenger[lane];
    room.game.triangles.host[lane] = "";
    room.game.triangles.challenger[lane] = "";
    room.game.usedCards.host = (room.game.usedCards.host || []).filter((cardNo) => cardNo !== hostCard);
    room.game.usedCards.challenger = (room.game.usedCards.challenger || []).filter((cardNo) => cardNo !== challengerCard);
    room.game.turns = room.game.turns.filter((item) => item.turn !== turn);
    room.game.skillChoices = room.game.skillChoices.filter(
      (choice) => choice.fightNo !== room.game.fightNo || choice.turn !== turn
    );
    room.game.turnReady = { host: false, challenger: false };
    room.game.turnStartedAt = Date.now();
    room.game.matchWinner = "";
    room.game.surrenderedBy = "";
    room.game.matchEndedAt = 0;
    room.game.rankedRecordedAt = 0;
    room.game.rankUpEvents = [];
    if (turn === 1) {
      room.game.openerTieBreak = emptyOpeningTieBreak();
    }
    runBotBrain(room);
    await upsertStoredRoom(room);
    return { ok: true as const, room: publicRoom(room), restartedTurn: turn };
  });
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
    cleanRoom.game = freshGameForRoom(cleanRoom);
  }
  await upsertStoredRoom(cleanRoom);
  return { ok: true as const, room: publicRoom(cleanRoom) };
}
