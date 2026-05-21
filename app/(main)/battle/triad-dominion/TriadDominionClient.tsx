"use client";

import Image from "next/image";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Brain,
  Check,
  ChevronRight,
  Crown,
  Eye,
  Flame,
  KeyRound,
  Layers3,
  Lock,
  Plus,
  RotateCcw,
  Search,
  Shield,
  Sparkles,
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
  type TriadTriangle,
  type TriadTurn,
  type TriadTurnResult,
} from "@/lib/triad-dominion";

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
  triangles: Record<RoomPlayerSide, TriadTriangle>;
  turns: TriadTurnResult[];
  activeTurn: TriadTurn;
  fightNo: number;
  turnStartedAt: number;
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

const DECK_SIZE = 9;
const TURN_SECONDS = 120;
const SPECTATOR_LIMIT = 10;
const ROOM_API_PATH = "/api/triad-rooms";
const LOBBY_SYNC_MS = 800;
const ACTIVE_ROOM_SYNC_MS = 220;
const HIDDEN_SYNC_MS = 1200;
const MIN_SYNC_GAP_MS = 80;

type PendingSkillChoice = {
  side: Side;
  lane: Lane;
  cardNo: string;
  selectedTarget: "player-top" | "bot-top" | "";
};

type SkillTargetId = Exclude<PendingSkillChoice["selectedTarget"], "">;

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

function getParticipantId(baseId: string) {
  if (typeof window === "undefined") return baseId || "triad-local-player";
  const key = "nexora:triad-dominion:participant-id";
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const next = `${baseId || "triad"}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  window.sessionStorage.setItem(key, next);
  return next;
}

function makeParticipant(user: Props["currentUser"]): RoomParticipant {
  return {
    id: getParticipantId(user.id),
    name: safeText(user.name) || "ผู้เล่น",
    image: safeText(user.image) || "/avatar.png",
    joinedAt: Date.now(),
  };
}

function participantInRoom(room: TriadRoom | undefined, participantId: string) {
  if (!room) return false;
  return (
    room.seats.host?.id === participantId ||
    room.seats.challenger?.id === participantId ||
    room.spectators.some((viewer) => viewer.id === participantId)
  );
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
        createdAt: Number(room?.createdAt || Date.now()),
        updatedAt: Number(room?.updatedAt || Date.now()),
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
  const triangles = raw.triangles && typeof raw.triangles === "object" ? (raw.triangles as Record<string, unknown>) : {};
  const activeTurn = Number(raw.activeTurn || 1);
  const cleanDeck = (deck: unknown) => Array.isArray(deck) ? deck.map((item) => safeText(item)).filter(Boolean).slice(0, DECK_SIZE) : [];
  return {
    decks: {
      host: cleanDeck(decks.host),
      challenger: cleanDeck(decks.challenger),
    },
    triangles: {
      host: { top: "", left: "", right: "", ...((triangles.host as TriadTriangle | undefined) || {}) },
      challenger: { top: "", left: "", right: "", ...((triangles.challenger as TriadTriangle | undefined) || {}) },
    },
    turns: Array.isArray(raw.turns) ? (raw.turns as TriadTurnResult[]) : [],
    activeTurn: activeTurn === 2 || activeTurn === 3 ? activeTurn : 1,
    fightNo: Math.max(1, Math.min(4, Number(raw.fightNo || 1))),
    turnStartedAt: Number(raw.turnStartedAt || Date.now()),
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
}: {
  turn: TriadTurn;
  player: TriadTriangle;
  bot: TriadTriangle;
  botDeckCards: CardView[];
}) {
  const lane = laneForTurn(turn);
  const alreadyPlaced = new Set([bot.top, bot.left, bot.right].filter(Boolean));
  const playableCards = botDeckCards.filter((card) => {
    if (alreadyPlaced.has(card.cardNo)) return false;
    return lane === "top" ? card.kind === "monster" : card.kind === "monster" || card.kind === "skill";
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

function skillNeedsChoice(card?: CardView) {
  return Boolean(card?.kind === "skill" && /เลือก|choose|target/i.test(card.skillText));
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
  onClick,
}: {
  card: CardView;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled && !selected}
      className={`group relative min-w-0 overflow-hidden rounded-xl border bg-black/50 text-left shadow-[0_18px_48px_rgba(0,0,0,0.32)] transition hover:-translate-y-1 hover:border-amber-300/60 disabled:cursor-not-allowed disabled:opacity-35 ${
        selected ? "border-amber-300 ring-2 ring-amber-300/30" : "border-white/10"
      }`}
    >
      <div className="relative aspect-[3/4]">
        <Image src={card.sourceImage} alt={card.name} fill sizes="180px" className="object-cover" />
        {selected ? (
          <div className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-amber-300 text-black">
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
  score,
  tone,
  deckLeft,
  side,
}: {
  name: string;
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
        <Image src="/avatar.png" alt={name} width={72} height={72} className="h-16 w-16 object-contain" />
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
    <div className="rounded-xl border border-amber-200/14 bg-[#17110a]/84 p-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
      <div className="grid grid-cols-5 gap-1">
        {steps.map(([label, value]) => (
          <div
            key={label}
            className={`rounded-lg px-2 py-2 text-center text-[10px] font-black uppercase tracking-[0.14em] sm:text-xs ${
              value === activeTurn ? "bg-amber-200 text-black shadow-[0_0_22px_rgba(251,191,36,0.28)]" : "text-amber-100/32"
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
  label,
  tone,
}: {
  card?: CardView;
  hidden?: boolean;
  active?: boolean;
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
      className={`relative w-[clamp(64px,9.2vw,128px)] overflow-hidden rounded-[10px] border bg-[#09090d] shadow-[0_18px_42px_rgba(0,0,0,0.42)] ${active ? "ring-2 ring-amber-300/70" : ""} ${border}`}
    >
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
}: {
  label: string;
  sublabel: string;
  tone: "red" | "blue" | "gold";
  rotate?: boolean;
  cards?: CardView[];
}) {
  const color =
    tone === "red"
      ? "border-red-500/70"
      : tone === "blue"
        ? "border-cyan-400/70"
        : "border-amber-400/70";

  return (
    <div
      className={`relative grid w-[clamp(54px,7vw,94px)] place-items-center overflow-hidden rounded-lg border bg-[#08080c] shadow-[0_16px_34px_rgba(0,0,0,0.36)] ${color} ${
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
    </div>
  );
}

function RevealSpotlight({
  playerCard,
  botCard,
  showPlayer,
  showBot,
  result,
}: {
  playerCard?: CardView;
  botCard?: CardView;
  showPlayer: boolean;
  showBot: boolean;
  result?: TriadTurnResult;
}) {
  if (!showPlayer && !showBot) return null;

  const isScored = Boolean(result && showPlayer && showBot);
  const playerWins = result?.winner === "player";
  const botWins = result?.winner === "opponent";
  const skillCard = [playerCard, botCard].find((card) => card?.kind === "skill");
  const skillEvent = result?.skillEvents?.[0];
  const skillText = skillEvent?.summary || skillCard?.skillText || "";
  const isSwapSkill = skillEvent?.type === "swap-control";

  return (
    <div className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-[radial-gradient(circle_at_50%_45%,rgba(255,255,255,0.16),rgba(0,0,0,0.48)_36%,rgba(0,0,0,0.76)_78%)] backdrop-blur-sm">
      <div className="absolute inset-x-[12%] top-1/2 h-px bg-gradient-to-r from-transparent via-cyan-200/80 to-transparent shadow-[0_0_34px_rgba(34,211,238,0.75)]" />
      <div className="relative grid w-[min(760px,92%)] items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
        <div className={`mx-auto w-[clamp(92px,17vw,178px)] ${playerWins ? "scale-105" : botWins ? "opacity-65" : ""}`}>
          {showPlayer && playerCard ? (
            <div className={`animate-[triad-card-pop_520ms_ease-out] rounded-[14px] border bg-black p-1 ${playerCard.kind === "skill" ? "border-violet-200/80 shadow-[0_0_58px_rgba(168,85,247,0.75)]" : "border-red-200/70 shadow-[0_0_45px_rgba(248,113,113,0.55)]"}`}>
              {playerCard.kind === "skill" ? <div className="absolute inset-x-0 -bottom-3 h-10 rounded-full bg-violet-400/50 blur-xl" /> : null}
              <div className="relative aspect-[3/4] overflow-hidden rounded-[10px]">
                <Image src={playerCard.sourceImage} alt={playerCard.name} fill sizes="180px" className="object-cover" />
              </div>
            </div>
          ) : null}
        </div>

        <div className="text-center">
          <div className="animate-[triad-flash_900ms_ease-out] text-[clamp(2rem,5vw,4.8rem)] font-black uppercase leading-none text-white drop-shadow-[0_0_22px_rgba(255,255,255,0.75)]">
            {isSwapSkill ? "สลับ!" : isScored ? (result?.winner === "draw" ? "เสมอ" : playerWins ? "เรา +1" : "คู่แข่ง +1") : "เปิดการ์ด"}
          </div>
          {isScored ? (
            <div className="mt-2 rounded-full border border-amber-200/50 bg-black/70 px-4 py-2 text-[clamp(1rem,2vw,1.45rem)] font-black text-amber-100 shadow-[0_0_34px_rgba(251,191,36,0.35)]">
              {result?.playerTotal.toLocaleString()} <span className="text-white/45">ปะทะ</span> {result?.opponentTotal.toLocaleString()}
            </div>
          ) : null}
        </div>

        <div className={`mx-auto w-[clamp(92px,17vw,178px)] ${botWins ? "scale-105" : playerWins ? "opacity-65" : ""}`}>
          {showBot && botCard ? (
            <div className={`animate-[triad-card-pop_520ms_ease-out] rounded-[14px] border bg-black p-1 ${botCard.kind === "skill" ? "border-violet-200/80 shadow-[0_0_58px_rgba(168,85,247,0.75)]" : "border-cyan-200/70 shadow-[0_0_45px_rgba(34,211,238,0.55)]"}`}>
              {botCard.kind === "skill" ? <div className="absolute inset-x-0 -bottom-3 h-10 rounded-full bg-violet-400/50 blur-xl" /> : null}
              <div className="relative aspect-[3/4] overflow-hidden rounded-[10px]">
                <Image src={botCard.sourceImage} alt={botCard.name} fill sizes="180px" className="object-cover" />
              </div>
            </div>
          ) : null}
        </div>
      </div>
      {skillCard ? (
        <div className="absolute bottom-[8%] max-w-[min(720px,88%)] animate-[triad-flash_900ms_ease-out] rounded-2xl border border-violet-200/35 bg-black/74 px-5 py-3 text-center shadow-[0_0_40px_rgba(168,85,247,0.35)]">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-violet-200/70">
            {isSwapSkill ? "สลับมอนสเตอร์หลักแล้ว" : "สกิลทำงานแล้ว"}
          </div>
          <div className="mt-1 text-lg font-black text-white">{skillEvent?.name || skillCard.name}</div>
          <div className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-white/68">
            {skillText || "ระบบกำลังจัดการผลสกิลของการ์ดนี้"}
          </div>
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
  onSlotClick?: (lane: Lane) => void;
  onDropCard?: (lane: Lane, cardNo: string) => void;
  selectedLane?: Lane;
}) {
  const lanes: { lane: Lane; label: string; className: string }[] = [
    {
      lane: "top",
      label: "หลัก",
      className: `col-span-2 mx-auto w-[clamp(56px,7.6vw,104px)] ${tone === "bot" ? "translate-y-2" : "-translate-y-2"}`,
    },
    {
      lane: "left",
      label: "โจมตี",
      className: `w-[clamp(54px,7vw,96px)] ${tone === "bot" ? "-translate-y-2" : "translate-y-2"}`,
    },
    {
      lane: "right",
      label: "ช่วย",
      className: `w-[clamp(54px,7vw,96px)] ${tone === "bot" ? "-translate-y-2" : "translate-y-2"}`,
    },
  ];

  return (
    <div className={`grid grid-cols-2 items-end justify-items-center gap-x-[clamp(10px,1.5vw,22px)] gap-y-0 ${tone === "player" ? "-translate-y-5" : "translate-y-5"}`}>
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
  onClick,
  onDropToLane,
}: {
  card: CardView;
  used: boolean;
  placedLane?: Lane;
  disabled: boolean;
  onClick: () => void;
  onDropToLane: (lane: Lane, cardNo: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      draggable={!disabled && !used}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", card.cardNo);
        event.dataTransfer.effectAllowed = "move";
      }}
      onPointerUp={(event) => {
        if (disabled || used) return;
        const target = document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest<HTMLElement>("[data-triad-lane]");
        const lane = target?.dataset.triadLane as Lane | undefined;
        if (lane) onDropToLane(lane, card.cardNo);
      }}
      disabled={disabled || used}
      className={`group relative min-w-[64px] flex-1 touch-none overflow-hidden rounded-xl border bg-black/60 text-left shadow-[0_16px_34px_rgba(0,0,0,0.36)] transition sm:min-w-[76px] ${
        used
          ? "border-white/8 opacity-25"
          : placedLane
            ? "border-amber-300/70 opacity-55"
            : "border-white/14 hover:-translate-y-2 hover:border-amber-200/70"
      }`}
    >
      <div className="relative aspect-[3/4]">
        <Image src={card.sourceImage} alt={card.name} fill sizes="110px" className="object-cover" />
      </div>
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
  onSelectLane: (lane: Lane) => void;
  onPlayCard: (cardNo: string) => void;
  onDropToLane: (lane: Lane, cardNo: string) => void;
}) {
  const placedByNo = new Map<string, Lane>();
  (["top", "left", "right"] as Lane[]).forEach((lane) => {
    const cardNo = player[lane];
    if (cardNo) placedByNo.set(cardNo, lane);
  });

  return (
    <div className="rounded-xl border border-white/8 bg-black/28 p-2 shadow-[0_18px_48px_rgba(0,0,0,0.32)]">
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
      <div className="flex min-h-0 gap-2 overflow-x-auto pb-1">
        {cards.map((card) => (
          <HandCard
            key={card.cardNo}
            card={card}
            used={usedSet.has(card.cardNo)}
            placedLane={placedByNo.get(card.cardNo)}
            disabled={locked}
            onClick={() => onPlayCard(card.cardNo)}
            onDropToLane={onDropToLane}
          />
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
}: {
  label: string;
  participant: RoomParticipant | null;
  isLeader?: boolean;
  tone: "host" | "challenger";
  emptyText: string;
  canTake: boolean;
  onTake: () => void;
}) {
  const toneClass =
    tone === "host"
      ? "border-amber-300/28 bg-amber-300/[0.08]"
      : "border-cyan-300/24 bg-cyan-300/[0.07]";

  return (
    <div className={`min-h-[170px] rounded-xl border p-4 ${toneClass}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/45">{label}</div>
        <Swords className={`h-4 w-4 ${tone === "host" ? "text-amber-200" : "text-cyan-200"}`} />
      </div>
      {participant ? (
        <div className="flex items-center gap-3">
          <Image src={participant.image || "/avatar.png"} alt={participant.name} width={54} height={54} className="h-14 w-14 rounded-xl object-cover" />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <div className="truncate text-lg font-black text-white">{participant.name}</div>
              {isLeader ? (
                <span className="inline-grid h-7 w-7 shrink-0 place-items-center rounded-full border border-amber-200/45 bg-amber-300 text-black shadow-[0_0_22px_rgba(251,191,36,0.35)]" title="หัวห้อง">
                  <Crown className="h-4 w-4" />
                </span>
              ) : null}
            </div>
            <div className="mt-1 text-xs font-bold text-white/42">พร้อมลงสนาม</div>
          </div>
        </div>
      ) : (
        <div>
          <div className="text-lg font-black text-white/58">{emptyText}</div>
          <div className="mt-2 text-sm font-semibold leading-5 text-white/42">ถ้าช่องว่าง ผู้ชมสามารถลงมาเล่นแทนได้</div>
          {canTake ? (
            <button
              type="button"
              onClick={onTake}
              className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-white px-4 text-xs font-black uppercase tracking-[0.12em] text-black transition hover:bg-amber-100"
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
    <div className="rounded-xl border border-white/8 bg-white/[0.035] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-black text-white">
          <Eye className="h-4 w-4 text-violet-200" />
          ผู้ชม {spectators.length}/{SPECTATOR_LIMIT}
        </div>
        {canWatch ? (
          <button
            type="button"
            onClick={onWatch}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-violet-200/30 bg-violet-200/10 px-3 text-xs font-black text-violet-100 transition hover:border-violet-100/60"
          >
            นั่งชม
          </button>
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {Array.from({ length: SPECTATOR_LIMIT }).map((_, index) => {
          const spectator = spectators[index];
          return (
            <div key={spectator?.id || index} className="flex min-h-11 items-center gap-2 rounded-lg border border-white/8 bg-black/22 px-3">
              <div className={`grid h-6 w-6 place-items-center rounded-md text-[10px] font-black ${spectator ? "bg-violet-200 text-black" : "bg-white/8 text-white/28"}`}>
                {index + 1}
              </div>
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

  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-black/72 px-4 backdrop-blur-md">
      <div className="w-[min(820px,94%)] rounded-3xl border border-violet-200/30 bg-[#08070d]/96 p-4 shadow-[0_0_80px_rgba(168,85,247,0.35)] sm:p-6">
        <div className="text-center">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-violet-200/70">เลือกเป้าหมายสกิล</div>
          <div className="mt-1 text-2xl font-black uppercase text-white">{card.name}</div>
          <div className="mx-auto mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/62">{card.skillText}</div>
          <div className="mt-3 text-lg font-black text-amber-200">
            {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {targets.map((target) => (
            <button
              key={target.id}
              type="button"
              onClick={() => onSelect(target.id)}
              className={`rounded-2xl border bg-black/42 p-3 text-left transition hover:-translate-y-1 ${
                selectedTarget === target.id ? "border-amber-300 shadow-[0_0_34px_rgba(251,191,36,0.28)]" : target.tone
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
          onClick={onConfirm}
          disabled={!selectedTarget}
          className="mt-5 h-12 w-full rounded-2xl bg-violet-300 text-sm font-black uppercase tracking-[0.14em] text-black transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-white/30"
        >
          ยืนยันเป้าหมาย
        </button>
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
  placementLane,
  timeLeft,
  turnLocked,
  pendingSkillChoice,
  revealAllCards = false,
  onSelectSkillTarget,
  onConfirmSkillTarget,
  onSelectLane,
  onPlaceCard,
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
  placementLane: Lane;
  timeLeft: number;
  turnLocked: boolean;
  pendingSkillChoice: PendingSkillChoice | null;
  revealAllCards?: boolean;
  onSelectSkillTarget: (target: PendingSkillChoice["selectedTarget"]) => void;
  onConfirmSkillTarget: () => void;
  onSelectLane: (lane: Lane) => void;
  onPlaceCard: (lane: Lane, cardNo: string) => void;
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

  return (
    <div className="relative h-full min-h-[340px] overflow-hidden rounded-[18px] border border-amber-100/14 bg-[#0a0908] shadow-[0_28px_90px_rgba(0,0,0,0.55)] sm:min-h-[430px] xl:min-h-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(251,191,36,0.12),transparent_20%),radial-gradient(circle_at_20%_30%,rgba(124,58,237,0.18),transparent_16%),radial-gradient(circle_at_78%_70%,rgba(14,165,233,0.14),transparent_18%),repeating-linear-gradient(90deg,rgba(255,255,255,0.03)_0,rgba(255,255,255,0.03)_1px,transparent_1px,transparent_42px),linear-gradient(180deg,#171008,#050506)]" />
      <div className="absolute inset-x-0 top-0 h-[13%] border-b border-amber-100/20 bg-[linear-gradient(180deg,rgba(255,244,214,0.34),rgba(0,0,0,0.18))]" />
      <div className="absolute inset-x-0 bottom-0 h-[13%] border-t border-amber-100/20 bg-[linear-gradient(0deg,rgba(255,244,214,0.34),rgba(0,0,0,0.18))]" />
      <div className="absolute left-1/2 top-0 h-full w-[9%] -translate-x-1/2 border-x border-amber-100/14 bg-black/20" />
      <RevealSpotlight
        playerCard={playerTriangle[activeLane] ? cardsByNo.get(playerTriangle[activeLane]) : undefined}
        botCard={botTriangle[activeLane] ? cardsByNo.get(botTriangle[activeLane]) : undefined}
        showPlayer={playerVisible(activeLane)}
        showBot={botVisible(activeLane)}
        result={currentResult && revealed[activeTurn]?.scored ? currentResult : undefined}
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

      <div className="relative grid h-full min-h-0 grid-rows-[7%_31%_1fr_31%_7%] px-[clamp(6px,1.2vw,18px)] py-[clamp(5px,0.9vw,12px)]">
        <div className="flex items-center justify-between gap-3">
          <div className="rounded-2xl border border-blue-300/18 bg-black/38 px-4 py-2">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-100/52">คู่แข่ง</div>
            <div className="text-lg font-black text-white">คู่แข่ง</div>
          </div>
          <div className="hidden rounded-2xl border border-white/10 bg-black/38 px-4 py-2 text-center sm:block">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/42">รอบสู้</div>
            <div className="text-2xl font-black text-white">{Math.min(fightNo, 3)} / 3</div>
          </div>
        </div>

        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <BoardPile label="ทิ้ง" sublabel={`${botGraveCards.length}`} tone="red" rotate cards={botGraveCards} />
          <BoardTriangle
            cardsByNo={cardsByNo}
            triangle={displayBotTriangle}
            activeLane={activeLane}
            tone="bot"
            isVisible={(lane) => botVisible(lane)}
            swapActive={hasSwapResult && showResolvedBoard}
          />
          <BoardPile label="เด็ค" sublabel={`${botDeckLeft}`} tone="blue" rotate />
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div />
          <div className="mx-auto w-full max-w-[720px]">
            <PhaseTrack activeTurn={activeTurn} />
            <div className="mt-2 text-center text-xs font-black uppercase tracking-[0.16em] text-amber-100/58">
              เกม {matchScore.player}-{matchScore.bot} / รอบ {fightScore.player}-{fightScore.bot} / เวลา {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
            </div>
          </div>
          <div />
        </div>

        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <BoardPile label="เด็ค" sublabel={`${playerDeckLeft}`} tone="blue" />
          <BoardTriangle
            cardsByNo={cardsByNo}
            triangle={displayPlayerTriangle}
            activeLane={activeLane}
            tone="player"
            isVisible={() => true}
            swapActive={hasSwapResult && showResolvedBoard}
            onSlotClick={canEditPlayerSlots ? (lane) => lane === activeLane && onSelectLane(lane) : undefined}
            onDropCard={canEditPlayerSlots ? (lane, cardNo) => lane === activeLane && onPlaceCard(lane, cardNo) : undefined}
            selectedLane={canEditPlayerSlots ? placementLane : undefined}
          />
          <BoardPile label="ทิ้ง" sublabel={`${playerGraveCards.length}`} tone="red" cards={playerGraveCards} />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="hidden rounded-2xl border border-white/10 bg-black/38 px-4 py-2 text-center sm:block">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/42">ตา</div>
            <div className="text-2xl font-black text-white">{activeTurn}</div>
          </div>
          <div className="rounded-2xl border border-red-300/18 bg-black/38 px-4 py-2 text-right">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-red-100/52">เรา</div>
            <div className="text-lg font-black text-white">เรา</div>
          </div>
        </div>
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

  const [participant] = useState(() => makeParticipant(currentUser));
  const [phase, setPhase] = useState<BattlePhase>("lobby");
  const [rooms, setRooms] = useState<TriadRoom[]>([]);
  const [activeRoomCode, setActiveRoomCode] = useState("");
  const [roomAccess, setRoomAccess] = useState<RoomAccess>("public");
  const [roomPassword, setRoomPassword] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [passwordRoom, setPasswordRoom] = useState<TriadRoom | null>(null);
  const [activeRoomSnapshot, setActiveRoomSnapshot] = useState<TriadRoom | null>(null);
  const activeRoomCodeRef = useRef("");
  const activeRoomSnapshotRef = useRef<TriadRoom | null>(null);
  const pvpTurnKeyRef = useRef("");
  const syncInFlightRef = useRef(false);
  const syncQueuedRef = useRef(false);
  const lastSyncAtRef = useRef(0);
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
  const [timeLeft, setTimeLeft] = useState(TURN_SECONDS);
  const [activeTurn, setActiveTurn] = useState<TriadTurn>(1);
  const [revealed, setRevealed] = useState<Record<TriadTurn, TurnReveal>>(emptyRevealState);
  const [lastTurnWinner, setLastTurnWinner] = useState<"player" | "bot" | "draw" | null>(null);
  const [fightNo, setFightNo] = useState(1);
  const [matchScore, setMatchScore] = useState({ player: 0, bot: 0 });
  const [battleLog, setBattleLog] = useState<string[]>([]);

  const playerDeckCards = playerDeck.map((cardNo) => cardsByNo.get(cardNo)).filter(Boolean) as CardView[];
  const botDeckCards = botDeck.map((cardNo) => cardsByNo.get(cardNo)).filter(Boolean) as CardView[];
  const usedPlayerSet = new Set(usedPlayerCards);
  const usedBotSet = new Set(usedBotCards);
  const availableBotCards = botDeckCards.filter((card) => !usedBotSet.has(card.cardNo));
  const currentResult = lockedFight?.turns.find((turn) => turn.turn === activeTurn);
  const fightScore = lockedFight ? getFightScore(lockedFight.turns, revealed) : { player: 0, bot: 0 };
  const playerGraveCards = gravePlayerCards.map((cardNo) => cardsByNo.get(cardNo)).filter(Boolean) as CardView[];
  const botGraveCards = graveBotCards.map((cardNo) => cardsByNo.get(cardNo)).filter(Boolean) as CardView[];
  const matchDone = fightNo > 3;
  const currentRoom = rooms.find((room) => room.code === activeRoomCode) || activeRoomSnapshot;
  const isRoomHost = Boolean(currentRoom && currentRoom.hostId === participant.id);
  const isSpectator = Boolean(currentRoom?.spectators.some((viewer) => viewer.id === participant.id));
  const isFieldPlayer = Boolean(
    currentRoom?.seats.host?.id === participant.id || currentRoom?.seats.challenger?.id === participant.id
  );
  const roomPlayerSide: RoomPlayerSide | null = currentRoom?.seats.host?.id === participant.id
    ? "host"
    : currentRoom?.seats.challenger?.id === participant.id
      ? "challenger"
      : null;
  const opponentSide: RoomPlayerSide | null = roomPlayerSide === "host" ? "challenger" : roomPlayerSide === "challenger" ? "host" : null;
  const isPvpRoom = Boolean(currentRoom && roomPlayerSide && opponentSide);
  const playerLabel = roomPlayerSide
    ? currentRoom?.seats[roomPlayerSide]?.name || "เรา"
    : "เรา";
  const opponentLabel = opponentSide
    ? currentRoom?.seats[opponentSide]?.name || "คู่แข่ง"
    : "คู่แข่ง";
  const winnerText =
    matchScore.player === matchScore.bot
      ? "เสมอกัน"
      : matchScore.player > matchScore.bot
        ? `${playerLabel} ชนะ`
        : `${opponentLabel} ชนะ`;

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

  const createRoom = async () => {
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
    if (!room) {
      setLobbyMessage("ไม่พบห้องนี้");
      return;
    }
    if (room.access === "private" && !passwordInput.trim() && room.hostId !== participant.id) {
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
      setLobbyMessage(result.payload?.reason === "wrong_password" ? "รหัสห้องไม่ถูกต้อง" : "เข้าห้องนี้ไม่ได้");
      return;
    }

    setPasswordRoom(null);
    setJoinPassword("");
    const joinedRoom = normalizeApiRooms(result.payload?.room ? [result.payload.room] : [])[0] || room;
    setActiveRoomSnapshot(joinedRoom);
    activeRoomSnapshotRef.current = joinedRoom;
    activeRoomCodeRef.current = code;
    setActiveRoomCode(code);
    setLobbyMessage(result.payload?.joinedAs === "spectator" ? "เข้ามาเป็นผู้ชมแล้ว" : "");
    setPhase("room");
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
    if (!currentRoom || !isRoomHost || !currentRoom.seats.host || !currentRoom.seats.challenger) return;
    const result = await postRoomAction({ action: "start", code: currentRoom.code });
    if (!result.ok) {
      setLobbyMessage("เจ้าของห้องเริ่มเกมได้เมื่อมีผู้เล่นครบ 2 ฝั่ง");
      return;
    }
    resetBattle();
    setPhase("deck");
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
    if (!currentRoom || !isRoomHost) return;
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
    if (currentRoom.status === "playing" && phase === "room") {
      setPhase(isSpectator ? "battle" : "deck");
    }
  }, [currentRoom, isSpectator, participant.id, phase]);

  useEffect(() => {
    if (!currentRoom || !roomPlayerSide || !opponentSide) return;
    const turnKey = `${currentRoom.code}:${currentRoom.game.fightNo}:${currentRoom.game.activeTurn}`;
    if (pvpTurnKeyRef.current && pvpTurnKeyRef.current !== turnKey) {
      setTurnLocked(false);
      setPendingSkillChoice(null);
      setTimeLeft(TURN_SECONDS);
      setRevealed(emptyRevealState());
      setLockedFight(null);
    }
    pvpTurnKeyRef.current = turnKey;
    const ownDeck = currentRoom.game.decks[roomPlayerSide];
    const enemyDeck = currentRoom.game.decks[opponentSide];
    if (ownDeck.length === DECK_SIZE) setPlayerDeck(ownDeck);
    if (enemyDeck.length === DECK_SIZE) setBotDeck(enemyDeck);
    const serverPlayerTriangle = currentRoom.game.triangles[roomPlayerSide];
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
    setLockedFight((current) => {
      if (mappedTurns.length === 0) return current;
      return {
        fightNo: currentRoom.game.fightNo,
        player: currentRoom.game.triangles[roomPlayerSide],
        bot: currentRoom.game.triangles[opponentSide],
        turns: mappedTurns,
      };
    });
    if (phase === "deck" && ownDeck.length === DECK_SIZE && enemyDeck.length === DECK_SIZE) {
      setPhase("battle");
      setBattleLog((current) => current.length ? current : ["ทั้งสองฝั่งล็อกเด็คแล้ว เริ่มสู้กันได้เลย"]);
    }
  }, [currentRoom, opponentSide, phase, roomPlayerSide]);

  const toggleDeckCard = (cardNo: string) => {
    setPlayerDeck((current) => {
      if (current.includes(cardNo)) return current.filter((item) => item !== cardNo);
      if (current.length >= DECK_SIZE) return current;
      return [...current, cardNo];
    });
  };

  const enterBattle = async () => {
    if (playerDeck.length !== DECK_SIZE) return;
    const monsterCount = playerDeckCards.filter((card) => card.kind === "monster").length;
    if (monsterCount < 3) {
      setBattleLog(["เด็คต้องมีมอนสเตอร์อย่างน้อย 3 ใบ เพื่อใช้เป็นการ์ดหลักของแต่ละรอบ"]);
      return;
    }

    if (currentRoom && roomPlayerSide && opponentSide) {
      const result = await postRoomAction({
        action: "set-deck",
        code: currentRoom.code,
        deck: playerDeck,
      });
      if (!result.ok) {
        setBattleLog(["ล็อกเด็คเข้าห้อง PvP ไม่ได้"]);
        return;
      }
      const room = normalizeApiRooms(result.payload?.room ? [result.payload.room] : [])[0] || currentRoom;
      const ownDeck = room.game.decks[roomPlayerSide];
      const enemyDeck = room.game.decks[opponentSide];
      setBotDeck(enemyDeck);
      if (ownDeck.length === DECK_SIZE && enemyDeck.length === DECK_SIZE) {
        setPhase("battle");
        setBattleLog(["ล็อกเด็คแล้ว สู้กับผู้เล่นอีกฝั่งได้เลย"]);
      } else {
        setBattleLog(["ล็อกเด็คแล้ว รออีกฝ่ายล็อกเด็ค"]);
      }
      return;
    }

    const nextBotDeck = chooseBotDeck(deckCatalog, playerDeck);
    setBotDeck(nextBotDeck);
    setPlayer({ top: "", left: "", right: "" });
    setPlacementLane("top");
    setTurnLocked(false);
    setPendingSkillChoice(null);
    setTimeLeft(TURN_SECONDS);
    setPhase("battle");
    setBattleLog(["ล็อกเด็คแล้ว เลือกการ์ดจากมือไปวางบนสนาม"]);
  };

  const resetBattle = () => {
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
    setTimeLeft(TURN_SECONDS);
    setActiveTurn(1);
    setRevealed(emptyRevealState());
    setLastTurnWinner(null);
    setFightNo(1);
    setMatchScore({ player: 0, bot: 0 });
    setBattleLog([]);
  };

  const setPlayerLane = (lane: Lane, cardNo: string) => {
    if (turnLocked || matchDone || usedPlayerSet.has(cardNo) || lane !== laneForTurn(activeTurn)) return;
    const card = cardsByNo.get(cardNo);
    if (lane === "top" && card?.kind !== "monster") {
      setBattleLog((current) => ["ตา 1 ต้องวางมอนสเตอร์เป็นการ์ดหลัก", ...current]);
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
    setPlayerLane(placementLane, cardNo);
  };

  const lockFight = () => {
    const lane = laneForTurn(activeTurn);
    if (!player[lane]) {
      setBattleLog((current) => [`เลือกการ์ด 1 ใบสำหรับตาที่ ${activeTurn} ก่อนกดล็อก`, ...current]);
      return;
    }

    if (currentRoom && roomPlayerSide && opponentSide) {
      void postRoomAction({
        action: "lock-card",
        code: currentRoom.code,
        cardNo: player[lane],
      }).then((result) => {
        if (!result.ok) {
          setBattleLog((current) => ["ล็อกการ์ดในห้อง PvP ไม่ได้", ...current]);
          return;
        }
        setTurnLocked(true);
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
    });
    const bot = { ...baseBot, [lane]: botCardNo };
    const playerCard = cardsByNo.get(player[lane] || "");
    if (playerCard && skillNeedsChoice(playerCard)) {
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
    if (!pendingSkillChoice || !lockedFight || !pendingSkillChoice.selectedTarget) return;
    const selectedTarget = pendingSkillChoice.selectedTarget;
    const skillCard = cardsByNo.get(pendingSkillChoice.cardNo);
    const selectableTargetIds = new Set(getSelectableSkillTargetIds(skillCard, pendingSkillChoice.side));
    if (!selectableTargetIds.has(selectedTarget)) {
      setPendingSkillChoice((current) => (current ? { ...current, selectedTarget: "" } : current));
      setBattleLog((current) => [
        `เป้าหมายสกิลไม่ถูกต้อง: ${selectedTarget} กรุณาเลือกเป้าหมายของ ${skillCard?.name || pendingSkillChoice.cardNo} ใหม่`,
        ...current,
      ]);
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
    setActiveTurn(1);
    setRevealed(emptyRevealState());
    setFightNo((current) => current + 1);
    setPlayer({ top: "", left: "", right: "" });
    setPlacementLane("top");
  };

  useEffect(() => {
    const pvpTurnResolved = Boolean(isPvpRoom && currentResult);
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
  }, [phase, matchDone, turnLocked, pendingSkillChoice, activeTurn, player, lockedFight, isPvpRoom, currentResult, currentRoom?.code, roomPlayerSide, opponentSide]);

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
    if (!isPvpRoom || !currentResult || pendingSkillChoice) return;
    setRevealed((current) => {
      const state = current[activeTurn];
      if (state.scored) return current;
      const next = {
        ...current,
        [activeTurn]: { ...state, player: true, bot: true },
      };
      return scoreTurnIfReady(activeTurn, next);
    });
  }, [activeTurn, currentResult, isPvpRoom, pendingSkillChoice]);

  const revealNext = () => {
    if (!lockedFight || !canRevealTurn || pendingSkillChoice || !currentResult) return;

    setRevealed((current) => {
      const state = current[activeTurn];
      let next = current;

      if (activeTurn === 1 || lastTurnWinner === null || lastTurnWinner === "draw") {
        next = {
          ...current,
          [activeTurn]: { ...state, player: true, bot: true },
        };
        return scoreTurnIfReady(activeTurn, next);
      }

      const firstSide: Side = lastTurnWinner === "bot" ? "bot" : "player";
      const secondSide: Side = firstSide === "bot" ? "player" : "bot";

      if (!state[firstSide]) {
        return {
          ...current,
          [activeTurn]: { ...state, [firstSide]: true },
        };
      }

      if (!state[secondSide]) {
        next = {
          ...current,
          [activeTurn]: { ...state, [secondSide]: true },
        };
        return scoreTurnIfReady(activeTurn, next);
      }

      return current;
    });
  };

  const nextTurn = () => {
    if (!lockedFight || activeTurn >= 3) return;
    if (currentRoom && isRoomHost) {
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
    setTurnLocked(false);
    setActiveTurn(nextActiveTurn);
    setPlacementLane(laneForTurn(nextActiveTurn));
    setTimeLeft(TURN_SECONDS);
  };

  const nextFight = () => {
    if (!lockedFight) return;
    if (currentRoom && isRoomHost) {
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
    setTimeLeft(TURN_SECONDS);
    setActiveTurn(1);
    setRevealed(emptyRevealState());
    setLastTurnWinner(null);
    setFightNo((current) => current + 1);
    setPlayer({ top: "", left: "", right: "" });
    setPlacementLane(nextAvailablePlayer.length > 0 ? "top" : placementLane);
  };

  const revealState = revealed[activeTurn];
  const activeTurnScored = Boolean(revealState?.scored);
  const canRevealTurn = turnLocked || Boolean(isPvpRoom && currentResult);
  const needsSecondReveal =
    lockedFight &&
    activeTurn > 1 &&
    lastTurnWinner !== null &&
    lastTurnWinner !== "draw" &&
    (revealState.player !== revealState.bot);
  const revealButtonLabel =
    !canRevealTurn
      ? "ล็อกการ์ดก่อน"
      : activeTurn === 1 || lastTurnWinner === null || lastTurnWinner === "draw"
        ? "เปิดทั้งสองฝั่ง"
        : needsSecondReveal
          ? "เปิดอีกฝั่ง"
          : lastTurnWinner === "bot"
            ? `${opponentLabel} เปิดก่อน`
            : `${playerLabel} เปิดก่อน`;

  if (phase === "lobby") {
    const visibleRooms = rooms
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 8);

    return (
      <main className="min-h-[calc(var(--app-shell-height)-var(--app-header-height)-var(--app-mobile-nav-height))] overflow-y-auto rounded-[24px] border border-white/8 bg-[#05070d] text-white shadow-[0_26px_90px_rgba(0,0,0,0.42)]">
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
        <section className="relative overflow-hidden border-b border-white/8 px-4 py-5 sm:px-6 lg:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(245,158,11,0.2),transparent_26%),radial-gradient(circle_at_82%_18%,rgba(34,211,238,0.18),transparent_24%),linear-gradient(180deg,#07111d,#05070d)]" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-amber-200">
                <Swords className="h-3.5 w-3.5" />
                ห้องแบทเทิลการ์ด
              </div>
              <h1 className="text-[clamp(2.1rem,8vw,5.8rem)] font-black uppercase leading-[0.9] tracking-normal">
                ล็อบบี้ต่อสู้
              </h1>
              <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-white/60 sm:text-base">
                สร้างห้อง เข้าห้องด้วยเลข 6 ตัว หรือเลือกนั่งชมก่อนเริ่มสู้ได้เลย
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:min-w-[420px]">
              {[
                ["ห้อง", rooms.length],
                ["ล็อก", rooms.filter((room) => room.access === "private").length],
                ["กำลังสู้", rooms.filter((room) => room.status === "playing").length],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/10 bg-black/28 p-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/38">{label}</div>
                  <div className="mt-1 text-2xl font-black text-white">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[360px_1fr] lg:p-8">
          <div className="space-y-4">
            <div className="rounded-xl border border-white/8 bg-white/[0.035] p-4">
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
                        ? "border-amber-300 bg-amber-300 text-black"
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
                    className="h-11 w-full rounded-xl border border-white/10 bg-black/36 px-3 text-sm font-bold text-white outline-none transition focus:border-amber-300/70"
                    placeholder="อย่างน้อย 4 ตัว"
                  />
                </label>
              ) : null}
              <button
                type="button"
                onClick={createRoom}
                className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-300 text-sm font-black uppercase tracking-[0.12em] text-black transition hover:bg-amber-200"
              >
                <Plus className="h-4 w-4" />
                สร้าง
              </button>
            </div>

            <div className="rounded-xl border border-white/8 bg-white/[0.035] p-4">
              <div className="mb-4 flex items-center gap-2 text-sm font-black text-white">
                <Search className="h-4 w-4 text-cyan-200" />
                ค้นหาห้อง
              </div>
              <input
                value={joinCode}
                onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                className="h-12 w-full rounded-xl border border-white/10 bg-black/36 px-3 text-center font-mono text-xl font-black tracking-[0.2em] text-white outline-none transition focus:border-cyan-200/70"
                placeholder="000000"
                inputMode="numeric"
              />
              <button
                type="button"
                onClick={() => enterRoom()}
                disabled={joinCode.length !== 6}
                className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-black uppercase tracking-[0.12em] text-black transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-white/28"
              >
                <KeyRound className="h-4 w-4" />
                เข้าห้อง
              </button>
            </div>
            {lobbyMessage ? (
              <div className="rounded-xl border border-rose-300/20 bg-rose-300/10 p-3 text-sm font-bold text-rose-100">
                {lobbyMessage}
              </div>
            ) : null}
          </div>

          <div className="rounded-xl border border-white/8 bg-white/[0.035] p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-black text-white">
                <Users className="h-4 w-4 text-emerald-200" />
                ห้องทั้งหมด
              </div>
              <div className="text-xs font-bold text-white/38">เห็นทั้งห้องสาธารณะและห้องล็อกรหัส</div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {visibleRooms.length > 0 ? visibleRooms.map((room) => (
                <div key={room.code} className="rounded-xl border border-white/8 bg-black/24 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-2xl font-black tracking-[0.18em] text-white">{room.code}</div>
                      <div className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-white/38">
                        {room.status === "playing" ? "กำลังสู้" : "รอเริ่ม"} • {room.seats.challenger ? "ผู้เล่น 2 คน" : "ผู้เล่น 1 คน"}
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
                    className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl bg-white text-xs font-black uppercase tracking-[0.12em] text-black transition hover:bg-emerald-100"
                  >
                    เข้าห้อง
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

    const canStart = isRoomHost && Boolean(currentRoom.seats.host && currentRoom.seats.challenger);
    const currentIsSpectator = currentRoom.spectators.some((viewer) => viewer.id === participant.id);

    return (
      <main className="min-h-[calc(var(--app-shell-height)-var(--app-header-height)-var(--app-mobile-nav-height))] overflow-y-auto rounded-[24px] border border-white/8 bg-[#05070d] text-white shadow-[0_26px_90px_rgba(0,0,0,0.42)]">
        <section className="relative overflow-hidden border-b border-white/8 px-4 py-5 sm:px-6 lg:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(245,158,11,0.2),transparent_24%),radial-gradient(circle_at_82%_20%,rgba(124,58,237,0.16),transparent_24%),linear-gradient(180deg,#07111d,#05070d)]" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-white/70">
                <KeyRound className="h-3.5 w-3.5" />
                ห้อง {currentRoom.code}
              </div>
              <h1 className="font-mono text-[clamp(2.4rem,9vw,6rem)] font-black leading-none tracking-[0.14em]">
                {currentRoom.code}
              </h1>
              <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-white/60">
                เจ้าของห้องเป็นคนกดเริ่มเกม คนที่เข้ามาหลังเกมเริ่มจะถูกนั่งเป็นผู้ชมอัตโนมัติ
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={leaveRoom}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-black/28 px-4 text-xs font-black uppercase tracking-[0.12em] text-white/64 transition hover:border-white/30"
              >
                ออกห้อง
              </button>
              <button
                type="button"
                onClick={startRoomGame}
                disabled={!canStart}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 text-xs font-black uppercase tracking-[0.12em] text-black transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-white/28"
              >
                <Swords className="h-4 w-4" />
                เริ่มเกม
              </button>
            </div>
          </div>
        </section>

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
            />
            <RoomSeatCard
              label="ฝั่งผู้ท้าชิง"
              participant={currentRoom.seats.challenger}
              isLeader={currentRoom.seats.challenger?.id === currentRoom.hostId}
              tone="challenger"
              emptyText="รอผู้ท้าชิง"
              canTake={currentIsSpectator && !currentRoom.seats.challenger}
              onTake={() => takeFieldSlot("challenger")}
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

          <SpectatorPanel
            spectators={currentRoom.spectators}
            currentId={participant.id}
            canWatch={!currentIsSpectator && currentRoom.status === "waiting"}
            onWatch={moveToSpectator}
          />
        </section>
      </main>
    );
  }

  if (phase === "deck") {
    return (
      <main className="min-h-[calc(var(--app-shell-height)-var(--app-header-height)-var(--app-mobile-nav-height))] overflow-y-auto rounded-[24px] border border-white/8 bg-[#050710] text-white shadow-[0_26px_90px_rgba(0,0,0,0.42)]">
        <section className="relative overflow-hidden border-b border-white/8 px-4 py-5 sm:px-6 lg:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(245,158,11,0.22),transparent_26%),radial-gradient(circle_at_80%_18%,rgba(34,211,238,0.18),transparent_24%),linear-gradient(180deg,#08111e,#050710)]" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-amber-200">
                <Layers3 className="h-3.5 w-3.5" />
                จัดเด็ค
              </div>
              <h1 className="text-[clamp(2.2rem,8vw,6rem)] font-black uppercase leading-[0.88] tracking-normal">
                เลือกเด็คของคุณ
              </h1>
              <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-white/60 sm:text-base">
                เลือกการ์ด 9 ใบสำหรับ 3 รอบสู้ การ์ดแต่ละใบใช้ได้ครั้งเดียวในเกมนี้
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/42">
                เลือกแล้ว
              </div>
              <div className="mt-1 text-5xl font-black text-white">
                {playerDeck.length}/{DECK_SIZE}
              </div>
              <button
                type="button"
                onClick={enterBattle}
                disabled={playerDeck.length !== DECK_SIZE}
                className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-300 px-4 text-sm font-black text-black transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-white/32"
              >
                เข้าสนาม
                <ChevronRight className="h-4 w-4" />
              </button>
              {currentRoom ? (
                <button
                  type="button"
                  onClick={leaveRoom}
                  className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-xl border border-white/10 bg-black/28 px-4 text-xs font-black uppercase tracking-[0.12em] text-white/64 transition hover:border-white/30"
                >
                  ออกห้อง
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <section className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[1fr_280px] lg:p-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {deckCatalog.map((card) => {
              const selected = playerDeck.includes(card.cardNo);
              const disabled = playerDeck.length >= DECK_SIZE && !selected;
              return (
                <DeckCard
                  key={card.cardNo}
                  card={card}
                  selected={selected}
                  disabled={disabled}
                  onClick={() => toggleDeckCard(card.cardNo)}
                />
              );
            })}
          </div>

          <aside className="rounded-2xl border border-white/8 bg-white/[0.035] p-4 lg:sticky lg:top-4 lg:self-start">
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
                  className="flex w-full items-center gap-3 rounded-xl border border-white/8 bg-black/24 p-2 text-left transition hover:border-amber-300/40"
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
      </main>
    );
  }

  return (
    <main className="relative min-h-[calc(var(--app-shell-height)-var(--app-header-height)-var(--app-mobile-nav-height))] overflow-y-auto rounded-[24px] border border-white/8 bg-[#06080d] text-white shadow-[0_26px_90px_rgba(0,0,0,0.42)] xl:h-[calc(var(--app-shell-height)-var(--app-desktop-chrome-height))] xl:min-h-0 xl:overflow-hidden">
      {currentRoom ? (
        <button
          type="button"
          onClick={leaveRoom}
          className="absolute right-4 top-4 z-20 inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-black/45 px-4 text-xs font-black uppercase tracking-[0.12em] text-white/70 backdrop-blur transition hover:border-white/30"
        >
          ออกห้อง
        </button>
      ) : null}
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
              ["เกม", `${matchScore.player}-${matchScore.bot}`],
              ["รอบ", Math.min(fightNo, 3)],
              ["เด็ค", `${playerDeck.length}/${DECK_SIZE}`],
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

      <section className="grid min-h-0 gap-2 p-2 sm:gap-3 sm:p-3 xl:h-full xl:grid-cols-[minmax(0,1fr)_210px]">
        <section className="grid min-h-0 grid-rows-[minmax(340px,1fr)_auto_auto] gap-2 sm:grid-rows-[minmax(430px,1fr)_auto_auto] sm:gap-3 xl:grid-rows-[minmax(0,1fr)_auto_auto]">
          <CompactBattleBoard
            cardsByNo={cardsByNo}
            lockedFight={lockedFight}
            player={player}
            revealed={revealed}
            activeTurn={activeTurn}
            matchScore={matchScore}
            fightNo={fightNo}
            fightScore={fightScore}
            playerDeckLeft={Math.max(0, playerDeck.length - usedPlayerCards.length)}
            botDeckLeft={Math.max(0, botDeck.length - usedBotCards.length)}
            playerGraveCards={playerGraveCards}
            botGraveCards={botGraveCards}
            placementLane={placementLane}
            timeLeft={timeLeft}
            turnLocked={turnLocked}
            pendingSkillChoice={pendingSkillChoice}
            revealAllCards={isSpectator}
            onSelectSkillTarget={(target) =>
              setPendingSkillChoice((current) => (current ? { ...current, selectedTarget: target } : current))
            }
            onConfirmSkillTarget={confirmSkillTarget}
            onSelectLane={setPlacementLane}
            onPlaceCard={(lane, cardNo) => {
              setPlacementLane(lane);
              setPlayerLane(lane, cardNo);
            }}
          />

          {isSpectator ? (
            <div className="rounded-xl border border-violet-200/18 bg-violet-200/[0.06] p-4">
              <div className="flex items-center gap-2 text-sm font-black text-violet-100">
                <Eye className="h-4 w-4" />
                โหมดผู้ชม
              </div>
              <div className="mt-2 text-sm font-semibold leading-6 text-white/54">
                คุณกำลังนั่งชม เห็นการ์ดทั้งสองฝั่ง แต่กดเล่นไม่ได้
              </div>
            </div>
          ) : (
            <PlayerHand
              cards={playerDeckCards}
              usedSet={usedPlayerSet}
              player={player}
              placementLane={placementLane}
              activeLane={laneForTurn(activeTurn)}
              locked={turnLocked || matchDone}
              onSelectLane={setPlacementLane}
              onPlayCard={placeCardFromHand}
              onDropToLane={(lane, cardNo) => {
                setPlacementLane(lane);
                setPlayerLane(lane, cardNo);
              }}
            />
          )}

          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-stretch">
              <div className="rounded-xl border border-white/8 bg-black/24 p-4">
                {matchDone ? (
                  <div className="flex items-center gap-3">
                    <Trophy className="h-7 w-7 text-amber-300" />
                    <div>
                      <div className="text-2xl font-black">{winnerText}</div>
                      <div className="text-sm font-semibold text-white/52">
                        คะแนนรวม {matchScore.player}-{matchScore.bot}
                      </div>
                    </div>
                  </div>
                ) : currentResult && activeTurnScored ? (
                  <ResultBanner result={currentResult} activeTurn={activeTurn} />
                ) : (
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-lg font-black">
                      <Flame className="h-5 w-5 text-amber-300" />
                      {canRevealTurn ? "พร้อมเปิดการ์ด" : `รอล็อกการ์ดตาที่ ${activeTurn}`}
                    </div>
                    <div className="text-sm font-semibold text-white/52">
                      {canRevealTurn
                        ? revealButtonLabel
                        : "เลือกการ์ด 1 ใบสำหรับตานี้ ก่อนกดล็อกยังเปลี่ยนได้"}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {matchDone ? (
                  isPvpRoom ? (
                    <div className="grid min-w-[220px] grid-cols-1 gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={continueRoomBattle}
                        disabled={!isRoomHost}
                        className="inline-flex h-full min-h-14 items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 text-sm font-black text-black transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-white/32"
                      >
                        <RotateCcw className="h-4 w-4" />
                        สู้ต่อ
                      </button>
                      <button
                        type="button"
                        onClick={disbandRoom}
                        disabled={!isRoomHost}
                        className="inline-flex h-full min-h-14 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-black transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-white/32"
                      >
                        ยุบห้อง
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={resetBattle}
                      className="inline-flex h-full min-h-14 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-black transition hover:bg-amber-100"
                    >
                      <RotateCcw className="h-4 w-4" />
                      เริ่มใหม่
                    </button>
                  )
                ) : !isSpectator && (!isPvpRoom || isRoomHost) && turnLocked && lockedFight && revealed[3].scored ? (
                  <button
                    type="button"
                    onClick={nextFight}
                    className="inline-flex h-full min-h-14 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-black transition hover:bg-amber-100"
                  >
                    {fightNo >= 3 ? "จบเกม" : "รอบถัดไป"}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : !isSpectator && (!isPvpRoom || isRoomHost) && turnLocked && lockedFight && activeTurnScored && activeTurn < 3 ? (
                  <button
                    type="button"
                    onClick={nextTurn}
                    className="inline-flex h-full min-h-14 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-black transition hover:bg-amber-100"
                  >
                    ตาถัดไป
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <>
                    {!turnLocked && !currentResult ? (
                      <button
                        type="button"
                        onClick={lockFight}
                        disabled={matchDone || isSpectator}
                        className="inline-flex h-full min-h-14 items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 text-sm font-black text-black transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-white/32"
                      >
                        <Brain className="h-4 w-4" />
                        ล็อกการ์ด
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={revealNext}
                      disabled={isSpectator || !canRevealTurn || !lockedFight || activeTurnScored}
                      className="inline-flex h-full min-h-14 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-black transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-white/32"
                    >
                      {revealButtonLabel}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
          </div>

          {currentResult && activeTurnScored ? (
            <div className="hidden gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-emerald-300/16 bg-emerald-300/[0.05] p-4">
                <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-100/70">
                  วิธีคิดคะแนนเรา
                </div>
                {currentResult.playerBreakdown.map((line) => (
                  <div key={line} className="text-sm font-semibold leading-6 text-white/62">
                    {line}
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-rose-300/16 bg-rose-300/[0.05] p-4">
                <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-rose-100/70">
                  วิธีคิดคะแนนคู่แข่ง
                </div>
                {currentResult.opponentBreakdown.map((line) => (
                  <div key={line} className="text-sm font-semibold leading-6 text-white/62">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <aside className="flex min-h-0 flex-col gap-4 overflow-hidden">
          <FighterPanel name={opponentLabel} score={matchScore.bot} tone="bot" deckLeft={Math.max(0, botDeck.length - usedBotCards.length)} side="left" />

          <div className="min-h-0 rounded-xl border border-white/8 bg-white/[0.035] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-white">
              <Trophy className="h-4 w-4 text-amber-300" />
              บันทึกการต่อสู้
            </div>
            <div className="max-h-[220px] space-y-2 overflow-auto pr-1">
              {battleLog.length > 0 ? (
                battleLog.map((line, index) => (
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
            <FighterPanel name={playerLabel} score={matchScore.player} tone="player" deckLeft={Math.max(0, playerDeck.length - usedPlayerCards.length)} side="left" />
          </div>
        </aside>
      </section>
    </main>
  );
}
