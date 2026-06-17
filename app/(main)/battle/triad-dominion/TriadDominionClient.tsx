"use client";

import Image from "next/image";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Brain,
  Check,
  ChevronRight,
  Crosshair,
  Crown,
  Eye,
  Flame,
  Hand,
  KeyRound,
  Layers3,
  Lock,
  Plus,
  RotateCcw,
  Search,
  Shield,
  Sparkles,
  Scissors,
  Swords,
  Trophy,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import {
  resolveTriadTurn,
  triadSkillRuleByNo,
  type TriadCardKind,
  type TriadElement,
  type TriadRpsChoice,
  type TriadTriangle,
  type TriadTurn,
  type TriadTurnResult,
} from "@/lib/triad-dominion";
import { getBrowserSupabaseClient } from "@/lib/supabase-browser";
import {
  TRIAD_ROOM_REALTIME_CHANNEL,
  TRIAD_ROOM_REALTIME_EVENT,
  type TriadRoomRealtimePayload,
} from "@/lib/triad-room-realtime";

type CardView = {
  cardNo: string;
  name: string;
  kind: TriadCardKind;
  attack: number;
  support: number;
  element: TriadElement;
  skillText: string;
  sourceImage: string;
};

type ReviewSkill = {
  cardNo: string;
  name: string;
  shape: string;
  text: string;
  reviewReason: string;
};

type Summary = {
  totalCards: number;
  monsters: number;
  skills: number;
  parsedSkills: number;
  reviewSkills: number;
};

type Props = {
  cards: CardView[];
  reviewSkills: ReviewSkill[];
  summary: Summary;
  currentUser: {
    id: string;
    name: string;
    image: string;
  };
};

type BattlePhase = "lobby" | "room" | "deck" | "battle";
type Side = "player" | "bot";
type Lane = "top" | "left" | "right";
type RoomAccess = "public" | "private";
type RoomStatus = "waiting" | "playing";
type RoomPlayerSide = "host" | "challenger";
type DeckMode = "all" | "monster" | "skill";

type RoomParticipant = {
  id: string;
  name: string;
  image: string;
  joinedAt: number;
};

type TriadRoom = {
  code: string;
  access: RoomAccess;
  hasPassword: boolean;
  status: RoomStatus;
  hostId: string;
  createdAt: number;
  updatedAt: number;
  seats: {
    host: RoomParticipant | null;
    challenger: RoomParticipant | null;
  };
  spectators: RoomParticipant[];
  game: RoomGame;
};

type RoomGame = {
  decks: Record<RoomPlayerSide, string[]>;
  deckReady: Record<RoomPlayerSide, boolean>;
  deckMode: DeckMode;
  selectionPools: Record<RoomPlayerSide, string[]>;
  deckStartedAt: number;
  triangles: Record<RoomPlayerSide, TriadTriangle>;
  skillChoices: RoomSkillChoice[];
  openerTieBreak: OpeningTieBreak;
  turns: TriadTurnResult[];
  activeTurn: TriadTurn;
  fightNo: number;
  turnStartedAt: number;
  matchWinner: RoomPlayerSide | "";
  surrenderedBy: RoomPlayerSide | "";
  matchEndedAt: number;
};

type OpeningTieBreak = {
  fightNo: number;
  turn: TriadTurn;
  status: "idle" | "waiting" | "resolved";
  reason: "first_turn_score_draw" | "";
  choices: Partial<Record<RoomPlayerSide, TriadRpsChoice>>;
  winner: RoomPlayerSide | "";
  source: "card-icon" | "manual" | "";
  message: string;
};

type RoomSkillChoice = {
  fightNo: number;
  turn: TriadTurn;
  side: RoomPlayerSide;
  lane: Lane;
  cardNo: string;
  startedAt: number;
  deadlineAt: number;
  selectedTarget: string;
  skipped: boolean;
  blessingChoice?: BlessingChoice;
  blessingDrawCardNo?: string;
  blessingPreviewTopNo?: string;
};

type LockedFight = {
  fightNo: number;
  player: TriadTriangle;
  bot: TriadTriangle;
  turns: TriadTurnResult[];
};

type TurnReveal = {
  player: boolean;
  bot: boolean;
  scored: boolean;
};

const DECK_SIZE = 20;
const SKILL_MODE_MONSTER_LIMIT = 10;
const SKILL_MODE_SKILL_LIMIT = 10;
const TURN_SECONDS = 120;
const RESULT_SECONDS = 60;
const SPECTATOR_LIMIT = 10;
const ROOM_API_PATH = "/api/triad-rooms";
const LOBBY_SYNC_MS = 1800;
const ACTIVE_ROOM_SYNC_MS = 1000;
const HIDDEN_SYNC_MS = 4000;
const MIN_SYNC_GAP_MS = 140;

const rankFrames = [
  { name: "ไม้ฝึกหัด", aura: "from-zinc-500/30 via-white/8 to-zinc-900/20", ring: "border-zinc-400/45 shadow-[0_0_22px_rgba(161,161,170,0.18)]", badge: "bg-zinc-300 text-black" },
  { name: "เหล็กดำ", aura: "from-slate-300/30 via-slate-800/20 to-black/20", ring: "border-slate-300/55 shadow-[0_0_24px_rgba(148,163,184,0.22)]", badge: "bg-slate-200 text-black" },
  { name: "ทองแดง", aura: "from-orange-300/38 via-amber-900/22 to-black/20", ring: "border-orange-300/60 shadow-[0_0_28px_rgba(251,146,60,0.26)]", badge: "bg-orange-300 text-black" },
  { name: "เงิน", aura: "from-white/42 via-cyan-200/18 to-black/20", ring: "border-white/70 shadow-[0_0_30px_rgba(226,232,240,0.3)]", badge: "bg-white text-black" },
  { name: "ทอง", aura: "from-amber-200/55 via-yellow-500/24 to-black/20", ring: "border-amber-200/80 shadow-[0_0_34px_rgba(251,191,36,0.38)]", badge: "bg-amber-200 text-black" },
  { name: "เพลิงแดง", aura: "from-red-300/58 via-rose-600/30 to-black/24", ring: "border-red-300/85 shadow-[0_0_38px_rgba(248,113,113,0.42)]", badge: "bg-red-400 text-white" },
  { name: "มรกต", aura: "from-emerald-200/58 via-emerald-500/26 to-black/24", ring: "border-emerald-200/85 shadow-[0_0_40px_rgba(52,211,153,0.38)]", badge: "bg-emerald-300 text-black" },
  { name: "เพชรฟ้า", aura: "from-cyan-100/65 via-sky-400/32 to-black/24", ring: "border-cyan-100/90 shadow-[0_0_44px_rgba(125,211,252,0.45)]", badge: "bg-cyan-200 text-black" },
  { name: "ราชันออร่า", aura: "from-yellow-100/75 via-rose-400/34 to-violet-500/24", ring: "border-yellow-100 shadow-[0_0_58px_rgba(250,204,21,0.58)]", badge: "bg-gradient-to-r from-yellow-200 to-rose-300 text-black" },
] as const;

type PendingSkillChoice = {
  side: Side;
  lane: Lane;
  cardNo: string;
  selectedTarget: "player-top" | "bot-top" | "";
};

type SkillTargetId = Exclude<PendingSkillChoice["selectedTarget"], "">;
type TargetAura = "own" | "enemy" | "pending";

type BlessingChoice = "draw-skill" | "reroll-own" | "reroll-opponent";

type PendingBlessingChoice = {
  player: TriadTriangle;
  bot: TriadTriangle;
  side: Side;
  lane: Lane;
  choice?: BlessingChoice;
  drawnCardNo?: string;
  previewTopCardNo?: string;
};

const elementStyles: Record<TriadElement, string> = {
  earth: "border-amber-500/40 bg-amber-500/10 text-amber-100",
  fire: "border-rose-500/40 bg-rose-500/10 text-rose-100",
  gold: "border-yellow-300/40 bg-yellow-300/10 text-yellow-100",
  wood: "border-emerald-400/40 bg-emerald-400/10 text-emerald-100",
  water: "border-cyan-400/40 bg-cyan-400/10 text-cyan-100",
  unknown: "border-white/15 bg-white/8 text-white/60",
};

const elementLabel: Record<TriadElement, string> = {
  earth: "ดิน",
  fire: "ไฟ",
  gold: "ทอง",
  wood: "ไม้",
  water: "น้ำ",
  unknown: "ไม่ระบุ",
};

function shuffledCardsBySeed(cards: CardView[], seed: string) {
  const next = [...cards];
  let state = seed.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0) || 1;
  for (let index = next.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const swapIndex = state % (index + 1);
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function uniqueByNo(cards: CardView[]) {
  const seen = new Set<string>();
  return cards.filter((card) => {
    if (seen.has(card.cardNo)) return false;
    seen.add(card.cardNo);
    return true;
  });
}

function safeText(value: unknown) {
  return String(value || "").trim();
}

function safeTimeMs(value: unknown, fallback = Date.now()) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;

  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getParticipantId(baseId: string) {
  return baseId || "triad-local-player";
}

function makeParticipant(user: Props["currentUser"]): RoomParticipant {
  return {
    id: getParticipantId(user.id),
    name: safeText(user.name) || "ผู้เล่น",
    image: safeText(user.image) || "/avatar.png",
    joinedAt: Date.now(),
  };
}

function rankIndexForParticipant(participant?: Pick<RoomParticipant, "id"> | null) {
  const seed = participant?.id || "empty";
  return seed.split("").reduce((total, letter) => total + letter.charCodeAt(0), 0) % rankFrames.length;
}

function RankAvatar({
  participant,
  name,
  image,
  rankIndex,
  size = "md",
  crown,
}: {
  participant?: RoomParticipant | null;
  name?: string;
  image?: string;
  rankIndex?: number;
  size?: "sm" | "md" | "lg" | "xl";
  crown?: boolean;
}) {
  const frame = rankFrames[rankIndex ?? rankIndexForParticipant(participant)];
  const sizeClass = {
    sm: "h-10 w-10 p-[3px]",
    md: "h-14 w-14 p-1",
    lg: "h-24 w-24 p-1.5",
    xl: "h-32 w-32 p-2",
  }[size];
  const imageSize = size === "xl" ? 112 : size === "lg" ? 84 : size === "md" ? 52 : 36;
  const label = name || participant?.name || "ว่าง";

  return (
    <div className={`relative grid shrink-0 place-items-center rounded-full border ${sizeClass} ${frame.ring}`}>
      <div className={`absolute -inset-3 rounded-full bg-gradient-to-br ${frame.aura} blur-xl`} />
      <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_20deg,rgba(255,255,255,0.5),rgba(0,0,0,0.15),rgba(251,191,36,0.55),rgba(0,0,0,0.2),rgba(255,255,255,0.35))] opacity-80" />
      <div className="relative h-full w-full overflow-hidden rounded-full border border-black/70 bg-[#07080b]">
        <Image src={image || participant?.image || "/avatar.png"} alt={label} width={imageSize} height={imageSize} className="h-full w-full object-cover" />
      </div>
      {crown ? (
        <span className="absolute -right-1 -top-1 grid h-7 w-7 place-items-center rounded-full border border-amber-100/70 bg-amber-300 text-black shadow-[0_0_24px_rgba(251,191,36,0.55)]">
          <Crown className="h-4 w-4" />
        </span>
      ) : null}
    </div>
  );
}

function RankFramePicker({
  selected,
  onSelect,
}: {
  selected: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="rounded-[18px] border border-amber-200/16 bg-black/36 p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100/48">กรอบแรงค์ทดลอง</div>
          <div className="mt-1 text-sm font-black text-white">{rankFrames[selected]?.name}</div>
        </div>
        <div className="rounded-full border border-red-300/35 bg-red-500/16 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-red-100">
          9 ระดับ
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {rankFrames.map((frame, index) => (
          <button
            key={frame.name}
            type="button"
            onClick={() => onSelect(index)}
            className={`group rounded-xl border p-2 text-left transition ${
              selected === index ? "border-red-300 bg-red-500/18" : "border-white/10 bg-white/[0.035] hover:border-amber-200/42"
            }`}
            title={frame.name}
          >
            <div className={`mx-auto h-9 w-9 rounded-full border bg-gradient-to-br ${frame.aura} ${frame.ring}`} />
            <div className="mt-2 truncate text-center text-[10px] font-black text-white/70">{index + 1}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function participantInRoom(room: TriadRoom | undefined, participantId: string) {
  if (!room) return false;
  return (
    room.seats.host?.id === participantId ||
    room.seats.challenger?.id === participantId ||
    room.spectators.some((viewer) => viewer.id === participantId)
  );
}

function phaseForPlayingRoom(room: TriadRoom, participantId: string): BattlePhase | null {
  const spectator = room.spectators.some((viewer) => viewer.id === participantId);
  const fieldPlayer = room.seats.host?.id === participantId || room.seats.challenger?.id === participantId;
  if (!spectator && !fieldPlayer) return null;
  if (spectator) return "battle";
  return room.game.deckReady.host && room.game.deckReady.challenger ? "battle" : "deck";
}

function removeParticipant(room: TriadRoom, participantId: string): TriadRoom {
  return {
    ...room,
    seats: {
      host: room.seats.host?.id === participantId ? null : room.seats.host,
      challenger: room.seats.challenger?.id === participantId ? null : room.seats.challenger,
    },
    spectators: room.spectators.filter((viewer) => viewer.id !== participantId),
  };
}

function normalizeApiRooms(value: unknown): TriadRoom[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((room): TriadRoom => {
      const access: RoomAccess = room?.access === "private" ? "private" : "public";
      const status: RoomStatus = room?.status === "playing" ? "playing" : "waiting";
      return {
        code: safeText(room?.code),
        access,
        hasPassword: Boolean(room?.hasPassword || access === "private"),
        status,
        hostId: safeText(room?.hostId),
        createdAt: safeTimeMs(room?.createdAt),
        updatedAt: safeTimeMs(room?.updatedAt),
        seats: {
          host: room?.seats?.host || null,
          challenger: room?.seats?.challenger || null,
        },
        spectators: Array.isArray(room?.spectators) ? room.spectators.slice(0, SPECTATOR_LIMIT) : [],
        game: normalizeRoomGame(room?.game),
      };
    })
    .filter((room) => room.code.length === 6);
}

function normalizeRoomGame(value: unknown): RoomGame {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const decks = raw.decks && typeof raw.decks === "object" ? (raw.decks as Record<string, unknown>) : {};
  const deckReady = raw.deckReady && typeof raw.deckReady === "object" ? (raw.deckReady as Record<string, unknown>) : {};
  const selectionPools = raw.selectionPools && typeof raw.selectionPools === "object" ? (raw.selectionPools as Record<string, unknown>) : {};
  const triangles = raw.triangles && typeof raw.triangles === "object" ? (raw.triangles as Record<string, unknown>) : {};
  const activeTurn = Number(raw.activeTurn || 1);
  const cleanDeck = (deck: unknown) => Array.isArray(deck) ? deck.map((item) => safeText(item)).filter(Boolean).slice(0, DECK_SIZE) : [];
  const cleanPool = (deck: unknown) => Array.isArray(deck) ? deck.map((item) => safeText(item)).filter(Boolean).slice(0, 40) : [];
  const cleanRpsChoice = (choice: unknown): TriadRpsChoice =>
    choice === "rock" || choice === "scissors" || choice === "paper" ? choice : "unknown";
  const cleanOpeningTieBreak = (tieBreak: unknown): OpeningTieBreak => {
    const rawTieBreak = tieBreak && typeof tieBreak === "object" ? (tieBreak as Record<string, unknown>) : {};
    const choices = rawTieBreak.choices && typeof rawTieBreak.choices === "object" ? (rawTieBreak.choices as Record<string, unknown>) : {};
    return {
      fightNo: Number(rawTieBreak.fightNo || 1),
      turn: rawTieBreak.turn === 2 || rawTieBreak.turn === 3 ? rawTieBreak.turn : 1,
      status: rawTieBreak.status === "waiting" || rawTieBreak.status === "resolved" ? rawTieBreak.status : "idle",
      reason: rawTieBreak.reason === "first_turn_score_draw" ? "first_turn_score_draw" : "",
      choices: {
        host: cleanRpsChoice(choices.host),
        challenger: cleanRpsChoice(choices.challenger),
      },
      winner: rawTieBreak.winner === "host" || rawTieBreak.winner === "challenger" ? rawTieBreak.winner : "",
      source: rawTieBreak.source === "card-icon" || rawTieBreak.source === "manual" ? rawTieBreak.source : "",
      message: safeText(rawTieBreak.message),
    };
  };
  const cleanSkillChoices = (choices: unknown): RoomSkillChoice[] => Array.isArray(choices)
    ? choices
        .map((choice) => {
          const rawChoice = choice && typeof choice === "object" ? (choice as Record<string, unknown>) : {};
          const turn = Number(rawChoice.turn || 1);
          const lane: Lane = rawChoice.lane === "left" || rawChoice.lane === "right" || rawChoice.lane === "top" ? rawChoice.lane : "top";
          const side: RoomPlayerSide = rawChoice.side === "challenger" ? "challenger" : "host";
          const normalizedTurn: TriadTurn = turn === 2 || turn === 3 ? turn : 1;
          return {
            fightNo: Number(rawChoice.fightNo || 1),
            turn: normalizedTurn,
            side,
            lane,
            cardNo: safeText(rawChoice.cardNo),
            startedAt: Number(rawChoice.startedAt || Date.now()),
            deadlineAt: Number(rawChoice.deadlineAt || Date.now()),
            selectedTarget: safeText(rawChoice.selectedTarget),
            skipped: Boolean(rawChoice.skipped),
          };
        })
        .filter((choice) => choice.cardNo)
    : [];
  return {
    decks: {
      host: cleanDeck(decks.host),
      challenger: cleanDeck(decks.challenger),
    },
    deckReady: {
      host: Boolean(deckReady.host),
      challenger: Boolean(deckReady.challenger),
    },
    deckMode: raw.deckMode === "monster" || raw.deckMode === "skill" ? raw.deckMode : "all",
    selectionPools: {
      host: cleanPool(selectionPools.host),
      challenger: cleanPool(selectionPools.challenger),
    },
    deckStartedAt: Number(raw.deckStartedAt || Date.now()),
    triangles: {
      host: { top: "", left: "", right: "", ...((triangles.host as TriadTriangle | undefined) || {}) },
      challenger: { top: "", left: "", right: "", ...((triangles.challenger as TriadTriangle | undefined) || {}) },
    },
    skillChoices: cleanSkillChoices(raw.skillChoices),
    openerTieBreak: cleanOpeningTieBreak(raw.openerTieBreak),
    turns: Array.isArray(raw.turns) ? (raw.turns as TriadTurnResult[]) : [],
    activeTurn: activeTurn === 2 || activeTurn === 3 ? activeTurn : 1,
    fightNo: Math.max(1, Math.min(4, Number(raw.fightNo || 1))),
    turnStartedAt: Number(raw.turnStartedAt || Date.now()),
    matchWinner: raw.matchWinner === "host" || raw.matchWinner === "challenger" ? raw.matchWinner : "",
    surrenderedBy: raw.surrenderedBy === "host" || raw.surrenderedBy === "challenger" ? raw.surrenderedBy : "",
    matchEndedAt: Number(raw.matchEndedAt || 0),
  };
}

function mergeRoomByCode(rooms: TriadRoom[], room?: TriadRoom | null) {
  if (!room?.code) return rooms;
  const exists = rooms.some((item) => item.code === room.code);
  return exists ? rooms.map((item) => (item.code === room.code ? room : item)) : [room, ...rooms];
}

function roomTurnSecondsLeft(room: TriadRoom) {
  const elapsedSeconds = Math.floor((Date.now() - room.game.turnStartedAt) / 1000);
  return Math.max(0, TURN_SECONDS - elapsedSeconds);
}

function roomDeckSecondsLeft(room: TriadRoom) {
  const elapsedSeconds = Math.floor((Date.now() - room.game.deckStartedAt) / 1000);
  return Math.max(0, 5 * 60 - elapsedSeconds);
}

function flipTriadResult(result: TriadTurnResult): TriadTurnResult {
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

function laneForTurn(turn: TriadTurn): Lane {
  if (turn === 1) return "top";
  if (turn === 2) return "left";
  return "right";
}

function turnForLane(lane: Lane): TriadTurn {
  if (lane === "top") return 1;
  if (lane === "left") return 2;
  return 3;
}

function cardLabel(card?: CardView) {
  if (!card) return "ว่าง";
  return `โจมตี ${card.attack.toLocaleString()} / ช่วย ${card.support.toLocaleString()}`;
}

function getFightScore(turns: TriadTurnResult[], reveals: Record<TriadTurn, TurnReveal>) {
  return turns.reduce(
    (score, turn) => {
      if (!reveals[turn.turn]?.scored) return score;
      if (turn.winner === "player") score.player += 1;
      if (turn.winner === "opponent") score.bot += 1;
      return score;
    },
    { player: 0, bot: 0 }
  );
}

function buildRevealStateForTurns(turns: TriadTurnResult[]) {
  const next = emptyRevealState();
  for (const turn of turns) {
    if (turn.turn === 1 || turn.turn === 2 || turn.turn === 3) {
      next[turn.turn] = { player: true, bot: true, scored: true };
    }
  }
  return next;
}

function buildSpectatorBattleLog(
  turns: TriadTurnResult[],
  hostName: string,
  challengerName: string
) {
  const lines: string[] = [];
  for (const turn of turns) {
    const winnerLabel =
      turn.winner === "draw"
        ? "เสมอ"
        : turn.winner === "player"
          ? hostName
          : challengerName;
    lines.push(
      `ตาที่ ${turn.turn}: ${winnerLabel} ชนะ (${turn.playerTotal.toLocaleString()} ต่อ ${turn.opponentTotal.toLocaleString()})`
    );
    for (const event of turn.skillEvents) {
      const actor = event.side === "player" ? hostName : challengerName;
      lines.push(`${actor}: ${event.summary}`);
    }
  }
  return lines;
}

function applyRoomBlessingPreview(
  room: TriadRoom,
  hostTriangle: TriadTriangle,
  challengerTriangle: TriadTriangle
) {
  const nextHost = { ...hostTriangle };
  const nextChallenger = { ...challengerTriangle };
  for (const choice of room.game.skillChoices) {
    if (
      choice.fightNo !== room.game.fightNo ||
      choice.turn !== room.game.activeTurn ||
      choice.cardNo !== "254" ||
      !choice.selectedTarget ||
      choice.skipped
    ) {
      continue;
    }
    if (choice.selectedTarget === "reroll-own" || choice.selectedTarget === "reroll-opponent") {
      const rerolledTarget =
        choice.selectedTarget === "reroll-own"
          ? choice.side === "host"
            ? nextHost
            : nextChallenger
          : choice.side === "host"
            ? nextChallenger
            : nextHost;
      if (choice.blessingPreviewTopNo) {
        rerolledTarget.top = choice.blessingPreviewTopNo;
      }
    }
  }
  return { host: nextHost, challenger: nextChallenger };
}

function getUsedFromFights(fights: LockedFight[]) {
  return new Set(
    fights.flatMap((fight) => [
      fight.player.top,
      fight.player.left,
      fight.player.right,
      fight.bot.top,
      fight.bot.left,
      fight.bot.right,
    ]).filter(Boolean)
  );
}

function chooseBotDeck(cards: CardView[], playerDeck: string[]) {
  const blocked = new Set(playerDeck);
  const candidates = cards.filter((card) => !blocked.has(card.cardNo) && card.kind !== "unknown");
  const monsterCards = candidates
    .filter((card) => card.kind === "monster")
    .sort((a, b) => b.attack + b.support - (a.attack + a.support));
  const skillCards = candidates
    .filter((card) => card.kind === "skill")
    .sort((a, b) => a.cardNo.localeCompare(b.cardNo));

  return [...monsterCards.slice(0, 3), ...monsterCards.slice(3, 6), ...skillCards]
    .slice(0, DECK_SIZE)
    .map((card) => card.cardNo);
}

function chooseBotTriangle(player: TriadTriangle, botDeckCards: CardView[]): TriadTriangle {
  const candidates = botDeckCards.slice(0, 18);
  let best: { triangle: TriadTriangle; points: number; total: number } | null = null;

  for (const top of candidates) {
    for (const left of candidates) {
      if (left.cardNo === top.cardNo) continue;
      for (const right of candidates) {
        if (right.cardNo === top.cardNo || right.cardNo === left.cardNo) continue;

        const bot = { top: top.cardNo, left: left.cardNo, right: right.cardNo };
        const turns = ([1, 2, 3] as TriadTurn[]).map((turn) =>
          resolveTriadTurn({ turn, player, opponent: bot })
        );
        const points = turns.reduce((sum, turn) => {
          if (turn.winner === "opponent") return sum + 1;
          if (turn.winner === "player") return sum - 1;
          return sum;
        }, 0);
        const total = turns.reduce((sum, turn) => sum + turn.opponentTotal - turn.playerTotal, 0);

        if (!best || points > best.points || (points === best.points && total > best.total)) {
          best = { triangle: bot, points, total };
        }
      }
    }
  }

  return (
    best?.triangle || {
      top: candidates[0]?.cardNo || "",
      left: candidates[1]?.cardNo || "",
      right: candidates[2]?.cardNo || "",
    }
  );
}

function chooseBotCardForTurn({
  turn,
  player,
  bot,
  botDeckCards,
  deckMode = "all",
}: {
  turn: TriadTurn;
  player: TriadTriangle;
  bot: TriadTriangle;
  botDeckCards: CardView[];
  deckMode?: DeckMode;
}) {
  const lane = laneForTurn(turn);
  const alreadyPlaced = new Set([bot.top, bot.left, bot.right].filter(Boolean));
  const requiredKind: TriadCardKind | "any" =
    lane === "top" ? "monster" : deckMode === "monster" ? "monster" : deckMode === "skill" ? "skill" : "any";
  const playableCards = botDeckCards.filter((card) => {
    if (alreadyPlaced.has(card.cardNo)) return false;
    if (requiredKind === "any") return card.kind === "monster" || card.kind === "skill";
    return card.kind === requiredKind;
  });
  let best: { cardNo: string; margin: number; total: number } | null = null;

  for (const card of playableCards) {
    const candidateBot = { ...bot, [lane]: card.cardNo };
    const result = resolveTriadTurn({ turn, player, opponent: candidateBot });
    const margin = result.opponentTotal - result.playerTotal;
    if (!best || margin > best.margin || (margin === best.margin && result.opponentTotal > best.total)) {
      best = { cardNo: card.cardNo, margin, total: result.opponentTotal };
    }
  }

  return best?.cardNo || playableCards[0]?.cardNo || "";
}

function deckModeCardKind(mode: DeckMode, lane: Lane): TriadCardKind | "any" {
  if (lane === "top") return "monster";
  if (mode === "monster") return "monster";
  if (mode === "skill") return "skill";
  return "any";
}

function deckAllowsCard(mode: DeckMode, lane: Lane, card?: CardView | null) {
  if (!card) return false;
  const requiredKind = deckModeCardKind(mode, lane);
  if (requiredKind === "any") return card.kind === "monster" || card.kind === "skill";
  return card.kind === requiredKind;
}

function validateDeckForMode(cards: CardView[], mode: DeckMode) {
  const monsters = cards.filter((card) => card.kind === "monster").length;
  const skills = cards.filter((card) => card.kind === "skill").length;
  const errors: string[] = [];

  if (cards.length !== DECK_SIZE) {
    errors.push(`ต้องเลือกการ์ดให้ครบ ${DECK_SIZE} ใบ`);
  }

  if (mode === "monster") {
    if (monsters !== DECK_SIZE) {
      errors.push(`โหมด MONSTER ต้องใช้การ์ดมอนสเตอร์ครบ ${DECK_SIZE} ใบ`);
    }
  } else if (mode === "skill") {
    if (monsters !== SKILL_MODE_MONSTER_LIMIT || skills !== SKILL_MODE_SKILL_LIMIT) {
      errors.push(`โหมด SKILL ต้องมีการ์ดมอนสเตอร์ ${SKILL_MODE_MONSTER_LIMIT} ใบ และการ์ดสกิล ${SKILL_MODE_SKILL_LIMIT} ใบ`);
    }
  } else if (monsters < 3) {
    errors.push("โหมด ALL IN ONE ต้องมีการ์ดมอนสเตอร์อย่างน้อย 3 ใบ");
  }

  return {
    valid: errors.length === 0,
    monsters,
    skills,
    errors,
  };
}

function skillNeedsChoice(card?: CardView) {
  return Boolean(card?.kind === "skill" && (card.cardNo === "254" || /เลือก|choose|target/i.test(card.skillText)));
}

function getSelectableSkillTargetIds(card?: CardView, side: Side = "player"): SkillTargetId[] {
  const ownTarget: SkillTargetId = side === "player" ? "player-top" : "bot-top";
  const opponentTarget: SkillTargetId = side === "player" ? "bot-top" : "player-top";
  const rule = card ? triadSkillRuleByNo.get(card.cardNo) : undefined;

  if (!rule) return [ownTarget];
  if (rule.target.startsWith("own")) return [ownTarget];
  if (rule.target.startsWith("opponent")) return [opponentTarget];
  if (rule.target === "any-one" || rule.target === "all") return [ownTarget, opponentTarget];

  return [ownTarget];
}

function hiddenCard() {
  return (
    <div className="grid aspect-[3/4] place-items-center overflow-hidden rounded-2xl border border-cyan-200/20 bg-[radial-gradient(circle_at_50%_25%,rgba(34,211,238,0.28),rgba(7,12,22,0.98)_58%)] shadow-[0_22px_60px_rgba(0,0,0,0.38)]">
      <div className="text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-cyan-200/20 bg-cyan-200/10">
          <Lock className="h-7 w-7 text-cyan-100" />
        </div>
        <div className="mt-3 text-xs font-black uppercase tracking-[0.22em] text-white/48">
          ปิดไว้
        </div>
      </div>
    </div>
  );
}

function BattleCard({
  card,
  active,
  hidden,
}: {
  card?: CardView;
  active?: boolean;
  hidden?: boolean;
}) {
  if (!card || hidden) return hiddenCard();

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-black/45 shadow-[0_24px_70px_rgba(0,0,0,0.38)] transition ${
        active ? "border-amber-300/90 ring-2 ring-amber-300/35" : "border-white/10"
      }`}
    >
      <div className="relative aspect-[3/4] bg-black/45">
        <Image src={card.sourceImage} alt={card.name} fill sizes="260px" className="object-cover" />
      </div>
      <div className="space-y-1 p-3">
        <div className="truncate text-sm font-black text-white">เลข {card.cardNo} {card.name}</div>
        <div className="truncate text-xs font-semibold text-white/64">{cardLabel(card)}</div>
      </div>
    </div>
  );
}

function DeckCard({
  card,
  selected,
  disabled,
  disabledReason,
  onClick,
}: {
  card: CardView;
  selected: boolean;
  disabled: boolean;
  disabledReason?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled && !selected}
      title={disabled && !selected ? disabledReason : selected ? "คลิกอีกครั้งเพื่อลบการ์ดใบนี้" : undefined}
      className={`group relative min-w-0 overflow-hidden rounded-xl border bg-black/52 text-left shadow-[0_18px_48px_rgba(0,0,0,0.32)] transition hover:-translate-y-1 hover:border-amber-300/60 disabled:cursor-not-allowed disabled:opacity-35 ${
        selected ? "border-amber-300 ring-2 ring-amber-300/30" : "border-white/10"
      }`}
    >
      <div className="relative aspect-[3/4]">
        <Image src={card.sourceImage} alt={card.name} fill sizes="180px" className="object-cover" />
        {selected ? (
          <div className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-amber-200 to-amber-400 text-black shadow-[0_0_18px_rgba(251,191,36,0.35)]">
            <Check className="h-4 w-4" />
          </div>
        ) : null}
      </div>
      <div className="p-2.5">
        <div className="truncate text-xs font-black text-white">เลข {card.cardNo} {card.name}</div>
        <div className="mt-1 truncate text-[11px] font-semibold text-white/58">{cardLabel(card)}</div>
        <div className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black ${card.kind === "skill" ? "border-violet-300/40 bg-violet-300/10 text-violet-100" : elementStyles[card.element]}`}>
          {card.kind === "skill" ? "สกิล" : elementLabel[card.element]}
        </div>
      </div>
    </button>
  );
}

function TriangleArena({
  title,
  triangle,
  cardsByNo,
  activeTurn,
  revealed,
  side,
}: {
  title: string;
  triangle: TriadTriangle;
  cardsByNo: Map<string, CardView>;
  activeTurn: TriadTurn;
  revealed: Record<TriadTurn, TurnReveal>;
  side: Side;
}) {
  const activeLane = laneForTurn(activeTurn);

  const isVisible = (lane: Lane) => {
    if (side === "player") return true;
    const turn = turnForLane(lane);
    return Boolean(revealed[turn]?.bot);
  };

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.035] p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-black text-white">
          {side === "bot" ? <Bot className="h-4 w-4 text-rose-200" /> : <Shield className="h-4 w-4 text-emerald-200" />}
          {title}
        </div>
        <div className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/42">
          ฐาน 3 ใบ
        </div>
      </div>

      <div className="mx-auto grid max-w-[640px] grid-cols-2 gap-3 sm:gap-5">
        <div className="col-span-2 mx-auto w-[62%] sm:w-[50%]">
          <BattleCard card={cardsByNo.get(triangle.top)} active={activeLane === "top"} hidden={!isVisible("top")} />
        </div>
        <BattleCard card={triangle.left ? cardsByNo.get(triangle.left) : undefined} active={activeLane === "left"} hidden={!isVisible("left")} />
        <BattleCard card={triangle.right ? cardsByNo.get(triangle.right) : undefined} active={activeLane === "right"} hidden={!isVisible("right")} />
      </div>
    </div>
  );
}

function ScorePill({ label, value, tone }: { label: string; value: number; tone: "player" | "bot" }) {
  return (
    <div className={`rounded-xl border p-3 ${tone === "player" ? "border-emerald-300/20 bg-emerald-300/10" : "border-rose-300/20 bg-rose-300/10"}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/45">{label}</div>
      <div className="mt-1 text-4xl font-black text-white">{value}</div>
    </div>
  );
}

function FighterPanel({
  name,
  image,
  score,
  tone,
  deckLeft,
  side,
}: {
  name: string;
  image: string;
  score: number;
  tone: "player" | "bot";
  deckLeft: number;
  side: "left" | "right";
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border bg-black/38 p-3 shadow-[0_18px_42px_rgba(0,0,0,0.32)] ${
        tone === "player" ? "border-red-300/18" : "border-blue-300/18"
      } ${side === "right" ? "xl:flex-row-reverse xl:text-right" : ""}`}
    >
      <div className="relative grid h-20 w-16 shrink-0 place-items-end overflow-hidden rounded-xl border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(0,0,0,0.3))]">
        <Image src={image || "/avatar.png"} alt={name} width={72} height={72} className="h-16 w-16 object-contain" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-black text-white">{name}</div>
        <div className="mt-1 flex items-center gap-2 text-xs font-bold text-white/48 xl:justify-start">
          <span className="rounded-md border border-white/10 bg-black/30 px-2 py-1">เด็ค {deckLeft}</span>
          <span className="rounded-md border border-white/10 bg-black/30 px-2 py-1">พลัง 200</span>
        </div>
        <div
          className={`mt-3 h-2 rounded-full ${
            tone === "player" ? "bg-red-500 shadow-[0_0_18px_rgba(239,68,68,0.5)]" : "bg-blue-500 shadow-[0_0_18px_rgba(59,130,246,0.5)]"
          }`}
        />
      </div>
      <div
        className={`grid h-16 w-16 shrink-0 place-items-center rounded-full border-4 text-3xl font-black shadow-[0_12px_34px_rgba(0,0,0,0.35)] ${
          tone === "player"
            ? "border-red-200 bg-[radial-gradient(circle,#ef4444,#7f1d1d)] text-white"
            : "border-blue-200 bg-[radial-gradient(circle,#60a5fa,#1d4ed8)] text-white"
        }`}
      >
        {score}
      </div>
    </div>
  );
}

function PhaseTrack({ activeTurn }: { activeTurn: TriadTurn }) {
  const steps = [
    ["เตรียม", 0],
    ["ตา 1", 1],
    ["ตา 2", 2],
    ["ตา 3", 3],
    ["จบ", 4],
  ] as const;

  return (
    <div className="relative overflow-hidden rounded-[18px] border border-amber-100/24 bg-[linear-gradient(180deg,rgba(30,21,9,0.94),rgba(9,7,5,0.88))] p-1.5 shadow-[0_16px_46px_rgba(0,0,0,0.36),inset_0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-md">
      <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-amber-100/55 to-transparent" />
      <div className="grid grid-cols-5 gap-1">
        {steps.map(([label, value]) => (
          <div
            key={label}
            className={`rounded-xl px-2 py-2 text-center text-[10px] font-black uppercase tracking-[0.14em] sm:text-xs ${
              value === activeTurn ? "bg-amber-200 text-black shadow-[0_0_26px_rgba(251,191,36,0.34)]" : "text-amber-100/38"
            }`}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function BoardCardSlot({
  card,
  hidden,
  active,
  aura,
  label,
  tone,
}: {
  card?: CardView;
  hidden?: boolean;
  active?: boolean;
  aura?: TargetAura;
  label: string;
  tone: "player" | "bot" | "neutral";
}) {
  const border =
    tone === "player"
      ? "border-red-300/55"
      : tone === "bot"
        ? "border-cyan-300/55"
        : "border-amber-300/55";

  return (
    <div
      className={`relative w-[clamp(48px,7vw,112px)] overflow-hidden rounded-[10px] border bg-[#09090d] shadow-[0_18px_42px_rgba(0,0,0,0.42)] ${active ? "ring-2 ring-amber-300/70" : ""} ${border} ${
        aura === "own"
          ? "ring-4 ring-cyan-300/85 shadow-[0_0_42px_rgba(34,211,238,0.62)]"
          : aura === "enemy"
            ? "ring-4 ring-red-400/85 shadow-[0_0_42px_rgba(248,113,113,0.62)]"
            : aura === "pending"
              ? "ring-4 ring-violet-300/80 shadow-[0_0_42px_rgba(168,85,247,0.55)]"
              : ""
      }`}
    >
      {aura ? (
        <div
          className={`pointer-events-none absolute inset-0 z-10 animate-pulse rounded-[inherit] ${
            aura === "own"
              ? "bg-cyan-300/14"
              : aura === "enemy"
                ? "bg-red-500/16"
                : "bg-violet-400/14"
          }`}
        />
      ) : null}
      <div className="relative aspect-[3/4]">
        {card && !hidden ? (
          <Image src={card.sourceImage} alt={card.name} fill sizes="128px" className="object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_20%,rgba(251,191,36,0.14),rgba(5,5,8,1)_62%)]">
            <div className="text-center text-[10px] font-black uppercase tracking-[0.16em] text-white/54">
              {hidden ? "ปิดไว้" : label}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BoardPile({
  label,
  sublabel,
  tone,
  rotate,
  cards,
  onClick,
}: {
  label: string;
  sublabel: string;
  tone: "red" | "blue" | "gold";
  rotate?: boolean;
  cards?: CardView[];
  onClick?: () => void;
}) {
  const color =
    tone === "red"
      ? "border-red-500/70"
      : tone === "blue"
        ? "border-cyan-400/70"
        : "border-amber-400/70";

  const Comp = onClick ? "button" : "div";

  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`relative grid w-[clamp(42px,6vw,88px)] place-items-center overflow-hidden rounded-lg border bg-[#08080c] shadow-[0_16px_34px_rgba(0,0,0,0.36)] transition ${onClick ? "hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-amber-200/70" : ""} ${color} ${
        rotate ? "rotate-180" : ""
      }`}
      style={{ aspectRatio: "3 / 4" }}
    >
      {cards?.slice(-4).map((card, index) => (
        <div
          key={`${card.cardNo}-${index}`}
          className="absolute inset-[8%] overflow-hidden rounded-md border border-white/14 bg-black shadow-[0_8px_18px_rgba(0,0,0,0.45)]"
          style={{ transform: `translate(${index * 4}px, ${index * -4}px) rotate(${(index - 1.5) * 3}deg)` }}
        >
          <Image src={card.sourceImage} alt={card.name} fill sizes="94px" className="object-cover opacity-80" />
        </div>
      ))}
      <div className="relative z-10 rounded-md bg-black/55 px-2 py-1 text-center backdrop-blur-sm">
        <div className="text-[clamp(0.55rem,1.1vw,0.9rem)] font-black uppercase leading-none text-white">
          {label}
        </div>
        <div className="mt-1 text-[clamp(0.45rem,0.9vw,0.72rem)] font-bold text-white/62">
          {sublabel}
        </div>
      </div>
    </Comp>
  );
}

function RevealSpotlight({
  playerCard,
  botCard,
  showPlayer,
  showBot,
  result,
  playerName,
  botName,
}: {
  playerCard?: CardView;
  botCard?: CardView;
  showPlayer: boolean;
  showBot: boolean;
  result?: TriadTurnResult;
  playerName: string;
  botName: string;
}) {
  if (!showPlayer && !showBot) return null;

  const isScored = Boolean(result && showPlayer && showBot);
  const playerWins = result?.winner === "player";
  const botWins = result?.winner === "opponent";
  const skillEvents = result?.skillEvents || [];
  const skillCard = [playerCard, botCard].find((card) => card?.kind === "skill");
  const skillEvent = skillEvents[0];
  const skillText = skillEvent?.summary || skillCard?.skillText || "";
  const isSwapSkill = skillEvent?.type === "swap-control";
  const scoreText = result ? `${result.playerTotal.toLocaleString()} ปะทะ ${result.opponentTotal.toLocaleString()}` : "";
  const winnerText = result?.winner === "draw" ? "เสมอ" : playerWins ? `${playerName} ได้แต้ม` : `${botName} ได้แต้ม`;
  const timeline =
    skillEvents.length > 0
      ? skillEvents
      : [
          {
            cardNo: "",
            name: "ปะทะโดยตรง",
            side: "player" as const,
            type: "stat" as const,
            text: "",
            summary: "ไม่มีสกิลพิเศษในตานี้ คิดคะแนนจากการปะทะของการ์ดทั้งสองฝั่ง",
          },
        ];

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[32%] z-20 flex justify-center px-3">
      {isScored ? (
        <div className="absolute inset-x-[18%] top-1/2 h-32 -translate-y-1/2 rounded-full bg-black/32 blur-2xl" />
      ) : null}
      <div className="absolute inset-x-[12%] top-1/2 h-px bg-gradient-to-r from-transparent via-cyan-200/80 to-transparent shadow-[0_0_34px_rgba(34,211,238,0.75)]" />
      <div className="relative grid w-[min(720px,76%)] items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <div className={`mx-auto w-[clamp(96px,13vw,174px)] ${playerWins ? "scale-105" : botWins ? "opacity-65" : ""}`}>
          {showPlayer && playerCard ? (
            <div className={`animate-[triad-card-pop_520ms_ease-out] rounded-[14px] border bg-black p-1 ${playerCard.kind === "skill" ? "border-violet-200/80 shadow-[0_0_58px_rgba(168,85,247,0.75)]" : "border-red-200/70 shadow-[0_0_45px_rgba(248,113,113,0.55)]"}`}>
              {playerCard.kind === "skill" ? <div className="absolute inset-x-0 -bottom-3 h-10 rounded-full bg-violet-400/50 blur-xl" /> : null}
              <div className="relative aspect-[3/4] overflow-hidden rounded-[10px]">
                <Image src={playerCard.sourceImage} alt={playerCard.name} fill sizes="210px" className="object-cover" />
              </div>
            </div>
          ) : null}
        </div>

        <div className="text-center">
          <div className="animate-[triad-flash_900ms_ease-out] rounded-3xl bg-black/34 px-4 py-2 text-[clamp(1.65rem,3.9vw,3.6rem)] font-black uppercase leading-none text-white drop-shadow-[0_0_22px_rgba(255,255,255,0.75)] backdrop-blur-sm">
            {isSwapSkill ? "สลับ!" : isScored ? winnerText : "เปิดการ์ด"}
          </div>
          {isScored ? (
            <div className="mt-2 rounded-full border border-amber-200/50 bg-black/70 px-4 py-2 text-[clamp(1rem,2vw,1.45rem)] font-black text-amber-100 shadow-[0_0_34px_rgba(251,191,36,0.35)]">
              {scoreText}
            </div>
          ) : null}
        </div>

        <div className={`mx-auto w-[clamp(96px,13vw,174px)] ${botWins ? "scale-105" : playerWins ? "opacity-65" : ""}`}>
          {showBot && botCard ? (
            <div className={`animate-[triad-card-pop_520ms_ease-out] rounded-[14px] border bg-black p-1 ${botCard.kind === "skill" ? "border-violet-200/80 shadow-[0_0_58px_rgba(168,85,247,0.75)]" : "border-cyan-200/70 shadow-[0_0_45px_rgba(34,211,238,0.55)]"}`}>
              {botCard.kind === "skill" ? <div className="absolute inset-x-0 -bottom-3 h-10 rounded-full bg-violet-400/50 blur-xl" /> : null}
              <div className="relative aspect-[3/4] overflow-hidden rounded-[10px]">
                <Image src={botCard.sourceImage} alt={botCard.name} fill sizes="210px" className="object-cover" />
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {isScored ? (
        <div className="absolute right-2 top-1/2 grid max-h-[82%] w-[min(380px,32vw)] -translate-y-1/2 gap-2 overflow-hidden sm:right-4">
          {timeline.map((event, index) => (
            <div
              key={`${event.cardNo || "basic"}-${index}`}
              className="animate-[triad-effect-step_720ms_ease-out_both] rounded-xl border border-violet-200/35 bg-black/82 px-3 py-2 shadow-[0_0_34px_rgba(168,85,247,0.22)] backdrop-blur-md"
              style={{ animationDelay: `${index * 160}ms` }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[9px] font-black uppercase tracking-[0.16em] text-violet-200/70">
                    {event.cardNo ? `${event.side === "player" ? playerName : botName} ใช้สกิล No.${event.cardNo}` : "ผลการปะทะ"}
                  </div>
                  <div className="mt-1 truncate text-sm font-black text-white">{event.name}</div>
                </div>
                <div className="shrink-0 rounded-full border border-amber-200/30 bg-amber-200/10 px-2 py-1 text-[10px] font-black text-amber-100">
                  {index + 1}/{timeline.length}
                </div>
              </div>
              {event.targetLabel ? (
                <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-red-300/32 bg-red-500/12 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-red-100">
                  <Crosshair className="h-3 w-3 shrink-0" />
                  <span className="truncate">ล็อกเป้า: {event.targetLabel}</span>
                </div>
              ) : null}
              {event.blocked ? (
                <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-amber-300/32 bg-amber-300/12 px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-100">
                  <Lock className="h-3 w-3 shrink-0" />
                  <span className="truncate">บัฟถูกบล็อก</span>
                </div>
              ) : null}
              <div className="mt-1 text-xs font-semibold leading-5 text-white/72">
                {event.summary || skillText || "ระบบกำลังจัดการผลสกิลของการ์ดนี้"}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <style jsx global>{`
        @keyframes triad-card-pop {
          0% { transform: translateY(24px) scale(0.82) rotate(-2deg); opacity: 0; filter: blur(8px); }
          65% { transform: translateY(-8px) scale(1.05) rotate(1deg); opacity: 1; filter: blur(0); }
          100% { transform: translateY(0) scale(1) rotate(0); opacity: 1; filter: blur(0); }
        }
        @keyframes triad-flash {
          0% { transform: scale(0.7); opacity: 0; text-shadow: 0 0 0 rgba(255,255,255,0); }
          40% { transform: scale(1.08); opacity: 1; text-shadow: 0 0 34px rgba(255,255,255,0.9); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes triad-effect-step {
          0% { transform: translateY(18px) scale(0.96); opacity: 0; filter: blur(6px); }
          100% { transform: translateY(0) scale(1); opacity: 1; filter: blur(0); }
        }
      `}</style>
    </div>
  );
}

function BoardTriangle({
  cardsByNo,
  triangle,
  activeLane,
  tone,
  isVisible,
  swapActive,
  auraByLane,
  onSlotClick,
  onDropCard,
  selectedLane,
}: {
  cardsByNo: Map<string, CardView>;
  triangle: TriadTriangle;
  activeLane: Lane;
  tone: "player" | "bot";
  isVisible: (lane: Lane) => boolean;
  swapActive?: boolean;
  auraByLane?: Partial<Record<Lane, TargetAura>>;
  onSlotClick?: (lane: Lane) => void;
  onDropCard?: (lane: Lane, cardNo: string) => void;
  selectedLane?: Lane;
}) {
  const lanes: { lane: Lane; label: string; className: string }[] = [
    {
      lane: "top",
      label: "หลัก",
      className: `col-span-2 mx-auto w-[clamp(52px,7vw,104px)] ${tone === "bot" ? "translate-y-1" : "-translate-y-1"}`,
    },
    {
      lane: "left",
      label: "โจมตี",
      className: `w-[clamp(48px,6.4vw,96px)] ${tone === "bot" ? "translate-y-1" : "-translate-y-1"}`,
    },
    {
      lane: "right",
      label: "ช่วย",
      className: `w-[clamp(48px,6.4vw,96px)] ${tone === "bot" ? "translate-y-1" : "-translate-y-1"}`,
    },
  ];

  return (
    <div className={`grid grid-cols-2 items-end justify-items-center gap-x-[clamp(5px,1vw,14px)] gap-y-0 ${tone === "player" ? "-translate-y-1 sm:-translate-y-3" : "translate-y-1 sm:translate-y-3"}`}>
      {lanes.map(({ lane, label, className }) => {
        const cardNo = triangle[lane];
        return (
          <button
            key={lane}
            type="button"
            data-triad-lane={lane}
            onClick={() => onSlotClick?.(lane)}
            onDragOver={(event) => {
              if (onDropCard) event.preventDefault();
            }}
            onDrop={(event) => {
              const cardNo = event.dataTransfer.getData("text/plain");
              if (cardNo) onDropCard?.(lane, cardNo);
            }}
            disabled={!onSlotClick}
            style={
              swapActive && lane === "top"
                ? ({ "--triad-swap-from": tone === "player" ? "220px" : "-220px" } as CSSProperties)
                : undefined
            }
            className={`${className} rounded-xl text-left transition ${
              selectedLane === lane ? "ring-2 ring-amber-300/80" : "ring-0"
            } ${swapActive && lane === "top" ? "animate-[triad-swap-land_700ms_ease-out]" : ""} ${
              onSlotClick ? "hover:-translate-y-1 disabled:hover:translate-y-0" : ""
            }`}
          >
            <BoardCardSlot
              card={cardNo ? cardsByNo.get(cardNo) : undefined}
              hidden={!isVisible(lane)}
              active={activeLane === lane}
              aura={auraByLane?.[lane]}
              label={label}
              tone={tone}
            />
          </button>
        );
      })}
      <style jsx>{`
        @keyframes triad-swap-land {
          0% { transform: translateX(var(--triad-swap-from, 0)) scale(0.86) rotate(-5deg); filter: blur(8px); opacity: 0.35; }
          55% { transform: translateX(0) scale(1.12) rotate(2deg); filter: blur(0); opacity: 1; }
          100% { transform: translateX(0) scale(1) rotate(0); filter: blur(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function HandCard({
  card,
  used,
  placedLane,
  disabled,
  highlighted,
  onClick,
  onDropToLane,
  onPreview,
  onPreviewEnd,
}: {
  card: CardView;
  used: boolean;
  placedLane?: Lane;
  disabled: boolean;
  highlighted?: boolean;
  onClick: () => void;
  onDropToLane: (lane: Lane, cardNo: string) => void;
  onPreview: (card: CardView) => void;
  onPreviewEnd: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => !used && onPreview(card)}
      onMouseLeave={onPreviewEnd}
      onFocus={() => !used && onPreview(card)}
      onBlur={onPreviewEnd}
      draggable={!disabled && !used}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", card.cardNo);
        event.dataTransfer.effectAllowed = "move";
      }}
      onPointerUp={(event) => {
        if (disabled || used) return;
        onPreview(card);
        const target = document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest<HTMLElement>("[data-triad-lane]");
        const lane = target?.dataset.triadLane as Lane | undefined;
        if (lane) onDropToLane(lane, card.cardNo);
      }}
      disabled={disabled || used}
      className={`group relative min-w-[50px] max-w-[104px] flex-[0_0_clamp(54px,5.6vw,104px)] touch-none overflow-hidden rounded-lg border bg-black/60 text-left shadow-[0_16px_34px_rgba(0,0,0,0.36)] transition ${
        used
          ? "border-white/8 opacity-25"
          : placedLane
            ? "border-amber-300/70 opacity-55"
            : highlighted
              ? "border-cyan-200/80 shadow-[0_0_24px_rgba(34,211,238,0.45)] hover:-translate-y-2"
              : "border-white/14 hover:-translate-y-2 hover:border-amber-200/70"
      }`}
    >
      <div className="relative aspect-[3/4]">
        <Image src={card.sourceImage} alt={card.name} fill sizes="110px" className="object-cover" />
      </div>
      {highlighted ? <div className="absolute inset-0 animate-pulse rounded-[inherit] ring-4 ring-cyan-300/65" /> : null}
      {placedLane ? (
        <div className="absolute right-1 top-1 rounded-md bg-amber-300 px-1.5 py-0.5 text-[8px] font-black uppercase text-black">
          {placedLane === "top" ? "หลัก" : placedLane === "left" ? "โจมตี" : "ช่วย"}
        </div>
      ) : null}
    </button>
  );
}

function PlayerHand({
  cards,
  usedSet,
  player,
  placementLane,
  activeLane,
  locked,
  highlightCardNo,
  onSelectLane,
  onPlayCard,
  onDropToLane,
}: {
  cards: CardView[];
  usedSet: Set<string>;
  player: TriadTriangle;
  placementLane: Lane;
  activeLane: Lane;
  locked: boolean;
  highlightCardNo?: string | null;
  onSelectLane: (lane: Lane) => void;
  onPlayCard: (cardNo: string) => void;
  onDropToLane: (lane: Lane, cardNo: string) => void;
}) {
  const [previewCard, setPreviewCard] = useState<CardView | null>(null);
  const placedByNo = new Map<string, Lane>();
  (["top", "left", "right"] as Lane[]).forEach((lane) => {
    const cardNo = player[lane];
    if (cardNo) placedByNo.set(cardNo, lane);
  });

  return (
    <div className="rounded-xl border border-white/8 bg-black/28 p-2 shadow-[0_18px_48px_rgba(0,0,0,0.32)]">
      <CardHoverPreview card={previewCard} />
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">
          การ์ดในมือ
        </div>
        <div className="flex gap-1">
          {(["top", "left", "right"] as Lane[]).map((lane) => (
            <button
              key={lane}
              type="button"
              onClick={() => lane === activeLane && onSelectLane(lane)}
              disabled={locked || lane !== activeLane}
              className={`h-7 rounded-lg border px-2 text-[10px] font-black uppercase transition ${
                placementLane === lane
                  ? "border-amber-300 bg-amber-300 text-black"
                  : "border-white/10 bg-white/5 text-white/55 hover:border-amber-300/50"
              } disabled:opacity-35`}
            >
              {lane === "top" ? "หลัก" : lane === "left" ? "โจมตี" : "ช่วย"}
            </button>
          ))}
        </div>
      </div>
      <div className="flex min-h-0 gap-1.5 overflow-x-auto overscroll-x-contain pb-2 pr-1 scrollbar-thin xl:justify-start">
        {cards.map((card) => (
            <HandCard
              key={card.cardNo}
              card={card}
              used={usedSet.has(card.cardNo)}
              placedLane={placedByNo.get(card.cardNo)}
              disabled={locked}
              highlighted={highlightCardNo === card.cardNo}
              onClick={() => onPlayCard(card.cardNo)}
              onDropToLane={onDropToLane}
              onPreview={setPreviewCard}
              onPreviewEnd={() => setPreviewCard(null)}
            />
        ))}
      </div>
    </div>
  );
}

function SpectatorDeckRail({
  title,
  cards,
  tone,
  onPreview,
}: {
  title: string;
  cards: CardView[];
  tone: "host" | "challenger";
  onPreview: (card: CardView | null) => void;
}) {
  const border = tone === "host" ? "border-cyan-200/18" : "border-rose-200/18";
  const glow = tone === "host" ? "shadow-[0_0_26px_rgba(34,211,238,0.14)]" : "shadow-[0_0_26px_rgba(248,113,113,0.14)]";
  return (
    <div className={`rounded-xl border bg-black/28 p-3 ${border} ${glow}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-white/52">{title}</div>
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/34">{DECK_SIZE} ใบ</div>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(3.25rem,1fr))] gap-1.5 sm:grid-cols-[repeat(auto-fit,minmax(3.6rem,1fr))]">
        {cards.map((card) => (
          <button
            key={card.cardNo}
            type="button"
            onMouseEnter={() => onPreview(card)}
            onMouseLeave={() => onPreview(null)}
            onFocus={() => onPreview(card)}
            onBlur={() => onPreview(null)}
            onClick={() => onPreview(card)}
            className="group relative aspect-[3/4] min-w-0 overflow-hidden rounded-lg border border-white/10 bg-black shadow-[0_12px_22px_rgba(0,0,0,0.24)] transition duration-200 hover:-translate-y-1 hover:scale-[1.03] hover:border-amber-200/60 hover:shadow-[0_0_34px_rgba(251,191,36,0.24)] focus:outline-none focus:ring-2 focus:ring-amber-200/70"
          >
            <Image
              src={card.sourceImage}
              alt={card.name}
              fill
              sizes="118px"
              quality={100}
              unoptimized
              loading="eager"
              className="object-cover transition duration-200 group-hover:scale-[1.04]"
            />
            <div className="absolute left-1 top-1 rounded bg-black/72 px-1.5 py-0.5 text-[8px] font-black text-white">
              {card.cardNo}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function SpectatorBattleOverview({
  hostName,
  challengerName,
  hostDeckCards,
  challengerDeckCards,
  turns,
}: {
  hostName: string;
  challengerName: string;
  hostDeckCards: CardView[];
  challengerDeckCards: CardView[];
  turns: TriadTurnResult[];
}) {
  const [previewCard, setPreviewCard] = useState<CardView | null>(null);

  return null;

  const visibleTurns = turns.slice().sort((a, b) => a.turn - b.turn);

  return (
    <div className="rounded-xl border border-violet-200/18 bg-black/28 p-4 shadow-[0_18px_48px_rgba(0,0,0,0.28)]">
      <CardHoverPreview card={previewCard} />
      <div className="mb-3 flex items-center gap-2 text-sm font-black text-violet-100">
        <Eye className="h-4 w-4 text-violet-200" />
        มุมมองผู้ชมสด
      </div>
      <div className="space-y-3">
        <SpectatorDeckRail title={challengerName} cards={challengerDeckCards} tone="challenger" onPreview={setPreviewCard} />
        <SpectatorDeckRail title={hostName} cards={hostDeckCards} tone="host" onPreview={setPreviewCard} />
      </div>
      <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.03] p-3">
        <div className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/42">ผลตาที่จบแล้ว</div>
        <div className="space-y-2">
          {visibleTurns.length ? (
            visibleTurns.map((turn) => (
              <div key={turn.turn} className="rounded-lg border border-white/8 bg-black/24 p-3 text-xs font-semibold leading-5 text-white/72">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-black text-white">ตาที่ {turn.turn}</div>
                  <div className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-white/48">
                    {turn.winner === "draw" ? "เสมอ" : turn.winner === "player" ? hostName : challengerName}
                  </div>
                </div>
                <div className="mt-1 text-white/62">
                  {turn.playerTotal.toLocaleString()} ต่อ {turn.opponentTotal.toLocaleString()}
                </div>
                {turn.skillEvents.length ? (
                  <div className="mt-2 space-y-1.5">
                    {turn.skillEvents.slice(0, 3).map((event, index) => (
                      <div key={`${turn.turn}-${index}`} className="rounded-md border border-white/8 bg-white/[0.035] px-2 py-1.5 text-[11px] text-white/56">
                        {event.summary}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-white/8 bg-black/24 p-3 text-sm font-semibold text-white/42">
              รอเริ่มตาแรก
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const rpsLabel: Record<TriadRpsChoice, string> = {
  rock: "ค้อน",
  scissors: "กรรไกร",
  paper: "กระดาษ",
  unknown: "ยังไม่เลือก",
};

function rpsIcon(choice: TriadRpsChoice) {
  if (choice === "paper") return <Hand className="h-5 w-5" />;
  if (choice === "scissors") return <Scissors className="h-5 w-5" />;
  return <Swords className="h-5 w-5" />;
}

function OpeningTieBreakOverlay({
  tieBreak,
  hostName,
  challengerName,
  ownSide,
  isSpectator,
  pendingChoice,
  onChoose,
}: {
  tieBreak?: OpeningTieBreak | null;
  hostName: string;
  challengerName: string;
  ownSide: RoomPlayerSide | null;
  isSpectator: boolean;
  pendingChoice: TriadRpsChoice | null;
  onChoose: (choice: TriadRpsChoice) => void;
}) {
  if (!tieBreak || tieBreak.status === "idle") return null;
  const hostChoice = tieBreak.choices.host || "unknown";
  const challengerChoice = tieBreak.choices.challenger || "unknown";
  const ownChoice = pendingChoice || (ownSide ? tieBreak.choices[ownSide] || "unknown" : "unknown");
  const winnerName = tieBreak.winner === "host" ? hostName : tieBreak.winner === "challenger" ? challengerName : "";
  const canChoose = tieBreak.status === "waiting" && !isSpectator && ownSide && ownChoice === "unknown";

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/72 px-4 backdrop-blur-md">
      <div className="w-[min(560px,94vw)] rounded-2xl border border-amber-200/36 bg-[#080a12] p-5 text-white shadow-[0_28px_110px_rgba(0,0,0,0.62)]">
        <div className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl border border-amber-200/25 bg-amber-200/10 text-amber-100">
            <Swords className="h-6 w-6" />
          </div>
          <div className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-amber-100/62">ตัดสินฝ่ายเปิดสกิลตาถัดไป</div>
          <div className="mt-1 text-2xl font-black">ตาแรกคะแนนเสมอแล้ว</div>
          <p className="mt-3 text-sm font-semibold leading-6 text-white/68">
            {tieBreak.message || "ใช้เป่ายิงฉุบเพื่อเลือกฝ่ายเปิดการ์ดสกิลในตาถัดไปเท่านั้น คะแนนตาแรกยังนับเป็นเสมอ"}
          </p>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {[
            ["host" as const, hostName, hostChoice],
            ["challenger" as const, challengerName, challengerChoice],
          ].map(([side, name, choice]) => (
            <div key={side} className="rounded-xl border border-white/10 bg-white/[0.035] p-3 text-center">
              <div className="truncate text-sm font-black text-white">{name}</div>
              <div className={`mt-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black ${choice === "unknown" ? "border-white/10 bg-black/30 text-white/42" : "border-emerald-200/30 bg-emerald-300/10 text-emerald-100"}`}>
                {choice === "unknown" ? "ยังไม่ล็อก" : "ล็อกแล้ว"}
              </div>
            </div>
          ))}
        </div>

        {tieBreak.status === "resolved" ? (
          <div className="mt-5 rounded-xl border border-emerald-200/24 bg-emerald-300/10 p-4 text-center text-sm font-black text-emerald-100">
            {winnerName} ได้เปิดสกิลก่อนในตาถัดไป
          </div>
        ) : canChoose ? (
          <div className="mt-5 grid grid-cols-3 gap-2">
            {(["rock", "scissors", "paper"] as TriadRpsChoice[]).map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => onChoose(choice)}
                className="inline-flex h-14 items-center justify-center gap-2 rounded-xl border border-amber-200/24 bg-amber-200/10 text-sm font-black text-amber-100 transition hover:border-amber-100/70 hover:bg-amber-200/18"
              >
                {rpsIcon(choice)}
                {rpsLabel[choice]}
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-white/10 bg-black/28 p-4 text-center text-sm font-semibold text-white/58">
            {isSpectator ? "ผู้ชมกำลังรอดูผลการล็อกของทั้งสองฝ่าย" : "ล็อกคำตอบแล้ว รออีกฝ่าย"}
          </div>
        )}
      </div>
    </div>
  );
}

function CardHoverPreview({ card }: { card: CardView | null }) {
  if (!card) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[80] grid place-items-center bg-black/18 p-4 backdrop-blur-[2px]">
      <div className="w-[min(430px,82vw)] rounded-[24px] border border-amber-100/55 bg-black/88 p-4 shadow-[0_0_90px_rgba(251,191,36,0.42)]">
        <div className="relative mx-auto aspect-[3/4] w-[min(330px,70vw)] overflow-hidden rounded-[18px] border border-white/18 bg-black shadow-[0_22px_80px_rgba(0,0,0,0.55)]">
          <Image src={card.sourceImage} alt={card.name} fill sizes="360px" className="object-cover" />
        </div>
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100/58">No.{card.cardNo}</div>
          <div className="mt-1 line-clamp-2 text-xl font-black leading-tight text-white">{card.name}</div>
          <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-black text-black">
            <span className="rounded-md bg-amber-200 px-2 py-1">ATK {card.attack.toLocaleString()}</span>
            <span className="rounded-md bg-cyan-200 px-2 py-1">SUP {card.support.toLocaleString()}</span>
          </div>
          <div className="mt-2 max-h-28 overflow-hidden text-sm font-semibold leading-6 text-white/72">
            {card.skillText || "มอนสเตอร์ใช้ค่าสถานะในการปะทะ"}
          </div>
        </div>
      </div>
    </div>
  );
}

function DeckSelectionStatusBanner({
  title,
  leftName,
  rightName,
  timerText,
  message,
  compact = false,
}: {
  title: string;
  leftName: string;
  rightName: string;
  timerText: string;
  message: string;
  compact?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-2xl border shadow-[0_18px_44px_rgba(0,0,0,0.26)] backdrop-blur-md",
        compact
          ? "border-white/10 bg-black/76 px-3 py-2"
          : "border-white/10 bg-black/72 px-4 py-3",
      ].join(" ")}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className={`text-[10px] font-black uppercase tracking-[0.2em] ${compact ? "text-cyan-100/62" : "text-cyan-100/70"}`}>
            {title}
          </div>
          <div className="mt-1 text-sm font-black text-white">
            {leftName} และ {rightName}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/48 px-3 py-2 text-right">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/46">เวลาที่เหลือ</div>
          <div className={`${compact ? "text-2xl" : "text-3xl"} font-black text-white`}>{timerText}</div>
        </div>
      </div>
      <div className={`mt-2 text-xs font-semibold leading-5 ${compact ? "text-white/50" : "text-white/58"}`}>
        {message}
      </div>
    </div>
  );
}

function SpectatorDeckStrip({
  title,
  cards,
  tone,
  onPreview,
}: {
  title: string;
  cards: CardView[];
  tone: "top" | "bottom";
  onPreview?: (card: CardView | null) => void;
}) {
  const accent =
    tone === "top"
      ? "border-cyan-200/24 bg-cyan-500/10 text-cyan-100"
      : "border-rose-200/24 bg-rose-500/10 text-rose-100";
  return (
    <div className={`rounded-2xl border bg-black/42 px-3 py-2 shadow-[0_18px_52px_rgba(0,0,0,0.3)] backdrop-blur-sm ${tone === "top" ? "border-cyan-200/18" : "border-rose-200/18"}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className={`text-[10px] font-black uppercase tracking-[0.18em] ${tone === "top" ? "text-cyan-100/72" : "text-rose-100/72"}`}>
          {title}
        </div>
        <div className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] ${accent}`}>
          {cards.length} ใบ
        </div>
      </div>
      <div className="grid grid-cols-10 gap-1 md:grid-cols-[repeat(20,minmax(0,1fr))]">
        {cards.map((card) => (
          <button
            key={card.cardNo}
            type="button"
            onMouseEnter={() => onPreview?.(card)}
            onMouseLeave={() => onPreview?.(null)}
            onFocus={() => onPreview?.(card)}
            onBlur={() => onPreview?.(null)}
            onClick={() => onPreview?.(card)}
            className="group relative aspect-[3/4] min-w-0 overflow-hidden rounded-md border border-white/10 bg-black shadow-[0_10px_18px_rgba(0,0,0,0.24)] transition duration-200 hover:-translate-y-1 hover:scale-[1.03] hover:border-amber-200/55 hover:shadow-[0_0_30px_rgba(251,191,36,0.2)] focus:outline-none focus:ring-2 focus:ring-amber-200/70"
          >
            <Image
              src={card.sourceImage}
              alt={card.name}
              fill
              sizes="54px"
              quality={92}
              unoptimized
              loading="eager"
              className="object-cover transition duration-200 group-hover:scale-[1.04]"
            />
            <div className="absolute left-1 top-1 rounded bg-black/72 px-1 py-0.5 text-[8px] font-black text-white">{card.cardNo}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function RoomSeatCard({
  label,
  participant,
  isLeader,
  tone,
  emptyText,
  canTake,
  onTake,
  currentId,
  selectedFrameIndex,
}: {
  label: string;
  participant: RoomParticipant | null;
  isLeader?: boolean;
  tone: "host" | "challenger";
  emptyText: string;
  canTake: boolean;
  onTake: () => void;
  currentId: string;
  selectedFrameIndex: number;
}) {
  const toneClass =
    tone === "host"
      ? "border-amber-300/45 from-amber-300/18 via-[#120806]/82 to-black"
      : "border-amber-200/28 from-[#2a1112]/82 via-[#120608]/88 to-black";
  const isCurrent = participant?.id === currentId;

  return (
    <div className={`relative min-h-[320px] overflow-hidden rounded-[18px] border bg-gradient-to-b p-4 shadow-[0_24px_70px_rgba(0,0,0,0.42)] ${toneClass}`}>
      <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.1),transparent)] opacity-30" />
      <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-amber-100/60 to-transparent" />
      <div className="relative mb-4 flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/52">{label}</div>
        <Swords className={`h-4 w-4 ${tone === "host" ? "text-amber-200" : "text-red-200"}`} />
      </div>
      {participant ? (
        <div className="relative flex min-h-[248px] flex-col items-center justify-center text-center">
          <RankAvatar participant={participant} size="xl" crown={isLeader} rankIndex={isCurrent ? selectedFrameIndex : undefined} />
          <div className="mt-5 w-full border-y border-white/10 bg-black/34 px-3 py-3">
            <div className="truncate text-2xl font-black uppercase tracking-normal text-white">{participant.name}</div>
            <div className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-amber-100/62">
              {rankFrames[isCurrent ? selectedFrameIndex : rankIndexForParticipant(participant)].name}
            </div>
          </div>
          <div className="mt-3 rounded-full border border-emerald-200/25 bg-emerald-300/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-100">
            พร้อมลงสนาม
          </div>
        </div>
      ) : (
        <div className="relative grid min-h-[248px] place-items-center text-center">
          <div>
            <div className="mx-auto grid h-28 w-28 place-items-center rounded-full border border-dashed border-white/18 bg-black/42 text-3xl font-black text-white/20">
              ?
            </div>
            <div className="mt-5 text-xl font-black text-white/68">{emptyText}</div>
            <div className="mt-2 text-sm font-semibold leading-5 text-white/42">ถ้าช่องว่าง ผู้ชมสามารถลงมาเล่นแทนได้</div>
          </div>
          {canTake ? (
            <button
              type="button"
              onClick={onTake}
              className="absolute bottom-0 left-1/2 inline-flex h-11 -translate-x-1/2 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 px-5 text-xs font-black uppercase tracking-[0.12em] text-black shadow-[0_0_30px_rgba(251,191,36,0.24)] transition hover:from-amber-200 hover:to-yellow-100"
            >
              <UserCheck className="h-4 w-4" />
              ลงสนาม
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function SpectatorPanel({
  spectators,
  currentId,
  canWatch,
  onWatch,
}: {
  spectators: RoomParticipant[];
  currentId: string;
  canWatch: boolean;
  onWatch: () => void;
}) {
  return (
    <div className="rounded-[18px] border border-amber-200/16 bg-[linear-gradient(180deg,rgba(15,14,12,0.9),rgba(6,6,8,0.9))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.32)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-black text-white">
          <Eye className="h-4 w-4 text-violet-200" />
          ผู้ชม {spectators.length}/{SPECTATOR_LIMIT}
        </div>
        {canWatch ? (
          <button
            type="button"
            onClick={onWatch}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-amber-200/35 bg-amber-300/10 px-3 text-xs font-black text-amber-100 transition hover:border-amber-100/60"
          >
            นั่งชม
          </button>
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {Array.from({ length: SPECTATOR_LIMIT }).map((_, index) => {
          const spectator = spectators[index];
          return (
            <div key={spectator?.id || index} className="flex min-h-14 items-center gap-3 rounded-xl border border-white/8 bg-white/[0.035] px-3">
              {spectator ? (
                <RankAvatar participant={spectator} size="sm" />
              ) : (
                <div className="grid h-10 w-10 place-items-center rounded-full border border-dashed border-white/12 bg-black/35 text-[10px] font-black text-white/24">
                  {index + 1}
                </div>
              )}
              <div className="min-w-0 truncate text-sm font-bold text-white/64">
                {spectator ? `${spectator.name}${spectator.id === currentId ? " (คุณ)" : ""}` : "ว่าง"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResultBanner({ result, activeTurn }: { result: TriadTurnResult; activeTurn: TriadTurn }) {
  const title =
    result.winner === "draw"
      ? "ตานี้เสมอ"
      : result.winner === "player"
        ? "เราได้แต้ม +1"
        : "คู่แข่งได้แต้ม +1";
  const tone =
    result.winner === "draw"
      ? "border-white/16 from-white/10 to-white/[0.03]"
      : result.winner === "player"
        ? "border-emerald-300/35 from-emerald-300/20 to-cyan-300/8"
        : "border-rose-300/35 from-rose-400/20 to-amber-300/8";

  return (
    <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-r ${tone} p-4 shadow-[0_18px_54px_rgba(0,0,0,0.35)]`}>
      <div className="absolute inset-y-0 left-0 w-1/2 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.18),transparent)] opacity-70" />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/48">
            ผลตาที่ {activeTurn}
          </div>
          <div className="mt-1 text-[clamp(1.25rem,3vw,2.4rem)] font-black uppercase leading-none text-white drop-shadow-[0_0_18px_rgba(255,255,255,0.28)]">
            {title}
          </div>
        </div>
        <div className="rounded-2xl border border-amber-200/35 bg-black/54 px-4 py-2 text-right shadow-[0_0_28px_rgba(251,191,36,0.16)]">
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-100/58">คะแนนปะทะ</div>
          <div className="text-2xl font-black text-amber-100">
            {result.playerTotal.toLocaleString()} <span className="text-white/35">ต่อ</span> {result.opponentTotal.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}

function MatchFinalOverlay({
  winner,
  surrendered,
  score,
}: {
  winner: string;
  surrendered?: string;
  score: { player: number; bot: number };
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center bg-[radial-gradient(circle_at_50%_45%,rgba(251,191,36,0.22),rgba(0,0,0,0.72)_48%,rgba(0,0,0,0.9)_100%)] backdrop-blur-sm">
      <div className="relative w-[min(760px,92vw)] overflow-hidden rounded-[28px] border border-amber-100/45 bg-black/82 p-6 text-center shadow-[0_0_90px_rgba(251,191,36,0.34)]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-200 to-transparent" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.12),transparent)] opacity-40" />
        <div className="relative">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-amber-100/70 bg-amber-300 text-black shadow-[0_0_50px_rgba(251,191,36,0.55)]">
            <Trophy className="h-8 w-8" />
          </div>
          <div className="mt-5 text-[clamp(2.2rem,8vw,5.8rem)] font-black uppercase leading-none text-white drop-shadow-[0_0_32px_rgba(255,255,255,0.65)]">
            ชนะที่แท้จริง
          </div>
          <div className="mt-4 text-[clamp(1.35rem,4vw,2.5rem)] font-black text-amber-100">{winner}</div>
          {surrendered ? (
            <div className="mt-2 text-sm font-bold text-white/58">{surrendered} ยอมแพ้ การต่อสู้จบลงทันที</div>
          ) : null}
          <div className="mx-auto mt-5 w-fit rounded-full border border-red-200/35 bg-red-500/16 px-5 py-2 text-xl font-black text-white">
            คะแนนรวม {score.player}-{score.bot}
          </div>
          <div className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-white/42">
            กำลังพาทุกคนกลับห้องรอ
          </div>
        </div>
      </div>
    </div>
  );
}

function SkillTargetOverlay({
  card,
  side,
  playerTop,
  botTop,
  selectedTarget,
  timeLeft,
  onSelect,
  onConfirm,
}: {
  card?: CardView;
  side: Side;
  playerTop?: CardView;
  botTop?: CardView;
  selectedTarget: PendingSkillChoice["selectedTarget"];
  timeLeft: number;
  onSelect: (target: SkillTargetId) => void;
  onConfirm: () => void;
}) {
  if (!card) return null;

  const selectableTargetIds = new Set(getSelectableSkillTargetIds(card, side));
  const targets = [
    { id: "player-top" as const, label: "การ์ดหลักเรา", card: playerTop, tone: "border-red-300/60" },
    { id: "bot-top" as const, label: "การ์ดหลักคู่แข่ง", card: botTop, tone: "border-cyan-300/60" },
  ].filter((target) => selectableTargetIds.has(target.id));
  const effectiveSelectedTarget = selectedTarget || (targets.length === 1 ? targets[0].id : "");

  return (
    <div className="absolute bottom-4 right-4 top-16 z-40 flex w-[min(430px,calc(100%-2rem))] items-center">
      <div className="max-h-full w-full overflow-auto rounded-2xl border border-violet-200/30 bg-[#08070d]/96 p-4 shadow-[0_0_80px_rgba(168,85,247,0.35)] backdrop-blur-md sm:p-5">
        <div className="text-center">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-violet-200/70">เลือกเป้าหมายสกิล</div>
          <div className="mt-1 text-2xl font-black uppercase text-white">{card.name}</div>
          <div className="mx-auto mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/62">{card.skillText}</div>
          <div className="mt-3 text-lg font-black text-amber-200">
            {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {targets.map((target) => (
            <button
              key={target.id}
              type="button"
              onClick={() => onSelect(target.id)}
              className={`rounded-2xl border bg-black/42 p-3 text-left transition hover:-translate-y-1 ${
                effectiveSelectedTarget === target.id ? "border-amber-300 shadow-[0_0_34px_rgba(251,191,36,0.28)]" : target.tone
              }`}
            >
              <div className="mb-2 text-center text-xs font-black uppercase tracking-[0.18em] text-white/56">{target.label}</div>
              <div className="mx-auto w-[clamp(90px,18vw,150px)]">
                <BoardCardSlot card={target.card} label={target.label} tone={target.id === "player-top" ? "player" : "bot"} />
              </div>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            if (!selectedTarget && targets.length === 1) onSelect(targets[0].id);
            onConfirm();
          }}
          disabled={!effectiveSelectedTarget}
          className="mt-5 h-12 w-full rounded-2xl bg-violet-300 text-sm font-black uppercase tracking-[0.14em] text-black transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-white/30"
        >
          ยืนยันเป้าหมาย
        </button>
      </div>
    </div>
  );
}

function BlessingChoiceOverlay({
  card,
  onChoose,
}: {
  card?: CardView;
  onChoose: (choice: BlessingChoice) => void;
}) {
  if (!card) return null;
  const choices: { id: BlessingChoice; title: string; detail: string }[] = [
    {
      id: "draw-skill",
      title: "สุ่มสกิลเข้ามือ",
      detail: "สุ่มสกิล 1 ใบเพิ่มเข้าแถวล่างทันที ใบนี้จะมีออร่าจนจบตาและใช้ต่อได้ตามปกติทั้งเกม",
    },
    {
      id: "reroll-own",
      title: "สุ่มมอนสเตอร์เรา",
      detail: "สุ่มมอนสเตอร์หลักของฝั่งเรา 1 ใบให้แทนตัวบนสุดในตานี้ เฉลยแล้วค่อยคืนค่าปกติ",
    },
    {
      id: "reroll-opponent",
      title: "สุ่มมอนสเตอร์อีกฝ่าย",
      detail: "สุ่มมอนสเตอร์หลักของฝั่งตรงข้าม 1 ใบให้คว่ำหน้าไว้จนเฉลย พร้อมแสงออร่าสถานะใช้งาน",
    },
  ];

  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-black/72 p-4 backdrop-blur-md">
      <div className="w-[min(720px,94vw)] overflow-hidden rounded-2xl border border-cyan-100/30 bg-[#05070d] shadow-[0_0_70px_rgba(34,211,238,0.25)]">
        <div className="border-b border-white/10 bg-[linear-gradient(135deg,rgba(34,211,238,0.16),rgba(251,191,36,0.08))] p-4 text-center">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-100/70">No.254 สกิลพิเศษ</div>
          <div className="mt-1 text-2xl font-black text-white">{card.name}</div>
          <div className="mx-auto mt-2 max-w-xl text-sm font-semibold leading-6 text-white/58">{card.skillText}</div>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-3">
          {choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              onClick={() => onChoose(choice.id)}
              className="min-h-32 rounded-xl border border-cyan-100/18 bg-white/[0.045] p-4 text-left transition hover:-translate-y-1 hover:border-amber-200/55 hover:bg-amber-200/10"
            >
              <div className="text-lg font-black text-white">{choice.title}</div>
              <div className="mt-2 text-sm font-semibold leading-5 text-white/55">{choice.detail}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CompactBattleBoard({
  cardsByNo,
  lockedFight,
  player,
  revealed,
  activeTurn,
  matchScore,
  fightNo,
  fightScore,
  playerDeckLeft,
  botDeckLeft,
  playerGraveCards,
  botGraveCards,
  playerName,
  botName,
  playerImage,
  botImage,
  placementLane,
  timeLeft,
  turnLocked,
  pendingSkillChoice,
  waitingSkillChoice,
  revealAllCards = false,
  randomCard,
  onSelectSkillTarget,
  onConfirmSkillTarget,
  onDrawRandomCard,
  onSelectLane,
  onPlaceCard,
  blessingAuras = null,
}: {
  cardsByNo: Map<string, CardView>;
  lockedFight: LockedFight | null;
  player: TriadTriangle;
  revealed: Record<TriadTurn, TurnReveal>;
  activeTurn: TriadTurn;
  matchScore: { player: number; bot: number };
  fightNo: number;
  fightScore: { player: number; bot: number };
  playerDeckLeft: number;
  botDeckLeft: number;
  playerGraveCards: CardView[];
  botGraveCards: CardView[];
  playerName: string;
  botName: string;
  playerImage: string;
  botImage: string;
  placementLane: Lane;
  timeLeft: number;
  turnLocked: boolean;
  pendingSkillChoice: PendingSkillChoice | null;
  waitingSkillChoice?: PendingSkillChoice | null;
  revealAllCards?: boolean;
  randomCard?: CardView | null;
  onSelectSkillTarget: (target: PendingSkillChoice["selectedTarget"]) => void;
  onConfirmSkillTarget: () => void;
  onDrawRandomCard: () => void;
  onSelectLane: (lane: Lane) => void;
  onPlaceCard: (lane: Lane, cardNo: string) => void;
  blessingAuras?: { player?: TargetAura; bot?: TargetAura } | null;
}) {
  const playerTriangle = lockedFight?.player || player;
  const botTriangle = lockedFight?.bot || { top: "", left: "", right: "" };
  const activeLane = laneForTurn(activeTurn);
  const currentResult = lockedFight?.turns.find((turn) => turn.turn === activeTurn);
  const hasSwapResult = Boolean(currentResult?.skillEvents.some((event) => event.type === "swap-control"));
  const showResolvedBoard = Boolean(currentResult && revealed[activeTurn]?.scored);
  const displayPlayerTriangle =
    showResolvedBoard && currentResult?.effectivePlayer ? currentResult.effectivePlayer : playerTriangle;
  const displayBotTriangle =
    showResolvedBoard && currentResult?.effectiveOpponent ? currentResult.effectiveOpponent : botTriangle;
  const botVisible = (lane: Lane) => revealAllCards || Boolean(revealed[turnForLane(lane)]?.bot);
  const playerVisible = (lane: Lane) => revealAllCards || Boolean(revealed[turnForLane(lane)]?.player);
  const canEditPlayerSlots = !turnLocked && !revealAllCards;
  const skillChoiceForAura = pendingSkillChoice || waitingSkillChoice || null;
  const pendingSkillCard = pendingSkillChoice ? cardsByNo.get(pendingSkillChoice.cardNo) : undefined;
  const pendingFallbackTargets = pendingSkillChoice ? getSelectableSkillTargetIds(pendingSkillCard, pendingSkillChoice.side) : [];
  const pendingTarget = pendingSkillChoice?.selectedTarget || (pendingFallbackTargets.length === 1 ? pendingFallbackTargets[0] : "");
  const playerAuraByLane: Partial<Record<Lane, TargetAura>> = {};
  const botAuraByLane: Partial<Record<Lane, TargetAura>> = {};
  if (skillChoiceForAura) {
    const sourceAura: TargetAura = skillChoiceForAura === pendingSkillChoice ? "pending" : "enemy";
    if (skillChoiceForAura.side === "player") playerAuraByLane[skillChoiceForAura.lane] = sourceAura;
    else botAuraByLane[skillChoiceForAura.lane] = sourceAura;
  }
  if (pendingTarget) {
    const aura: TargetAura = pendingTarget === "player-top" ? "own" : "enemy";
    if (pendingTarget === "player-top") playerAuraByLane.top = aura;
    if (pendingTarget === "bot-top") botAuraByLane.top = aura;
  }
  if (blessingAuras?.player) playerAuraByLane.top = blessingAuras.player;
  if (blessingAuras?.bot) botAuraByLane.top = blessingAuras.bot;
  const waitingCard = waitingSkillChoice ? cardsByNo.get(waitingSkillChoice.cardNo) : undefined;

  return (
    <div className="relative h-full min-h-[360px] overflow-hidden rounded-[18px] border border-amber-100/14 bg-[#0a0908] shadow-[0_28px_90px_rgba(0,0,0,0.55)] sm:min-h-[460px] xl:min-h-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(251,191,36,0.12),transparent_20%),radial-gradient(circle_at_20%_30%,rgba(124,58,237,0.18),transparent_16%),radial-gradient(circle_at_78%_70%,rgba(14,165,233,0.14),transparent_18%),repeating-linear-gradient(90deg,rgba(255,255,255,0.03)_0,rgba(255,255,255,0.03)_1px,transparent_1px,transparent_42px),linear-gradient(180deg,#171008,#050506)]" />
      <div className="absolute inset-x-0 top-0 h-[13%] border-b border-amber-100/20 bg-[linear-gradient(180deg,rgba(255,244,214,0.34),rgba(0,0,0,0.18))]" />
      <div className="absolute inset-x-0 bottom-0 h-[13%] border-t border-amber-100/20 bg-[linear-gradient(0deg,rgba(255,244,214,0.34),rgba(0,0,0,0.18))]" />
      <div className="absolute left-1/2 top-0 h-full w-[9%] -translate-x-1/2 border-x border-amber-100/14 bg-black/20" />
      <div className="pointer-events-none absolute left-2 top-2 z-20 flex max-w-[46%] items-center gap-1.5 rounded-xl border border-cyan-200/22 bg-black/62 px-2 py-1.5 shadow-[0_16px_44px_rgba(0,0,0,0.42)] backdrop-blur-md sm:left-4 sm:top-4 sm:max-w-[360px] sm:gap-2 sm:rounded-2xl sm:px-2.5 sm:py-2">
        <Image src={botImage || "/avatar.png"} alt={botName} width={44} height={44} className="hidden h-10 w-10 shrink-0 rounded-xl border border-cyan-100/18 object-contain sm:block" />
        <div className="min-w-0 max-w-[120px] sm:max-w-none">
          <div className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-100/58">คู่แข่ง</div>
          <div className="truncate text-xs font-black text-white sm:text-base">{botName}</div>
        </div>
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-cyan-100 bg-cyan-500 text-sm font-black text-white shadow-[0_0_22px_rgba(34,211,238,0.32)] sm:h-9 sm:w-9 sm:text-lg">
          {matchScore.bot}
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-2 right-2 z-20 flex max-w-[46%] items-center gap-1.5 rounded-xl border border-red-200/24 bg-black/62 px-2 py-1.5 text-right shadow-[0_16px_44px_rgba(0,0,0,0.42)] backdrop-blur-md sm:bottom-4 sm:right-4 sm:max-w-[360px] sm:gap-2 sm:rounded-2xl sm:px-2.5 sm:py-2">
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-red-100 bg-red-500 text-sm font-black text-white shadow-[0_0_22px_rgba(239,68,68,0.32)] sm:h-9 sm:w-9 sm:text-lg">
          {matchScore.player}
        </div>
        <div className="min-w-0 max-w-[120px] sm:max-w-none">
          <div className="text-[9px] font-black uppercase tracking-[0.18em] text-red-100/58">เรา</div>
          <div className="truncate text-xs font-black text-white sm:text-base">{playerName}</div>
        </div>
        <Image src={playerImage || "/avatar.png"} alt={playerName} width={44} height={44} className="hidden h-10 w-10 shrink-0 rounded-xl border border-red-100/18 object-contain sm:block" />
      </div>
      <RevealSpotlight
        playerCard={playerTriangle[activeLane] ? cardsByNo.get(playerTriangle[activeLane]) : undefined}
        botCard={botTriangle[activeLane] ? cardsByNo.get(botTriangle[activeLane]) : undefined}
        showPlayer={playerVisible(activeLane)}
        showBot={botVisible(activeLane)}
        result={currentResult && revealed[activeTurn]?.scored ? currentResult : undefined}
        playerName={playerName}
        botName={botName}
      />
      <SkillTargetOverlay
        card={pendingSkillChoice ? cardsByNo.get(pendingSkillChoice.cardNo) : undefined}
        side={pendingSkillChoice?.side || "player"}
        playerTop={displayPlayerTriangle.top ? cardsByNo.get(displayPlayerTriangle.top) : undefined}
        botTop={displayBotTriangle.top ? cardsByNo.get(displayBotTriangle.top) : undefined}
        selectedTarget={pendingSkillChoice?.selectedTarget || ""}
        timeLeft={timeLeft}
        onSelect={(target) => {
          if (!pendingSkillChoice) return;
          const skillCard = cardsByNo.get(pendingSkillChoice.cardNo);
          if (!getSelectableSkillTargetIds(skillCard, pendingSkillChoice.side).includes(target)) return;
          onSelectSkillTarget(target);
        }}
        onConfirm={onConfirmSkillTarget}
      />
      {!pendingSkillChoice && waitingSkillChoice ? (
        <div className="absolute bottom-4 right-4 top-16 z-40 flex w-[min(430px,calc(100%-2rem))] items-center">
          <div className="w-full rounded-2xl border border-red-300/35 bg-[#090507]/94 p-5 text-center shadow-[0_0_72px_rgba(248,113,113,0.34)] backdrop-blur-md">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-red-100/64">รอฝ่ายตรงข้ามเลือกเป้าหมาย</div>
            <div className="mt-2 text-2xl font-black uppercase text-white">{waitingCard?.name || `No.${waitingSkillChoice.cardNo}`}</div>
            <div className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-6 text-white/60">
              อีกฝ่ายกำลังเลือกเป้าหมายสกิล การ์ดที่เกี่ยวข้องจะมีออร่าสีแดงจนกว่าตานี้จะตัดสินผล
            </div>
            <div className="mt-4 text-3xl font-black text-red-100">
              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
            </div>
          </div>
        </div>
      ) : null}

      <div className="relative grid h-full min-h-0 grid-rows-[8px_minmax(126px,1fr)_auto_minmax(126px,1fr)_8px] gap-y-1 px-[clamp(6px,1.2vw,18px)] py-[clamp(8px,1.1vw,16px)]">
        <div />

        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <BoardPile label="ทิ้ง" sublabel={`${botGraveCards.length}`} tone="red" rotate cards={botGraveCards} />
          <BoardTriangle
            cardsByNo={cardsByNo}
            triangle={displayBotTriangle}
            activeLane={activeLane}
            tone="bot"
            isVisible={(lane) => botVisible(lane)}
            swapActive={hasSwapResult && showResolvedBoard}
            auraByLane={botAuraByLane}
          />
          <BoardPile label="สุ่ม" sublabel="293 ใบ" tone="gold" rotate />
        </div>

        <div className="relative z-30 grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-3">
          <div />
          <div className="mx-auto w-full max-w-[520px] space-y-3">
            <PhaseTrack activeTurn={activeTurn} />
            <div className="rounded-full border border-amber-100/14 bg-black/32 px-3 py-1.5 text-center text-[9px] font-black uppercase tracking-[0.16em] text-amber-100/62 shadow-[0_10px_30px_rgba(0,0,0,0.28)] backdrop-blur-sm">
              เกม {matchScore.player}-{matchScore.bot} / รอบ {fightScore.player}-{fightScore.bot} / เวลา {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
            </div>
          </div>
          <div />
        </div>

        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <BoardPile label="สุ่ม" sublabel="293 ใบ" tone="gold" />
          <BoardTriangle
            cardsByNo={cardsByNo}
            triangle={displayPlayerTriangle}
            activeLane={activeLane}
            tone="player"
            isVisible={() => true}
            swapActive={hasSwapResult && showResolvedBoard}
            auraByLane={playerAuraByLane}
            onSlotClick={canEditPlayerSlots ? (lane) => lane === activeLane && onSelectLane(lane) : undefined}
            onDropCard={canEditPlayerSlots ? (lane, cardNo) => lane === activeLane && onPlaceCard(lane, cardNo) : undefined}
            selectedLane={canEditPlayerSlots ? placementLane : undefined}
          />
          <BoardPile label="ทิ้ง" sublabel={`${playerGraveCards.length}`} tone="red" cards={playerGraveCards} />
        </div>

        <div />
      </div>
    </div>
  );
}

function emptyRevealState(): Record<TriadTurn, TurnReveal> {
  return {
    1: { player: false, bot: false, scored: false },
    2: { player: false, bot: false, scored: false },
    3: { player: false, bot: false, scored: false },
  };
}

export default function TriadDominionClient({ cards, reviewSkills, summary, currentUser }: Props) {
  const cardsByNo = useMemo(() => new Map(cards.map((card) => [card.cardNo, card])), [cards]);
  const deckCatalog = useMemo(
    () => uniqueByNo(cards.filter((card) => card.kind === "monster" || card.kind === "skill")),
    [cards]
  );

  const participant = useMemo(() => makeParticipant(currentUser), [currentUser.id, currentUser.image, currentUser.name]);
  const [phase, setPhase] = useState<BattlePhase>("lobby");
  const [rooms, setRooms] = useState<TriadRoom[]>([]);
  const [activeRoomCode, setActiveRoomCode] = useState("");
  const [roomAccess, setRoomAccess] = useState<RoomAccess>("public");
  const [roomPassword, setRoomPassword] = useState("");
  const [createModeDialogOpen, setCreateModeDialogOpen] = useState(false);
  const [createRoomMode, setCreateRoomMode] = useState<DeckMode>("all");
  const [joinCode, setJoinCode] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [passwordRoom, setPasswordRoom] = useState<TriadRoom | null>(null);
  const [activeRoomSnapshot, setActiveRoomSnapshot] = useState<TriadRoom | null>(null);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(4);
  const activeRoomCodeRef = useRef("");
  const activeRoomSnapshotRef = useRef<TriadRoom | null>(null);
  const pvpTurnKeyRef = useRef("");
  const syncInFlightRef = useRef(false);
  const syncQueuedRef = useRef(false);
  const lastSyncAtRef = useRef(0);
  const resultAdvanceKeyRef = useRef("");
  const deckBattleStartKeyRef = useRef("");
  const [lobbyMessage, setLobbyMessage] = useState("");
  const [playerDeck, setPlayerDeck] = useState<string[]>([]);
  const [botDeck, setBotDeck] = useState<string[]>([]);
  const [usedPlayerCards, setUsedPlayerCards] = useState<string[]>([]);
  const [usedBotCards, setUsedBotCards] = useState<string[]>([]);
  const [gravePlayerCards, setGravePlayerCards] = useState<string[]>([]);
  const [graveBotCards, setGraveBotCards] = useState<string[]>([]);
  const [player, setPlayer] = useState<TriadTriangle>({ top: "", left: "", right: "" });
  const [placementLane, setPlacementLane] = useState<Lane>("top");
  const [lockedFight, setLockedFight] = useState<LockedFight | null>(null);
  const [turnLocked, setTurnLocked] = useState(false);
  const [pendingSkillChoice, setPendingSkillChoice] = useState<PendingSkillChoice | null>(null);
  const [pendingBlessingChoice, setPendingBlessingChoice] = useState<PendingBlessingChoice | null>(null);
  const [randomDrawCardNo, setRandomDrawCardNo] = useState("");
  const [timeLeft, setTimeLeft] = useState(TURN_SECONDS);
  const [resultTimeLeft, setResultTimeLeft] = useState(RESULT_SECONDS);
  const [deckTimeLeft, setDeckTimeLeft] = useState(5 * 60);
  const [activeTurn, setActiveTurn] = useState<TriadTurn>(1);
  const [revealed, setRevealed] = useState<Record<TriadTurn, TurnReveal>>(emptyRevealState);
  const [lastTurnWinner, setLastTurnWinner] = useState<"player" | "bot" | "draw" | null>(null);
  const [fightNo, setFightNo] = useState(1);
  const [matchScore, setMatchScore] = useState({ player: 0, bot: 0 });
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const [spectatorPreviewCard, setSpectatorPreviewCard] = useState<CardView | null>(null);
  const [openingTieBreakPendingChoice, setOpeningTieBreakPendingChoice] = useState<TriadRpsChoice | null>(null);
  const openingTieBreakPendingChoiceRef = useRef<TriadRpsChoice | null>(null);

  const playerDeckCards = playerDeck.map((cardNo) => cardsByNo.get(cardNo)).filter(Boolean) as CardView[];
  const botDeckCards = botDeck.map((cardNo) => cardsByNo.get(cardNo)).filter(Boolean) as CardView[];
  const randomDrawCard = randomDrawCardNo ? cardsByNo.get(randomDrawCardNo) || null : null;
  const usedPlayerSet = new Set(usedPlayerCards);
  const usedBotSet = new Set(usedBotCards);
  const deckSelectionCounts = useMemo(
    () =>
      playerDeckCards.reduce(
        (counts, card) => {
          if (card.kind === "monster") counts.monsters += 1;
          if (card.kind === "skill") counts.skills += 1;
          return counts;
        },
        { monsters: 0, skills: 0 }
      ),
    [playerDeckCards]
  );
  const availableBotCards = botDeckCards.filter((card) => !usedBotSet.has(card.cardNo));
  const currentRoom = rooms.find((room) => room.code === activeRoomCode) || activeRoomSnapshot;
  const currentDeckMode: DeckMode = currentRoom?.game.deckMode || "all";
  const currentResult = lockedFight?.turns.find((turn) => turn.turn === activeTurn);
  const roomTurnResolved = Boolean(currentRoom?.game.turns.some((turn) => turn.turn === activeTurn));
  const fightScore = lockedFight ? getFightScore(lockedFight.turns, revealed) : { player: 0, bot: 0 };
  const playerGraveCards = gravePlayerCards.map((cardNo) => cardsByNo.get(cardNo)).filter(Boolean) as CardView[];
  const botGraveCards = graveBotCards.map((cardNo) => cardsByNo.get(cardNo)).filter(Boolean) as CardView[];
  const forcedWinnerSide = currentRoom?.game.matchWinner || "";
  const surrenderedSide = currentRoom?.game.surrenderedBy || "";
  const matchDone = fightNo > 3 || Boolean(forcedWinnerSide);
  const isRoomHost = Boolean(currentRoom && currentRoom.hostId === participant.id);
  const isRoomController = Boolean(
    currentRoom && (currentRoom.hostId === participant.id || currentRoom.seats.host?.id === participant.id)
  );
  const isFieldPlayer = Boolean(
    currentRoom?.seats.host?.id === participant.id || currentRoom?.seats.challenger?.id === participant.id
  );
  const isSpectator = Boolean(currentRoom && !isFieldPlayer && currentRoom.spectators.some((viewer) => viewer.id === participant.id));
  const roomPlayerSide: RoomPlayerSide | null = currentRoom?.seats.host?.id === participant.id
    ? "host"
    : currentRoom?.seats.challenger?.id === participant.id
      ? "challenger"
      : null;
  const opponentSide: RoomPlayerSide | null = roomPlayerSide === "host" ? "challenger" : roomPlayerSide === "challenger" ? "host" : null;
  const spectatorBattleState = useMemo(() => {
    if (!isSpectator || !currentRoom) return null;
    const revealState = buildRevealStateForTurns(currentRoom.game.turns);
    const activeLane = laneForTurn(currentRoom.game.activeTurn);
    const previewTriangles = applyRoomBlessingPreview(
      currentRoom,
      currentRoom.game.triangles.host,
      currentRoom.game.triangles.challenger
    );
    const hostTriangle = previewTriangles.host;
    const challengerTriangle = previewTriangles.challenger;
    return {
      lockedFight: {
        fightNo: currentRoom.game.fightNo,
        player: hostTriangle,
        bot: challengerTriangle,
        turns: currentRoom.game.turns,
      } as LockedFight,
      player: hostTriangle,
      revealed: revealState,
      activeTurn: currentRoom.game.activeTurn,
      fightNo: currentRoom.game.fightNo,
      fightScore: getFightScore(currentRoom.game.turns, revealState),
      matchScore: getFightScore(currentRoom.game.turns, revealState),
      turnLocked: Boolean(hostTriangle[activeLane] || challengerTriangle[activeLane]),
      timeLeft: roomTurnSecondsLeft(currentRoom),
      playerDeckCards: currentRoom.game.decks.host.map((cardNo) => cardsByNo.get(cardNo)).filter(Boolean) as CardView[],
      botDeckCards: currentRoom.game.decks.challenger.map((cardNo) => cardsByNo.get(cardNo)).filter(Boolean) as CardView[],
      playerName: currentRoom.seats.host?.name || "ฝั่งบน",
      botName: currentRoom.seats.challenger?.name || "ฝั่งล่าง",
      playerImage: currentRoom.seats.host?.image || "/avatar.png",
      botImage: currentRoom.seats.challenger?.image || "/avatar.png",
      battleLog: buildSpectatorBattleLog(
        currentRoom.game.turns,
        currentRoom.seats.host?.name || "ฝั่งบน",
        currentRoom.seats.challenger?.name || "ฝั่งล่าง"
      ),
    };
  }, [cardsByNo, currentRoom, isSpectator]);
  const selectableDeckCatalog = useMemo(() => {
    if (!currentRoom || !roomPlayerSide) return deckCatalog;
    const pool = currentRoom.game.selectionPools[roomPlayerSide] || [];
    if (pool.length > 0) {
      const orderedCards = pool.map((cardNo) => cardsByNo.get(cardNo)).filter(Boolean) as CardView[];
      if (currentDeckMode === "monster") {
        return orderedCards.filter((card) => card.kind === "monster");
      }
      if (currentDeckMode === "skill") {
        return orderedCards.filter((card) => card.kind === "monster" || card.kind === "skill");
      }
      return orderedCards;
    }
    if (currentDeckMode === "monster") {
      return shuffledCardsBySeed(deckCatalog.filter((card) => card.kind === "monster"), `${currentRoom.code}:monster:${roomPlayerSide}`);
    }
    if (currentDeckMode === "skill") {
      return shuffledCardsBySeed(
        deckCatalog.filter((card) => card.kind === "monster" || card.kind === "skill"),
        `${currentRoom.code}:skill:${roomPlayerSide}`
      );
    }
    return shuffledCardsBySeed(deckCatalog, `${currentRoom.code}:all:${roomPlayerSide}`);
  }, [cardsByNo, currentDeckMode, currentRoom, deckCatalog, roomPlayerSide]);
  const isPvpRoom = Boolean(currentRoom && roomPlayerSide && opponentSide);
  const playerLabel = roomPlayerSide
    ? currentRoom?.seats[roomPlayerSide]?.name || "เรา"
    : "เรา";
  const opponentLabel = opponentSide
    ? currentRoom?.seats[opponentSide]?.name || "คู่แข่ง"
    : "คู่แข่ง";
  const playerImage = roomPlayerSide
    ? currentRoom?.seats[roomPlayerSide]?.image || participant.image || "/avatar.png"
    : participant.image || "/avatar.png";
  const opponentImage = opponentSide
    ? currentRoom?.seats[opponentSide]?.image || "/avatar.png"
    : "/avatar.png";
  const displayLockedFight = spectatorBattleState?.lockedFight || lockedFight;
  const displayPlayer = spectatorBattleState?.player || player;
  const displayRevealed = spectatorBattleState?.revealed || revealed;
  const displayActiveTurn = spectatorBattleState?.activeTurn || activeTurn;
  const displayFightNo = spectatorBattleState?.fightNo || fightNo;
  const displayMatchScore = spectatorBattleState?.matchScore || matchScore;
  const displayFightScore = spectatorBattleState?.fightScore || fightScore;
  const displayTimeLeft = spectatorBattleState?.timeLeft ?? timeLeft;
  const displayTurnLocked = spectatorBattleState?.turnLocked ?? turnLocked;
  const displayPlayerName = spectatorBattleState?.playerName || playerLabel;
  const displayBotName = spectatorBattleState?.botName || opponentLabel;
  const displayPlayerImage = spectatorBattleState?.playerImage || playerImage;
  const displayBotImage = spectatorBattleState?.botImage || opponentImage;
  const displayPlayerDeckCards = spectatorBattleState?.playerDeckCards || playerDeckCards;
  const displayBotDeckCards = spectatorBattleState?.botDeckCards || botDeckCards;
  const displayBattleLog = spectatorBattleState?.battleLog || battleLog;
  const ownDeckReady = Boolean(roomPlayerSide && currentRoom?.game.deckReady[roomPlayerSide]);
  const opponentDeckReady = Boolean(opponentSide && currentRoom?.game.deckReady[opponentSide]);
  const bothDecksReady = Boolean(currentRoom?.game.deckReady.host && currentRoom?.game.deckReady.challenger);
  const deckSelectionActive = Boolean(currentRoom && currentRoom.status === "playing" && !bothDecksReady);
  const deckTimerText = `${Math.floor(deckTimeLeft / 60)}:${String(deckTimeLeft % 60).padStart(2, "0")}`;
  const deckValidation = validateDeckForMode(playerDeckCards, currentDeckMode);
  const deckSelectionGuide =
    currentDeckMode === "skill"
      ? `โหมด SKILL: มอนสเตอร์ ${deckSelectionCounts.monsters}/${SKILL_MODE_MONSTER_LIMIT} ใบ · สกิล ${deckSelectionCounts.skills}/${SKILL_MODE_SKILL_LIMIT} ใบ · รวม ${playerDeck.length}/${DECK_SIZE} ใบ`
      : currentDeckMode === "monster"
        ? `โหมด MONSTER: มอนสเตอร์ ${playerDeckCards.length}/${DECK_SIZE} ใบ`
        : `โหมด ALL IN ONE: มอนสเตอร์อย่างน้อย 3 ใบ · รวม ${playerDeck.length}/${DECK_SIZE} ใบ`;
  const deckSelectionNotice =
    currentDeckMode === "skill" && (deckSelectionCounts.monsters >= SKILL_MODE_MONSTER_LIMIT || deckSelectionCounts.skills >= SKILL_MODE_SKILL_LIMIT)
      ? "ครบโควตาแล้ว กดใบเดิมเพื่อยกเลิกก่อนถึงจะเลือกใบใหม่ได้"
      : currentDeckMode === "skill"
        ? `มอนสเตอร์ได้ ${SKILL_MODE_MONSTER_LIMIT} ใบ สกิลได้ ${SKILL_MODE_SKILL_LIMIT} ใบ เท่านั้น`
        : currentDeckMode === "monster"
          ? `โหมดนี้ใช้การ์ดมอนสเตอร์ทั้งหมด ${DECK_SIZE} ใบ`
          : "โหมดนี้ต้องมีมอนสเตอร์อย่างน้อย 3 ใบ ที่เหลือเลือกการ์ดใดก็ได้";
  const ownPendingRoomSkillChoice = currentRoom && roomPlayerSide
    ? currentRoom.game.skillChoices.find(
        (choice) =>
          choice.fightNo === currentRoom.game.fightNo &&
          choice.turn === currentRoom.game.activeTurn &&
          choice.side === roomPlayerSide &&
          !choice.selectedTarget &&
          !choice.skipped
      ) || null
    : null;
  const ownPendingRoomBlessingChoice = currentRoom && roomPlayerSide
    ? currentRoom.game.skillChoices.find(
        (choice) =>
          choice.fightNo === currentRoom.game.fightNo &&
          choice.turn === currentRoom.game.activeTurn &&
          choice.side === roomPlayerSide &&
          choice.cardNo === "254" &&
          !choice.skipped
      ) || null
    : null;
  const displayRandomDrawCardNo = ownPendingRoomBlessingChoice?.blessingDrawCardNo || pendingBlessingChoice?.drawnCardNo || randomDrawCardNo;
  const displayBlessingAuras = (() => {
    if (pendingBlessingChoice?.choice === "reroll-own") {
      return { player: "pending" as TargetAura };
    }
    if (pendingBlessingChoice?.choice === "reroll-opponent") {
      return { bot: "pending" as TargetAura };
    }
    if (!currentRoom) return null;
    const currentBlessingChoice = currentRoom.game.skillChoices.find(
      (choice) =>
        choice.fightNo === currentRoom.game.fightNo &&
        choice.turn === currentRoom.game.activeTurn &&
        choice.cardNo === "254" &&
        choice.selectedTarget &&
        !choice.skipped
    );
    if (!currentBlessingChoice || currentBlessingChoice.selectedTarget === "draw-skill") return null;
    const playerActualSide = isSpectator ? "host" : roomPlayerSide;
    const botActualSide = isSpectator ? "challenger" : opponentSide;
    const affectedActualSide =
      currentBlessingChoice.selectedTarget === "reroll-own"
        ? currentBlessingChoice.side
        : currentBlessingChoice.side === "host"
          ? "challenger"
          : "host";
    if (affectedActualSide === playerActualSide) return { player: "pending" as TargetAura };
    if (affectedActualSide === botActualSide) return { bot: "pending" as TargetAura };
    return null;
  })();
  const waitingPendingRoomSkillChoice = currentRoom
    ? currentRoom.game.skillChoices.find(
        (choice) =>
          choice.fightNo === currentRoom.game.fightNo &&
          choice.turn === currentRoom.game.activeTurn &&
          choice.side !== roomPlayerSide &&
          !choice.selectedTarget &&
          !choice.skipped
      ) || null
    : null;
  const waitingSkillChoice: PendingSkillChoice | null = waitingPendingRoomSkillChoice
    ? {
        side: "bot",
        lane: waitingPendingRoomSkillChoice.lane,
        cardNo: waitingPendingRoomSkillChoice.cardNo,
        selectedTarget: "",
      }
    : null;
  const forcedWinnerLabel = forcedWinnerSide ? currentRoom?.seats[forcedWinnerSide]?.name || "ผู้ชนะ" : "";
  const surrenderedLabel = surrenderedSide ? currentRoom?.seats[surrenderedSide]?.name || "ผู้ยอมแพ้" : "";
  const winnerText =
    forcedWinnerLabel
      ? `${forcedWinnerLabel} ชนะ`
      : matchScore.player === matchScore.bot
      ? "เสมอกัน"
      : matchScore.player > matchScore.bot
        ? `${playerLabel} ชนะ`
        : `${opponentLabel} ชนะ`;

  const finalMatchScore = forcedWinnerSide
    ? forcedWinnerSide === roomPlayerSide
      ? { player: Math.max(matchScore.player, matchScore.bot + 1), bot: matchScore.bot }
      : forcedWinnerSide === opponentSide
        ? { player: matchScore.player, bot: Math.max(matchScore.bot, matchScore.player + 1) }
        : matchScore
    : matchScore;

  const syncRooms = async (options: { force?: boolean } = {}) => {
    const now = Date.now();
    if (!options.force && now - lastSyncAtRef.current < MIN_SYNC_GAP_MS) return [];
    if (syncInFlightRef.current) {
      syncQueuedRef.current = true;
      return [];
    }

    syncInFlightRef.current = true;
    lastSyncAtRef.current = now;
    try {
      const response = await fetch(`${ROOM_API_PATH}?ts=${now}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!Array.isArray(payload.rooms)) return [];
    const nextRooms = normalizeApiRooms(payload.rooms);
    const activeCode = activeRoomCodeRef.current;
    const reconnectRoom = !activeCode ? nextRooms.find((room) => participantInRoom(room, participant.id)) : null;
    if (reconnectRoom) {
      activeRoomCodeRef.current = reconnectRoom.code;
      activeRoomSnapshotRef.current = reconnectRoom;
      setActiveRoomCode(reconnectRoom.code);
      setActiveRoomSnapshot(reconnectRoom);
      setPhase(reconnectRoom.status === "playing" ? phaseForPlayingRoom(reconnectRoom, participant.id) || "battle" : "room");
      setLobbyMessage("");
    }
    if (activeCode && !nextRooms.some((room) => room.code === activeCode)) {
      activeRoomCodeRef.current = "";
      activeRoomSnapshotRef.current = null;
      setActiveRoomCode("");
      setActiveRoomSnapshot(null);
      setPhase("lobby");
      setLobbyMessage("ห้องถูกปิดแล้ว");
    }
    setRooms(nextRooms);
    return nextRooms;
    } finally {
      syncInFlightRef.current = false;
      if (syncQueuedRef.current) {
        syncQueuedRef.current = false;
        window.setTimeout(() => void syncRooms({ force: true }).catch(() => null), 0);
      }
    }
  };

  const patchCurrentRoom = (updater: (room: TriadRoom) => TriadRoom) => {
    if (!currentRoom) return null;
    const nextRoom = updater(currentRoom);
    setRooms((current) => mergeRoomByCode(current, nextRoom));
    activeRoomSnapshotRef.current = nextRoom;
    setActiveRoomSnapshot(nextRoom);
    if (activeRoomCodeRef.current === nextRoom.code) {
      setActiveRoomCode(nextRoom.code);
    }
    return nextRoom;
  };

  const postRoomAction = async (body: Record<string, unknown>) => {
    const response = await fetch(ROOM_API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ ...body, participant }),
    });
    const payload = await response.json().catch(() => ({}));
    const actionRoom = normalizeApiRooms(payload.room ? [payload.room] : [])[0] || null;
    let nextRooms = Array.isArray(payload.rooms) ? normalizeApiRooms(payload.rooms) : rooms;
    if ((body.action === "disband" || (body.action === "leave" && !actionRoom)) && activeRoomCodeRef.current) {
      nextRooms = nextRooms.filter((room) => room.code !== activeRoomCodeRef.current);
    }
    setRooms(actionRoom ? mergeRoomByCode(nextRooms, actionRoom) : nextRooms);
    if (actionRoom) {
      activeRoomSnapshotRef.current = actionRoom;
      setActiveRoomSnapshot(actionRoom);
      if (participantInRoom(actionRoom, participant.id) && actionRoom.status === "playing") {
        const nextPhase = phaseForPlayingRoom(actionRoom, participant.id);
        if (nextPhase) setPhase(nextPhase);
      }
    } else if (body.action === "disband" || (activeRoomCodeRef.current && !nextRooms.some((room) => room.code === activeRoomCodeRef.current))) {
      activeRoomCodeRef.current = "";
      activeRoomSnapshotRef.current = null;
      setActiveRoomCode("");
      setActiveRoomSnapshot(null);
      setPhase("lobby");
    }
    window.setTimeout(() => void syncRooms({ force: true }).catch(() => null), 60);
    return { ok: response.ok, status: response.status, payload };
  };

  const chooseOpeningTieBreak = (choice: TriadRpsChoice) => {
    if (!currentRoom || !roomPlayerSide || choice === "unknown") return;
    if (openingTieBreakPendingChoiceRef.current || currentRoom.game.openerTieBreak.choices[roomPlayerSide] !== "unknown") return;
    openingTieBreakPendingChoiceRef.current = choice;
    setOpeningTieBreakPendingChoice(choice);
    patchCurrentRoom((room) => ({
      ...room,
      game: {
        ...room.game,
        openerTieBreak: {
          ...room.game.openerTieBreak,
          choices: {
            ...room.game.openerTieBreak.choices,
            [roomPlayerSide]: choice,
          },
        },
      },
    }));
    void postRoomAction({
      action: "choose-opening-tiebreak",
      code: currentRoom.code,
      choice,
    }).then((result) => {
      if (!result.ok) {
        openingTieBreakPendingChoiceRef.current = null;
        setOpeningTieBreakPendingChoice(null);
        void syncRooms({ force: true }).catch(() => null);
        setBattleLog((current) => ["เลือกเป่ายิงฉุบไม่สำเร็จ ระบบจะซิงก์สถานะล่าสุดอีกครั้ง", ...current]);
      }
    });
  };

  useEffect(() => {
    const tieBreak = currentRoom?.game.openerTieBreak;
    if (!tieBreak || tieBreak.status !== "waiting" || !roomPlayerSide) {
      openingTieBreakPendingChoiceRef.current = null;
      setOpeningTieBreakPendingChoice(null);
      return;
    }
    const serverChoice = tieBreak.choices[roomPlayerSide] || "unknown";
    if (serverChoice !== "unknown") {
      openingTieBreakPendingChoiceRef.current = serverChoice;
      setOpeningTieBreakPendingChoice(null);
    }
  }, [
    currentRoom?.game.openerTieBreak.fightNo,
    currentRoom?.game.openerTieBreak.status,
    currentRoom?.game.openerTieBreak.choices.host,
    currentRoom?.game.openerTieBreak.choices.challenger,
    roomPlayerSide,
  ]);

  const createRoom = async (deckMode: DeckMode) => {
    const access = roomAccess;
    const password = access === "private" ? roomPassword.trim() : "";
    if (access === "private" && password.length < 4) {
      setLobbyMessage("รหัสห้องส่วนตัวต้องมีอย่างน้อย 4 ตัว");
      return;
    }

    const result = await postRoomAction({
      action: "create",
      access,
      password,
      deckMode,
    });

    const room = normalizeApiRooms(result.payload?.room ? [result.payload.room] : [])[0];
    if (!result.ok || !room?.code) {
      setLobbyMessage("สร้างห้องไม่สำเร็จ");
      return;
    }
    setActiveRoomSnapshot(room);
    activeRoomSnapshotRef.current = room;
    activeRoomCodeRef.current = room.code;
    setActiveRoomCode(room.code);
    setLobbyMessage("");
    setPhase("room");
  };

  const enterRoom = async (codeInput = joinCode, forceSpectator = false, passwordInput = joinPassword) => {
    const code = codeInput.replace(/\D/g, "").slice(0, 6);
    const room = rooms.find((item) => item.code === code);
    if (code.length !== 6) {
      setLobbyMessage("ไม่พบห้องนี้");
      return;
    }
    if (room?.access === "private" && !passwordInput.trim() && room.hostId !== participant.id) {
      setPasswordRoom(room);
      setLobbyMessage("");
      return;
    }

    const result = await postRoomAction({
      action: "join",
      code,
      password: passwordInput.trim(),
      forceSpectator,
    });

    if (!result.ok) {
      const lockedRoom = normalizeApiRooms(result.payload?.room ? [result.payload.room] : [])[0] || null;
      if (result.payload?.reason === "wrong_password" && lockedRoom && !passwordInput.trim()) {
        setPasswordRoom(lockedRoom);
        setLobbyMessage("");
        return;
      }
      setLobbyMessage(result.payload?.reason === "wrong_password" ? "รหัสห้องไม่ถูกต้อง" : "เข้าห้องนี้ไม่ได้");
      return;
    }

    setPasswordRoom(null);
    setJoinPassword("");
    const joinedRoom = normalizeApiRooms(result.payload?.room ? [result.payload.room] : [])[0] || room;
    if (!joinedRoom?.code) {
      setLobbyMessage("ไม่พบห้องนี้");
      return;
    }
    setActiveRoomSnapshot(joinedRoom);
    activeRoomSnapshotRef.current = joinedRoom;
    activeRoomCodeRef.current = joinedRoom.code;
    setActiveRoomCode(joinedRoom.code);
    setLobbyMessage(result.payload?.joinedAs === "spectator" ? "เข้ามาเป็นผู้ชมแล้ว" : "");
    setPhase(joinedRoom.status === "playing" ? phaseForPlayingRoom(joinedRoom, participant.id) || "battle" : "room");
  };

  const moveToSpectator = async () => {
    if (!currentRoom || isSpectator || currentRoom.status === "playing") return;
    const result = await postRoomAction({ action: "spectate", code: currentRoom.code });
    if (!result.ok) setLobbyMessage("ย้ายไปนั่งชมไม่ได้");
  };

  const takeFieldSlot = async (slot: "host" | "challenger") => {
    if (!currentRoom || currentRoom.status === "playing" || currentRoom.seats[slot]) return;
    const result = await postRoomAction({ action: "take-slot", code: currentRoom.code, slot });
    if (!result.ok) setLobbyMessage("ลงช่องนี้ไม่ได้");
  };

  const startRoomGame = async () => {
    if (!currentRoom || !isRoomController || !currentRoom.seats.host || !currentRoom.seats.challenger) return;
    const result = await postRoomAction({ action: "start", code: currentRoom.code });
    if (!result.ok) {
      setLobbyMessage("เจ้าของห้องเริ่มเกมได้เมื่อมีผู้เล่นครบ 2 ฝั่ง");
      return;
    }
    resetBattle();
    const startedRoom = normalizeApiRooms(result.payload?.room ? [result.payload.room] : [])[0] || currentRoom;
    const startedAsFieldPlayer = Boolean(
      startedRoom?.seats.host?.id === participant.id || startedRoom?.seats.challenger?.id === participant.id
    );
    setPhase(startedAsFieldPlayer ? "deck" : "battle");
  };

  const leaveRoom = async () => {
    if (currentRoom) {
      await postRoomAction({ action: "leave", code: currentRoom.code });
    }
    activeRoomCodeRef.current = "";
    activeRoomSnapshotRef.current = null;
    setActiveRoomCode("");
    setActiveRoomSnapshot(null);
    setPhase("lobby");
  };

  const continueRoomBattle = async () => {
    if (!currentRoom || !isRoomController) return;
    const result = await postRoomAction({ action: "continue", code: currentRoom.code });
    if (!result.ok) {
      setLobbyMessage("เริ่มสู้ต่อในห้องนี้ไม่ได้");
      return;
    }
    resetBattle();
    setPhase("room");
  };

  const disbandRoom = async () => {
    if (!currentRoom || !isRoomHost) return;
    await postRoomAction({ action: "disband", code: currentRoom.code });
    activeRoomCodeRef.current = "";
    activeRoomSnapshotRef.current = null;
    setActiveRoomCode("");
    setActiveRoomSnapshot(null);
    setPhase("lobby");
    setLobbyMessage("ยุบห้องแล้ว");
  };

  const surrenderBattle = async () => {
    if (!currentRoom || !isFieldPlayer || matchDone) return;
    const result = await postRoomAction({ action: "surrender", code: currentRoom.code });
    if (!result.ok) {
      setBattleLog((current) => ["ยอมแพ้ไม่สำเร็จ ลองกดใหม่อีกครั้ง", ...current]);
      return;
    }
    const room = normalizeApiRooms(result.payload?.room ? [result.payload.room] : [])[0];
    if (room) {
      activeRoomSnapshotRef.current = room;
      setActiveRoomSnapshot(room);
      setRooms((current) => mergeRoomByCode(current, room));
    }
    setBattleLog((current) => ["ยอมแพ้แล้ว ระบบสรุปผู้ชนะทันที", ...current]);
  };

  useEffect(() => {
    let stopped = false;
    let timer = 0;
    const loop = () => {
      void syncRooms().catch(() => null).finally(() => {
        if (stopped) return;
        const delay = document.hidden
          ? HIDDEN_SYNC_MS
          : activeRoomCodeRef.current
            ? ACTIVE_ROOM_SYNC_MS
            : LOBBY_SYNC_MS;
        timer = window.setTimeout(loop, delay);
      });
    };

    loop();
    const syncOnFocus = () => void syncRooms({ force: true }).catch(() => null);
    const syncOnVisibility = () => {
      if (!document.hidden) void syncRooms({ force: true }).catch(() => null);
    };
    window.addEventListener("focus", syncOnFocus);
    document.addEventListener("visibilitychange", syncOnVisibility);

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      window.removeEventListener("focus", syncOnFocus);
      document.removeEventListener("visibilitychange", syncOnVisibility);
    };
  }, [participant.id]);

  useEffect(() => {
    const supabase = getBrowserSupabaseClient();
    if (!supabase) return;

    const channel = supabase.channel(TRIAD_ROOM_REALTIME_CHANNEL, {
      config: {
        broadcast: {
          self: false,
        },
      },
    });

    channel.on("broadcast", { event: TRIAD_ROOM_REALTIME_EVENT }, ({ payload }) => {
      const event = (payload || {}) as TriadRoomRealtimePayload;
      const room = normalizeApiRooms(event.room ? [event.room] : [])[0] || null;
      const code = safeText(event.code || room?.code);

      if (event.refresh) {
        void syncRooms({ force: true }).catch(() => null);
        return;
      }

      if (event.deleted && code) {
        setRooms((current) => current.filter((item) => item.code !== code));
        if (activeRoomCodeRef.current === code) {
          activeRoomCodeRef.current = "";
          activeRoomSnapshotRef.current = null;
          setActiveRoomCode("");
          setActiveRoomSnapshot(null);
          setPhase("lobby");
        }
        return;
      }

      if (!room) {
        void syncRooms({ force: true }).catch(() => null);
        return;
      }

      setRooms((current) => mergeRoomByCode(current, room));

      const roomIncludesMe = participantInRoom(room, participant.id);
      if (activeRoomCodeRef.current === room.code || roomIncludesMe) {
        activeRoomSnapshotRef.current = room;
        setActiveRoomSnapshot(room);
      }

      if (!activeRoomCodeRef.current && roomIncludesMe) {
        activeRoomCodeRef.current = room.code;
        setActiveRoomCode(room.code);
      }

      if (roomIncludesMe) {
        setPhase((currentPhase) => {
          if (room.status === "playing") return phaseForPlayingRoom(room, participant.id) || currentPhase;
          if (currentPhase === "deck" || currentPhase === "battle" || currentPhase === "lobby") return "room";
          return currentPhase;
        });
      }
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void syncRooms({ force: true }).catch(() => null);
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [participant.id]);

  useEffect(() => {
    activeRoomCodeRef.current = activeRoomCode;
  }, [activeRoomCode]);

  useEffect(() => {
    activeRoomSnapshotRef.current = activeRoomSnapshot;
  }, [activeRoomSnapshot]);

  useEffect(() => {
    if (!currentRoom || !participantInRoom(currentRoom, participant.id)) return;
    if (currentRoom.status === "waiting" && (phase === "deck" || phase === "battle")) {
      resetBattle();
      setPhase("room");
      return;
    }
    if (currentRoom.status === "playing") {
      const nextPhase = phaseForPlayingRoom(currentRoom, participant.id);
      if (nextPhase && phase !== nextPhase) setPhase(nextPhase);
    }
  }, [currentRoom, participant.id, phase]);

  useEffect(() => {
    if (!currentRoom?.game.matchWinner || !currentRoom.game.matchEndedAt || !isRoomController) return;
    const delay = Math.max(0, 6500 - (Date.now() - currentRoom.game.matchEndedAt));
    const timer = window.setTimeout(() => {
      void postRoomAction({ action: "continue", code: currentRoom.code });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [currentRoom?.code, currentRoom?.game.matchEndedAt, currentRoom?.game.matchWinner, isRoomController]);

  useEffect(() => {
    if (!currentRoom || !roomPlayerSide || !opponentSide) return;
    const turnKey = `${currentRoom.code}:${currentRoom.game.fightNo}:${currentRoom.game.activeTurn}`;
    if (pvpTurnKeyRef.current && pvpTurnKeyRef.current !== turnKey) {
      setTurnLocked(false);
      setPendingSkillChoice(null);
      setPendingBlessingChoice(null);
      setTimeLeft(TURN_SECONDS);
      if (currentRoom.game.activeTurn === 1 && currentRoom.game.turns.length === 0) {
        setRevealed(emptyRevealState());
        setLockedFight(null);
      }
    }
    pvpTurnKeyRef.current = turnKey;
    const ownDeck = currentRoom.game.decks[roomPlayerSide];
    const enemyDeck = currentRoom.game.decks[opponentSide];
    const previewTriangles = applyRoomBlessingPreview(
      currentRoom,
      currentRoom.game.triangles.host,
      currentRoom.game.triangles.challenger
    );
    if (ownDeckReady || phase !== "deck") setPlayerDeck(ownDeck);
    setBotDeck(enemyDeck);
    const serverPlayerTriangle = previewTriangles[roomPlayerSide];
    const activeLane = laneForTurn(currentRoom.game.activeTurn);
    setTurnLocked(Boolean(serverPlayerTriangle[activeLane]));
    setTimeLeft(roomTurnSecondsLeft(currentRoom));
    setPlayer((current) => {
      const next = { ...serverPlayerTriangle };
      if (!serverPlayerTriangle[activeLane] && current[activeLane]) {
        next[activeLane] = current[activeLane];
      }
      return next;
    });
    setActiveTurn(currentRoom.game.activeTurn);
    setFightNo(currentRoom.game.fightNo);
    const mappedTurns = roomPlayerSide === "host"
      ? currentRoom.game.turns
      : currentRoom.game.turns.map(flipTriadResult);
    setLockedFight({
      fightNo: currentRoom.game.fightNo,
      player: previewTriangles[roomPlayerSide],
      bot: previewTriangles[opponentSide],
      turns: mappedTurns,
    });
    setDeckTimeLeft(roomDeckSecondsLeft(currentRoom));
    if ((phase === "deck" || deckSelectionActive) && currentRoom.game.deckReady.host && currentRoom.game.deckReady.challenger) {
      setBattleLog((current) => current.length ? current : ["ทั้งสองฝั่งล็อกเด็คแล้ว เริ่มสู้กันได้เลย"]);
    }
  }, [currentRoom, deckSelectionActive, opponentSide, ownDeckReady, phase, roomPlayerSide]);

  useEffect(() => {
    if (!ownPendingRoomSkillChoice || !roomPlayerSide) {
      if (isPvpRoom) setPendingSkillChoice(null);
      if (!waitingPendingRoomSkillChoice) return;
      const tick = () => {
        setTimeLeft(Math.max(0, Math.ceil((waitingPendingRoomSkillChoice.deadlineAt - Date.now()) / 1000)));
      };
      tick();
      const timer = window.setInterval(tick, 250);
      return () => window.clearInterval(timer);
    }

    setPendingSkillChoice((current) => ({
      side: "player",
      lane: ownPendingRoomSkillChoice.lane,
      cardNo: ownPendingRoomSkillChoice.cardNo,
      selectedTarget:
        current?.cardNo === ownPendingRoomSkillChoice.cardNo && current?.lane === ownPendingRoomSkillChoice.lane
          ? current.selectedTarget
          : "",
    }));

    const tick = () => {
      setTimeLeft(Math.max(0, Math.ceil((ownPendingRoomSkillChoice.deadlineAt - Date.now()) / 1000)));
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [isPvpRoom, ownPendingRoomSkillChoice, roomPlayerSide, waitingPendingRoomSkillChoice]);

  const toggleDeckCard = (cardNo: string) => {
    if (ownDeckReady) return;
    const card = cardsByNo.get(cardNo);
    if (!selectableDeckCatalog.some((item) => item.cardNo === cardNo) || !card) return;
    const selected = playerDeck.includes(cardNo);
    if (!selected) {
      if (playerDeck.length >= DECK_SIZE) {
        setBattleLog((current) => [`เลือกได้ทั้งหมด ${DECK_SIZE} ใบเท่านั้น`, ...current]);
        return;
      }
      if (currentDeckMode === "skill" && card.kind === "monster" && deckSelectionCounts.monsters >= SKILL_MODE_MONSTER_LIMIT) {
        setBattleLog((current) => [`โหมด SKILL เลือกมอนสเตอร์ได้ ${SKILL_MODE_MONSTER_LIMIT} ใบเท่านั้น ต้องยกเลิกใบเดิมก่อน`, ...current]);
        return;
      }
      if (currentDeckMode === "skill" && card.kind === "skill" && deckSelectionCounts.skills >= SKILL_MODE_SKILL_LIMIT) {
        setBattleLog((current) => [`โหมด SKILL เลือกการ์ดสกิลได้ ${SKILL_MODE_SKILL_LIMIT} ใบเท่านั้น ต้องยกเลิกใบเดิมก่อน`, ...current]);
        return;
      }
    }
    const nextDeck = selected ? playerDeck.filter((item) => item !== cardNo) : [...playerDeck, cardNo];
    setPlayerDeck(nextDeck);
    if (!deckValidation.valid) {
      setBattleLog(deckValidation.errors);
      return;
    }

    if (currentRoom && roomPlayerSide && opponentSide) {
      void postRoomAction({
        action: "set-deck",
        code: currentRoom.code,
        deck: nextDeck,
      });
    }
  };

  const resetBattlePlayState = () => {
    setUsedPlayerCards([]);
    setUsedBotCards([]);
    setGravePlayerCards([]);
    setGraveBotCards([]);
    setPlayer({ top: "", left: "", right: "" });
    setPlacementLane("top");
    setLockedFight(null);
    setTurnLocked(false);
    setPendingSkillChoice(null);
    setPendingBlessingChoice(null);
    setTimeLeft(TURN_SECONDS);
    setResultTimeLeft(RESULT_SECONDS);
    setActiveTurn(1);
    setRevealed(emptyRevealState());
    setLastTurnWinner(null);
    setFightNo(1);
    setMatchScore({ player: 0, bot: 0 });
    setRandomDrawCardNo("");
    resultAdvanceKeyRef.current = "";
    pvpTurnKeyRef.current = "";
  };

  const enterBattle = async () => {
    if (ownDeckReady) return;
    const monsterCount = playerDeckCards.filter((card) => card.kind === "monster").length;
    if (!currentRoom && monsterCount < 3) {
      setBattleLog(["เด็คต้องมีมอนสเตอร์อย่างน้อย 3 ใบ เพื่อใช้เป็นการ์ดหลักของแต่ละรอบ"]);
      return;
    }

    if (currentRoom && roomPlayerSide && opponentSide) {
      const optimisticRoom = patchCurrentRoom((room) => ({
        ...room,
        game: {
          ...room.game,
          deckReady: {
            ...room.game.deckReady,
            [roomPlayerSide]: room.game.deckReady[roomPlayerSide],
          },
        },
      }));
      if (optimisticRoom?.game.deckReady.host && optimisticRoom?.game.deckReady.challenger) {
        setBattleLog(["ทั้งสองฝั่งพร้อมแล้ว เริ่มสู้ได้ทันที"]);
      } else {
        setBattleLog(["กดพร้อมแล้ว เด็คถูกล็อก รออีกฝ่ายกดพร้อม"]);
      }
      const result = await postRoomAction({
        action: "ready-deck",
        code: currentRoom.code,
        deck: playerDeck,
      });
      if (!result.ok) {
        setBattleLog(["กดพร้อมเด็คเข้าห้อง PvP ไม่ได้"]);
        return;
      }
      const room = normalizeApiRooms(result.payload?.room ? [result.payload.room] : [])[0] || currentRoom;
      const ownDeck = room.game.decks[roomPlayerSide];
      const enemyDeck = room.game.decks[opponentSide];
      setBotDeck(enemyDeck);
      setPlayerDeck(ownDeck);
      if (room.game.deckReady.host && room.game.deckReady.challenger) {
        setBattleLog(["ทั้งสองฝั่งพร้อมแล้ว เริ่มสู้ได้ทันที"]);
      } else {
        setBattleLog(["กดพร้อมแล้ว เด็คถูกล็อก รออีกฝ่ายกดพร้อม"]);
      }
      return;
    }

    if (playerDeck.length !== DECK_SIZE) return;

    const nextBotDeck = chooseBotDeck(deckCatalog, playerDeck);
    setBotDeck(nextBotDeck);
    resetBattlePlayState();
    setPhase("battle");
    setBattleLog(["ล็อกเด็คแล้ว เลือกการ์ดจากมือไปวางบนสนาม"]);
  };

  useEffect(() => {
    if (!currentRoom || (!deckSelectionActive && phase !== "deck")) return;
    const timer = window.setInterval(() => {
      const nextLeft = roomDeckSecondsLeft(currentRoom);
      setDeckTimeLeft(nextLeft);
      if (phase === "deck" && nextLeft <= 0 && roomPlayerSide && opponentSide && !ownDeckReady && deckValidation.valid) {
        void postRoomAction({
          action: "ready-deck",
          code: currentRoom.code,
          deck: playerDeck,
        }).then((result) => {
          if (result.ok) {
            const room = normalizeApiRooms(result.payload?.room ? [result.payload.room] : [])[0];
            if (room?.game.deckReady.host && room.game.deckReady.challenger) {
              setBattleLog(["หมดเวลาเลือกเด็ค ระบบล็อกเด็คเท่าที่เลือกไว้แล้ว"]);
            }
          }
        });
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [currentRoom, deckSelectionActive, deckValidation.valid, ownDeckReady, opponentSide, phase, playerDeck, roomPlayerSide]);

  useEffect(() => {
    if (!currentRoom || currentRoom.status !== "playing") return;
    const decksReady = Boolean(currentRoom.game.deckReady.host && currentRoom.game.deckReady.challenger);
    if (!decksReady) {
      deckBattleStartKeyRef.current = "";
      return;
    }

    const startKey = `${currentRoom.code}:${currentRoom.game.deckReady.host ? 1 : 0}:${currentRoom.game.deckReady.challenger ? 1 : 0}`;
    if (deckBattleStartKeyRef.current === startKey && phase === "battle") return;
    deckBattleStartKeyRef.current = startKey;

    resetBattlePlayState();
    setPhase("battle");
    setBattleLog((current) => (current.length ? current : ["ทั้งสองฝั่งล็อคเด็คแล้ว เริ่มสู้กันได้เลย"]));
  }, [currentRoom, phase]);

  function resetBattle() {
    setPhase("deck");
    setPlayerDeck([]);
    setBotDeck([]);
    setUsedPlayerCards([]);
    setUsedBotCards([]);
    setGravePlayerCards([]);
    setGraveBotCards([]);
    setPlayer({ top: "", left: "", right: "" });
    setPlacementLane("top");
    setLockedFight(null);
    setTurnLocked(false);
    setPendingSkillChoice(null);
    setPendingBlessingChoice(null);
    setTimeLeft(TURN_SECONDS);
    setResultTimeLeft(RESULT_SECONDS);
    setActiveTurn(1);
    setRevealed(emptyRevealState());
    setLastTurnWinner(null);
    setFightNo(1);
    setMatchScore({ player: 0, bot: 0 });
    setRandomDrawCardNo("");
    setBattleLog([]);
  }

  const setPlayerLane = (lane: Lane, cardNo: string) => {
    if (turnLocked || matchDone || usedPlayerSet.has(cardNo) || lane !== laneForTurn(activeTurn)) return;
    const card = cardsByNo.get(cardNo);
    if (lane === "top" && card?.kind !== "monster") {
      setBattleLog((current) => ["ตาแรกต้องวางการ์ดมอนสเตอร์เท่านั้น", ...current]);
      return;
    }
    if (lane === "top" && card?.kind !== "monster") {
      setBattleLog((current) => ["ตา 1 ต้องวางมอนสเตอร์เป็นการ์ดหลัก", ...current]);
      return;
    }
    if (currentDeckMode === "monster" && card?.kind !== "monster") {
      setBattleLog((current) => ["โหมด MONSTER ใช้การ์ดมอนสเตอร์เท่านั้น", ...current]);
      return;
    }
    if (currentDeckMode === "skill" && lane !== "top" && card?.kind !== "skill") {
      setBattleLog((current) => ["โหมด SKILL ใช้การ์ดสกิลในตานี้เท่านั้น", ...current]);
      return;
    }
    if (lane !== "top" && card?.kind !== "monster" && card?.kind !== "skill") return;
    setPlayer((current) => {
      const next = { ...current };
      (["top", "left", "right"] as Lane[]).forEach((item) => {
        if (next[item] === cardNo) next[item] = "";
      });
      next[lane] = cardNo;
      return next;
    });
  };

  const placeCardFromHand = (cardNo: string) => {
    const activeLane = laneForTurn(activeTurn);
    setPlacementLane(activeLane);
    setPlayerLane(activeLane, cardNo);
  };

  const drawRandomCard = () => {
    if (deckCatalog.length === 0) return "";
    const card = deckCatalog[Math.floor(Math.random() * deckCatalog.length)];
    setRandomDrawCardNo(card.cardNo);
    setBattleLog((current) => [`สุ่มจากกองกลางได้ No.${card.cardNo} ${card.name}`, ...current]);
    return card.cardNo;
  };

  const randomCardNoByKind = (kind: TriadCardKind) => {
    const pool = deckCatalog.filter((card) => card.kind === kind);
    const card = pool[Math.floor(Math.random() * Math.max(1, pool.length))];
    if (card) setRandomDrawCardNo(card.cardNo);
    return card?.cardNo || "";
  };

  const lockFight = () => {
    const lane = laneForTurn(activeTurn);
    if (!player[lane]) {
      setBattleLog((current) => [`เลือกการ์ด 1 ใบสำหรับตาที่ ${activeTurn} ก่อนกดล็อก`, ...current]);
      return;
    }

    const playerCard = cardsByNo.get(player[lane] || "");

    if (currentRoom && roomPlayerSide && opponentSide) {
      const needsSkillChoice = Boolean(playerCard && skillNeedsChoice(playerCard));
      const previousRoom = currentRoom;
      patchCurrentRoom((room) => ({
        ...room,
        game: {
          ...room.game,
          triangles: {
            ...room.game.triangles,
            [roomPlayerSide]: {
              ...room.game.triangles[roomPlayerSide],
              [lane]: player[lane],
            },
          },
          skillChoices: needsSkillChoice
            ? [
                ...room.game.skillChoices.filter(
                  (choice) =>
                    choice.fightNo !== room.game.fightNo ||
                    choice.turn !== room.game.activeTurn ||
                    choice.side !== roomPlayerSide
                ),
                {
                  fightNo: room.game.fightNo,
                  turn: room.game.activeTurn,
                  side: roomPlayerSide,
                  lane,
                  cardNo: playerCard?.cardNo || "",
                  startedAt: Date.now(),
                  deadlineAt: Date.now() + 30_000,
                  selectedTarget: "",
                  skipped: false,
                },
              ]
            : room.game.skillChoices,
        },
      }));
      setTurnLocked(true);
      void postRoomAction({
        action: "lock-card",
        code: currentRoom.code,
        cardNo: player[lane],
      }).then((result) => {
        if (!result.ok) {
          setTurnLocked(false);
          if (previousRoom) patchCurrentRoom(() => previousRoom);
          void syncRooms({ force: true }).catch(() => null);
          setBattleLog((current) => ["ล็อกการ์ดในห้อง PvP ไม่ได้", ...current]);
          return;
        }
        setBattleLog((current) => [
          result.payload?.resolved
            ? `ตาที่ ${activeTurn}: ทั้งสองฝั่งล็อกแล้ว`
            : `ตาที่ ${activeTurn}: ล็อกการ์ดแล้ว รอคู่แข่ง`,
          ...current,
        ]);
      });
      return;
    }

    const baseBot = lockedFight?.bot || { top: "", left: "", right: "" };
    const botCardNo = chooseBotCardForTurn({
      turn: activeTurn,
      player,
      bot: baseBot,
      botDeckCards: availableBotCards,
      deckMode: currentDeckMode,
    });
    const bot = { ...baseBot, [lane]: botCardNo };
    if (playerCard?.cardNo === "254") {
      setLockedFight({ fightNo, player, bot, turns: lockedFight?.turns || [] });
      setTurnLocked(true);
      setPendingBlessingChoice({ side: "player", lane, player, bot });
      setTimeLeft(TURN_SECONDS);
      setBattleLog((current) => [`${playerCard.name}: เลือกพร 1 ข้อเพื่อให้ผลเกิดทันที`, ...current]);
      return;
    }

    if (playerCard && skillNeedsChoice(playerCard)) {
      const targets = getSelectableSkillTargetIds(playerCard, "player");
      if (targets.length === 1) {
        const result = resolveTriadTurn({ turn: activeTurn, player, opponent: bot });
        const turns = [
          ...(lockedFight?.turns.filter((turn) => turn.turn !== activeTurn) || []),
          result,
        ].sort((a, b) => a.turn - b.turn);
        setLockedFight({ fightNo, player, bot, turns });
        setTurnLocked(true);
        setBattleLog((current) => [
          `${playerCard.name}: เลือกเป้าหมายอัตโนมัติแล้ว (${targets[0] === "bot-top" ? "มอนสเตอร์หลักฝั่งตรงข้าม" : "มอนสเตอร์หลักฝั่งเรา"})`,
          ...current,
        ]);
        return;
      }
      setLockedFight({ fightNo, player, bot, turns: lockedFight?.turns || [] });
      setTurnLocked(true);
      setPendingSkillChoice({ side: "player", lane, cardNo: playerCard.cardNo, selectedTarget: "" });
      setTimeLeft(TURN_SECONDS);
      setBattleLog((current) => [`${playerCard.name}: เลือกเป้าหมายก่อนคิดผลตาที่ ${activeTurn}`, ...current]);
      return;
    }

    const result = resolveTriadTurn({ turn: activeTurn, player, opponent: bot });
    const turns = [
      ...(lockedFight?.turns.filter((turn) => turn.turn !== activeTurn) || []),
      result,
    ].sort((a, b) => a.turn - b.turn);

    setLockedFight({ fightNo, player, bot, turns });
    setTurnLocked(true);
    setBattleLog((current) => [
      `รอบสู้ ${fightNo} ตา ${activeTurn}: ล็อกการ์ด ${player[lane]} แล้ว`,
      ...current,
    ]);
  };

  const confirmSkillTarget = () => {
    if (!pendingSkillChoice || !lockedFight) return;
    const skillCard = cardsByNo.get(pendingSkillChoice.cardNo);
    const fallbackTargets = getSelectableSkillTargetIds(skillCard, pendingSkillChoice.side);
    const selectedTarget = pendingSkillChoice.selectedTarget || (fallbackTargets.length === 1 ? fallbackTargets[0] : "");
    if (!selectedTarget) return;
    const selectableTargetIds = new Set(getSelectableSkillTargetIds(skillCard, pendingSkillChoice.side));
    if (!selectableTargetIds.has(selectedTarget)) {
      setPendingSkillChoice((current) => (current ? { ...current, selectedTarget: "" } : current));
      setBattleLog((current) => [
        `เป้าหมายสกิลไม่ถูกต้อง: ${selectedTarget} กรุณาเลือกเป้าหมายของ ${skillCard?.name || pendingSkillChoice.cardNo} ใหม่`,
        ...current,
      ]);
      return;
    }

    if (currentRoom && roomPlayerSide && opponentSide) {
      patchCurrentRoom((room) => ({
        ...room,
        game: {
          ...room.game,
          skillChoices: room.game.skillChoices.map((choice) =>
            choice.fightNo === room.game.fightNo &&
            choice.turn === room.game.activeTurn &&
            choice.side === roomPlayerSide &&
            !choice.selectedTarget &&
            !choice.skipped
              ? { ...choice, selectedTarget }
              : choice
          ),
        },
      }));
      setPendingSkillChoice(null);
      void postRoomAction({
        action: "choose-skill-target",
        code: currentRoom.code,
        selectedTarget,
      }).then((result) => {
        if (!result.ok) {
          void syncRooms({ force: true }).catch(() => null);
          setBattleLog((current) => ["เลือกเป้าหมายสกิลไม่สำเร็จ หรือหมดเวลา 30 วินาทีแล้ว", ...current]);
          return;
        }
        setBattleLog((current) => [`${skillCard?.name || pendingSkillChoice.cardNo}: ยืนยันเป้าหมายแล้ว`, ...current]);
      });
      return;
    }

    const result = resolveTriadTurn({
      turn: activeTurn,
      player: lockedFight.player,
      opponent: lockedFight.bot,
    });
    const turns = [
      ...lockedFight.turns.filter((turn) => turn.turn !== activeTurn),
      result,
    ].sort((a, b) => a.turn - b.turn);

    setLockedFight({ ...lockedFight, turns });
    setPendingSkillChoice(null);
    setBattleLog((current) => [
      `ยืนยันเป้าหมายสกิลแล้ว กำลังคิดผลตาที่ ${activeTurn}`,
      ...current,
    ]);
  };

  const chooseBlessing = (choice: BlessingChoice) => {
    if (!pendingBlessingChoice) return;
    const blessingCard = cardsByNo.get("254");
    let nextPlayer = { ...pendingBlessingChoice.player };
    let nextBot = { ...pendingBlessingChoice.bot };
    let summary = "ขอพรศักดิ์สิทธิ์ทำงานแล้ว";
    let drawnCardNo = "";
    let previewTopCardNo = "";

    if (choice === "draw-skill") {
      drawnCardNo = randomCardNoByKind("skill");
      if (drawnCardNo) {
        setPlayerDeck((current) => (current.includes(drawnCardNo) ? current : [...current, drawnCardNo]));
        summary = `ขอพรเปิดสกิลเพิ่ม ได้ No.${drawnCardNo}`;
      }
    } else if (choice === "reroll-own") {
      previewTopCardNo = randomCardNoByKind("monster");
      if (previewTopCardNo) {
        nextPlayer = { ...nextPlayer, top: previewTopCardNo };
        summary = `ขอพรสุ่มเปลี่ยนมอนสเตอร์เราเป็น No.${previewTopCardNo}`;
      }
    } else {
      previewTopCardNo = randomCardNoByKind("monster");
      if (previewTopCardNo) {
        nextBot = { ...nextBot, top: previewTopCardNo };
        summary = `ขอพรให้อีกฝ่ายสุ่มเปลี่ยนมอนสเตอร์เป็น No.${previewTopCardNo}`;
      }
    }

    if (currentRoom && roomPlayerSide) {
      setPendingBlessingChoice({
        ...pendingBlessingChoice,
        choice,
        drawnCardNo: "",
        previewTopCardNo: "",
        player: nextPlayer,
        bot: nextBot,
      });
      void postRoomAction({
        action: "choose-skill-target",
        code: currentRoom.code,
        selectedTarget: choice,
      }).then((result) => {
        if (!result.ok) {
          void syncRooms({ force: true }).catch(() => null);
          setBattleLog((current) => ["ขอพรศักดิ์สิทธิ์ยืนยันไม่สำเร็จ", ...current]);
          return;
        }
        setBattleLog((current) => [summary, ...current]);
      });
      return;
    }

    const result = resolveTriadTurn({
      turn: activeTurn,
      player: nextPlayer,
      opponent: nextBot,
      skippedSkillCardNos: ["254"],
    });
    const blessingEvent = {
      cardNo: "254",
      name: blessingCard?.name || "ขอพรศักดิ์สิทธิ์",
      side: "player" as const,
      type: "unparsed" as const,
      text: blessingCard?.skillText || "",
      summary,
    };
    const turns = [
      ...(lockedFight?.turns.filter((turn) => turn.turn !== activeTurn) || []),
      { ...result, skillEvents: [blessingEvent, ...result.skillEvents] },
    ].sort((a, b) => a.turn - b.turn);

    setPlayer(nextPlayer);
    setLockedFight({ fightNo, player: nextPlayer, bot: nextBot, turns });
    setPendingBlessingChoice({
      ...pendingBlessingChoice,
      choice,
      drawnCardNo,
      previewTopCardNo,
      player: nextPlayer,
      bot: nextBot,
    });
    if (drawnCardNo) setRandomDrawCardNo(drawnCardNo);
    setBattleLog((current) => [summary, ...current]);
  };

  const timeoutTurn = () => {
    if (matchDone || (!isPvpRoom && turnLocked && !pendingSkillChoice)) return;
    const lane = laneForTurn(activeTurn);

    if (currentRoom && roomPlayerSide && opponentSide) {
      void postRoomAction({ action: "timeout-turn", code: currentRoom.code }).then((result) => {
        if (result.ok) {
          setBattleLog((current) => [`ตาที่ ${activeTurn}: หมดเวลา ระบบตัดสินผลให้แล้ว`, ...current]);
        }
      });
      return;
    }

    setMatchScore((current) => ({ ...current, bot: current.bot + 1 }));
    setLastTurnWinner("bot");
    setPendingSkillChoice(null);
    setBattleLog((current) => [
      `ตาที่ ${activeTurn}: หมดเวลา เราเสีย 1 แต้ม และการ์ดกลับเข้ามือ`,
      ...current,
    ]);
    setPlayer((current) => ({ ...current, [lane]: "" }));

    if (activeTurn < 3) {
      const nextActiveTurn = (activeTurn + 1) as TriadTurn;
      setTurnLocked(false);
      setPendingSkillChoice(null);
      setActiveTurn(nextActiveTurn);
      setPlacementLane(laneForTurn(nextActiveTurn));
      setTimeLeft(TURN_SECONDS);
      setResultTimeLeft(RESULT_SECONDS);
      return;
    }

    if (lockedFight) {
      const completedPlayerCards = [lockedFight.player.top, lockedFight.player.left, lockedFight.player.right].filter(
        (cardNo): cardNo is string => Boolean(cardNo)
      );
      const completedBotCards = [lockedFight.bot.top, lockedFight.bot.left, lockedFight.bot.right].filter(
        (cardNo): cardNo is string => Boolean(cardNo)
      );
      setGravePlayerCards((current) => Array.from(new Set([...current, ...completedPlayerCards])));
      setGraveBotCards((current) => Array.from(new Set([...current, ...completedBotCards])));
    }

    setLockedFight(null);
    setTurnLocked(false);
    setPendingSkillChoice(null);
    setTimeLeft(TURN_SECONDS);
    setResultTimeLeft(RESULT_SECONDS);
    setActiveTurn(1);
    setRevealed(emptyRevealState());
    setFightNo((current) => current + 1);
    setPlayer({ top: "", left: "", right: "" });
    setPlacementLane("top");
  };

  useEffect(() => {
    const pvpTurnResolved = Boolean(isPvpRoom && currentResult && roomTurnResolved);
    if (phase !== "battle" || matchDone || pvpTurnResolved || (!isPvpRoom && turnLocked && !pendingSkillChoice)) return;

    const timer = window.setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setTimeout(timeoutTurn, 0);
          return TURN_SECONDS;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [phase, matchDone, turnLocked, pendingSkillChoice, activeTurn, player, lockedFight, isPvpRoom, currentResult, roomTurnResolved, currentRoom?.code, roomPlayerSide, opponentSide]);

  const scoreTurnIfReady = (
    turn: TriadTurn,
    nextReveal: Record<TriadTurn, TurnReveal>
  ) => {
    if (!lockedFight) return nextReveal;
    const state = nextReveal[turn];
    if (!state.player || !state.bot || state.scored) return nextReveal;

    const result = lockedFight.turns.find((item) => item.turn === turn);
    if (!result) return nextReveal;

    const winner = result.winner === "opponent" ? "bot" : result.winner;
    if (winner !== "draw") {
      setMatchScore((current) => ({
        player: current.player + (winner === "player" ? 1 : 0),
        bot: current.bot + (winner === "bot" ? 1 : 0),
      }));
    }
    setLastTurnWinner(winner);
    setResultTimeLeft(RESULT_SECONDS);
    setBattleLog((current) => [
      `ตาที่ ${turn}: ${winner === "draw" ? "เสมอ" : winner === "player" ? "เราได้แต้ม" : "คู่แข่งได้แต้ม"} (${result.playerTotal.toLocaleString()} ต่อ ${result.opponentTotal.toLocaleString()})`,
      ...current,
    ]);

    return {
      ...nextReveal,
      [turn]: { ...state, scored: true },
    };
  };

  useEffect(() => {
    if (!isPvpRoom || !currentResult || !roomTurnResolved || pendingSkillChoice) return;
    setRevealed((current) => {
      const state = current[activeTurn];
      if (state.scored) return current;
      const next = {
        ...current,
        [activeTurn]: { ...state, player: true, bot: true },
      };
      return scoreTurnIfReady(activeTurn, next);
    });
  }, [activeTurn, currentResult, isPvpRoom, pendingSkillChoice, roomTurnResolved]);

  const revealNext = () => {
    if (!lockedFight || !canRevealTurn || pendingSkillChoice || !currentResult) return;

    setRevealed((current) => {
      const state = current[activeTurn];
      if (state.scored) return current;
      const next = {
        ...current,
        [activeTurn]: { ...state, player: true, bot: true },
      };
      return scoreTurnIfReady(activeTurn, next);
    });
  };

  const nextTurn = () => {
    if (!lockedFight || activeTurn >= 3) return;
    if (currentRoom && isRoomController) {
      void postRoomAction({ action: "advance-turn", code: currentRoom.code });
    }
    const lane = laneForTurn(activeTurn);
    const nextActiveTurn = (activeTurn + 1) as TriadTurn;

    setUsedPlayerCards((current) =>
      Array.from(new Set([...current, lockedFight.player[lane]].filter((cardNo): cardNo is string => Boolean(cardNo))))
    );
    setUsedBotCards((current) =>
      Array.from(new Set([...current, lockedFight.bot[lane]].filter((cardNo): cardNo is string => Boolean(cardNo))))
    );
    setPendingSkillChoice(null);
    setPendingBlessingChoice(null);
    setRandomDrawCardNo("");
    setTurnLocked(false);
    setActiveTurn(nextActiveTurn);
    setPlacementLane(laneForTurn(nextActiveTurn));
    setTimeLeft(TURN_SECONDS);
    setResultTimeLeft(RESULT_SECONDS);
  };

  const nextFight = () => {
    if (!lockedFight) return;
    if (currentRoom && isRoomController) {
      void postRoomAction({ action: "advance-turn", code: currentRoom.code });
    }

    const nextUsedPlayer = [
      ...usedPlayerCards,
      lockedFight.player.top,
      lockedFight.player.left || "",
      lockedFight.player.right || "",
    ].filter(Boolean);
    const nextUsedBot = [
      ...usedBotCards,
      lockedFight.bot.top,
      lockedFight.bot.left || "",
      lockedFight.bot.right || "",
    ].filter(Boolean);
    const nextAvailablePlayer = playerDeckCards.filter((card) => !new Set(nextUsedPlayer).has(card.cardNo));

    const completedPlayerCards = [lockedFight.player.top, lockedFight.player.left, lockedFight.player.right].filter(
      (cardNo): cardNo is string => Boolean(cardNo)
    );
    const completedBotCards = [lockedFight.bot.top, lockedFight.bot.left, lockedFight.bot.right].filter(
      (cardNo): cardNo is string => Boolean(cardNo)
    );
    setGravePlayerCards((current) => Array.from(new Set([...current, ...completedPlayerCards])));
    setGraveBotCards((current) => Array.from(new Set([...current, ...completedBotCards])));
    setUsedPlayerCards(Array.from(new Set(nextUsedPlayer)));
    setUsedBotCards(Array.from(new Set(nextUsedBot)));
    setLockedFight(null);
    setTurnLocked(false);
    setPendingSkillChoice(null);
    setPendingBlessingChoice(null);
    setRandomDrawCardNo("");
    setTimeLeft(TURN_SECONDS);
    setResultTimeLeft(RESULT_SECONDS);
    setActiveTurn(1);
    setRevealed(emptyRevealState());
    setLastTurnWinner(null);
    setFightNo((current) => current + 1);
    setPlayer({ top: "", left: "", right: "" });
    setPlacementLane(nextAvailablePlayer.length > 0 ? "top" : placementLane);
  };

  const displayCurrentResult = spectatorBattleState?.lockedFight?.turns.find((turn) => turn.turn === displayActiveTurn) || currentResult;
  const revealState = displayRevealed[displayActiveTurn];
  const activeTurnScored = Boolean(revealState?.scored);
  const canRevealTurn = Boolean(displayCurrentResult) && (displayTurnLocked || Boolean(isPvpRoom && roomTurnResolved));
  useEffect(() => {
    if (phase !== "battle" || matchDone || !lockedFight || !activeTurnScored) {
      resultAdvanceKeyRef.current = "";
      return;
    }

    const advanceKey = `${activeRoomCode || "solo"}:${fightNo}:${activeTurn}:${currentResult?.winner || "resolved"}`;
    if (resultAdvanceKeyRef.current !== advanceKey) {
      resultAdvanceKeyRef.current = advanceKey;
      setResultTimeLeft(RESULT_SECONDS);
    }

    const timer = window.setInterval(() => {
      setResultTimeLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          if (!isPvpRoom || isRoomController) {
            setTimeout(() => {
              if (activeTurn >= 3) nextFight();
              else nextTurn();
            }, 0);
          }
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeRoomCode, activeTurn, activeTurnScored, currentResult?.winner, fightNo, isPvpRoom, isRoomController, lockedFight, matchDone, phase]);

  const revealButtonLabel =
    !canRevealTurn
      ? "ล็อกการ์ดก่อน"
      : "เปิดทั้งสองฝั่ง";

  if (phase === "lobby") {
    const visibleRooms = rooms
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 8);
    const searchedRoom = joinCode.length === 6 ? rooms.find((room) => room.code === joinCode) : null;

    return (
      <main className="min-h-[calc(var(--app-shell-height)-var(--app-header-height)-var(--app-mobile-nav-height))] overflow-y-auto rounded-[24px] border border-amber-200/12 bg-[#050507] text-white shadow-[0_30px_110px_rgba(0,0,0,0.58)]">
        {passwordRoom ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-md">
            <div className="w-[min(420px,94vw)] rounded-2xl border border-amber-200/28 bg-[#090b12] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.55)]">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl border border-amber-200/25 bg-amber-200/10">
                <KeyRound className="h-6 w-6 text-amber-200" />
              </div>
              <div className="mt-4 text-center">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/42">ห้องส่วนตัว</div>
                <div className="mt-1 font-mono text-3xl font-black tracking-[0.18em] text-white">{passwordRoom.code}</div>
              </div>
              <label className="mt-5 block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-white/42">รหัสผ่าน</span>
                <input
                  value={joinPassword}
                  onChange={(event) => setJoinPassword(event.target.value)}
                  className="h-12 w-full rounded-xl border border-white/10 bg-black/40 px-3 text-center text-base font-bold text-white outline-none transition focus:border-amber-300/70"
                  autoFocus
                />
              </label>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPasswordRoom(null);
                    setJoinPassword("");
                  }}
                  className="h-11 rounded-xl border border-white/10 bg-white/5 text-xs font-black uppercase tracking-[0.12em] text-white/62 transition hover:border-white/30"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={() => enterRoom(passwordRoom.code, false, joinPassword)}
                  className="h-11 rounded-xl bg-amber-300 text-xs font-black uppercase tracking-[0.12em] text-black transition hover:bg-amber-200"
                >
                  ยืนยัน
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {createModeDialogOpen ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-md">
            <div className="w-[min(620px,94vw)] rounded-[28px] border border-amber-200/28 bg-[radial-gradient(circle_at_top,rgba(255,214,102,0.12),transparent_34%),linear-gradient(180deg,#0a0b0f,#050507_62%,#040405)] p-5 shadow-[0_24px_90px_rgba(0,0,0,0.58)]">
              <div className="text-center">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-100/58">เลือกโหมดการ์ดของห้อง</div>
                <div className="mt-1 text-3xl font-black text-white">ตั้งกองเลือกก่อนสร้าง</div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {[
                  { id: "all" as DeckMode, title: "ALL IN ONE", detail: "เปิดการ์ดทั้งหมด 293 ใบให้ทั้งสองฝั่งเลือกจัดเด็คเอง" },
                  { id: "monster" as DeckMode, title: "MONSTER", detail: "สุ่ม pool ฝั่งละ 20 ใบ: มอนสเตอร์ล้วนสำหรับโหมดนี้" },
                  { id: "skill" as DeckMode, title: "SKILL", detail: `บังคับเด็ค ${SKILL_MODE_MONSTER_LIMIT} มอนสเตอร์ + ${SKILL_MODE_SKILL_LIMIT} สกิล และให้กติกาตรงตามโหมดสกิล` },
                ].map((mode) => {
                  const selected = createRoomMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setCreateRoomMode(mode.id)}
                      className={`min-h-40 rounded-2xl border p-4 text-left transition ${
                        selected
                          ? "border-amber-200 bg-[radial-gradient(circle_at_top,rgba(255,214,102,0.2),rgba(255,196,0,0.06)_42%,rgba(255,255,255,0.02)_100%)] shadow-[0_0_0_1px_rgba(251,191,36,0.35),0_0_30px_rgba(251,191,36,0.16)]"
                          : "border-amber-200/18 bg-white/[0.045] hover:-translate-y-0.5 hover:border-amber-200/55 hover:bg-amber-200/10"
                      }`}
                    >
                      <div className="flex h-full flex-col">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-black uppercase tracking-[0.18em] text-amber-200/80">
                            {selected ? "เลือกอยู่" : "โหมด"}
                          </div>
                          <div
                            className={`grid h-5 w-5 place-items-center rounded-full border text-[10px] font-black ${
                              selected
                                ? "border-amber-200 bg-amber-200 text-black shadow-[0_0_18px_rgba(251,191,36,0.6)]"
                                : "border-white/16 bg-black/34 text-white/28"
                            }`}
                          >
                            {selected ? "✓" : ""}
                          </div>
                        </div>
                        <div className="mt-4 text-2xl font-black text-white">{mode.title}</div>
                        <div className="mt-3 text-sm font-semibold leading-6 text-white/58">{mode.detail}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreateModeDialogOpen(false);
                  void createRoom(createRoomMode);
                }}
                className="mt-4 h-11 w-full rounded-xl bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 text-xs font-black uppercase tracking-[0.12em] text-black shadow-[0_0_26px_rgba(251,191,36,0.18)] transition hover:from-amber-200 hover:to-yellow-100"
              >
                ยืนยันสร้างห้อง
              </button>
              <button
                type="button"
                onClick={() => setCreateModeDialogOpen(false)}
                className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-black/34 text-xs font-black uppercase tracking-[0.12em] text-white/62 transition hover:border-amber-200/30 hover:text-white"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        ) : null}
        <section className="relative min-h-[320px] overflow-hidden border-b border-amber-200/12 px-4 py-6 sm:px-6 lg:px-8">
          <div className="absolute inset-0">
            <Image
              src="/images/triad/battle-header-banner.webp"
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover object-center"
            />
          </div>
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.36)_42%,rgba(0,0,0,0.68)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.34)_0%,rgba(0,0,0,0.1)_38%,rgba(0,0,0,0.22)_100%)]" />
          <div className="relative z-10 flex min-h-[280px] flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="relative z-20 max-w-3xl lg:max-w-[44%]">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/16 bg-black/35 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-white/85 backdrop-blur-sm">
                <Swords className="h-3.5 w-3.5" />
                ห้องแบทเทิลการ์ด
              </div>
              <h1 className="text-[clamp(2.4rem,9vw,6.4rem)] font-black uppercase leading-[0.86] tracking-normal text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.75)]">
                ล็อบบี้ต่อสู้
              </h1>
              <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-white/78 sm:text-base drop-shadow-[0_1px_8px_rgba(0,0,0,0.6)]">
                สร้างห้อง เข้าห้องด้วยเลข 6 ตัว หรือเลือกนั่งชมก่อนเริ่มสู้ได้เลย
              </p>
            </div>
            <div className="relative z-20 grid grid-cols-3 gap-2 sm:min-w-[420px]">
              {[
                ["ห้อง", rooms.length],
                ["ล็อก", rooms.filter((room) => room.access === "private").length],
                ["กำลังสู้", rooms.filter((room) => room.status === "playing").length],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/12 bg-black/36 p-3 backdrop-blur-sm shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/38">{label}</div>
                  <div className="mt-1 text-2xl font-black text-white">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[380px_1fr] lg:p-8">
          <div className="space-y-4">
            <div className="rounded-[18px] border border-amber-200/16 bg-black/40 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.32)]">
              <div className="mb-4 flex items-center gap-2 text-sm font-black text-white">
                <Plus className="h-4 w-4 text-amber-300" />
                สร้างห้อง
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(["public", "private"] as RoomAccess[]).map((access) => (
                  <button
                    key={access}
                    type="button"
                    onClick={() => setRoomAccess(access)}
                    className={`h-11 rounded-xl border text-xs font-black uppercase tracking-[0.12em] transition ${
                      roomAccess === access
                        ? "border-red-300 bg-red-500 text-white shadow-[0_0_28px_rgba(239,68,68,0.28)]"
                        : "border-white/10 bg-black/28 text-white/58 hover:border-amber-300/40"
                    }`}
                  >
                    {access === "public" ? "สาธารณะ" : "ส่วนตัว"}
                  </button>
                ))}
              </div>
              {roomAccess === "private" ? (
                <label className="mt-3 block">
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.16em] text-white/42">รหัสห้อง</span>
                  <input
                    value={roomPassword}
                    onChange={(event) => setRoomPassword(event.target.value)}
                    className="h-11 w-full rounded-xl border border-amber-200/12 bg-black/50 px-3 text-sm font-bold text-white outline-none transition focus:border-red-300/70"
                    placeholder="อย่างน้อย 4 ตัว"
                  />
                </label>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setCreateRoomMode("all");
                  setCreateModeDialogOpen(true);
                }}
                className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-500 text-sm font-black uppercase tracking-[0.12em] text-white shadow-[0_0_32px_rgba(239,68,68,0.32)] transition hover:bg-red-400"
              >
                <Plus className="h-4 w-4" />
                สร้าง
              </button>
            </div>

            <div className="rounded-[18px] border border-amber-200/16 bg-black/40 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.32)]">
              <div className="mb-4 flex items-center gap-2 text-sm font-black text-white">
                <Search className="h-4 w-4 text-cyan-200" />
                ค้นหาห้อง
              </div>
              <input
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                className="h-12 w-full rounded-xl border border-amber-200/12 bg-black/50 px-3 text-center font-mono text-xl font-black tracking-[0.2em] text-white outline-none transition focus:border-red-300/70"
                placeholder="000000"
                inputMode="numeric"
              />
              <button
                type="button"
                onClick={() => enterRoom()}
                disabled={joinCode.length !== 6}
                className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-500 text-sm font-black uppercase tracking-[0.12em] text-white shadow-[0_0_32px_rgba(239,68,68,0.26)] transition hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-white/28"
              >
                <KeyRound className="h-4 w-4" />
                {searchedRoom?.status === "playing" ? "เข้าชม" : "เข้าห้อง"}
              </button>
            </div>
            {lobbyMessage ? (
              <div className="rounded-xl border border-rose-300/20 bg-rose-300/10 p-3 text-sm font-bold text-rose-100">
                {lobbyMessage}
              </div>
            ) : null}
            <RankFramePicker selected={selectedFrameIndex} onSelect={setSelectedFrameIndex} />
          </div>

          <div className="rounded-[18px] border border-amber-200/16 bg-black/36 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.38)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-black text-white">
                <Users className="h-4 w-4 text-emerald-200" />
                ห้องทั้งหมด
              </div>
              <div className="text-xs font-bold text-white/38">เห็นทั้งห้องสาธารณะและห้องล็อกรหัส</div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {visibleRooms.length > 0 ? visibleRooms.map((room) => (
                <div key={room.code} className="relative overflow-hidden rounded-[18px] border border-amber-200/14 bg-[linear-gradient(135deg,rgba(255,255,255,0.055),rgba(0,0,0,0.4))] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.28)]">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-200/70 to-transparent" />
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <RankAvatar participant={room.seats.host} size="md" />
                      <div className="min-w-0">
                      <div className="font-mono text-2xl font-black tracking-[0.18em] text-white">{room.code}</div>
                      <div className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-white/38">
                        {room.status === "playing" ? "กำลังสู้" : "รอเริ่ม"} • {room.seats.challenger ? "ผู้เล่น 2 คน" : "ผู้เล่น 1 คน"}
                      </div>
                      <div className="mt-1 truncate text-xs font-bold text-amber-100/55">
                        หัวห้อง: {room.seats.host?.name || "ไม่มี"}
                      </div>
                      </div>
                    </div>
                    <div className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-black uppercase ${
                      room.access === "private"
                        ? "border-amber-200/24 bg-amber-200/10 text-amber-100"
                        : "border-emerald-200/20 bg-emerald-200/10 text-emerald-100"
                    }`}>
                      {room.access === "private" ? <Lock className="h-3 w-3" /> : null}
                      {room.access === "private" ? "ล็อกรหัส" : "สาธารณะ"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => (room.access === "private" && room.hostId !== participant.id ? setPasswordRoom(room) : enterRoom(room.code))}
                    className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl bg-red-500 text-xs font-black uppercase tracking-[0.12em] text-white shadow-[0_0_28px_rgba(239,68,68,0.26)] transition hover:bg-red-400"
                  >
                    {room.status === "playing" ? "เข้าชม" : "เข้าห้อง"}
                  </button>
                </div>
              )) : (
                <div className="rounded-xl border border-white/8 bg-black/24 p-6 text-sm font-semibold text-white/42">
                  ยังไม่มีห้อง
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (phase === "room") {
    if (!currentRoom) {
      return (
        <main className="grid min-h-[calc(var(--app-shell-height)-var(--app-header-height)-var(--app-mobile-nav-height))] place-items-center rounded-[24px] border border-white/8 bg-[#05070d] p-6 text-white">
          <div className="w-[min(420px,94vw)] rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-center">
            <div className="text-lg font-black text-white">กำลังเชื่อมห้องใหม่</div>
            <div className="mt-2 text-sm font-semibold leading-6 text-white/50">
              กำลังโหลดข้อมูลห้อง ถ้าห้องถูกปิดแล้วสามารถกลับไปล็อบบี้ได้
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void syncRooms().catch(() => null)}
                className="h-11 rounded-xl bg-amber-300 text-xs font-black uppercase tracking-[0.12em] text-black"
              >
                โหลดใหม่
              </button>
              <button
                type="button"
                onClick={() => {
                  activeRoomCodeRef.current = "";
                  activeRoomSnapshotRef.current = null;
                  setActiveRoomCode("");
                  setActiveRoomSnapshot(null);
                  setPhase("lobby");
                }}
                className="h-11 rounded-xl bg-white text-xs font-black uppercase tracking-[0.12em] text-black"
              >
                ล็อบบี้
              </button>
            </div>
          </div>
        </main>
      );
    }

    const canStart = isRoomController && Boolean(currentRoom.seats.host && currentRoom.seats.challenger);
    const currentIsSpectator = currentRoom.spectators.some((viewer) => viewer.id === participant.id);

    return (
      <main className="min-h-[calc(var(--app-shell-height)-var(--app-header-height)-var(--app-mobile-nav-height))] overflow-y-auto rounded-[24px] border border-amber-200/12 bg-[#050507] text-white shadow-[0_30px_110px_rgba(0,0,0,0.58)]">
        <section className="relative overflow-hidden border-b border-amber-200/12 px-4 py-5 sm:px-6 lg:px-8">
          <div className="absolute inset-0">
            <Image
              src="/images/triad/battle-header-banner.webp"
              alt=""
              fill
              priority
              sizes="100vw"
              className="object-cover object-center"
            />
          </div>
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.12)_0%,rgba(0,0,0,0.28)_34%,rgba(0,0,0,0.6)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.22)_0%,rgba(0,0,0,0.1)_40%,rgba(0,0,0,0.16)_100%)]" />
          <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/16 bg-black/35 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-white/85 backdrop-blur-sm">
                <KeyRound className="h-3.5 w-3.5" />
                ห้อง {currentRoom.code}
              </div>
              <h1 className="font-mono text-[clamp(2.4rem,9vw,6rem)] font-black leading-none tracking-[0.14em] text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.75)]">
                {currentRoom.code}
              </h1>
              <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-white/78 drop-shadow-[0_1px_8px_rgba(0,0,0,0.6)]">
                เจ้าของห้องเป็นคนกดเริ่มเกม คนที่เข้ามาหลังเกมเริ่มจะถูกนั่งเป็นผู้ชมอัตโนมัติ
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={leaveRoom}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-white/14 bg-black/45 px-4 text-xs font-black uppercase tracking-[0.12em] text-white/78 transition hover:border-white/30 hover:bg-black/55"
              >
                ออกห้อง
              </button>
              <button
                type="button"
                onClick={startRoomGame}
                disabled={!canStart}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 px-5 text-xs font-black uppercase tracking-[0.12em] text-black shadow-[0_0_32px_rgba(251,191,36,0.26)] transition hover:from-amber-200 hover:to-yellow-100 disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-black/35"
              >
                <Swords className="h-4 w-4" />
                เริ่มเกม
              </button>
            </div>
          </div>
        </section>

        <div className="px-4 pb-2 sm:px-6 xl:px-8">
          <div className="rounded-2xl border border-cyan-200/14 bg-cyan-300/8 px-4 py-3 text-sm font-semibold leading-6 text-cyan-50/78">
            เมื่อเริ่มเกม ทั้งสองฝั่งจะเข้าสู่ช่วงเลือกเด็คพร้อมกัน ผู้ชมจะเห็นตัวนับถอยหลัง 5 นาทีและชื่อของฝั่งที่กำลังจัดเด็คอย่างชัดเจน
          </div>
        </div>

        <section className="grid gap-4 p-4 sm:p-6 xl:grid-cols-[1fr_320px] xl:p-8">
          <div className="grid gap-4 md:grid-cols-2">
            <RoomSeatCard
              label="ฝั่งเจ้าของห้อง"
              participant={currentRoom.seats.host}
              isLeader={currentRoom.seats.host?.id === currentRoom.hostId}
              tone="host"
              emptyText="ช่องเจ้าของห้องว่าง"
              canTake={currentIsSpectator && !currentRoom.seats.host}
              onTake={() => takeFieldSlot("host")}
              currentId={participant.id}
              selectedFrameIndex={selectedFrameIndex}
            />
            <RoomSeatCard
              label="ฝั่งผู้ท้าชิง"
              participant={currentRoom.seats.challenger}
              isLeader={currentRoom.seats.challenger?.id === currentRoom.hostId}
              tone="challenger"
              emptyText="รอผู้ท้าชิง"
              canTake={currentIsSpectator && !currentRoom.seats.challenger}
              onTake={() => takeFieldSlot("challenger")}
              currentId={participant.id}
              selectedFrameIndex={selectedFrameIndex}
            />
            <div className="md:col-span-2 rounded-xl border border-white/8 bg-black/24 p-4">
              <div className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/42">กติกาห้อง</div>
              <div className="grid gap-2 text-sm font-semibold leading-6 text-white/58 sm:grid-cols-2">
                <div>คนที่ 2 จะลงช่องผู้ท้าชิงให้อัตโนมัติ</div>
                <div>ก่อนเริ่มเกม ผู้เล่นย้ายไปเป็นผู้ชมได้</div>
                <div>ผู้ชมลงสนามได้เมื่อช่องผู้เล่นว่าง</div>
                <div>หลังเริ่มเกม คนที่เข้ามาใหม่จะเป็นผู้ชม</div>
              </div>
              {isFieldPlayer && currentRoom.status === "waiting" ? (
                <button
                  type="button"
                  onClick={moveToSpectator}
                  className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-violet-200/30 bg-violet-200/10 px-4 text-xs font-black uppercase tracking-[0.12em] text-violet-100 transition hover:border-violet-100/60"
                >
                  <Eye className="h-4 w-4" />
                  ไปนั่งชม
                </button>
              ) : null}
            </div>
          </div>

          <aside className="space-y-4">
            <SpectatorPanel
              spectators={currentRoom.spectators}
              currentId={participant.id}
              canWatch={!currentIsSpectator && currentRoom.status === "waiting"}
              onWatch={moveToSpectator}
            />
            <RankFramePicker selected={selectedFrameIndex} onSelect={setSelectedFrameIndex} />
          </aside>
        </section>
      </main>
    );
  }

  if (phase === "deck") {
    const deckReadyDisabled = currentRoom ? ownDeckReady || !deckValidation.valid : !deckValidation.valid;
    const deckReadyLabel = ownDeckReady ? "พร้อมแล้ว" : currentRoom ? "พร้อม" : "เข้าสนาม";
    const deckTimerText = `${Math.floor(deckTimeLeft / 60)}:${String(deckTimeLeft % 60).padStart(2, "0")}`;
    return (
      <main className="min-h-[calc(var(--app-shell-height)-var(--app-header-height)-var(--app-mobile-nav-height))] overflow-y-auto rounded-[24px] border border-white/8 bg-[#050710] text-white shadow-[0_26px_90px_rgba(0,0,0,0.42)]">
        <section className="relative overflow-hidden border-b border-amber-200/12 px-4 py-5 sm:px-6 lg:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(251,191,36,0.18),transparent_24%),radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.06),transparent_24%),radial-gradient(circle_at_82%_20%,rgba(160,120,35,0.22),transparent_28%),linear-gradient(180deg,#090909,#050507_58%,#120d08)]" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-amber-200">
                <Layers3 className="h-3.5 w-3.5" />
                จัดเด็ค
              </div>
              <h1 className="text-[clamp(2.2rem,8vw,6rem)] font-black uppercase leading-[0.88] tracking-normal text-white">
                เลือกเด็คของคุณ
              </h1>
              <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-white/62 sm:text-base">
                เลือกการ์ด {DECK_SIZE} ใบสำหรับ 3 รอบสู้ การ์ดแต่ละใบใช้ได้ครั้งเดียวในเกมนี้
              </p>
              <div className="mt-4 max-w-2xl rounded-2xl border border-amber-200/16 bg-black/30 px-4 py-3 text-sm font-bold leading-6 text-amber-100/86">
                {deckSelectionGuide}
                <div className="mt-1 text-xs font-semibold text-amber-100/62">{deckSelectionNotice}</div>
              </div>
            </div>

            <div className="relative z-20 rounded-2xl border border-amber-200/12 bg-black/36 p-4 shadow-[0_0_24px_rgba(251,191,36,0.04)]">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/42">
                {currentRoom ? "เวลาเลือกเด็ค" : "เลือกแล้ว"}
              </div>
              <div className="mt-1 text-5xl font-black text-white">
                {currentRoom ? deckTimerText : `${playerDeck.length}/${DECK_SIZE}`}
              </div>
              <div className="mt-2 text-xs font-bold text-white/48">
                เลือกแล้ว {playerDeck.length}/{DECK_SIZE} • {opponentDeckReady ? "อีกฝ่ายพร้อมแล้ว" : "รออีกฝ่าย"}
              </div>
              <button
                type="button"
                onClick={enterBattle}
                disabled={deckReadyDisabled}
                className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 px-4 text-sm font-black text-black shadow-[0_0_32px_rgba(251,191,36,0.22)] transition hover:from-amber-200 hover:to-yellow-100 disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-black/35 disabled:hover:from-white/10"
              >
                {deckReadyLabel}
                <ChevronRight className="h-4 w-4" />
              </button>
              {currentRoom ? (
                <button
                  type="button"
                  onClick={leaveRoom}
                  className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-xl border border-white/10 bg-black/28 px-4 text-xs font-black uppercase tracking-[0.12em] text-white/64 transition hover:border-amber-200/30 hover:text-white"
                >
                  ออกห้อง
                </button>
              ) : null}
            </div>
          </div>
        </section>

        {deckSelectionActive ? (
          <div className="px-4 pb-2 sm:px-6 lg:px-8">
            <DeckSelectionStatusBanner
              title="กำลังเลือกเด็ค"
              leftName={currentRoom?.seats.host?.name || "ฝั่งบน"}
              rightName={currentRoom?.seats.challenger?.name || "ฝั่งล่าง"}
              timerText={deckTimerText}
              message="ทั้งสองฝั่งกำลังจัดเด็คพร้อมกันจนกว่าจะกดพร้อมครบ ผู้ชมจะเห็นสถานะนี้แบบเดียวกันทั้งห้อง"
            />
          </div>
        ) : null}

        <section className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[1fr_280px] lg:p-8">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
            {selectableDeckCatalog.map((card) => {
              const selected = playerDeck.includes(card.cardNo);
              const disabled =
                ownDeckReady ||
                (playerDeck.length >= DECK_SIZE && !selected) ||
                (currentDeckMode === "skill" && !selected && card.kind === "monster" && deckSelectionCounts.monsters >= SKILL_MODE_MONSTER_LIMIT) ||
                (currentDeckMode === "skill" && !selected && card.kind === "skill" && deckSelectionCounts.skills >= SKILL_MODE_SKILL_LIMIT);
              const disabledReason =
                currentDeckMode === "skill" && !selected && card.kind === "monster" && deckSelectionCounts.monsters >= SKILL_MODE_MONSTER_LIMIT
                  ? `โหมด SKILL เลือกมอนสเตอร์ได้ ${SKILL_MODE_MONSTER_LIMIT} ใบเท่านั้น`
                  : currentDeckMode === "skill" && !selected && card.kind === "skill" && deckSelectionCounts.skills >= SKILL_MODE_SKILL_LIMIT
                    ? `โหมด SKILL เลือกการ์ดสกิลได้ ${SKILL_MODE_SKILL_LIMIT} ใบเท่านั้น`
                    : playerDeck.length >= DECK_SIZE && !selected
                      ? `เลือกได้ ${DECK_SIZE} ใบเท่านั้น`
                      : undefined;
              return (
                <DeckCard
                  key={card.cardNo}
                  card={card}
                  selected={selected}
                  disabled={disabled}
                  disabledReason={disabledReason}
                  onClick={() => toggleDeckCard(card.cardNo)}
                />
              );
            })}
          </div>

          <aside className="rounded-2xl border border-amber-200/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.02))] p-4 lg:sticky lg:top-4 lg:self-start">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-white">
              <Sparkles className="h-4 w-4 text-amber-300" />
              เด็คที่เลือก
            </div>
            <div className="space-y-2">
              {playerDeckCards.map((card, index) => (
                <button
                  key={card.cardNo}
                  type="button"
                  onClick={() => toggleDeckCard(card.cardNo)}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/8 bg-black/24 p-2 text-left transition hover:border-amber-300/40 hover:bg-amber-300/6"
                >
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-300 text-xs font-black text-black">
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-white">เลข {card.cardNo} {card.name}</div>
                    <div className="truncate text-xs font-semibold text-white/48">{cardLabel(card)}</div>
                  </div>
                </button>
              ))}
            </div>
          </aside>
        </section>
        {currentRoom ? (
          <div className="fixed inset-x-3 bottom-[calc(var(--app-mobile-nav-height)+12px)] z-40 mx-auto flex max-w-[560px] items-center gap-3 rounded-2xl border border-amber-200/24 bg-black/78 p-3 shadow-[0_0_44px_rgba(251,191,36,0.12)] backdrop-blur-md xl:bottom-5">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100/62">
                ล็อกเด็คอัตโนมัติใน {deckTimerText}
              </div>
              <div className="mt-1 truncate text-sm font-bold text-white/70">
                {ownDeckReady ? "เด็คคุณล็อกแล้ว รออีกฝ่าย" : `เลือกไว้ ${playerDeck.length}/${DECK_SIZE} ใบ กดพร้อมแล้วจะแก้ไม่ได้`}
              </div>
            </div>
            <button
              type="button"
              onClick={enterBattle}
              disabled={ownDeckReady}
              className="inline-flex h-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 px-6 text-sm font-black uppercase tracking-[0.12em] text-black shadow-[0_0_32px_rgba(251,191,36,0.22)] transition hover:from-amber-200 hover:to-yellow-100 disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-black/35 disabled:hover:from-white/10"
            >
              {ownDeckReady ? "พร้อมแล้ว" : "พร้อม"}
            </button>
          </div>
        ) : null}
      </main>
    );
  }

  return (
    <main className="relative min-h-[calc(var(--app-shell-height)-var(--app-header-height)-var(--app-mobile-nav-height))] overflow-y-auto rounded-[24px] border border-white/8 bg-[#06080d] text-white shadow-[0_26px_90px_rgba(0,0,0,0.42)] xl:h-[calc(var(--app-shell-height)-var(--app-desktop-chrome-height))] xl:min-h-0">
      {currentRoom && isFieldPlayer && !matchDone ? (
        <button
          type="button"
          onClick={surrenderBattle}
          className="absolute left-4 top-4 z-30 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200/35 bg-red-500 px-4 text-xs font-black uppercase tracking-[0.12em] text-white shadow-[0_0_30px_rgba(239,68,68,0.28)] backdrop-blur transition hover:bg-red-400"
        >
          <Swords className="h-4 w-4" />
          ยอมแพ้
        </button>
      ) : null}
      {matchDone && forcedWinnerLabel ? (
        <MatchFinalOverlay winner={forcedWinnerLabel} surrendered={surrenderedLabel} score={finalMatchScore} />
      ) : null}
      <OpeningTieBreakOverlay
        tieBreak={currentRoom?.game.openerTieBreak}
        hostName={currentRoom?.seats.host?.name || "ฝั่งบน"}
        challengerName={currentRoom?.seats.challenger?.name || "ฝั่งล่าง"}
        ownSide={roomPlayerSide}
        isSpectator={isSpectator}
        pendingChoice={openingTieBreakPendingChoice}
        onChoose={chooseOpeningTieBreak}
      />
      {currentRoom ? (
        <button
          type="button"
          onClick={leaveRoom}
          className="absolute right-4 top-4 z-30 inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-black/55 px-4 text-xs font-black uppercase tracking-[0.12em] text-white/70 backdrop-blur transition hover:border-white/30"
        >
          ออกห้อง
        </button>
      ) : null}
      {deckSelectionActive ? (
        <div className="px-2 pt-16 sm:px-3">
          <div className="ml-auto w-full sm:w-[min(390px,100%)]">
            <DeckSelectionStatusBanner
              title="กำลังเลือกเด็ค"
              leftName={currentRoom?.seats.host?.name || "ฝั่งบน"}
              rightName={currentRoom?.seats.challenger?.name || "ฝั่งล่าง"}
              timerText={deckTimerText}
              message="ผู้ชมจะเห็นสถานะนี้จนกว่าทั้งสองฝั่งจะกดพร้อมครบ เกมจึงจะเริ่มต่อได้"
              compact
            />
          </div>
        </div>
      ) : null}
      {isSpectator ? <CardHoverPreview card={spectatorPreviewCard} /> : null}
      <section className="hidden relative overflow-hidden border-b border-white/8 bg-[#070b12] px-4 py-5 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(245,158,11,0.22),transparent_28%),radial-gradient(circle_at_82%_4%,rgba(14,165,233,0.16),transparent_26%),linear-gradient(135deg,rgba(255,255,255,0.04),transparent)]" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-amber-200">
              <Swords className="h-3.5 w-3.5" />
              สนามทดสอบ
            </div>
            <h1 className="text-[clamp(2.1rem,8vw,6.2rem)] font-black uppercase leading-[0.88] tracking-normal">
              Triad Dominion
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-white/62 sm:text-base">
              สู้ทั้งหมด 3 รอบ รอบละ 3 ตา ตาแรกเปิดพร้อมกัน หลังจากนั้นผู้ชนะตาก่อนจะเปิดก่อน
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 xl:min-w-[560px]">
            {[
              ["เกม", `${displayMatchScore.player}-${displayMatchScore.bot}`],
              ["รอบ", Math.min(displayFightNo, 3)],
              ["เด็ค", isSpectator ? `${displayPlayerDeckCards.length}/${DECK_SIZE}` : `${playerDeck.length}/${DECK_SIZE}`],
              ["การ์ด", summary.totalCards],
              ["รอเช็ก", summary.reviewSkills],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-white/10 bg-black/24 p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/36">
                  {label}
                </div>
                <div className="mt-1 text-2xl font-black text-white">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={`grid min-h-0 gap-2 p-2 sm:gap-3 sm:p-3 xl:grid-cols-[minmax(0,1fr)_220px] ${deckSelectionActive ? "pt-2 sm:pt-3" : "pt-16 sm:pt-16"}`}>
        <section className="grid min-h-0 grid-rows-[minmax(390px,1fr)_auto_auto] gap-2 sm:grid-rows-[minmax(500px,1fr)_auto_auto] sm:gap-3 xl:grid-rows-[minmax(580px,calc(100vh-300px))_auto_auto]">
          {false && deckSelectionActive ? (
            <div className="rounded-2xl border border-amber-200/16 bg-amber-300/10 px-4 py-3 shadow-[0_14px_40px_rgba(0,0,0,0.24)] backdrop-blur-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-100/70">
                    กำลังเลือกเด็ค
                  </div>
                  <div className="mt-1 text-sm font-black text-white">
                    {currentRoom?.seats.host?.name || "ฝั่งบน"} และ {currentRoom?.seats.challenger?.name || "ฝั่งล่าง"} กำลังเลือกเด็คอยู่
                  </div>
                </div>
                <div className="rounded-2xl border border-amber-100/18 bg-black/40 px-3 py-2 text-right">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100/52">เวลาที่เหลือ</div>
                  <div className="text-3xl font-black text-amber-100">{deckTimerText}</div>
                </div>
              </div>
              <div className="mt-2 text-xs font-semibold leading-5 text-white/62">
                ผู้ชมจะเห็นสถานะนี้จนกว่าทั้งสองฝั่งจะกดพร้อมครบ เด็คถึงจะเริ่มสู้ต่อได้
              </div>
            </div>
          ) : null}

          {isSpectator ? (
            <div className="grid gap-2 sm:gap-3">
              <SpectatorDeckStrip title={`ฝั่งบน · ${displayBotName}`} cards={displayBotDeckCards} tone="top" onPreview={setSpectatorPreviewCard} />
              <CompactBattleBoard
                cardsByNo={cardsByNo}
                lockedFight={displayLockedFight}
                player={displayPlayer}
                revealed={displayRevealed}
                activeTurn={displayActiveTurn}
                matchScore={displayMatchScore}
                fightNo={displayFightNo}
                fightScore={displayFightScore}
                playerDeckLeft={Math.max(0, displayPlayerDeckCards.length)}
                botDeckLeft={Math.max(0, displayBotDeckCards.length)}
                playerGraveCards={playerGraveCards}
                botGraveCards={botGraveCards}
                playerName={displayPlayerName}
                botName={displayBotName}
                playerImage={displayPlayerImage}
                botImage={displayBotImage}
                placementLane={placementLane}
                timeLeft={displayTimeLeft}
                turnLocked={displayTurnLocked}
                pendingSkillChoice={pendingSkillChoice}
                waitingSkillChoice={waitingSkillChoice}
                revealAllCards={isSpectator}
                randomCard={randomDrawCard}
                blessingAuras={displayBlessingAuras}
                onSelectSkillTarget={(target) =>
                  setPendingSkillChoice((current) => (current ? { ...current, selectedTarget: target } : current))
                }
                onConfirmSkillTarget={confirmSkillTarget}
                onDrawRandomCard={() => {
                  void drawRandomCard();
                }}
                onSelectLane={setPlacementLane}
                onPlaceCard={(lane, cardNo) => {
                  setPlacementLane(lane);
                  setPlayerLane(lane, cardNo);
                }}
              />
              <SpectatorDeckStrip title={`ฝั่งล่าง · ${displayPlayerName}`} cards={displayPlayerDeckCards} tone="bottom" onPreview={setSpectatorPreviewCard} />
            </div>
          ) : (
            <CompactBattleBoard
              cardsByNo={cardsByNo}
              lockedFight={displayLockedFight}
              player={displayPlayer}
              revealed={displayRevealed}
              activeTurn={displayActiveTurn}
              matchScore={displayMatchScore}
              fightNo={displayFightNo}
              fightScore={displayFightScore}
              playerDeckLeft={Math.max(0, displayPlayerDeckCards.length)}
              botDeckLeft={Math.max(0, displayBotDeckCards.length)}
              playerGraveCards={playerGraveCards}
              botGraveCards={botGraveCards}
              playerName={displayPlayerName}
              botName={displayBotName}
              playerImage={displayPlayerImage}
              botImage={displayBotImage}
              placementLane={placementLane}
              timeLeft={displayTimeLeft}
              turnLocked={displayTurnLocked}
              pendingSkillChoice={pendingSkillChoice}
              waitingSkillChoice={waitingSkillChoice}
              revealAllCards={isSpectator}
              randomCard={randomDrawCard}
              blessingAuras={displayBlessingAuras}
              onSelectSkillTarget={(target) =>
                setPendingSkillChoice((current) => (current ? { ...current, selectedTarget: target } : current))
              }
              onConfirmSkillTarget={confirmSkillTarget}
              onDrawRandomCard={() => {
                void drawRandomCard();
              }}
              onSelectLane={setPlacementLane}
              onPlaceCard={(lane, cardNo) => {
                setPlacementLane(lane);
                setPlayerLane(lane, cardNo);
              }}
            />
          )}
          <BlessingChoiceOverlay card={pendingBlessingChoice ? cardsByNo.get("254") : undefined} onChoose={chooseBlessing} />

          {!isSpectator ? (
            <PlayerHand
              cards={playerDeckCards}
              usedSet={usedPlayerSet}
              player={player}
              placementLane={placementLane}
              activeLane={laneForTurn(activeTurn)}
              locked={turnLocked || matchDone}
              highlightCardNo={displayRandomDrawCardNo}
              onSelectLane={setPlacementLane}
              onPlayCard={placeCardFromHand}
              onDropToLane={(lane, cardNo) => {
                setPlacementLane(lane);
                setPlayerLane(lane, cardNo);
              }}
            />
          ) : null}

          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-stretch">
              <div className="rounded-xl border border-white/8 bg-black/24 p-4">
                {matchDone ? (
                  <div className="flex items-center gap-3">
                    <Trophy className="h-7 w-7 text-amber-300" />
                    <div>
                      <div className="text-2xl font-black">{winnerText}</div>
                      <div className="text-sm font-semibold text-white/52">
                        คะแนนรวม {displayMatchScore.player}-{displayMatchScore.bot}
                      </div>
                    </div>
                  </div>
                ) : displayCurrentResult && activeTurnScored ? (
                  <div>
                    <ResultBanner result={displayCurrentResult} activeTurn={displayActiveTurn} />
                    <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-amber-200/20 bg-amber-200/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-amber-100">
                      ตาถัดไปอัตโนมัติใน {Math.floor(resultTimeLeft / 60)}:{String(resultTimeLeft % 60).padStart(2, "0")}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-lg font-black">
                      <Flame className="h-5 w-5 text-amber-300" />
                      {canRevealTurn ? "พร้อมเปิดการ์ด" : `รอล็อกการ์ดตาที่ ${displayActiveTurn}`}
                    </div>
                    <div className="text-sm font-semibold text-white/52">
                      {canRevealTurn
                        ? revealButtonLabel
                        : "เลือกการ์ด 1 ใบสำหรับตานี้ ก่อนกดล็อกยังเปลี่ยนได้"}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 md:justify-end">
                {matchDone ? (
                  isPvpRoom ? (
                    <div className="grid min-w-[220px] grid-cols-1 gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={continueRoomBattle}
                        disabled={!isRoomController}
                        className="inline-flex h-full min-h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 text-sm font-black text-black transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-black/35 md:flex-none"
                      >
                        <RotateCcw className="h-4 w-4" />
                        สู้ต่อ
                      </button>
                      <button
                        type="button"
                        onClick={disbandRoom}
                        disabled={!isRoomHost}
                        className="inline-flex h-full min-h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-black transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-white/32 md:flex-none"
                      >
                        ยุบห้อง
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={resetBattle}
                      className="inline-flex h-full min-h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-black transition hover:bg-amber-100 md:flex-none"
                    >
                      <RotateCcw className="h-4 w-4" />
                      เริ่มใหม่
                    </button>
                  )
                ) : !isSpectator && (!isPvpRoom || isRoomController) && displayTurnLocked && displayLockedFight && displayRevealed[3].scored ? (
                  <button
                    type="button"
                    onClick={nextFight}
                    className="inline-flex h-full min-h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-black transition hover:bg-amber-100 md:flex-none"
                  >
                    {displayFightNo >= 3 ? "จบเกม" : "รอบถัดไป"}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : !isSpectator && (!isPvpRoom || isRoomController) && displayTurnLocked && displayLockedFight && activeTurnScored && displayActiveTurn < 3 ? (
                  <button
                    type="button"
                    onClick={nextTurn}
                    className="inline-flex h-full min-h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-black transition hover:bg-amber-100 md:flex-none"
                  >
                    ตาถัดไป
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <>
                    {!displayTurnLocked && !displayCurrentResult ? (
                      <button
                        type="button"
                        onClick={lockFight}
                        disabled={matchDone || isSpectator}
                        className="inline-flex h-full min-h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 text-sm font-black text-black transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-black/35 md:flex-none"
                      >
                        <Brain className="h-4 w-4" />
                        ล็อกการ์ด
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={revealNext}
                      disabled={isSpectator || !canRevealTurn || !displayLockedFight || activeTurnScored}
                      className="inline-flex h-full min-h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-black transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-white/32 md:flex-none"
                    >
                      {revealButtonLabel}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
          </div>

          {displayCurrentResult && activeTurnScored ? (
            <div className="hidden gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-emerald-300/16 bg-emerald-300/[0.05] p-4">
                <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-100/70">
                  วิธีคิดคะแนนเรา
                </div>
                {displayCurrentResult.playerBreakdown.map((line) => (
                  <div key={line} className="text-sm font-semibold leading-6 text-white/62">
                    {line}
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-rose-300/16 bg-rose-300/[0.05] p-4">
                <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-rose-100/70">
                  วิธีคิดคะแนนคู่แข่ง
                </div>
                {displayCurrentResult.opponentBreakdown.map((line) => (
                  <div key={line} className="text-sm font-semibold leading-6 text-white/62">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <aside className="flex min-h-0 flex-col gap-3 overflow-visible">
          <FighterPanel
            name={displayBotName}
            image={displayBotImage}
            score={displayMatchScore.bot}
            tone="bot"
            deckLeft={Math.max(0, displayBotDeckCards.length)}
            side="left"
          />

          <div className="min-h-0 rounded-xl border border-white/8 bg-white/[0.035] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-white">
              <Trophy className="h-4 w-4 text-amber-300" />
              บันทึกการต่อสู้
            </div>
            <div className="max-h-[320px] space-y-2 overflow-auto pr-1">
              {displayBattleLog.length > 0 ? (
                displayBattleLog.map((line, index) => (
                  <div key={`${line}-${index}`} className="rounded-lg border border-white/8 bg-black/22 p-3 text-xs font-semibold leading-5 text-white/58">
                    {line}
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-white/8 bg-black/22 p-3 text-sm font-semibold text-white/42">
                  ยังไม่มีเหตุการณ์
                </div>
              )}
            </div>
          </div>

          <div className="hidden rounded-xl border border-white/8 bg-white/[0.035] p-4 xl:block">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-white">
              <Bot className="h-4 w-4 text-cyan-200" />
              เด็คคู่แข่ง
            </div>
            <div className="grid grid-cols-3 gap-2">
              {botDeckCards.map((card) => {
                const used = usedBotSet.has(card.cardNo);
                return (
                  <div key={card.cardNo} className={`rounded-lg border p-2 text-center text-xs font-black ${used ? "border-white/8 bg-white/5 text-white/24" : "border-cyan-300/18 bg-cyan-300/8 text-white/70"}`}>
                    {used ? "ใช้แล้ว" : "ล็อกแล้ว"}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-auto pb-16 xl:pb-20">
          <FighterPanel
            name={displayPlayerName}
            image={displayPlayerImage}
            score={displayMatchScore.player}
            tone="player"
            deckLeft={Math.max(0, displayPlayerDeckCards.length)}
            side="left"
          />
          </div>
        </aside>
      </section>
    </main>
  );
}
