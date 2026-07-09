"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { Fragment, type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Check,
  Clock3,
  ChevronRight,
  Crosshair,
  Crown,
  Eye,
  Flame,
  Hand,
  House,
  KeyRound,
  Layers3,
  Lock,
  Loader2,
  MessageCircle,
  Plus,
  RotateCcw,
  Search,
  SendHorizontal,
  Shield,
  Smile,
  Sparkles,
  Scissors,
  Swords,
  Trophy,
  UserCheck,
  UserPlus,
  Users,
  X,
  Zap,
} from "lucide-react";
import ChatEmojiPicker from "@/components/ChatEmojiPicker";
import {
  resolveTriadTurn,
  triadCardByNo,
  triadSkillRuleByNo,
  type TriadCard,
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

const TRIAD_CARD_BACK_SRC = "/cards/card-backs/card-backs.png";

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

type CardPreviewMode = "hover" | "modal";

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

type TriadRankKey = "bronze" | "silver" | "gold" | "platinum" | "diamond" | "master" | "god-of-legends";

type TriadRankProfile = {
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

type TriadRankUpEvent = {
  userId: string;
  name: string;
  image: string;
  previousRank: TriadRankKey;
  nextRank: TriadRankKey;
  rankName: string;
  wins: number;
  at: number;
};

type FriendRelationStatus = "self" | "none" | "outgoing" | "incoming" | "friends";

type FriendRelationResponse = {
  relation?: {
    status?: FriendRelationStatus;
    requestId?: string | null;
  };
};

type RoomChatMessage = {
  id: string;
  roomCode: string;
  senderId: string;
  senderName: string;
  senderImage: string;
  text: string;
  createdAt: number;
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
  usedCards: Record<RoomPlayerSide, string[]>;
  deckMode: DeckMode;
  selectionPools: Record<RoomPlayerSide, string[]>;
  deckStartedAt: number;
  triangles: Record<RoomPlayerSide, TriadTriangle>;
  skillChoices: RoomSkillChoice[];
  openerTieBreak: OpeningTieBreak;
  turns: TriadTurnResult[];
  turnReady: Record<RoomPlayerSide, boolean>;
  matchScore: Record<RoomPlayerSide, number>;
  activeTurn: TriadTurn;
  fightNo: number;
  turnStartedAt: number;
  matchWinner: RoomPlayerSide | "";
  surrenderedBy: RoomPlayerSide | "";
  matchEndedAt: number;
  rankedRecordedAt: number;
  rankUpEvents: TriadRankUpEvent[];
  chat: RoomChatMessage[];
};

type OpeningTieBreak = {
  fightNo: number;
  turn: TriadTurn;
  round?: number;
  status: "idle" | "waiting" | "resolved";
  reason: "first_turn_score_draw" | "";
  choices: Partial<Record<RoomPlayerSide, TriadRpsChoice>>;
  revealChoices?: Partial<Record<RoomPlayerSide, TriadRpsChoice>>;
  winner: RoomPlayerSide | "";
  source: "card-icon" | "manual" | "";
  message: string;
};

function openingTieBreakChoiceKey(roomCode: string, tieBreak: OpeningTieBreak, side: RoomPlayerSide) {
  return `${roomCode}:${tieBreak.fightNo}:${tieBreak.turn}:${tieBreak.round || 1}:${side}`;
}

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
const TRIAD_RESUME_ROOM_CACHE_KEY = "nexora:triad:active-room";
const TRIAD_BOT_ID = "triad-bot-level-99";
const rankFrames = [
  { key: "bronze", name: "???????????", aura: "from-orange-700/40 via-amber-900/18 to-black/20", ring: "border-orange-400/58 shadow-[0_0_26px_rgba(251,146,60,0.24)]", badge: "bg-orange-400 text-black" },
  { key: "silver", name: "?????????????", aura: "from-white/46 via-slate-300/18 to-black/18", ring: "border-slate-100/75 shadow-[0_0_34px_rgba(226,232,240,0.3)]", badge: "bg-slate-100 text-black" },
  { key: "gold", name: "??????????", aura: "from-yellow-100/62 via-amber-400/28 to-black/18", ring: "border-yellow-200/90 shadow-[0_0_42px_rgba(250,204,21,0.44)]", badge: "bg-yellow-200 text-black" },
  { key: "platinum", name: "???????????????", aura: "from-cyan-100/58 via-teal-300/24 to-black/20", ring: "border-cyan-100/85 shadow-[0_0_46px_rgba(125,211,252,0.42)]", badge: "bg-cyan-100 text-black" },
  { key: "diamond", name: "????????????", aura: "from-sky-100/70 via-blue-400/32 to-violet-400/16", ring: "border-sky-100 shadow-[0_0_56px_rgba(96,165,250,0.54)]", badge: "bg-sky-200 text-black" },
  { key: "master", name: "?????????????", aura: "from-fuchsia-200/64 via-rose-500/28 to-violet-700/24", ring: "border-fuchsia-100 shadow-[0_0_64px_rgba(217,70,239,0.55)]", badge: "bg-fuchsia-200 text-black" },
  { key: "god-of-legends", name: "????? God Of Legends", aura: "from-yellow-100/80 via-rose-300/42 to-violet-400/32", ring: "border-yellow-100 shadow-[0_0_82px_rgba(250,204,21,0.72)]", badge: "bg-gradient-to-r from-yellow-100 via-rose-200 to-violet-200 text-black" },
] as const;

type SkillTargetId = "player-top" | "bot-top";
type SkillTargetSelection = SkillTargetId | `${SkillTargetId}>${SkillTargetId}` | "";

type PendingSkillChoice = {
  side: Side;
  lane: Lane;
  cardNo: string;
  selectedTarget: SkillTargetSelection;
};
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

function rankForWins(wins: number) {
  const safeWins = Math.max(0, Math.floor(Number(wins) || 0));
  if (safeWins >= 10000) return 6;
  if (safeWins >= 5000) return 5;
  if (safeWins >= 3000) return 4;
  if (safeWins >= 1000) return 3;
  if (safeWins >= 500) return 2;
  if (safeWins >= 100) return 1;
  return 0;
}

function normalizeRankProfile(value: unknown): TriadRankProfile | null {
  const raw = value && typeof value === "object" ? (value as Partial<TriadRankProfile>) : {};
  const userId = safeText(raw.userId);
  if (!userId || userId === TRIAD_BOT_ID) return null;
  const wins = Math.max(0, Math.floor(Number(raw.wins) || 0));
  const losses = Math.max(0, Math.floor(Number(raw.losses) || 0));
  const rankIndex = Math.min(rankFrames.length - 1, Math.max(0, Number.isFinite(Number(raw.rankIndex)) ? Number(raw.rankIndex) : rankForWins(wins)));
  const frame = rankFrames[rankIndex] || rankFrames[0];
  return {
    userId,
    name: safeText(raw.name) || "PLAYER",
    image: safeText(raw.image) || "/avatar.png",
    wins,
    losses,
    rankKey: (raw.rankKey || frame.key) as TriadRankKey,
    rankName: safeText(raw.rankName) || frame.name,
    rankIndex,
    nextRankWins: raw.nextRankWins === null ? null : Number(raw.nextRankWins || 0) || null,
    updatedAt: safeTimeMs(raw.updatedAt, Date.now()),
  };
}

function profileForParticipant(participant: Pick<RoomParticipant, "id" | "name" | "image"> | null | undefined, profiles: Record<string, TriadRankProfile>) {
  if (!participant || participant.id === TRIAD_BOT_ID) return null;
  return profiles[participant.id] || {
    userId: participant.id,
    name: participant.name,
    image: participant.image,
    wins: 0,
    losses: 0,
    rankKey: "bronze" as const,
    rankName: rankFrames[0].name,
    rankIndex: 0,
    nextRankWins: 100,
    updatedAt: Date.now(),
  };
}

function rankIndexForParticipant(participant?: Pick<RoomParticipant, "id"> | null, profile?: TriadRankProfile | null) {
  if (profile) return profile.rankIndex;
  if (participant?.id === TRIAD_BOT_ID) return rankFrames.length - 1;
  return 0;
}

function RankAvatar({
  participant,
  name,
  image,
  profile,
  rankIndex,
  size = "md",
  crown,
}: {
  participant?: RoomParticipant | null;
  name?: string;
  image?: string;
  profile?: TriadRankProfile | null;
  rankIndex?: number;
  size?: "sm" | "md" | "lg" | "xl";
  crown?: boolean;
}) {
  const frame = rankFrames[rankIndex ?? rankIndexForParticipant(participant, profile)] || rankFrames[0];
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

function participantInRoom(room: TriadRoom | undefined, participantId: string) {
  if (!room) return false;
  return (
    room.seats.host?.id === participantId ||
    room.seats.challenger?.id === participantId ||
    room.spectators.some((viewer) => viewer.id === participantId)
  );
}

function participantsLookSame(a?: RoomParticipant | null, b?: RoomParticipant | null) {
  if (!a || !b || isBotParticipant(a) || isBotParticipant(b)) return false;
  const aName = safeText(a.name).toLowerCase();
  const bName = safeText(b.name).toLowerCase();
  if (!aName || aName !== bName) return false;
  const aImage = safeText(a.image);
  const bImage = safeText(b.image);
  return !aImage || !bImage || aImage === bImage;
}

function participantRoomSide(room: TriadRoom | null | undefined, participant: RoomParticipant): RoomPlayerSide | null {
  if (!room) return null;
  if (room.seats.host?.id === participant.id) return "host";
  if (room.seats.challenger?.id === participant.id) return "challenger";
  if (participantsLookSame(room.seats.host, participant)) return "host";
  if (participantsLookSame(room.seats.challenger, participant)) return "challenger";
  return null;
}

function isBotParticipant(participant?: RoomParticipant | null) {
  return participant?.id === TRIAD_BOT_ID;
}

function readCachedTriadRoom(participantId: string) {
  if (typeof window === "undefined" || !participantId) return null;
  try {
    const raw = window.sessionStorage.getItem(TRIAD_RESUME_ROOM_CACHE_KEY) || window.localStorage.getItem(TRIAD_RESUME_ROOM_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { participantId?: string; room?: unknown };
    if (safeText(parsed.participantId) !== participantId) return null;
    const room = normalizeApiRooms(parsed.room ? [parsed.room] : [])[0] || null;
    return room && participantInRoom(room, participantId) ? room : null;
  } catch {
    return null;
  }
}

function writeCachedTriadRoom(participantId: string, room: TriadRoom | null) {
  if (typeof window === "undefined" || !participantId) return;
  try {
    if (!room || !participantInRoom(room, participantId)) {
      window.sessionStorage.removeItem(TRIAD_RESUME_ROOM_CACHE_KEY);
      window.localStorage.removeItem(TRIAD_RESUME_ROOM_CACHE_KEY);
      return;
    }
    const payload = JSON.stringify({ participantId, room });
    window.sessionStorage.setItem(TRIAD_RESUME_ROOM_CACHE_KEY, payload);
    window.localStorage.setItem(TRIAD_RESUME_ROOM_CACHE_KEY, payload);
  } catch {
    return;
  }
}

function BattleMiniFriendButton({
  targetUserId,
  currentUserId,
}: {
  targetUserId?: string;
  currentUserId?: string;
}) {
  const [relation, setRelation] = useState<FriendRelationStatus>("none");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");
  const cleanTargetId = safeText(targetUserId);
  const cleanCurrentId = safeText(currentUserId);
  const isSelf = !cleanTargetId || (cleanCurrentId ? cleanTargetId === cleanCurrentId : false);

  useEffect(() => {
    let cancelled = false;

    const loadRelation = async () => {
      if (isSelf) {
        setRelation("self");
        setRequestId(null);
        return;
      }

      setChecking(true);
      try {
        const res = await fetch(`/api/community/status/${encodeURIComponent(cleanTargetId)}`, { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as FriendRelationResponse;
        if (cancelled) return;
        setRelation(data.relation?.status || "none");
        setRequestId(safeText(data.relation?.requestId) || null);
      } catch {
        if (!cancelled) {
          setRelation("none");
          setRequestId(null);
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    void loadRelation();

    return () => {
      cancelled = true;
    };
  }, [cleanTargetId, isSelf]);

  const submitFriendAction = async (payload: Record<string, unknown>) => {
    if (busy || isSelf) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/community/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(String(data?.error || "ทำรายการไม่สำเร็จ"));
        return;
      }

      if (data?.relation?.status) {
        setRelation(data.relation.status as FriendRelationStatus);
        setRequestId(safeText(data.relation.requestId) || null);
      } else if (data?.status === "accepted") {
        setRelation("friends");
        setRequestId(null);
      } else {
        setRelation("outgoing");
      }
      window.dispatchEvent(new CustomEvent("nexora:friends-updated", { detail: { targetUserId: cleanTargetId } }));
    } catch {
      setMessage("เชื่อมระบบเพื่อนไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  };

  if (isSelf || relation === "self") return null;

  if (relation === "friends") {
    return (
      <div className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200/28 bg-emerald-300/12 px-3 py-2 text-[11px] font-black text-emerald-100 shadow-[0_0_24px_rgba(52,211,153,0.12)]">
        <UserCheck className="h-4 w-4" />
        เป็นเพื่อนแล้ว
      </div>
    );
  }

  if (relation === "outgoing") {
    return (
      <div className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-200/28 bg-amber-300/12 px-3 py-2 text-[11px] font-black text-amber-100">
        <Clock3 className="h-4 w-4" />
        ส่งคำขอแล้ว
      </div>
    );
  }

  if (relation === "incoming" && requestId) {
    return (
      <div className="mt-3">
        <button
          type="button"
          disabled={busy}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void submitFriendAction({ action: "respond", requestId, decision: "accept" });
          }}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-200/32 bg-emerald-400/14 px-3 py-2 text-[11px] font-black text-emerald-50 shadow-[0_0_28px_rgba(52,211,153,0.14)] transition hover:scale-[1.02] hover:bg-emerald-400/20 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          รับเป็นเพื่อน
        </button>
        {message ? <div className="mt-2 text-center text-[10px] font-bold text-red-200">{message}</div> : null}
      </div>
    );
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={busy || checking}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void submitFriendAction({ action: "request", targetUserId: cleanTargetId });
        }}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-200/30 bg-[linear-gradient(135deg,rgba(34,211,238,0.18),rgba(168,85,247,0.14))] px-3 py-2 text-[11px] font-black text-cyan-50 shadow-[0_0_30px_rgba(34,211,238,0.14)] transition hover:scale-[1.02] hover:border-cyan-100/48 hover:bg-cyan-300/18 disabled:opacity-60"
      >
        {busy || checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        {checking ? "เช็กสถานะ..." : busy ? "กำลังส่ง..." : "แอดเพื่อน"}
      </button>
      {message ? <div className="mt-2 text-center text-[10px] font-bold text-red-200">{message}</div> : null}
    </div>
  );
}

function MiniProfileHover({
  participant,
  name,
  image,
  profile,
  label,
  align = "left",
  placement = "bottom",
  size = "sm",
  currentParticipantId,
}: {
  participant?: RoomParticipant | null;
  name?: string;
  image?: string;
  profile?: TriadRankProfile | null;
  label?: string;
  align?: "left" | "right";
  placement?: "top" | "bottom";
  size?: "sm" | "md";
  currentParticipantId?: string;
}) {
  const profileName = name || participant?.name || "???????";
  const profileImage = image || participant?.image || "/avatar.png";
  const frame = rankFrames[rankIndexForParticipant(participant || { id: profileName }, profile)] || rankFrames[0];
  const avatarSize = size === "md" ? "h-11 w-11" : "h-9 w-9";
  const wins = profile?.wins || 0;
  const losses = profile?.losses || 0;
  const totalMatches = wins + losses;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;

  return (
    <div className="group relative z-50 inline-flex shrink-0 items-center">
      <button
        type="button"
        className={`relative grid ${avatarSize} place-items-center rounded-full border ${frame.ring} bg-black/70 p-[3px] outline-none transition hover:scale-105 focus:scale-105`}
      >
        <span className={`absolute -inset-2 rounded-full bg-gradient-to-br ${frame.aura} opacity-70 blur-lg`} />
        <span className="relative h-full w-full overflow-hidden rounded-full border border-black/70 bg-black">
          <Image src={profileImage} alt={profileName} width={48} height={48} className="h-full w-full object-cover" />
        </span>
      </button>
      <div
        className={`pointer-events-auto invisible absolute z-[160] w-72 rounded-2xl border border-amber-100/24 bg-[#07080d]/96 p-3 text-left opacity-0 shadow-[0_24px_70px_rgba(0,0,0,0.55),0_0_42px_rgba(251,191,36,0.18)] backdrop-blur-xl transition duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 ${
          placement === "top" ? "bottom-[calc(100%+0.55rem)]" : "top-[calc(100%+0.55rem)]"
        } ${align === "right" ? "right-0" : "left-0"}`}
      >
        <div className="flex items-center gap-3">
          <RankAvatar participant={participant || undefined} name={profileName} image={profileImage} profile={profile} size="md" />
          <div className="min-w-0">
            <div className="truncate text-sm font-black text-white">{profileName}</div>
            <div className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.16em] text-amber-100/56">
              {label || profile?.rankName || frame.name}
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-emerald-200/16 bg-emerald-300/10 px-2 py-2 text-center">
            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100/60">???</div>
            <div className="mt-1 text-lg font-black text-emerald-100">{wins.toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-rose-200/16 bg-rose-300/10 px-2 py-2 text-center">
            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-rose-100/60">???</div>
            <div className="mt-1 text-lg font-black text-rose-100">{losses.toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-amber-200/16 bg-amber-300/10 px-2 py-2 text-center">
            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-100/60">???%</div>
            <div className="mt-1 text-lg font-black text-amber-100">{winRate}%</div>
          </div>
        </div>
        <div className={`mt-3 rounded-xl border px-3 py-2 text-xs font-black leading-5 ${frame.badge}`}>
          {profile?.rankName || frame.name}
          {profile?.nextRankWins ? <span className="ml-2 opacity-70">??? {Math.max(0, profile.nextRankWins - wins).toLocaleString()} ???????????????</span> : <span className="ml-2 opacity-80">??????????</span>}
        </div>
        <BattleMiniFriendButton targetUserId={participant?.id} currentUserId={currentParticipantId} />
      </div>
    </div>
  );
}

function RankLeaderboardPanel({
  leaderboard,
  currentParticipantId,
}: {
  leaderboard: TriadRankProfile[];
  currentParticipantId: string;
}) {
  const rankedPlayers = leaderboard
    .filter((profile) => profile.wins > 0)
    .slice()
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name, "th"))
    .slice(0, 100);

  return (
    <div className="relative overflow-hidden rounded-[18px] border border-amber-200/20 bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.16),transparent_34%),linear-gradient(180deg,rgba(12,10,8,0.92),rgba(3,4,8,0.9))] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.42)]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-100/80 to-transparent" />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl border border-amber-100/35 bg-amber-300/16 text-amber-100 shadow-[0_0_34px_rgba(251,191,36,0.18)]">
            <Trophy className="h-5 w-5" />
          </span>
          <div>
            <div className="text-sm font-black text-white">ถ้วยอันดับแรงค์</div>
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-100/52">PvP leaderboard</div>
          </div>
        </div>
        <div className="rounded-full border border-white/10 bg-black/36 px-3 py-1 text-xs font-black text-white/58">
          {rankedPlayers.length.toLocaleString()} ผู้เล่น
        </div>
      </div>

      {rankedPlayers.length > 0 ? (
        <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
          {rankedPlayers.map((profile, index) => {
            const participantProfile: RoomParticipant = {
              id: profile.userId,
              name: profile.name,
              image: profile.image,
              joinedAt: profile.updatedAt,
            };
            const frame = rankFrames[profile.rankIndex] || rankFrames[0];
            const podium =
              index === 0
                ? "border-amber-100/50 bg-amber-300/12"
                : index === 1
                  ? "border-slate-100/35 bg-white/[0.055]"
                  : index === 2
                    ? "border-orange-200/35 bg-orange-300/8"
                    : "border-white/8 bg-white/[0.035]";

            return (
              <div key={profile.userId} className={`group relative grid grid-cols-[44px_1fr_auto] items-center gap-3 rounded-2xl border ${podium} px-3 py-2 transition hover:-translate-y-0.5 hover:border-amber-100/45 hover:bg-amber-200/10`}>
                <div className="text-center">
                  <div className={`mx-auto grid h-9 w-9 place-items-center rounded-xl border text-sm font-black ${index < 3 ? "border-amber-100/45 bg-amber-300/18 text-amber-100" : "border-white/10 bg-black/38 text-white/54"}`}>
                    {index === 0 ? <Crown className="h-4 w-4" /> : index + 1}
                  </div>
                </div>
                <div className="flex min-w-0 items-center gap-3">
                  <MiniProfileHover
                    participant={participantProfile}
                    profile={profile}
                    label={profile.rankName}
                    currentParticipantId={currentParticipantId}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-black text-white">{profile.name}</div>
                    <div className={`mt-1 inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] ${frame.badge}`}>
                      <span className="truncate">{profile.rankName}</span>
                    </div>
                  </div>
                </div>
                <div className="grid min-w-[96px] grid-cols-2 gap-1 text-center">
                  <div className="rounded-lg border border-emerald-200/14 bg-emerald-300/10 px-2 py-1">
                    <div className="text-[9px] font-black text-emerald-100/56">ชนะ</div>
                    <div className="text-sm font-black text-emerald-100">{profile.wins.toLocaleString()}</div>
                  </div>
                  <div className="rounded-lg border border-rose-200/14 bg-rose-300/10 px-2 py-1">
                    <div className="text-[9px] font-black text-rose-100/56">แพ้</div>
                    <div className="text-sm font-black text-rose-100">{profile.losses.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/12 bg-black/28 p-6 text-center text-sm font-semibold text-white/46">
          ยังไม่มีผู้เล่นที่ชนะ PvP อย่างน้อย 1 เกม
        </div>
      )}
    </div>
  );
}

function phaseForPlayingRoom(room: TriadRoom, participantId: string): BattlePhase | null {
  const spectator = room.spectators.some((viewer) => viewer.id === participantId);
  const fieldPlayer = room.seats.host?.id === participantId || room.seats.challenger?.id === participantId;
  if (!spectator && !fieldPlayer) return null;
  if (spectator) return "battle";
  return roomDecksReadyForBattle(room) ? "battle" : "deck";
}

function roomDecksReadyForBattle(room: TriadRoom | null | undefined) {
  return Boolean(
    room?.game.deckReady.host &&
      room.game.deckReady.challenger &&
      room.game.decks.host.length >= DECK_SIZE &&
      room.game.decks.challenger.length >= DECK_SIZE
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
  const usedCards = raw.usedCards && typeof raw.usedCards === "object" ? (raw.usedCards as Record<string, unknown>) : {};
  const selectionPools = raw.selectionPools && typeof raw.selectionPools === "object" ? (raw.selectionPools as Record<string, unknown>) : {};
  const triangles = raw.triangles && typeof raw.triangles === "object" ? (raw.triangles as Record<string, unknown>) : {};
  const turnReady = raw.turnReady && typeof raw.turnReady === "object" ? (raw.turnReady as Record<string, unknown>) : {};
  const activeTurn = Number(raw.activeTurn || 1);
  const cleanDeck = (deck: unknown) => Array.isArray(deck) ? deck.map((item) => safeText(item)).filter(Boolean).slice(0, DECK_SIZE) : [];
  const cleanPool = (deck: unknown) => Array.isArray(deck) ? deck.map((item) => safeText(item)).filter(Boolean).slice(0, 40) : [];
  const cleanChat = (messages: unknown): RoomChatMessage[] => Array.isArray(messages)
    ? messages
        .map((message) => {
          const rawMessage = message && typeof message === "object" ? (message as Record<string, unknown>) : {};
          const senderId = safeText(rawMessage.senderId);
          const text = safeText(rawMessage.text).slice(0, 240);
          const createdAt = Number(rawMessage.createdAt || Date.now());
          if (!senderId || !text) return null;
          return {
            id: safeText(rawMessage.id) || `${createdAt}-${senderId}`,
            roomCode: safeText(rawMessage.roomCode),
            senderId,
            senderName: safeText(rawMessage.senderName) || "PLAYER",
            senderImage: safeText(rawMessage.senderImage) || "/avatar.png",
            text,
            createdAt,
          } satisfies RoomChatMessage;
        })
        .filter((message): message is RoomChatMessage => Boolean(message))
        .sort((a, b) => a.createdAt - b.createdAt)
        .slice(-80)
    : [];
  const cleanRpsChoice = (choice: unknown): TriadRpsChoice =>
    choice === "rock" || choice === "scissors" || choice === "paper" ? choice : "unknown";
  const cleanOpeningTieBreak = (tieBreak: unknown): OpeningTieBreak => {
    const rawTieBreak = tieBreak && typeof tieBreak === "object" ? (tieBreak as Record<string, unknown>) : {};
    const choices = rawTieBreak.choices && typeof rawTieBreak.choices === "object" ? (rawTieBreak.choices as Record<string, unknown>) : {};
    const revealChoices =
      rawTieBreak.revealChoices && typeof rawTieBreak.revealChoices === "object"
        ? (rawTieBreak.revealChoices as Record<string, unknown>)
        : null;
    return {
    fightNo: Number(rawTieBreak.fightNo || 1),
    turn: rawTieBreak.turn === 2 || rawTieBreak.turn === 3 ? rawTieBreak.turn : 1,
    round: Math.max(1, Number(rawTieBreak.round || 1)),
      status: rawTieBreak.status === "waiting" || rawTieBreak.status === "resolved" ? rawTieBreak.status : "idle",
      reason: rawTieBreak.reason === "first_turn_score_draw" ? "first_turn_score_draw" : "",
      choices: {
        host: cleanRpsChoice(choices.host),
        challenger: cleanRpsChoice(choices.challenger),
      },
      ...(revealChoices
        ? {
            revealChoices: {
              host: cleanRpsChoice(revealChoices.host),
              challenger: cleanRpsChoice(revealChoices.challenger),
            },
          }
        : {}),
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
  const cleanRankUpEvents = (events: unknown): TriadRankUpEvent[] => Array.isArray(events)
    ? events
        .map((event) => {
          const rawEvent = event && typeof event === "object" ? (event as Record<string, unknown>) : {};
          const userId = safeText(rawEvent.userId);
          const rankIndex = rankFrames.findIndex((frame) => frame.key === rawEvent.nextRank);
          if (!userId || rankIndex < 0) return null;
          return {
            userId,
            name: safeText(rawEvent.name) || "PLAYER",
            image: safeText(rawEvent.image) || "/avatar.png",
            previousRank: (safeText(rawEvent.previousRank) || "bronze") as TriadRankKey,
            nextRank: rankFrames[rankIndex].key as TriadRankKey,
            rankName: safeText(rawEvent.rankName) || rankFrames[rankIndex].name,
            wins: Math.max(0, Number(rawEvent.wins || 0)),
            at: safeTimeMs(rawEvent.at, Date.now()),
          } satisfies TriadRankUpEvent;
        })
        .filter((event): event is TriadRankUpEvent => Boolean(event))
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
    usedCards: {
      host: cleanDeck(usedCards.host),
      challenger: cleanDeck(usedCards.challenger),
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
    rankUpEvents: cleanRankUpEvents(raw.rankUpEvents),
    chat: cleanChat(raw.chat),
  };
}

function roomProgressValue(room: TriadRoom) {
  return room.game.fightNo * 10 + room.game.activeTurn;
}

function shouldKeepCurrentRoomSnapshot(currentRoom: TriadRoom | undefined, nextRoom: TriadRoom) {
  if (!currentRoom || currentRoom.code !== nextRoom.code) return false;
  if (
    currentRoom.status === "playing" &&
    nextRoom.status === "playing" &&
    roomDecksReadyForBattle(currentRoom) &&
    !roomDecksReadyForBattle(nextRoom) &&
    Number(nextRoom.game.deckStartedAt || 0) <= Number(currentRoom.game.deckStartedAt || 0)
  ) {
    return true;
  }
  return roomProgressValue(currentRoom) > roomProgressValue(nextRoom);
}

function mergeRoomByCode(rooms: TriadRoom[], room?: TriadRoom | null) {
  if (!room?.code) return rooms;
  const existing = rooms.find((item) => item.code === room.code);
  if (shouldKeepCurrentRoomSnapshot(existing, room)) return rooms;
  return existing ? rooms.map((item) => (item.code === room.code ? mergeRoomWithStableChat(item, room) : item)) : [room, ...rooms];
}

function mergeRoomListsWithStableChat(currentRooms: TriadRoom[], nextRooms: TriadRoom[]) {
  return nextRooms.map((room) => mergeRoomWithStableChat(currentRooms.find((item) => item.code === room.code), room));
}

function mergeRoomWithStableChat(currentRoom: TriadRoom | null | undefined, nextRoom: TriadRoom) {
  if (!currentRoom || currentRoom.code !== nextRoom.code) return nextRoom;
  const chat = mergeRoomChatMessages(currentRoom.game.chat || [], nextRoom.game.chat || []);
  return {
    ...nextRoom,
    game: {
      ...nextRoom.game,
      chat,
    },
  };
}

function mergeRoomChatMessages(currentMessages: RoomChatMessage[], nextMessages: RoomChatMessage[]) {
  const merged: RoomChatMessage[] = [];
  const pushStable = (message: RoomChatMessage) => {
    const duplicateIndex = merged.findIndex((item) => {
      if (item.id === message.id) return true;
      const sameOptimisticEcho =
        item.senderId === message.senderId &&
        item.text === message.text &&
        Math.abs(item.createdAt - message.createdAt) < 8000 &&
        (item.id.startsWith("local-") || message.id.startsWith("local-"));
      return sameOptimisticEcho;
    });
    if (duplicateIndex >= 0) {
      const existing = merged[duplicateIndex];
      merged[duplicateIndex] = existing.id.startsWith("local-") && !message.id.startsWith("local-") ? message : existing;
      return;
    }
    merged.push(message);
  };
  currentMessages.forEach(pushStable);
  nextMessages.forEach(pushStable);
  return merged.sort((a, b) => a.createdAt - b.createdAt).slice(-80);
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

function roomOpeningSideForTurn(room: TriadRoom, activeTurn: TriadTurn): RoomPlayerSide | null {
  if (activeTurn === 1) return "host";
  const previousTurn = (activeTurn - 1) as TriadTurn;
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

function roomOpeningSide(room: TriadRoom): RoomPlayerSide | null {
  return roomOpeningSideForTurn(room, room.game.activeTurn);
}

function currentQueuedSkillChoice(room: TriadRoom) {
  const opener = roomOpeningSide(room);
  const order: RoomPlayerSide[] = opener === "challenger" ? ["challenger", "host"] : ["host", "challenger"];
  const choices = room.game.skillChoices.filter(
    (choice) => choice.fightNo === room.game.fightNo && choice.turn === room.game.activeTurn && !choice.skipped
  );
  for (const side of order) {
    const choice = choices.find((item) => item.side === side);
    if (!choice) continue;
    if (!choice.selectedTarget) return choice;
  }
  return null;
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
    if (choice.selectedTarget === "draw-skill") {
      const targetTriangle = choice.side === "host" ? nextHost : nextChallenger;
      if (choice.blessingDrawCardNo) {
        targetTriangle[choice.lane] = choice.blessingDrawCardNo;
      }
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

function localBotSkillElementScore(turn: TriadTurn, player: TriadTriangle, bot: TriadTriangle, card: CardView) {
  const rule = triadSkillRuleByNo.get(card.cardNo);
  if (card.kind !== "skill" || !rule) return 0;
  if (!rule.allowedTurns.includes(turn)) return -180_000;
  if (!rule.elementCondition) return 2_500;

  const playerTop = player.top ? triadCardByNo.get(player.top) : undefined;
  const botTop = bot.top ? triadCardByNo.get(bot.top) : undefined;
  const matches = (target?: CardView | TriadCard | null) => {
    if (!target) return false;
    const listed = rule.elementCondition?.elements.includes(target.element) || false;
    return rule.elementCondition?.mode === "include" ? listed : !listed;
  };
  const hasBuff = rule.effects.some((effect) => effect.delta > 0);
  const hasDebuff = rule.effects.some((effect) => effect.delta < 0);
  const intendedTargets =
    rule.target.startsWith("own")
      ? [botTop]
      : rule.target.startsWith("opponent")
        ? [playerTop]
        : rule.target === "all"
          ? [playerTop, botTop]
          : rule.target === "any-one"
            ? hasDebuff
              ? [playerTop]
              : hasBuff
                ? [botTop]
                : [playerTop, botTop]
            : [playerTop, botTop];
  const intendedMatches = intendedTargets.filter(matches).length;
  if (intendedMatches > 0) return 35_000 + intendedMatches * 14_000;
  return -260_000;
}

function localBotResolvedSkillPenalty(result: TriadTurnResult, card: CardView) {
  const rule = triadSkillRuleByNo.get(card.cardNo);
  if (card.kind !== "skill" || !rule?.elementCondition) return 0;
  const botEvents = result.skillEvents.filter((event) => event.side === "opponent" && event.cardNo === card.cardNo);
  if (botEvents.length === 0) return -260_000;
  if (botEvents.some((event) => event.blocked)) return -320_000;
  return 80_000;
}

function localBotCanUseElementSkill(turn: TriadTurn, player: TriadTriangle, bot: TriadTriangle, card: CardView) {
  const rule = triadSkillRuleByNo.get(card.cardNo);
  if (card.kind !== "skill" || !rule?.elementCondition) return true;
  return localBotSkillElementScore(turn, player, bot, card) > 0;
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
  const smartPlayableCards = playableCards.filter((card) => {
    const candidateBot = { ...bot, [lane]: card.cardNo };
    return localBotCanUseElementSkill(turn, player, candidateBot, card);
  });
  const scoringCards = smartPlayableCards.length > 0 ? smartPlayableCards : playableCards;
  let best: { cardNo: string; margin: number; total: number } | null = null;

  for (const card of scoringCards) {
    const candidateBot = { ...bot, [lane]: card.cardNo };
    const result = resolveTriadTurn({ turn, player, opponent: candidateBot });
    const margin =
      result.opponentTotal -
      result.playerTotal +
      localBotSkillElementScore(turn, player, candidateBot, card) +
      localBotResolvedSkillPenalty(result, card);
    if (!best || margin > best.margin || (margin === best.margin && result.opponentTotal > best.total)) {
      best = { cardNo: card.cardNo, margin, total: result.opponentTotal };
    }
  }

  return best?.cardNo || scoringCards[0]?.cardNo || "";
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
  if (card?.cardNo === "245") return false;
  if (card?.cardNo === "265") return false;
  return Boolean(card?.kind === "skill" && (card.cardNo === "254" || card.cardNo === "231" || /เลือก|choose|target/i.test(card.skillText)));
}

function roomMatchScoreForView(room: TriadRoom | null | undefined, roomPlayerSide: RoomPlayerSide | null, isSpectator = false) {
  if (!room) return null;
  const score = room.game.matchScore || { host: 0, challenger: 0 };
  if (isSpectator || !roomPlayerSide) {
    return { player: score.host || 0, bot: score.challenger || 0 };
  }
  const opponentSide = roomPlayerSide === "host" ? "challenger" : "host";
  return { player: score[roomPlayerSide] || 0, bot: score[opponentSide] || 0 };
}

function absoluteRoomTurn(fightNo: number, turn: TriadTurn) {
  return (Math.max(1, fightNo) - 1) * 3 + turn;
}

function monsterHasUnequalStats(card?: CardView) {
  return Boolean(card?.kind === "monster" && card.attack !== card.support);
}

function monsterHasGravityFieldStat(card?: CardView) {
  return Boolean(card?.kind === "monster" && (card.attack >= 7000 || card.support >= 7000));
}

function monsterHasTidebombStat(card?: CardView) {
  return Boolean(card?.kind === "monster" && (card.attack >= 5000 || card.support >= 5000));
}

function monsterHasHydroburst255Stat(card?: CardView) {
  if (card?.kind !== "monster") return false;
  return card.attack <= 5000 || card.support <= 5000;
}

function monsterHasVerdant019Element(card?: CardView) {
  return Boolean(card?.kind === "monster" && card.element === "wood");
}

function monsterHasPitfall223Stat(card?: CardView) {
  return Boolean(card?.kind === "monster" && card.attack <= 2000);
}

function monsterHasMetalShield238Stat(card?: CardView) {
  return Boolean(card?.kind === "monster" && card.support <= 2000);
}

function monsterHasIronWings239Stat(card?: CardView) {
  return Boolean(card?.kind === "monster" && card.support <= 1000);
}

function monsterHasCounterBlade243Stat(card?: CardView) {
  return Boolean(card?.kind === "monster" && card.support <= 3000);
}

function parseSkillTargetSelection(value: SkillTargetSelection | string = ""): SkillTargetId[] {
  return value
    .split(">")
    .map((item) => item.trim())
    .filter((item): item is SkillTargetId => item === "player-top" || item === "bot-top");
}

function isTwoStepTargetSkill(card?: CardView) {
  return card?.cardNo === "232";
}

function nextTwoStepTargetSelection(current: SkillTargetSelection, target: SkillTargetId): SkillTargetSelection {
  const selected = parseSkillTargetSelection(current);
  if (selected.includes(target)) {
    return selected.filter((item) => item !== target).join(">") as SkillTargetSelection;
  }
  if (selected.length === 0) return target;
  return `${selected[0]}>${target}` as SkillTargetSelection;
}

function getSelectableSkillTargetIds(card?: CardView, side: Side = "player", playerTop?: CardView, botTop?: CardView): SkillTargetId[] {
  const ownTarget: SkillTargetId = side === "player" ? "player-top" : "bot-top";
  const opponentTarget: SkillTargetId = side === "player" ? "bot-top" : "player-top";
  const rule = card ? triadSkillRuleByNo.get(card.cardNo) : undefined;

  if (card?.cardNo === "254") return [];
  if (!rule) return [ownTarget];
  if (card?.cardNo === "234") return [ownTarget];
  if (card?.cardNo === "232") {
    return [
      playerTop?.kind === "monster" ? "player-top" as const : null,
      botTop?.kind === "monster" ? "bot-top" as const : null,
    ].filter((target): target is SkillTargetId => Boolean(target));
  }
  if (card?.cardNo === "231") {
    return [
      monsterHasUnequalStats(playerTop) ? "player-top" as const : null,
      monsterHasUnequalStats(botTop) ? "bot-top" as const : null,
    ].filter((target): target is SkillTargetId => Boolean(target));
  }
  if (card?.cardNo === "227") {
    return [
      monsterHasGravityFieldStat(playerTop) ? "player-top" as const : null,
      monsterHasGravityFieldStat(botTop) ? "bot-top" as const : null,
    ].filter((target): target is SkillTargetId => Boolean(target));
  }
  if (card?.cardNo === "259") {
    return [
      monsterHasTidebombStat(playerTop) ? "player-top" as const : null,
      monsterHasTidebombStat(botTop) ? "bot-top" as const : null,
    ].filter((target): target is SkillTargetId => Boolean(target));
  }
  if (card?.cardNo === "255") {
    const ownCard = side === "player" ? playerTop : botTop;
    return monsterHasHydroburst255Stat(ownCard) ? [ownTarget] : [];
  }
  if (card?.cardNo === "019") {
    const ownCard = side === "player" ? playerTop : botTop;
    return monsterHasVerdant019Element(ownCard) ? [ownTarget] : [];
  }
  if (card?.cardNo === "223") {
    const ownCard = side === "player" ? playerTop : botTop;
    return monsterHasPitfall223Stat(ownCard) ? [ownTarget] : [];
  }
  if (card?.cardNo === "238") {
    const ownCard = side === "player" ? playerTop : botTop;
    return monsterHasMetalShield238Stat(ownCard) ? [ownTarget] : [];
  }
  if (card?.cardNo === "239") {
    const ownCard = side === "player" ? playerTop : botTop;
    return monsterHasIronWings239Stat(ownCard) ? [ownTarget] : [];
  }
  if (card?.cardNo === "243") {
    const ownCard = side === "player" ? playerTop : botTop;
    return monsterHasCounterBlade243Stat(ownCard) ? [ownTarget] : [];
  }
  if (rule.target.startsWith("own")) return [ownTarget];
  if (rule.target.startsWith("opponent")) return [opponentTarget];
  if (rule.target === "any-one" || rule.target === "all") return [ownTarget, opponentTarget];

  return [ownTarget];
}

function hiddenCard() {
  return (
    <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-cyan-200/20 bg-black shadow-[0_22px_60px_rgba(0,0,0,0.38)]">
      <Image src={TRIAD_CARD_BACK_SRC} alt="Card back" fill sizes="260px" quality={72} className="object-cover" />
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent_24%,rgba(0,0,0,0.2))]" />
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
    <div className="triad-phase-track relative overflow-hidden rounded-[18px] border border-amber-100/24 bg-[linear-gradient(180deg,rgba(30,21,9,0.94),rgba(9,7,5,0.88))] p-1.5 shadow-[0_16px_46px_rgba(0,0,0,0.36),inset_0_0_0_1px_rgba(255,255,255,0.05)] backdrop-blur-md">
      <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-amber-100/55 to-transparent" />
      <div className="triad-phase-track-grid grid grid-cols-5 gap-1">
        {steps.map(([label, value]) => (
          <div
            key={label}
            className={`triad-phase-step rounded-xl px-2 py-2 text-center text-[10px] font-black uppercase tracking-[0.14em] sm:text-xs ${
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
  const activeGlow = active ? "shadow-[0_18px_48px_rgba(0,0,0,0.58)]" : "";

  return (
    <div
      className={`group relative w-[var(--triad-card-size,clamp(48px,7vw,112px))] overflow-visible rounded-[12px] bg-transparent shadow-[0_18px_42px_rgba(0,0,0,0.42)] ${activeGlow} ${
        aura === "own"
          ? "shadow-[0_20px_54px_rgba(0,0,0,0.58)]"
          : aura === "enemy"
            ? "shadow-[0_20px_54px_rgba(0,0,0,0.58)]"
            : aura === "pending"
              ? "shadow-[0_20px_54px_rgba(0,0,0,0.58)]"
              : ""
      }`}
    >
      <div className={`pointer-events-none absolute -inset-2 rounded-[18px] bg-black/45 opacity-25 blur-xl transition-opacity duration-200 ${active || aura ? "opacity-40" : ""}`} />
      {aura ? (
        <div className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] bg-white/[0.035]" />
      ) : null}
      <div className="relative overflow-hidden rounded-[10px] bg-black aspect-[3/4]">
        <div className="pointer-events-none absolute inset-0 z-[2] rounded-[inherit] bg-[linear-gradient(180deg,rgba(255,255,255,0.12),transparent_18%,transparent_68%,rgba(0,0,0,0.34))]" />
        <div className="pointer-events-none absolute inset-x-[14%] top-0 z-[3] h-px bg-gradient-to-r from-transparent via-white/55 to-transparent" />
        {card && !hidden ? (
          <Image src={card.sourceImage} alt={card.name} fill sizes="128px" className="object-cover" />
        ) : (
          <>
            <Image
              src={TRIAD_CARD_BACK_SRC}
              alt={`${label} card back`}
              fill
              sizes="128px"
              quality={72}
              priority={active}
              className="object-cover"
            />
            <div className="pointer-events-none absolute inset-0 z-[1] rounded-[inherit] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),transparent_22%,rgba(0,0,0,0.22))]" />
          </>
        )}
      </div>
      <div className={`pointer-events-none absolute -bottom-2 left-1/2 h-3 w-[78%] -translate-x-1/2 rounded-full bg-black/70 blur-md ${active ? "opacity-90" : "opacity-55"}`} />
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
      className={`relative grid w-[var(--triad-pile-size,clamp(42px,6vw,88px))] place-items-center overflow-hidden rounded-lg border bg-[#08080c] shadow-[0_16px_34px_rgba(0,0,0,0.36)] transition ${onClick ? "hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-amber-200/70" : ""} ${color} ${
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
        <div className="text-[clamp(0.52rem,2.2cqw,0.78rem)] font-black uppercase leading-none text-white">
          {label}
        </div>
        <div className="mt-1 text-[clamp(0.44rem,1.8cqw,0.64rem)] font-bold text-white/62">
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
  spectatorView = false,
  readyAdvanceSlot,
  skillOpenerName,
  skillSecondName,
  nextSkillOpenerName,
  nextSkillSecondName,
}: {
  playerCard?: CardView;
  botCard?: CardView;
  showPlayer: boolean;
  showBot: boolean;
  result?: TriadTurnResult;
  playerName: string;
  botName: string;
  spectatorView?: boolean;
  readyAdvanceSlot?: ReactNode;
  skillOpenerName?: string;
  skillSecondName?: string;
  nextSkillOpenerName?: string;
  nextSkillSecondName?: string;
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
  const hasThaiText = (value: string) => new RegExp("[\\u0E00-\\u0E7F]").test(value);
  const skillNameForEvent = (cardNo: string, fallback: string) => {
    const dbName = cardNo ? triadCardByNo.get(cardNo)?.name || "" : "";
    if (dbName && hasThaiText(dbName)) return dbName;
    if (fallback && hasThaiText(fallback)) return fallback;
    return cardNo ? `สกิล No.${cardNo}` : fallback;
  };
  const fallbackPriorityName = result?.prioritySide === "opponent" ? botName : playerName;
  const fallbackSecondPriorityName = result?.prioritySide === "opponent" ? playerName : botName;
  const priorityName = skillOpenerName || fallbackPriorityName;
  const secondPriorityName = skillSecondName || fallbackSecondPriorityName;
  const hasUpcomingSkillOrder = Boolean(nextSkillOpenerName && nextSkillSecondName);
  const upcomingPriorityName = nextSkillOpenerName || priorityName;
  const upcomingSecondPriorityName = nextSkillSecondName || secondPriorityName;
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
    <div className="pointer-events-none absolute inset-x-0 top-[clamp(38px,7cqw,76px)] z-[74] flex justify-center px-3">
      {isScored ? (
        <div className="absolute inset-x-[18%] top-1/2 h-32 -translate-y-1/2 rounded-full bg-black/32 blur-2xl" />
      ) : null}
      <div className="relative grid w-[min(680px,88cqw)] items-center gap-2 sm:grid-cols-[1fr_minmax(150px,auto)_1fr] sm:gap-3">
        <div className={`mx-auto hidden w-[clamp(72px,16cqw,148px)] sm:block ${playerWins ? "scale-105" : ""}`}>
          {showPlayer && playerCard ? (
            <div className={`animate-[triad-card-pop_520ms_ease-out] rounded-[14px] border bg-black p-1 ${playerCard.kind === "skill" ? "border-violet-200/80 shadow-[0_0_58px_rgba(168,85,247,0.75)]" : "border-red-200/70 shadow-[0_0_45px_rgba(248,113,113,0.55)]"}`}>
              {playerCard.kind === "skill" ? <div className="absolute inset-x-0 -bottom-3 h-10 rounded-full bg-violet-400/50 blur-xl" /> : null}
              <div className="relative aspect-[3/4] overflow-hidden rounded-[10px]">
                <Image src={playerCard.sourceImage} alt={playerCard.name} fill sizes="210px" className="object-cover" />
              </div>
            </div>
          ) : null}
        </div>

        <div className="min-w-0 text-center">
          <div className="mx-auto max-w-[min(420px,54cqw)] animate-[triad-flash_900ms_ease-out] rounded-2xl border border-white/10 bg-black/62 px-3 py-1.5 text-[clamp(0.9rem,3.2cqw,1.85rem)] font-black uppercase leading-[1.06] text-white drop-shadow-[0_0_22px_rgba(255,255,255,0.75)] shadow-[0_16px_46px_rgba(0,0,0,0.42)] backdrop-blur-sm sm:rounded-3xl sm:px-5 sm:py-2.5">
            {isSwapSkill ? "สลับ!" : isScored ? winnerText : "เปิดการ์ด"}
          </div>
          {isScored ? (
            <div className="mx-auto mt-1.5 max-w-[min(420px,52cqw)] rounded-full border border-amber-200/50 bg-black/76 px-3 py-1.5 text-[clamp(0.72rem,1.85cqw,0.96rem)] font-black leading-tight text-amber-100 shadow-[0_0_34px_rgba(251,191,36,0.35)] sm:px-4">
              {scoreText}
            </div>
          ) : null}
          {isScored && readyAdvanceSlot ? (
            <div className="triad-ready-advance-spotlight pointer-events-auto mx-auto mt-2 hidden w-[min(330px,72cqw)]">
              {readyAdvanceSlot}
            </div>
          ) : null}
        </div>

        <div className={`mx-auto hidden w-[clamp(72px,16cqw,148px)] sm:block ${botWins ? "scale-105" : ""}`}>
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
        <div
          className={`triad-effect-timeline pointer-events-auto absolute z-30 grid gap-1.5 ${
            spectatorView
              ? "right-[clamp(12px,2.6cqw,30px)] top-[calc(100%+clamp(8px,1.8cqw,16px))] w-[clamp(280px,34cqw,430px)]"
              : "right-[clamp(12px,2.6cqw,30px)] top-[calc(100%+clamp(8px,1.8cqw,16px))] w-[clamp(260px,28cqw,390px)]"
          }`}
        >
          <div className="rounded-xl border border-amber-200/35 bg-amber-300/12 px-3 py-2 text-left shadow-[0_0_28px_rgba(251,191,36,0.16)] backdrop-blur-md">
            <div className="text-[8px] font-black uppercase leading-3 tracking-[0.14em] text-amber-100/72">
              ลำดับเปิดใช้ผลสกิล
            </div>
            <div className="mt-0.5 text-[clamp(0.72rem,1.55cqw,0.9rem)] font-black leading-5 text-white">
              {hasUpcomingSkillOrder ? `ตาถัดไป ${upcomingPriorityName} เปิดใช้ผลสกิลก่อน` : `${priorityName} เปิดใช้ผลสกิลก่อน`}
            </div>
            <div className="mt-1 text-[clamp(0.58rem,1.2cqw,0.72rem)] font-semibold leading-4 text-amber-50/72">
              {hasUpcomingSkillOrder ? `ตานี้ ${priorityName} → ${secondPriorityName} / ต่อด้วย ${upcomingSecondPriorityName}` : `ตามด้วย ${secondPriorityName} หากมีสกิลในตานี้`}
            </div>
          </div>
          {timeline.map((event, index) => {
            const eventName = event.cardNo ? skillNameForEvent(event.cardNo, event.name) : event.name;
            return (
              <div
                key={`${event.cardNo || "basic"}-${index}`}
                className="animate-[triad-effect-step_720ms_ease-out_both] rounded-xl border border-violet-200/35 bg-black/88 px-3 py-2 text-left shadow-[0_0_34px_rgba(168,85,247,0.22)] backdrop-blur-md"
                style={{ animationDelay: `${index * 160}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[8px] font-black uppercase leading-3 tracking-[0.14em] text-violet-200/70">
                      {event.cardNo ? `${event.side === "player" ? playerName : botName} ใช้สกิล No.${event.cardNo}` : "ผลการปะทะ"}
                    </div>
                    <div className="mt-0.5 text-[clamp(0.75rem,1.6cqw,0.95rem)] font-black leading-5 text-white">{eventName}</div>
                  </div>
                  <div className="shrink-0 rounded-full border border-amber-200/30 bg-amber-200/10 px-2 py-1 text-[10px] font-black text-amber-100">
                    {index + 1}/{timeline.length}
                  </div>
                </div>
                <div className="mt-1 whitespace-normal break-words text-[clamp(0.68rem,1.35cqw,0.82rem)] font-semibold leading-5 text-white/76">
                  {event.summary || skillText || "ระบบกำลังจัดการผลสกิลของการ์ดนี้"}
                </div>
                {event.targetLabel || event.blocked ? (
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {event.targetLabel ? (
                      <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-red-300/32 bg-red-500/12 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-red-100">
                        <Crosshair className="h-3 w-3 shrink-0" />
                        <span className="min-w-0 break-words leading-4">ล็อกเป้า: {event.targetLabel}</span>
                      </span>
                    ) : null}
                    {event.blocked ? (
                      <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-amber-300/32 bg-amber-300/12 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.1em] text-amber-100">
                        <Lock className="h-3 w-3 shrink-0" />
                        <span className="min-w-0 break-words leading-4">บัฟถูกบล็อก</span>
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
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
  onPreview,
  onPreviewEnd,
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
  onPreview?: (card: CardView, mode?: CardPreviewMode) => void;
  onPreviewEnd?: () => void;
}) {
  const playerLanes: { lane: Lane; label: string; className: string }[] = [
    {
      lane: "top",
      label: "หลัก",
      className: "col-span-2 mx-auto w-[var(--triad-top-card-size,var(--triad-card-size,clamp(52px,7vw,104px)))] translate-y-3 sm:translate-y-5",
    },
    {
      lane: "left",
      label: "โจมตี",
      className: "w-[var(--triad-card-size,clamp(48px,6.4vw,96px))] -translate-y-0.5",
    },
    {
      lane: "right",
      label: "ช่วย",
      className: "w-[var(--triad-card-size,clamp(48px,6.4vw,96px))] -translate-y-0.5",
    },
  ];
  const botLanes: { lane: Lane; label: string; className: string }[] = [
    {
      lane: "left",
      label: "โจมตี",
      className: "w-[var(--triad-card-size,clamp(48px,6.4vw,96px))] translate-y-0.5",
    },
    {
      lane: "right",
      label: "ช่วย",
      className: "w-[var(--triad-card-size,clamp(48px,6.4vw,96px))] translate-y-0.5",
    },
    {
      lane: "top",
      label: "หลัก",
      className: "col-span-2 mx-auto w-[var(--triad-top-card-size,var(--triad-card-size,clamp(52px,7vw,104px)))] -translate-y-3 sm:-translate-y-5",
    },
  ];
  const lanes = tone === "bot" ? botLanes : playerLanes;

  return (
    <div className={`grid grid-cols-2 justify-items-center gap-x-[var(--triad-slot-gap,clamp(5px,1vw,14px))] gap-y-0 ${tone === "player" ? "items-end -translate-y-0.5 sm:-translate-y-2" : "items-start translate-y-0.5 sm:translate-y-2"}`}>
      {lanes.map(({ lane, label, className }) => {
        const cardNo = triangle[lane];
        const card = cardNo ? cardsByNo.get(cardNo) : undefined;
        const visible = isVisible(lane);
        const canPreview = Boolean(card && visible);
        return (
          <Fragment key={lane}>
            <button
              type="button"
              data-triad-lane={lane}
              onClick={() => {
                if (card && canPreview) onPreview?.(card, "modal");
                onSlotClick?.(lane);
              }}
              onMouseEnter={() => {
                if (card && canPreview) onPreview?.(card, "hover");
              }}
              onMouseLeave={onPreviewEnd}
              onPointerEnter={() => {
                if (card && canPreview) onPreview?.(card, "hover");
              }}
              onPointerMove={() => {
                if (card && canPreview) onPreview?.(card, "hover");
              }}
              onPointerLeave={onPreviewEnd}
              onFocus={() => {
                if (card && canPreview) onPreview?.(card, "modal");
              }}
              onBlur={onPreviewEnd}
              onDragOver={(event) => {
                if (onDropCard) event.preventDefault();
              }}
              onDrop={(event) => {
                const cardNo = event.dataTransfer.getData("text/plain");
                if (cardNo) onDropCard?.(lane, cardNo);
              }}
              disabled={!onSlotClick && !canPreview}
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
                card={card}
                hidden={!visible}
                active={activeLane === lane}
                aura={auraByLane?.[lane]}
                label={label}
                tone={tone}
              />
            </button>
          </Fragment>
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
  previewOnly,
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
  previewOnly?: boolean;
  onClick: () => void;
  onDropToLane: (lane: Lane, cardNo: string) => void;
  onPreview: (card: CardView) => void;
  onPreviewEnd: () => void;
}) {
  const holdPreviewPointerRef = useRef<number | null>(null);
  const isPreviewOnlyInput = () =>
    Boolean(previewOnly) ||
    (typeof window !== "undefined" &&
      (window.matchMedia("(hover: none), (pointer: coarse)").matches || window.navigator.maxTouchPoints > 0));
  const closeHoldPreview = () => {
    if (holdPreviewPointerRef.current === null) return;
    holdPreviewPointerRef.current = null;
    onPreviewEnd();
  };

  return (
    <button
      type="button"
      onClick={(event) => {
        if (isPreviewOnlyInput()) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (disabled || used) {
          onPreview(card);
          return;
        }
        onClick();
      }}
      onMouseEnter={() => {
        if (isPreviewOnlyInput()) return;
        onPreview(card);
      }}
      onMouseLeave={() => {
        if (isPreviewOnlyInput()) return;
        onPreviewEnd();
      }}
      onFocus={() => {
        if (isPreviewOnlyInput()) return;
        onPreview(card);
      }}
      onBlur={() => {
        if (isPreviewOnlyInput()) return;
        onPreviewEnd();
      }}
      onPointerDown={(event) => {
        if (!isPreviewOnlyInput()) return;
        event.preventDefault();
        event.stopPropagation();
        holdPreviewPointerRef.current = event.pointerId;
        onPreview(card);
      }}
      draggable={!previewOnly && !disabled && !used}
      onDragStart={(event) => {
        if (isPreviewOnlyInput()) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.setData("text/plain", card.cardNo);
        event.dataTransfer.effectAllowed = "move";
      }}
      onPointerUp={(event) => {
        if (isPreviewOnlyInput()) {
          event.preventDefault();
          event.stopPropagation();
          closeHoldPreview();
          return;
        }
        if (disabled || used) return;
        onPreview(card);
        const target = document
          .elementFromPoint(event.clientX, event.clientY)
          ?.closest<HTMLElement>("[data-triad-lane]");
        const lane = target?.dataset.triadLane as Lane | undefined;
        if (lane) onDropToLane(lane, card.cardNo);
      }}
      onTouchEnd={(event) => {
        if (isPreviewOnlyInput()) {
          event.preventDefault();
          event.stopPropagation();
          closeHoldPreview();
          return;
        }
      }}
      onPointerCancel={(event) => {
        if (!isPreviewOnlyInput()) return;
        event.preventDefault();
        event.stopPropagation();
        closeHoldPreview();
      }}
      onPointerLeave={(event) => {
        if (!isPreviewOnlyInput()) return;
        event.stopPropagation();
        closeHoldPreview();
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      aria-disabled={disabled || used}
      className={`group relative z-[2] min-w-0 touch-manipulation select-none overflow-hidden rounded-lg border bg-black/60 text-left shadow-[0_16px_34px_rgba(0,0,0,0.36)] transition [-webkit-touch-callout:none] [pointer-events:auto] ${
        used
          ? "border-white/8 opacity-30 grayscale"
          : placedLane
            ? "border-amber-300/70 opacity-55"
            : highlighted
              ? "border-cyan-200/80 shadow-[0_0_24px_rgba(34,211,238,0.45)] hover:-translate-y-2"
              : "border-white/14 hover:-translate-y-2 hover:border-amber-200/70"
      }`}
    >
      <div className="relative aspect-[3/4]">
        <Image src={card.sourceImage} alt={card.name} fill sizes="110px" draggable={false} className="select-none object-cover [-webkit-touch-callout:none]" />
        {used ? <div className="absolute inset-0 bg-black/62" /> : null}
      </div>
      {used ? (
        <div className="absolute inset-x-1 bottom-1 rounded-md border border-white/10 bg-black/78 px-1 py-1 text-center text-[8px] font-black uppercase tracking-[0.08em] text-white/58">
          ใช้แล้ว
        </div>
      ) : null}
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
  const [splitHandLayout, setSplitHandLayout] = useState(false);
  const placedByNo = new Map<string, Lane>();
  (["top", "left", "right"] as Lane[]).forEach((lane) => {
    const cardNo = player[lane];
    if (cardNo) placedByNo.set(cardNo, lane);
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncSplitHandLayout = () => {
      const coarsePointer = window.matchMedia("(hover: none), (pointer: coarse)").matches;
      const touchDevice = window.navigator.maxTouchPoints > 0;
      const compactLandscape = window.innerHeight <= 620 && window.innerWidth > window.innerHeight;
      setSplitHandLayout(coarsePointer || touchDevice || compactLandscape);
    };
    syncSplitHandLayout();
    window.addEventListener("resize", syncSplitHandLayout);
    window.addEventListener("orientationchange", syncSplitHandLayout);

    const preloadHandImages = () => {
      cards.forEach((card) => {
        const img = new window.Image();
        img.decoding = "async";
        img.src = card.sourceImage;
      });
    };

    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(preloadHandImages, { timeout: 700 });
      return () => {
        window.cancelIdleCallback(idleId);
        window.removeEventListener("resize", syncSplitHandLayout);
        window.removeEventListener("orientationchange", syncSplitHandLayout);
      };
    }

    const timeoutId = globalThis.setTimeout(preloadHandImages, 180);
    return () => {
      globalThis.clearTimeout(timeoutId);
      window.removeEventListener("resize", syncSplitHandLayout);
      window.removeEventListener("orientationchange", syncSplitHandLayout);
    };
  }, [cards]);

  const canUsePreviewCard =
    previewCard &&
    !locked &&
    !usedSet.has(previewCard.cardNo) &&
    !(placedByNo.has(previewCard.cardNo) && placedByNo.get(previewCard.cardNo) !== activeLane);

  const usePreviewCard = (cardNo: string) => {
    onPlayCard(cardNo);
    setPreviewCard(null);
  };
  const monsterCards = cards.filter((card) => card.kind !== "skill");
  const skillCards = cards.filter((card) => card.kind === "skill");
  const renderHandCard = (card: CardView) => {
    const placedLane = placedByNo.get(card.cardNo);
    const unavailable = usedSet.has(card.cardNo) || Boolean(placedLane && placedLane !== activeLane);
    return (
      <HandCard
        key={card.cardNo}
        card={card}
        used={unavailable}
        placedLane={placedLane}
        disabled={locked}
        highlighted={highlightCardNo === card.cardNo}
        previewOnly={splitHandLayout}
        onClick={() => onPlayCard(card.cardNo)}
        onDropToLane={onDropToLane}
        onPreview={setPreviewCard}
        onPreviewEnd={() => setPreviewCard(null)}
      />
    );
  };

  return (
    <div className="triad-player-hand relative z-[90] rounded-xl border border-white/8 bg-black/28 p-2 shadow-[0_18px_48px_rgba(0,0,0,0.32)] [container-type:inline-size]">
      <CardHoverPreview card={previewCard} onClose={() => setPreviewCard(null)} onUseCard={canUsePreviewCard ? usePreviewCard : undefined} passive />
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
      <div className={`triad-hand-grid ${splitHandLayout ? "triad-hand-grid-split" : ""} grid min-h-0 grid-cols-[repeat(auto-fit,minmax(clamp(48px,6.2vw,82px),1fr))] gap-1.5 overflow-visible pb-1`}>
        <div className="triad-hand-row triad-hand-row-monster">
          <div className="triad-hand-row-label">มอนสเตอร์</div>
          {monsterCards.map(renderHandCard)}
        </div>
        <div className="triad-hand-row triad-hand-row-skill">
          <div className="triad-hand-row-label">สกิล</div>
          {skillCards.map(renderHandCard)}
        </div>
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
      <CardHoverPreview card={previewCard} onClose={() => setPreviewCard(null)} />
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

function OpeningTieBreakResultOverlay({
  tieBreak,
  hostName,
  challengerName,
  visible,
}: {
  tieBreak?: OpeningTieBreak | null;
  hostName: string;
  challengerName: string;
  visible: boolean;
}) {
  if (!visible || !tieBreak || tieBreak.status !== "resolved" || !tieBreak.winner) return null;

  const revealedChoices = tieBreak.revealChoices || tieBreak.choices;
  const hostChoice = revealedChoices.host || "unknown";
  const challengerChoice = revealedChoices.challenger || "unknown";
  const winnerName = tieBreak.winner === "host" ? hostName : challengerName;
  const choiceRows: Array<[RoomPlayerSide, string, TriadRpsChoice]> = [
    ["host", hostName, hostChoice],
    ["challenger", challengerName, challengerChoice],
  ];

  return (
    <div className="triad-tiebreak-result-overlay fixed inset-0 z-[96] grid place-items-center bg-black/78 px-4 backdrop-blur-lg">
      <div className="triad-tiebreak-result-panel overflow-hidden rounded-[26px] border border-amber-100/32 bg-[#07070b]/96 p-6 text-center text-white shadow-[0_0_100px_rgba(251,191,36,0.26)]">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-amber-100/35 bg-amber-300 text-black shadow-[0_0_34px_rgba(251,191,36,0.36)]">
          <Trophy className="h-7 w-7" />
        </div>
        <div className="mt-4 text-[11px] font-black uppercase tracking-[0.22em] text-amber-100/70">เป่ายิงฉุบตัดสินสิทธิ์เปิดก่อน</div>
        <div className="mt-2 text-4xl font-black leading-none text-white triad-tiebreak-result-title">{winnerName}</div>
        <div className="mt-3 inline-flex rounded-full border border-emerald-200/30 bg-emerald-300/12 px-4 py-2 text-sm font-black text-emerald-50">
          ชนะจากการตัดสินเป่ายิงฉุบ
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 triad-tiebreak-result-choices">
          {choiceRows.map(([side, name, choice]) => (
            <div
              key={side}
              className={`rounded-2xl border p-3 ${side === tieBreak.winner ? "border-amber-200/55 bg-amber-200/13 text-amber-50" : "border-white/10 bg-white/[0.035] text-white/62"}`}
            >
              <div className="truncate text-xs font-black uppercase tracking-[0.1em]">{name}</div>
              <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/28 px-3 py-1 text-sm font-black">
                {rpsIcon(choice)}
                {rpsLabel[choice]}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-2xl border border-amber-100/26 bg-amber-200/10 px-4 py-3 text-base font-black leading-7 text-amber-50 triad-tiebreak-result-note">
          {winnerName} ได้เป็นฝ่ายเปิดการ์ดและเริ่มใช้สกิลก่อน
        </div>
        <div className="mt-3 text-xs font-black uppercase tracking-[0.18em] text-white/36">กำลังเข้าสู่ตาถัดไปอัตโนมัติ</div>
      </div>
    </div>
  );
}

function OpeningTieBreakOverlay({
  tieBreak,
  hostName,
  challengerName,
  ownSide,
  isSpectator,
  pendingChoice,
  onChoose,
  onReset,
  resetDisabled,
  onExit,
}: {
  tieBreak?: OpeningTieBreak | null;
  hostName: string;
  challengerName: string;
  ownSide: RoomPlayerSide | null;
  isSpectator: boolean;
  pendingChoice: TriadRpsChoice | null;
  onChoose: (choice: TriadRpsChoice) => void;
  onReset?: () => void;
  resetDisabled?: boolean;
  onExit?: () => void;
}) {
  if (!tieBreak || (tieBreak.status !== "waiting" && tieBreak.status !== "resolved")) return null;
  const revealedChoices = tieBreak.revealChoices || tieBreak.choices;
  const hostChoice = revealedChoices.host || "unknown";
  const challengerChoice = revealedChoices.challenger || "unknown";
  const ownChoice = pendingChoice || (ownSide ? tieBreak.choices[ownSide] || "unknown" : "unknown");
  const winnerName = tieBreak.winner === "host" ? hostName : tieBreak.winner === "challenger" ? challengerName : "";
  const resolved = tieBreak.status === "resolved" && Boolean(tieBreak.winner);
  const canChoose = tieBreak.status === "waiting" && !isSpectator && ownSide && ownChoice === "unknown";
  const previousRoundDraw = tieBreak.status === "waiting" && hostChoice !== "unknown" && challengerChoice !== "unknown";

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-black/72 px-4 backdrop-blur-md">
      <div className="w-[min(560px,94vw)] rounded-2xl border border-amber-200/36 bg-[#080a12] p-5 text-white shadow-[0_28px_110px_rgba(0,0,0,0.62)]">
        <div className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl border border-amber-200/25 bg-amber-200/10 text-amber-100">
            <Swords className="h-6 w-6" />
          </div>
          <div className="mt-4 text-[10px] font-black uppercase tracking-[0.2em] text-amber-100/62">ตัดสินฝ่ายเปิดสกิลตาถัดไป</div>
          <div className="mt-1 text-2xl font-black">{resolved ? "ตัดสินเป่ายิงฉุบแล้ว" : previousRoundDraw ? "เป่ายิงฉุบเสมอ เลือกใหม่" : "ตาแรกคะแนนเสมอแล้ว"}</div>
          <div className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-amber-100/48">รอบเป่ายิงฉุบที่ {tieBreak.round || 1}</div>
          <p className="mt-3 text-sm font-semibold leading-6 text-white/68">
            {resolved && winnerName
              ? `${winnerName} ชนะจากการตัดสินเป่ายิงฉุบ และจะเป็นฝ่ายเปิดการ์ด/ใช้สกิลก่อนในตาถัดไป`
              : tieBreak.message || "ใช้เป่ายิงฉุบเพื่อเลือกฝ่ายเปิดการ์ดสกิลในตาถัดไปเท่านั้น คะแนนตาแรกยังนับเป็นเสมอ"}
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

        {resolved ? (
          <div className="mt-5 rounded-xl border border-emerald-200/24 bg-emerald-300/10 p-4 text-center text-sm font-black text-emerald-100">
            {winnerName} ชนะจากการเป่ายิงฉุบ และได้เปิดสกิลก่อนในตาถัดไป
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {previousRoundDraw ? (
              <div className="rounded-xl border border-amber-200/24 bg-amber-300/10 p-3 text-center text-sm font-black text-amber-100">
                เสมออีกครั้ง เลือกใหม่ได้ทันที จนกว่าจะมีผู้ชนะเพื่อเปิดสกิลก่อน
              </div>
            ) : null}
            {canChoose ? (
              <div className="grid grid-cols-3 gap-2">
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
              <div className="space-y-3 rounded-xl border border-white/10 bg-black/28 p-4 text-center text-sm font-semibold text-white/58">
                <div>{isSpectator ? "ผู้ชมกำลังรอดูผลการล็อกของทั้งสองฝ่าย" : "ล็อกคำตอบแล้ว รออีกฝ่าย"}</div>
                {isSpectator && onExit ? (
                  <button
                    type="button"
                    onClick={onExit}
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-white/12 bg-white/8 px-4 text-xs font-black text-white transition hover:border-amber-100/45 hover:bg-amber-200/12 hover:text-amber-100"
                  >
                    ออกจากห้องนี้
                  </button>
                ) : null}
              </div>
            )}
          </div>
        )}
        {!isSpectator && ownSide && onReset ? (
          <button
            type="button"
            onClick={onReset}
            disabled={resetDisabled}
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-200/24 bg-red-500/10 text-xs font-black uppercase tracking-[0.12em] text-red-100 transition hover:border-red-100/55 hover:bg-red-500/18 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {resetDisabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
            Reset RPS
          </button>
        ) : null}
      </div>
    </div>
  );
}

function CardHoverPreview({
  card,
  onClose,
  onUseCard,
  passive = false,
}: {
  card: CardView | null;
  onClose?: () => void;
  onUseCard?: (cardNo: string) => void;
  passive?: boolean;
}) {
  const useCardStampRef = useRef(0);
  const interactive = !passive && (Boolean(onUseCard) || Boolean(onClose));
  const useCardFromPreview = () => {
    if (!card || !onUseCard) return;
    const now = Date.now();
    if (now - useCardStampRef.current < 180) return;
    useCardStampRef.current = now;
    onUseCard(card.cardNo);
  };

  useEffect(() => {
    if (!card || !onClose) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [card, onClose]);

  if (!card) return null;
  return (
    <div
      className={`triad-card-preview-overlay fixed inset-0 z-[80] grid place-items-center bg-black/18 p-4 backdrop-blur-[2px] ${interactive ? "pointer-events-auto" : "pointer-events-none"}`}
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.currentTarget === event.target) onClose?.();
      }}
    >
      <div
        className={`triad-card-preview-panel ${interactive ? "pointer-events-auto" : "triad-card-preview-panel-passive pointer-events-none"} relative w-[min(430px,82vw)] rounded-[24px] border border-amber-100/55 bg-black/88 p-4 shadow-[0_0_90px_rgba(251,191,36,0.42)]`}
        onPointerDown={(event) => event.stopPropagation()}
        onPointerUp={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
        onTouchEnd={(event) => event.stopPropagation()}
      >
        {onClose && !passive ? (
          <button
            type="button"
            aria-label="ปิดหน้าต่างการ์ด"
            onClick={onClose}
            className="triad-card-preview-close absolute right-2 top-2 z-20 grid h-9 w-9 place-items-center rounded-full border border-white/16 bg-black/72 text-white shadow-[0_10px_28px_rgba(0,0,0,0.36)] transition hover:border-amber-100/55 hover:text-amber-100"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
        <div className="triad-card-preview-image relative mx-auto aspect-[3/4] w-[min(330px,70vw)] overflow-hidden rounded-[18px] border border-white/18 bg-black shadow-[0_22px_80px_rgba(0,0,0,0.55)]">
          <Image
            src={card.sourceImage}
            alt={card.name}
            fill
            sizes="(hover: none) and (pointer: coarse) 72svh, 360px"
            className="object-contain"
            priority
            loading="eager"
            unoptimized
          />
        </div>
        <div className="triad-card-preview-info mt-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100/58">No.{card.cardNo}</div>
          <div className="mt-1 line-clamp-2 text-xl font-black leading-tight text-white">{card.name}</div>
          <div className="mt-2 flex flex-wrap gap-1 text-[10px] font-black text-black">
            <span className="rounded-md bg-amber-200 px-2 py-1">ATK {card.attack.toLocaleString()}</span>
            <span className="rounded-md bg-cyan-200 px-2 py-1">SUP {card.support.toLocaleString()}</span>
          </div>
          <div className="triad-card-preview-text mt-2 max-h-28 overflow-hidden text-sm font-semibold leading-6 text-white/72">
            {card.skillText || "มอนสเตอร์ใช้ค่าสถานะในการปะทะ"}
          </div>
          {onUseCard && !passive ? (
            <button
              type="button"
              className="triad-card-preview-use mt-3 hidden w-full items-center justify-center rounded-xl border border-amber-100/70 bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 px-4 py-3 text-sm font-black text-black shadow-[0_0_28px_rgba(251,191,36,0.55)] transition active:scale-[0.98]"
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => {
                event.preventDefault();
                event.stopPropagation();
                useCardFromPreview();
              }}
              onTouchStart={(event) => event.stopPropagation()}
              onTouchEnd={(event) => {
                event.preventDefault();
                event.stopPropagation();
                useCardFromPreview();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                useCardFromPreview();
              }}
            >
              เลือกใช้การ์ดใบนี้
            </button>
          ) : null}
          {onClose && !passive ? (
            <button
              type="button"
              onClick={onClose}
              className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-xl border border-white/12 bg-white/8 text-sm font-black text-white transition hover:border-amber-100/45 hover:bg-amber-200/12 hover:text-amber-100"
            >
              ปิด
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function BattleRoomChatPanel({
  room,
  currentUserId,
  onSend,
}: {
  room: TriadRoom | null | undefined;
  currentUserId: string;
  onSend: (text: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const messages = room?.game.chat || [];
  const memberCount =
    (room?.seats.host ? 1 : 0) +
    (room?.seats.challenger ? 1 : 0) +
    (room?.spectators.length || 0);

  useEffect(() => {
    const messagesEl = messagesRef.current;
    if (!messagesEl) return;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }, [messages.length, room?.code]);

  useEffect(() => {
    if (!emojiOpen) return;
    const closeEmojiPicker = (event: MouseEvent) => {
      if (!emojiRef.current?.contains(event.target as Node)) {
        setEmojiOpen(false);
      }
    };
    document.addEventListener("mousedown", closeEmojiPicker);
    return () => document.removeEventListener("mousedown", closeEmojiPicker);
  }, [emojiOpen]);

  const submit = async () => {
    const text = draft.trim();
    if (!text || !room?.code) return;
    setDraft("");
    setSending(true);
    void onSend(text).then((ok) => {
      if (!ok) setDraft((current) => current || text);
      setSending(false);
    });
  };

  return (
    <section className="triad-battle-chat-panel flex min-h-[300px] flex-col overflow-hidden rounded-2xl border border-amber-200/24 bg-[radial-gradient(circle_at_18%_0%,rgba(251,191,36,0.16),transparent_34%),linear-gradient(180deg,rgba(18,13,5,0.94),rgba(4,4,7,0.98))] shadow-[0_24px_70px_rgba(0,0,0,0.42),0_0_42px_rgba(251,191,36,0.08),inset_0_0_0_1px_rgba(255,244,214,0.055)] 2xl:h-[min(560px,calc(100vh-300px))] 2xl:min-h-[380px]">
      <div className="border-b border-amber-200/14 bg-[linear-gradient(135deg,rgba(251,191,36,0.22),rgba(180,83,9,0.12),transparent)] px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-100/32 bg-amber-300/14 text-amber-100 shadow-[0_0_26px_rgba(251,191,36,0.2)]">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-black text-white">แชทสดสนาม</div>
              <div className="mt-0.5 text-[11px] font-black uppercase tracking-[0.16em] text-amber-100/62">
                ห้อง {room?.code || "------"} • {memberCount} คน
              </div>
            </div>
          </div>
          <div className="rounded-full border border-amber-100/34 bg-amber-300/14 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-amber-100 shadow-[0_0_20px_rgba(251,191,36,0.14)]">
            LIVE
          </div>
        </div>
      </div>

      <div ref={messagesRef} className="triad-battle-chat-messages min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length > 0 ? (
          messages.map((message) => {
            const mine = message.senderId === currentUserId;
            return (
              <div key={message.id} className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                {!mine ? (
                  <Image
                    src={message.senderImage || "/avatar.png"}
                    alt={message.senderName}
                    width={34}
                    height={34}
                    className="mt-1 h-8 w-8 shrink-0 rounded-lg border border-white/10 object-cover"
                  />
                ) : null}
                <div className={`max-w-[88%] ${mine ? "text-right" : "text-left"}`}>
                  <div className={`mb-1 flex items-center gap-2 text-[11px] font-bold text-white/38 ${mine ? "justify-end" : ""}`}>
                    <span className="max-w-[190px] truncate">{mine ? "เรา" : message.senderName}</span>
                    <span>{new Date(message.createdAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <div
                    className={`break-words rounded-2xl border px-4 py-2.5 text-[15px] font-semibold leading-6 ${
                      mine
                        ? "border-amber-200/34 bg-[linear-gradient(135deg,rgba(251,191,36,0.22),rgba(180,83,9,0.12))] text-amber-50 shadow-[0_0_22px_rgba(251,191,36,0.08)]"
                        : "border-amber-100/16 bg-white/[0.055] text-white/82"
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="grid h-full min-h-[190px] place-items-center text-center">
            <div className="px-6">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-dashed border-amber-100/22 bg-amber-300/[0.045] text-amber-100/60">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div className="mt-3 text-sm font-black text-white/62">ยังไม่มีข้อความ</div>
              <div className="mt-1 text-xs font-semibold text-white/38">พิมพ์คุยกับผู้เล่นและผู้ชมในห้องนี้ได้เลย</div>
            </div>
          </div>
        )}
      </div>

      <form
        className="border-t border-amber-200/12 bg-black/30 p-2.5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="flex items-center gap-2 rounded-2xl border border-amber-100/18 bg-black/48 p-1.5 shadow-[inset_0_0_0_1px_rgba(255,244,214,0.045)]">
          <div ref={emojiRef} className="relative shrink-0">
            {emojiOpen ? (
              <div className="absolute bottom-[calc(100%+0.75rem)] left-0 z-[90]">
                <ChatEmojiPicker
                  onSelect={(emoji) => {
                    setDraft((current) => `${current}${emoji}`.slice(0, 240));
                    setEmojiOpen(false);
                  }}
                  onClose={() => setEmojiOpen(false)}
                />
              </div>
            ) : null}
            <button
              type="button"
              disabled={!room?.code}
              onClick={() => setEmojiOpen((current) => !current)}
              className={`grid h-10 w-10 place-items-center rounded-xl border transition disabled:cursor-not-allowed disabled:opacity-35 ${
                emojiOpen
                  ? "border-amber-200/50 bg-amber-300/14 text-amber-100"
                  : "border-white/10 bg-white/[0.055] text-white/58 hover:border-amber-200/38 hover:text-amber-100"
              }`}
              aria-label="เลือกอีโมจิ"
              aria-expanded={emojiOpen}
            >
              <Smile className="h-4.5 w-4.5" />
            </button>
          </div>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value.slice(0, 240))}
            disabled={!room?.code}
            placeholder="พิมพ์แชทสด..."
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[14px] font-semibold text-white outline-none placeholder:text-white/30 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={!draft.trim() || !room?.code}
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-black transition disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/25 ${sending ? "bg-amber-100" : "bg-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.18)] hover:bg-amber-200"}`}
            aria-label="ส่งข้อความ"
          >
            <SendHorizontal className="h-4 w-4" />
          </button>
        </div>
      </form>
    </section>
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
  onPreviewEnd,
}: {
  title: string;
  cards: CardView[];
  tone: "top" | "bottom";
  onPreview?: (card: CardView | null) => void;
  onPreviewEnd?: () => void;
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
            onMouseLeave={onPreviewEnd}
            onPointerEnter={() => onPreview?.(card)}
            onPointerMove={() => onPreview?.(card)}
            onPointerLeave={onPreviewEnd}
            onFocus={() => onPreview?.(card)}
            onBlur={onPreviewEnd}
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
  profile,
  isLeader,
  tone,
  emptyText,
  canTake,
  onTake,
}: {
  label: string;
  participant: RoomParticipant | null;
  profile?: TriadRankProfile | null;
  isLeader?: boolean;
  tone: "host" | "challenger";
  emptyText: string;
  canTake: boolean;
  onTake: () => void;
}) {
  const toneClass =
    tone === "host"
      ? "border-amber-300/45 from-amber-300/18 via-[#120806]/82 to-black"
      : "border-amber-200/28 from-[#2a1112]/82 via-[#120608]/88 to-black";
  const botSeat = isBotParticipant(participant);
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
          {botSeat ? (
            <div className="absolute left-1/2 top-0 z-10 inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-cyan-100/45 bg-cyan-200/14 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-50 shadow-[0_0_30px_rgba(34,211,238,0.24)]">
              <Bot className="h-3.5 w-3.5" />
              AI COMBAT CORE
            </div>
          ) : null}
          <RankAvatar participant={participant} profile={profile} size="xl" crown={isLeader} />
          <div className="mt-5 w-full border-y border-white/10 bg-black/34 px-3 py-3">
            <div className="truncate text-2xl font-black uppercase tracking-normal text-white">{participant.name}</div>
            <div className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-amber-100/62">
              {botSeat ? "LEVEL 99 AI DUELIST" : profile?.rankName || rankFrames[rankIndexForParticipant(participant, profile)].name}
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
  rankProfiles,
  canWatch,
  onWatch,
}: {
  spectators: RoomParticipant[];
  currentId: string;
  rankProfiles: Record<string, TriadRankProfile>;
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
                <RankAvatar participant={spectator} profile={profileForParticipant(spectator, rankProfiles)} size="sm" />
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

function SpectatorAvatarRail({
  spectators,
  rankProfiles,
  currentParticipantId,
}: {
  spectators: RoomParticipant[];
  rankProfiles: Record<string, TriadRankProfile>;
  currentParticipantId?: string;
}) {
  return (
    <div className="triad-spectator-avatar-rail flex min-w-0 flex-wrap items-center gap-1.5 sm:justify-end">
      {Array.from({ length: SPECTATOR_LIMIT }).map((_, index) => {
        const spectator = spectators[index];
        return spectator ? (
          <MiniProfileHover
            key={spectator.id}
            participant={spectator}
            profile={profileForParticipant(spectator, rankProfiles)}
            label={`ผู้ชม ${index + 1}`}
            align={index > 5 ? "right" : "left"}
            currentParticipantId={currentParticipantId}
          />
        ) : (
          <div
            key={`empty-${index}`}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-dashed border-white/10 bg-black/32 text-[10px] font-black text-white/20"
            title={`ที่นั่งผู้ชม ${index + 1}`}
          >
            {index + 1}
          </div>
        );
      })}
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
  isDraw,
  rankUpEvents = [],
}: {
  winner: string;
  surrendered?: string;
  score: { player: number; bot: number };
  isDraw?: boolean;
  rankUpEvents?: TriadRankUpEvent[];
}) {
  return (
    <div className="triad-match-final-overlay pointer-events-none fixed inset-0 z-[95] grid place-items-center bg-[radial-gradient(circle_at_50%_45%,rgba(251,191,36,0.22),rgba(0,0,0,0.72)_48%,rgba(0,0,0,0.9)_100%)] p-4 backdrop-blur-sm">
      <div className="triad-match-final-panel relative grid w-[min(680px,calc(100svw-24px))] max-h-[calc(100svh-24px)] place-items-center overflow-hidden rounded-[24px] border border-amber-100/45 bg-black/84 p-6 text-center shadow-[0_0_90px_rgba(251,191,36,0.34)]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-200 to-transparent" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.12),transparent)] opacity-40" />
        <div className="triad-match-final-content relative">
          <div className="triad-match-final-icon mx-auto grid h-16 w-16 place-items-center rounded-full border border-amber-100/70 bg-amber-300 text-black shadow-[0_0_50px_rgba(251,191,36,0.55)]">
            <Trophy className="h-8 w-8" />
          </div>
          <div className="triad-match-final-title mt-5 text-[clamp(2.1rem,6vw,4.8rem)] font-black uppercase leading-none text-white drop-shadow-[0_0_32px_rgba(255,255,255,0.65)]">
            {isDraw ? "เสมออย่างสมศักดิ์ศรี" : "ชนะที่แท้จริง"}
          </div>
          <div className="triad-match-final-winner mt-4 text-[clamp(1.25rem,3.2vw,2.15rem)] font-black text-amber-100">{winner}</div>
          {surrendered ? (
            <div className="triad-match-final-surrender mt-2 text-sm font-bold text-white/58">{surrendered} ยอมแพ้ การต่อสู้จบลงทันที</div>
          ) : null}
          <div className="triad-match-final-score mx-auto mt-5 w-fit rounded-full border border-red-200/35 bg-red-500/16 px-5 py-2 text-xl font-black text-white">
            คะแนนรวม {score.player}-{score.bot}
          </div>
          {rankUpEvents.length > 0 ? (
            <div className="mx-auto mt-4 grid w-[min(520px,100%)] gap-2">
              {rankUpEvents.map((event) => {
                const frame = rankFrames.find((rankFrame) => rankFrame.key === event.nextRank) || rankFrames[0];
                return (
                  <div key={`${event.userId}-${event.nextRank}-${event.at}`} className={`rounded-2xl border px-4 py-3 text-left shadow-[0_0_38px_rgba(251,191,36,0.14)] ${frame.badge}`}>
                    <div className="flex items-center gap-2 text-sm font-black">
                      <Sparkles className="h-4 w-4" />
                      เลื่อนแรงค์!
                    </div>
                    <div className="mt-1 text-xs font-bold opacity-90">
                      {event.name} ขึ้นสู่ {event.rankName} ด้วยชัยชนะ {event.wins.toLocaleString()} เกม
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
          <div className="triad-match-final-note mt-4 text-xs font-black uppercase tracking-[0.18em] text-white/42">
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
  targetPlayerTop,
  targetBotTop,
  selectedTarget,
  timeLeft,
  onSelect,
  onConfirm,
}: {
  card?: CardView;
  side: Side;
  playerTop?: CardView;
  botTop?: CardView;
  targetPlayerTop?: CardView;
  targetBotTop?: CardView;
  selectedTarget: PendingSkillChoice["selectedTarget"];
  timeLeft: number;
  onSelect: (target: SkillTargetSelection) => void;
  onConfirm: () => void;
}) {
  if (!card) return null;

  const requiresTwoTargets = isTwoStepTargetSkill(card);
  const selectedTargets = parseSkillTargetSelection(selectedTarget);
  const selectableTargetIds = new Set(getSelectableSkillTargetIds(card, side, targetPlayerTop || playerTop, targetBotTop || botTop));
  const targets = [
    { id: "player-top" as const, label: "การ์ดหลักเรา", card: playerTop, tone: "border-red-300/60" },
    { id: "bot-top" as const, label: "การ์ดหลักคู่แข่ง", card: botTop, tone: "border-cyan-300/60" },
  ].filter((target) => selectableTargetIds.has(target.id));
  const effectiveSelectedTarget = requiresTwoTargets
    ? selectedTargets.length === 2 ? selectedTarget : ""
    : selectedTarget || (targets.length === 1 ? targets[0].id : "");

  return (
    <div className="triad-skill-target-overlay absolute bottom-4 right-4 top-16 z-[90] flex w-[min(430px,calc(100%-2rem))] items-center">
      <div className="triad-skill-target-panel max-h-full w-full overflow-auto rounded-2xl border border-violet-200/30 bg-[#08070d]/96 p-4 shadow-[0_0_80px_rgba(168,85,247,0.35)] backdrop-blur-md sm:p-5">
        <div className="triad-skill-target-header text-center">
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-violet-200/70">เลือกเป้าหมายสกิล</div>
          <div className="mt-1 text-2xl font-black uppercase text-white">{card.name}</div>
          <div className="mx-auto mt-2 max-w-2xl text-sm font-semibold leading-6 text-white/62">{card.skillText}</div>
          <div className="mt-3 text-lg font-black text-amber-200">
            {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
          </div>
          {requiresTwoTargets ? (
            <div className="mx-auto mt-3 grid max-w-xl gap-2 text-left text-xs font-black text-white/68 sm:grid-cols-2">
              <div className="rounded-xl border border-rose-200/28 bg-rose-400/10 px-3 py-2">
                ตัวที่ 1: ATK -2,000 {selectedTargets[0] ? `(${selectedTargets[0] === "player-top" ? "การ์ดหลักเรา" : "การ์ดหลักคู่แข่ง"})` : ""}
              </div>
              <div className="rounded-xl border border-emerald-200/28 bg-emerald-400/10 px-3 py-2">
                ตัวที่ 2: ATK +2,000 {selectedTargets[1] ? `(${selectedTargets[1] === "player-top" ? "การ์ดหลักเรา" : "การ์ดหลักคู่แข่ง"})` : ""}
              </div>
            </div>
          ) : null}
        </div>

        <div className="triad-skill-target-list mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {targets.map((target) => (
            <button
              key={target.id}
              type="button"
              onClick={() => onSelect(requiresTwoTargets ? nextTwoStepTargetSelection(selectedTarget, target.id) : target.id)}
              className={`triad-skill-target-choice rounded-2xl border bg-black/42 p-3 text-left transition hover:-translate-y-1 ${
                selectedTargets.includes(target.id) || effectiveSelectedTarget === target.id ? "border-amber-300 shadow-[0_0_34px_rgba(251,191,36,0.28)]" : target.tone
              }`}
            >
              <div className="mb-2 text-center text-xs font-black uppercase tracking-[0.18em] text-white/56">{target.label}</div>
              {requiresTwoTargets && selectedTargets.includes(target.id) ? (
                <div className="mb-2 text-center text-[11px] font-black text-amber-100">
                  {selectedTargets[0] === target.id ? "ตัวที่ 1: ลด ATK" : "ตัวที่ 2: เพิ่ม ATK"}
                </div>
              ) : null}
              <div className="triad-skill-target-card mx-auto w-[clamp(90px,18vw,150px)]">
                <BoardCardSlot card={target.card} label={target.label} tone={target.id === "player-top" ? "player" : "bot"} />
              </div>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => {
            if (!requiresTwoTargets && !selectedTarget && targets.length === 1) onSelect(targets[0].id);
            onConfirm();
          }}
          disabled={!effectiveSelectedTarget}
          className="triad-skill-target-confirm mt-5 h-12 w-full rounded-2xl bg-violet-300 text-sm font-black uppercase tracking-[0.14em] text-black transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-white/30"
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

function ReadyAdvanceButton({
  label,
  readyCount,
  myReady,
  opponentReady,
  opponentName,
  onClick,
  disabled,
}: {
  label: string;
  readyCount: number;
  myReady: boolean;
  opponentReady: boolean;
  opponentName: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group relative flex min-h-[74px] w-full items-center justify-between overflow-hidden rounded-2xl border px-4 text-left font-black transition active:scale-[0.985] disabled:cursor-not-allowed ${
        myReady
          ? "border-emerald-200/32 bg-[linear-gradient(135deg,rgba(16,185,129,0.24),rgba(6,78,59,0.28))] text-emerald-50 shadow-[0_0_34px_rgba(16,185,129,0.18),inset_0_0_0_1px_rgba(255,255,255,0.05)]"
          : "border-amber-100/45 bg-[linear-gradient(135deg,#ffe58a,#f59e0b)] text-black shadow-[0_0_36px_rgba(251,191,36,0.30),inset_0_0_0_1px_rgba(255,255,255,0.30)] hover:-translate-y-0.5 hover:shadow-[0_0_48px_rgba(251,191,36,0.46)]"
      }`}
    >
      {!myReady ? <span className="absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.5),transparent)] opacity-0 transition group-hover:translate-x-full group-hover:opacity-80" /> : null}
      {myReady ? <span className="absolute inset-0 bg-emerald-300/10" /> : null}
      <span className="relative z-10 flex min-w-0 items-center gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border ${myReady ? "border-emerald-100/25 bg-emerald-200/12 text-emerald-100" : "border-black/10 bg-black/14 text-black"}`}>
          {myReady ? <Check className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-base">
            {myReady ? `พร้อมแล้ว (${readyCount}/2)` : `พร้อม (${readyCount}/2)`}
          </span>
          <span className={`mt-1 block truncate text-[10px] uppercase tracking-[0.12em] ${myReady ? "text-emerald-100/68" : "text-black/60"}`}>
            {opponentReady ? `${opponentName} พร้อมแล้ว` : label}
          </span>
        </span>
      </span>
      <ChevronRight className={`relative z-10 h-5 w-5 shrink-0 ${myReady ? "text-emerald-100/48" : "text-black/56"}`} />
    </button>
  );
}

function TimeoutWarningOverlay({
  secondsLeft,
  missingNames,
}: {
  secondsLeft: number;
  missingNames: string[];
}) {
  if (secondsLeft > 30 || secondsLeft <= 0 || missingNames.length === 0) return null;
  const nameText = missingNames.length === 1 ? missingNames[0] : missingNames.join(" และ ");

  return (
    <div className="triad-timeout-warning-overlay pointer-events-none absolute inset-0 z-[80] grid place-items-center px-4">
      <div className="absolute inset-0 bg-black/42 backdrop-blur-[2px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(248,113,113,0.28),rgba(0,0,0,0.28)_34%,transparent_68%)]" />
      <div className="triad-timeout-warning-pulse absolute z-[81] h-[min(420px,72vw)] w-[min(420px,72vw)] animate-ping rounded-full border border-red-300/25 bg-red-500/8" />
      <div className="triad-timeout-warning-panel relative z-[90] w-[min(760px,94vw)] overflow-hidden rounded-[28px] border border-red-200/45 bg-black/86 p-5 text-center shadow-[0_0_92px_rgba(248,113,113,0.52),inset_0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-md sm:p-7">
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-red-100 to-transparent" />
        <div className="absolute inset-0 bg-[conic-gradient(from_180deg_at_50%_50%,rgba(248,113,113,0.22),rgba(251,191,36,0.16),rgba(34,211,238,0.10),rgba(248,113,113,0.22))] opacity-30" />
        <div className="relative">
          <div className="triad-timeout-warning-icon mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-red-100/35 bg-red-500/18 text-red-100 shadow-[0_0_34px_rgba(248,113,113,0.38)]">
            <Flame className="h-6 w-6" />
          </div>
          <div className="text-[10px] font-black uppercase tracking-[0.24em] text-red-100/70">
            Turn timeout warning
          </div>
          <div className="triad-timeout-warning-title mt-2 text-[clamp(1.15rem,3vw,2rem)] font-black leading-tight text-white">
            ผู้เล่น {nameText} ยังไม่ลงการ์ด
          </div>
          <div className="triad-timeout-warning-count mx-auto mt-4 grid h-[clamp(112px,18vw,180px)] w-[clamp(112px,18vw,180px)] place-items-center rounded-full border-[6px] border-red-100 bg-[radial-gradient(circle,#fb7185,#b91c1c_58%,#450a0a)] text-[clamp(4rem,10vw,8rem)] font-black leading-none text-white shadow-[0_0_70px_rgba(248,113,113,0.72)]">
            {secondsLeft}
          </div>
          <div className="triad-timeout-warning-note mx-auto mt-4 max-w-2xl rounded-full border border-amber-100/28 bg-amber-300/12 px-4 py-2 text-sm font-black text-amber-50 shadow-[0_0_32px_rgba(251,191,36,0.18)]">
            จะถูกปรับแพ้ใน {secondsLeft} วินาที หากไม่ลงการ์ด
          </div>
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
  playerParticipant,
  botParticipant,
  rankProfiles,
  currentParticipantId,
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
  readyAdvanceSlot,
  skillOpenerName,
  skillSecondName,
  nextSkillOpenerName,
  nextSkillSecondName,
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
  playerParticipant?: RoomParticipant | null;
  botParticipant?: RoomParticipant | null;
  rankProfiles?: Record<string, TriadRankProfile>;
  currentParticipantId?: string;
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
  readyAdvanceSlot?: ReactNode;
  skillOpenerName?: string;
  skillSecondName?: string;
  nextSkillOpenerName?: string;
  nextSkillSecondName?: string;
}) {
  const [previewCard, setPreviewCard] = useState<CardView | null>(null);
  const [previewMode, setPreviewMode] = useState<CardPreviewMode>("hover");
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
  const pendingFallbackTargets = pendingSkillChoice
    ? getSelectableSkillTargetIds(pendingSkillCard, pendingSkillChoice.side, cardsByNo.get(playerTriangle.top), cardsByNo.get(botTriangle.top))
    : [];
  const pendingTarget = pendingSkillChoice?.selectedTarget || (pendingFallbackTargets.length === 1 ? pendingFallbackTargets[0] : "");
  const playerAuraByLane: Partial<Record<Lane, TargetAura>> = {};
  const botAuraByLane: Partial<Record<Lane, TargetAura>> = {};
  const timeoutMissingNames =
    timeLeft <= 30 && timeLeft > 0 && !currentResult
      ? [
          !displayPlayerTriangle[activeLane] ? playerName : "",
          !displayBotTriangle[activeLane] ? botName : "",
        ].filter(Boolean)
      : [];
  if (skillChoiceForAura) {
    const sourceAura: TargetAura = skillChoiceForAura === pendingSkillChoice ? "pending" : "enemy";
    if (skillChoiceForAura.side === "player") playerAuraByLane[skillChoiceForAura.lane] = sourceAura;
    else botAuraByLane[skillChoiceForAura.lane] = sourceAura;
  }
  for (const pendingTargetId of parseSkillTargetSelection(pendingTarget)) {
    const aura: TargetAura = pendingTargetId === "player-top" ? "own" : "enemy";
    if (pendingTargetId === "player-top") playerAuraByLane.top = aura;
    if (pendingTargetId === "bot-top") botAuraByLane.top = aura;
  }
  if (blessingAuras?.player) playerAuraByLane.top = blessingAuras.player;
  if (blessingAuras?.bot) botAuraByLane.top = blessingAuras.bot;
  const showBoardPreview = (card: CardView, mode: CardPreviewMode = "hover") => {
    setPreviewMode(mode);
    setPreviewCard(card);
  };
  const closeBoardPreview = () => {
    setPreviewCard(null);
    setPreviewMode("hover");
  };
  return (
    <div className="triad-compact-board relative h-full min-h-[clamp(330px,62dvh,600px)] max-w-full overflow-hidden rounded-[18px] border border-amber-100/14 bg-[#0a0908] shadow-[0_28px_90px_rgba(0,0,0,0.55)] [--triad-card-size:clamp(40px,12.5cqw,86px)] [--triad-pile-size:clamp(34px,8.8cqw,68px)] [--triad-slot-gap:clamp(4px,1.7cqw,10px)] [--triad-top-card-size:clamp(44px,13cqw,90px)] [container-type:inline-size] sm:min-h-[clamp(390px,64dvh,640px)] 2xl:min-h-0">
      <CardHoverPreview card={previewCard} onClose={closeBoardPreview} passive={previewMode === "hover"} />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(251,191,36,0.12),transparent_20%),radial-gradient(circle_at_20%_30%,rgba(124,58,237,0.18),transparent_16%),radial-gradient(circle_at_78%_70%,rgba(14,165,233,0.14),transparent_18%),repeating-linear-gradient(90deg,rgba(255,255,255,0.03)_0,rgba(255,255,255,0.03)_1px,transparent_1px,transparent_42px),linear-gradient(180deg,#171008,#050506)]" />
      <div className="absolute inset-x-0 top-0 h-[10%] border-b border-amber-100/20 bg-[linear-gradient(180deg,rgba(255,244,214,0.28),rgba(0,0,0,0.14))]" />
      <div className="absolute inset-x-0 bottom-0 h-[10%] border-t border-amber-100/20 bg-[linear-gradient(0deg,rgba(255,244,214,0.28),rgba(0,0,0,0.14))]" />
      <div className="absolute left-1/2 top-0 h-full w-[9%] -translate-x-1/2 border-x border-amber-100/14 bg-black/20" />
      <div className="triad-opponent-scoreplate pointer-events-auto absolute left-2 top-2 z-[70] flex max-w-[46%] items-center gap-1.5 rounded-xl border border-cyan-200/22 bg-black/62 px-2 py-1.5 shadow-[0_16px_44px_rgba(0,0,0,0.42)] backdrop-blur-md sm:left-4 sm:top-4 sm:max-w-[360px] sm:gap-2 sm:rounded-2xl sm:px-2.5 sm:py-2">
        <MiniProfileHover participant={botParticipant || undefined} name={botName} image={botImage} profile={profileForParticipant(botParticipant, rankProfiles || {})} label="คู่แข่ง" currentParticipantId={currentParticipantId} />
        <div className="min-w-0 max-w-[120px] sm:max-w-none">
          <div className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-100/58">คู่แข่ง</div>
          <div className="truncate text-xs font-black text-white sm:text-base">{botName}</div>
        </div>
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-cyan-100 bg-cyan-500 text-sm font-black text-white shadow-[0_0_22px_rgba(34,211,238,0.32)] sm:h-9 sm:w-9 sm:text-lg">
          {matchScore.bot}
        </div>
      </div>
      <div className="triad-player-scoreplate pointer-events-auto absolute bottom-2 right-2 z-[70] flex max-w-[46%] items-center gap-1.5 rounded-xl border border-red-200/24 bg-black/62 px-2 py-1.5 text-right shadow-[0_16px_44px_rgba(0,0,0,0.42)] backdrop-blur-md sm:bottom-4 sm:right-4 sm:max-w-[360px] sm:gap-2 sm:rounded-2xl sm:px-2.5 sm:py-2">
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-red-100 bg-red-500 text-sm font-black text-white shadow-[0_0_22px_rgba(239,68,68,0.32)] sm:h-9 sm:w-9 sm:text-lg">
          {matchScore.player}
        </div>
        <div className="min-w-0 max-w-[120px] sm:max-w-none">
          <div className="text-[9px] font-black uppercase tracking-[0.18em] text-red-100/58">เรา</div>
          <div className="truncate text-xs font-black text-white sm:text-base">{playerName}</div>
        </div>
        <MiniProfileHover participant={playerParticipant || undefined} name={playerName} image={playerImage} profile={profileForParticipant(playerParticipant, rankProfiles || {})} label="เรา" align="right" placement="top" currentParticipantId={currentParticipantId} />
      </div>
      <RevealSpotlight
        playerCard={playerTriangle[activeLane] ? cardsByNo.get(playerTriangle[activeLane]) : undefined}
        botCard={botTriangle[activeLane] ? cardsByNo.get(botTriangle[activeLane]) : undefined}
        showPlayer={playerVisible(activeLane)}
        showBot={botVisible(activeLane)}
        result={currentResult && revealed[activeTurn]?.scored ? currentResult : undefined}
        playerName={playerName}
        botName={botName}
        spectatorView={revealAllCards}
        readyAdvanceSlot={readyAdvanceSlot}
        skillOpenerName={skillOpenerName}
        skillSecondName={skillSecondName}
        nextSkillOpenerName={nextSkillOpenerName}
        nextSkillSecondName={nextSkillSecondName}
      />
      <SkillTargetOverlay
        card={pendingSkillChoice ? cardsByNo.get(pendingSkillChoice.cardNo) : undefined}
        side={pendingSkillChoice?.side || "player"}
        playerTop={displayPlayerTriangle.top ? cardsByNo.get(displayPlayerTriangle.top) : undefined}
        botTop={botVisible("top") && displayBotTriangle.top ? cardsByNo.get(displayBotTriangle.top) : undefined}
        targetPlayerTop={displayPlayerTriangle.top ? cardsByNo.get(displayPlayerTriangle.top) : undefined}
        targetBotTop={displayBotTriangle.top ? cardsByNo.get(displayBotTriangle.top) : undefined}
        selectedTarget={pendingSkillChoice?.selectedTarget || ""}
        timeLeft={timeLeft}
        onSelect={(target) => {
          if (!pendingSkillChoice) return;
          const skillCard = cardsByNo.get(pendingSkillChoice.cardNo);
          const selectable = new Set(getSelectableSkillTargetIds(skillCard, pendingSkillChoice.side, displayPlayerTriangle.top ? cardsByNo.get(displayPlayerTriangle.top) : undefined, displayBotTriangle.top ? cardsByNo.get(displayBotTriangle.top) : undefined));
          if (!parseSkillTargetSelection(target).every((item) => selectable.has(item))) return;
          onSelectSkillTarget(target);
        }}
        onConfirm={onConfirmSkillTarget}
      />
      {!pendingSkillChoice && !waitingSkillChoice ? (
        <TimeoutWarningOverlay secondsLeft={timeLeft} missingNames={timeoutMissingNames} />
      ) : null}
      {!pendingSkillChoice && waitingSkillChoice ? (
        <div className="absolute bottom-4 right-4 top-16 z-40 flex w-[min(430px,calc(100%-2rem))] items-center">
          <div className="w-full rounded-2xl border border-red-300/35 bg-[#090507]/94 p-5 text-center shadow-[0_0_72px_rgba(248,113,113,0.34)] backdrop-blur-md">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-red-100/64">รอฝ่ายตรงข้ามเลือกเป้าหมาย</div>
            <div className="mt-2 text-2xl font-black uppercase text-white">กำลังเปิดสกิล</div>
            <div className="mx-auto mt-2 max-w-sm text-sm font-semibold leading-6 text-white/60">
              อีกฝ่ายกำลังเลือกเป้าหมายสกิล การ์ดที่เกี่ยวข้องจะมีออร่าสีแดงจนกว่าตานี้จะตัดสินผล
            </div>
            <div className="mt-4 text-3xl font-black text-red-100">
              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
            </div>
          </div>
        </div>
      ) : null}

      <div className="triad-board-field-grid relative grid h-full min-h-0 grid-rows-[clamp(44px,9cqw,82px)_minmax(92px,1fr)_clamp(0px,0.45cqw,4px)_minmax(92px,1fr)_clamp(22px,5cqw,52px)] gap-y-0 px-[clamp(4px,1.7cqw,12px)] py-[clamp(4px,1.5cqw,10px)] sm:grid-rows-[clamp(54px,8cqw,96px)_minmax(112px,1fr)_clamp(0px,0.35cqw,5px)_minmax(112px,1fr)_clamp(26px,4cqw,58px)]">
        <div />

        <div className="triad-board-side triad-board-side-bot grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-end gap-[clamp(4px,2cqw,12px)]">
          <BoardPile label="ทิ้ง" sublabel={`${botGraveCards.length}`} tone="red" rotate cards={botGraveCards} />
          <BoardTriangle
            cardsByNo={cardsByNo}
            triangle={displayBotTriangle}
            activeLane={activeLane}
            tone="bot"
            isVisible={(lane) => botVisible(lane)}
            swapActive={hasSwapResult && showResolvedBoard}
            auraByLane={botAuraByLane}
            onPreview={showBoardPreview}
            onPreviewEnd={previewMode === "hover" ? closeBoardPreview : undefined}
          />
          <BoardPile label="สุ่ม" sublabel="293 ใบ" tone="gold" rotate />
        </div>

        <div className="triad-board-center-gap h-[clamp(0px,0.45cqw,4px)]" />

        <div className="triad-board-side triad-board-side-player grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-[clamp(4px,2cqw,12px)]">
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
            onPreview={showBoardPreview}
            onPreviewEnd={previewMode === "hover" ? closeBoardPreview : undefined}
          />
          <BoardPile label="ทิ้ง" sublabel={`${playerGraveCards.length}`} tone="red" cards={playerGraveCards} />
        </div>

        <div />
      </div>
      <div className="triad-board-phase-hud pointer-events-none absolute inset-x-2 bottom-1 z-[65] flex justify-center sm:bottom-2">
        <div className="triad-board-phase-card pointer-events-auto w-[min(500px,82cqw)] space-y-1.5">
          <PhaseTrack activeTurn={activeTurn} />
          <div className="triad-board-phase-meta rounded-full border border-amber-100/14 bg-black/48 px-3 py-1.5 text-center text-[9px] font-black uppercase tracking-[0.16em] text-amber-100/62 shadow-[0_10px_30px_rgba(0,0,0,0.28)] backdrop-blur-sm">
            เกม {matchScore.player}-{matchScore.bot} / รอบ {fightScore.player}-{fightScore.bot} / เวลา {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, "0")}
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
  const router = useRouter();
  const cardsByNo = useMemo(() => new Map(cards.map((card) => [card.cardNo, card])), [cards]);
  const deckCatalog = useMemo(
    () => uniqueByNo(cards.filter((card) => card.kind === "monster" || card.kind === "skill")),
    [cards]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isMobileBattleDevice =
      window.matchMedia("(hover: none) and (pointer: coarse)").matches ||
      /android|iphone|ipad|ipod|mobile/i.test(window.navigator.userAgent);
    if (!isMobileBattleDevice) return;

    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (orientation: "landscape" | "portrait" | "any" | "natural") => Promise<void>;
      unlock?: () => void;
    };

    void orientation.lock?.("landscape").catch(() => null);

    return () => {
      try {
        orientation.unlock?.();
      } catch {
        return;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const isBattleTarget = (target: EventTarget | null) =>
      target instanceof Element && Boolean(target.closest(".nexora-battle-shell"));
    const blockNativeMobileMenu = (event: Event) => {
      if (!isBattleTarget(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener("contextmenu", blockNativeMobileMenu, true);
    document.addEventListener("dragstart", blockNativeMobileMenu, true);
    document.addEventListener("selectstart", blockNativeMobileMenu, true);

    return () => {
      document.removeEventListener("contextmenu", blockNativeMobileMenu, true);
      document.removeEventListener("dragstart", blockNativeMobileMenu, true);
      document.removeEventListener("selectstart", blockNativeMobileMenu, true);
    };
  }, []);

  const participant = useMemo(() => makeParticipant(currentUser), [currentUser.id, currentUser.image, currentUser.name]);
  const [phase, setPhase] = useState<BattlePhase>("lobby");
  const [resumeChecking, setResumeChecking] = useState(true);
  const [rooms, setRooms] = useState<TriadRoom[]>([]);
  const [rankProfiles, setRankProfiles] = useState<Record<string, TriadRankProfile>>({});
  const [leaderboard, setLeaderboard] = useState<TriadRankProfile[]>([]);
  const [activeRoomCode, setActiveRoomCode] = useState("");
  const [roomAccess, setRoomAccess] = useState<RoomAccess>("public");
  const [roomPassword, setRoomPassword] = useState("");
  const [createModeDialogOpen, setCreateModeDialogOpen] = useState(false);
  const [createRoomMode, setCreateRoomMode] = useState<DeckMode>("all");
  const [createRoomWithBot, setCreateRoomWithBot] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [passwordRoom, setPasswordRoom] = useState<TriadRoom | null>(null);
  const [activeRoomSnapshot, setActiveRoomSnapshot] = useState<TriadRoom | null>(null);
  const activeRoomCodeRef = useRef("");
  const activeRoomSnapshotRef = useRef<TriadRoom | null>(null);
  const pvpTurnKeyRef = useRef("");
  const openerTieBreakAdvanceKeyRef = useRef("");
  const openerTieBreakAdvanceTimerRef = useRef<number | null>(null);
  const openerTieBreakResultKeyRef = useRef("");
  const openerTieBreakResultTimerRef = useRef<number | null>(null);
  const botRunKeyRef = useRef("");
  const syncInFlightRef = useRef(false);
  const syncQueuedRef = useRef(false);
  const lastSyncAtRef = useRef(0);
  const resultAdvanceKeyRef = useRef("");
  const turnReadyRecoveryKeyRef = useRef("");
  const deckBattleStartKeyRef = useRef("");
  const optimisticRoomLockUntilRef = useRef(0);
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
  const [openingTieBreakResultVisible, setOpeningTieBreakResultVisible] = useState(false);
  const [openingTieBreakResultKey, setOpeningTieBreakResultKey] = useState("");
  const [openingTieBreakResetting, setOpeningTieBreakResetting] = useState(false);
  const [pendingTurnReadyKey, setPendingTurnReadyKey] = useState("");
  const [turnReadySubmittingKey, setTurnReadySubmittingKey] = useState("");
  const [deckReadySubmitting, setDeckReadySubmitting] = useState(false);
  const openingTieBreakPendingChoiceRef = useRef<TriadRpsChoice | null>(null);
  const openingTieBreakPendingKeyRef = useRef("");
  const roomPlayerSideRef = useRef<RoomPlayerSide | null>(null);

  useEffect(() => {
    const cachedRoom = readCachedTriadRoom(participant.id);
    if (!cachedRoom) {
      setResumeChecking(false);
      return;
    }

    activeRoomCodeRef.current = cachedRoom.code;
    activeRoomSnapshotRef.current = cachedRoom;
    setActiveRoomCode(cachedRoom.code);
    setActiveRoomSnapshot(cachedRoom);
    setRooms((current) => mergeRoomByCode(current, cachedRoom));
    setPhase(cachedRoom.status === "playing" ? phaseForPlayingRoom(cachedRoom, participant.id) || "battle" : "room");
  }, [participant.id]);

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
  const currentDeckModeTitle =
    currentDeckMode === "monster"
      ? "โหมดมอนสเตอร์"
      : currentDeckMode === "skill"
        ? "โหมดสกิล"
        : "โหมดรวม";
  const currentResult = lockedFight?.turns.find((turn) => turn.turn === activeTurn);
  const roomTurnResolved = Boolean(currentRoom?.game.turns.some((turn) => turn.turn === activeTurn));
  const fightScore = lockedFight ? getFightScore(lockedFight.turns, revealed) : { player: 0, bot: 0 };
  const playerGraveCards = gravePlayerCards.map((cardNo) => cardsByNo.get(cardNo)).filter(Boolean) as CardView[];
  const botGraveCards = graveBotCards.map((cardNo) => cardsByNo.get(cardNo)).filter(Boolean) as CardView[];
  const forcedWinnerSide = currentRoom?.game.matchWinner || "";
  const surrenderedSide = currentRoom?.game.surrenderedBy || "";
  const matchDone = Boolean(currentRoom?.game.matchEndedAt) || fightNo > 3 || Boolean(forcedWinnerSide);
  const isRoomHost = Boolean(currentRoom && currentRoom.hostId === participant.id);
  const isRoomController = Boolean(
    currentRoom && (currentRoom.hostId === participant.id || currentRoom.seats.host?.id === participant.id)
  );
  const hasBotOpponent = Boolean(currentRoom && isBotParticipant(currentRoom.seats.challenger));
  const roomPlayerSide: RoomPlayerSide | null = participantRoomSide(currentRoom, participant);
  const isFieldPlayer = Boolean(roomPlayerSide);
  const isSpectator = Boolean(currentRoom && !isFieldPlayer && currentRoom.spectators.some((viewer) => viewer.id === participant.id));
  const opponentSide: RoomPlayerSide | null = roomPlayerSide === "host" ? "challenger" : roomPlayerSide === "challenger" ? "host" : null;
  const displayUsedPlayerSet = new Set([
    ...usedPlayerSet,
    ...((roomPlayerSide && currentRoom?.game.usedCards[roomPlayerSide]) || []),
  ]);
  const turnReadyState = currentRoom?.game.turnReady || { host: false, challenger: false };
  const currentTurnReadyKey =
    currentRoom && roomPlayerSide ? `${currentRoom.code}:${currentRoom.game.fightNo}:${currentRoom.game.activeTurn}:${roomPlayerSide}` : "";
  const pendingLocalTurnReady = Boolean(
    currentTurnReadyKey && (pendingTurnReadyKey === currentTurnReadyKey || turnReadySubmittingKey === currentTurnReadyKey)
  );
  const effectiveTurnReadyState = {
    host: Boolean(turnReadyState.host || (pendingLocalTurnReady && roomPlayerSide === "host")),
    challenger: Boolean(turnReadyState.challenger || (pendingLocalTurnReady && roomPlayerSide === "challenger")),
  };
  const myTurnReady = Boolean(roomPlayerSide && effectiveTurnReadyState[roomPlayerSide]);
  const opponentTurnReady = Boolean(opponentSide && effectiveTurnReadyState[opponentSide]);
  const readyCount = Number(effectiveTurnReadyState.host) + Number(effectiveTurnReadyState.challenger);
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
      matchScore: roomMatchScoreForView(currentRoom, null, true) || getFightScore(currentRoom.game.turns, revealState),
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
  const spectatorRoomStateKey = currentRoom
    ? JSON.stringify({
        code: currentRoom.code,
        updatedAt: currentRoom.updatedAt,
        fightNo: currentRoom.game.fightNo,
        activeTurn: currentRoom.game.activeTurn,
        triangles: currentRoom.game.triangles,
        turns: currentRoom.game.turns.map((turn) => [turn.turn, turn.winner, turn.playerTotal, turn.opponentTotal]),
        choices: currentRoom.game.skillChoices.map((choice) => [
          choice.fightNo,
          choice.turn,
          choice.side,
          choice.cardNo,
          choice.selectedTarget,
          choice.skipped,
        ]),
        ready: currentRoom.game.turnReady,
        tieBreak: currentRoom.game.openerTieBreak,
        matchEndedAt: currentRoom.game.matchEndedAt,
      })
    : "";
  useEffect(() => {
    if (isSpectator) return;
    setSpectatorPreviewCard(null);
  }, [isSpectator]);
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
  const roomBattleReady = roomDecksReadyForBattle(currentRoom);
  const pvpTurnTimedOut = Boolean(
    isPvpRoom &&
      roomBattleReady &&
      currentRoom &&
      currentRoom.status === "playing" &&
      (timeLeft <= 0 || roomTurnSecondsLeft(currentRoom) <= 0)
  );
  const pvpPlacementClosed = Boolean(isPvpRoom && (roomTurnResolved || currentResult || pvpTurnTimedOut));
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
  const roomDisplayMatchScore = roomMatchScoreForView(currentRoom, roomPlayerSide, isSpectator);
  const displayMatchScore = spectatorBattleState?.matchScore || roomDisplayMatchScore || matchScore;
  const displayFightScore = spectatorBattleState?.fightScore || fightScore;
  const displayTimeLeft = spectatorBattleState?.timeLeft ?? timeLeft;
  const displayTurnLocked = spectatorBattleState?.turnLocked ?? turnLocked;
  const placementLocked = Boolean(displayTurnLocked || matchDone || pvpPlacementClosed);
  const displayPlayerName = spectatorBattleState?.playerName || playerLabel;
  const displayBotName = spectatorBattleState?.botName || opponentLabel;
  const displayPlayerImage = spectatorBattleState?.playerImage || playerImage;
  const displayBotImage = spectatorBattleState?.botImage || opponentImage;
  const displayPlayerParticipant = isSpectator
    ? currentRoom?.seats.host || null
    : roomPlayerSide
      ? currentRoom?.seats[roomPlayerSide] || null
      : makeParticipant(currentUser);
  const displayBotParticipant = isSpectator
    ? currentRoom?.seats.challenger || null
    : opponentSide
      ? currentRoom?.seats[opponentSide] || null
      : null;
  const displayNameForRoomSide = (side: RoomPlayerSide | null) => {
    if (!side) return "";
    if (isSpectator) return side === "host" ? displayPlayerName : displayBotName;
    if (side === roomPlayerSide) return displayPlayerName;
    if (side === opponentSide) return displayBotName;
    return currentRoom?.seats[side]?.name || "";
  };
  const oppositeRoomSide = (side: RoomPlayerSide | null): RoomPlayerSide | null =>
    side === "host" ? "challenger" : side === "challenger" ? "host" : null;
  const displaySkillOpenerSide = currentRoom ? roomOpeningSideForTurn(currentRoom, displayActiveTurn) : null;
  const displaySkillSecondSide = oppositeRoomSide(displaySkillOpenerSide);
  const nextSkillTurn = displayActiveTurn < 3 ? ((displayActiveTurn + 1) as TriadTurn) : null;
  const displayNextSkillOpenerSide = currentRoom && nextSkillTurn ? roomOpeningSideForTurn(currentRoom, nextSkillTurn) : null;
  const displayNextSkillSecondSide = oppositeRoomSide(displayNextSkillOpenerSide);
  const displaySkillOpenerName = displayNameForRoomSide(displaySkillOpenerSide);
  const displaySkillSecondName = displayNameForRoomSide(displaySkillSecondSide);
  const displayNextSkillOpenerName = displayNameForRoomSide(displayNextSkillOpenerSide);
  const displayNextSkillSecondName = displayNameForRoomSide(displayNextSkillSecondSide);
  const displayPlayerDeckCards = spectatorBattleState?.playerDeckCards || playerDeckCards;
  const displayBotDeckCards = spectatorBattleState?.botDeckCards || botDeckCards;
  const displayBattleLog = spectatorBattleState?.battleLog || battleLog;
  const ownDeckReady = Boolean(roomPlayerSide && currentRoom?.game.deckReady[roomPlayerSide]);
  const opponentDeckReady = Boolean(opponentSide && currentRoom?.game.deckReady[opponentSide]);
  const bothDecksReady = roomBattleReady;
  useEffect(() => {
    if (!deckReadySubmitting) return;
    if (!currentRoom || currentRoom.status !== "playing" || phase !== "deck" || ownDeckReady || bothDecksReady) {
      setDeckReadySubmitting(false);
    }
  }, [bothDecksReady, currentRoom, deckReadySubmitting, ownDeckReady, phase]);
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
  const queuedRoomSkillChoice = currentRoom ? currentQueuedSkillChoice(currentRoom) : null;
  const ownPendingRoomSkillChoice =
    queuedRoomSkillChoice && queuedRoomSkillChoice.side === roomPlayerSide ? queuedRoomSkillChoice : null;
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
  const waitingPendingRoomSkillChoice =
    queuedRoomSkillChoice && queuedRoomSkillChoice.side !== roomPlayerSide ? queuedRoomSkillChoice : null;
  const waitingSkillChoice: PendingSkillChoice | null = waitingPendingRoomSkillChoice
    ? {
        side: "bot",
        lane: waitingPendingRoomSkillChoice.lane,
        cardNo: "",
        selectedTarget: "",
      }
    : null;
  const forcedWinnerLabel = forcedWinnerSide ? currentRoom?.seats[forcedWinnerSide]?.name || "ผู้ชนะ" : "";
  const surrenderedLabel = surrenderedSide ? currentRoom?.seats[surrenderedSide]?.name || "ผู้ยอมแพ้" : "";

  useEffect(() => {
    if (currentRoom && participantInRoom(currentRoom, participant.id)) {
      writeCachedTriadRoom(participant.id, currentRoom);
    }
  }, [currentRoom, participant.id]);
  const winnerText =
    forcedWinnerLabel
      ? `${forcedWinnerLabel} ชนะ`
      : displayMatchScore.player === displayMatchScore.bot
      ? "เสมอกัน"
      : displayMatchScore.player > displayMatchScore.bot
        ? `${playerLabel} ชนะ`
        : `${opponentLabel} ชนะ`;

  const finalMatchScore = forcedWinnerSide
    ? forcedWinnerSide === roomPlayerSide
      ? { player: Math.max(displayMatchScore.player, displayMatchScore.bot + 1), bot: displayMatchScore.bot }
      : forcedWinnerSide === opponentSide
        ? { player: displayMatchScore.player, bot: Math.max(displayMatchScore.bot, displayMatchScore.player + 1) }
        : displayMatchScore
    : displayMatchScore;

  const keepPendingOpeningTieBreakChoice = (room: TriadRoom) => {
    const pendingChoice = openingTieBreakPendingChoiceRef.current;
    const pendingSide = roomPlayerSideRef.current;
    if (!pendingChoice || !pendingSide) return room;
    const tieBreak = room.game.openerTieBreak;
    if (room.code !== activeRoomCodeRef.current || tieBreak.status !== "waiting") return room;
    if (openingTieBreakPendingKeyRef.current !== openingTieBreakChoiceKey(room.code, tieBreak, pendingSide)) return room;
    if (tieBreak.revealChoices?.[pendingSide] && tieBreak.revealChoices[pendingSide] !== "unknown") return room;
    if ((tieBreak.choices[pendingSide] || "unknown") !== "unknown") return room;

    return {
      ...room,
      game: {
        ...room.game,
        openerTieBreak: {
          ...tieBreak,
          choices: {
            ...tieBreak.choices,
            [pendingSide]: pendingChoice,
          },
        },
      },
    };
  };

  const mergeIncomingRooms = (current: TriadRoom[], nextRooms: TriadRoom[]) =>
    mergeRoomListsWithStableChat(current, nextRooms).map((room) => {
      const optimisticRoom = activeRoomSnapshotRef.current;
      if (
        optimisticRoom &&
        optimisticRoom.code === room.code &&
        Date.now() < optimisticRoomLockUntilRef.current
      ) {
        return keepPendingOpeningTieBreakChoice(mergeRoomWithStableChat(room, optimisticRoom));
      }
      return keepPendingOpeningTieBreakChoice(room);
    });

  const mergeIncomingRoom = (current: TriadRoom[], room: TriadRoom) => {
    const optimisticRoom = activeRoomSnapshotRef.current;
    const stableRoom =
      optimisticRoom &&
      optimisticRoom.code === room.code &&
      Date.now() < optimisticRoomLockUntilRef.current
        ? mergeRoomWithStableChat(room, optimisticRoom)
        : room;
    return mergeRoomByCode(current, keepPendingOpeningTieBreakChoice(stableRoom));
  };

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
    const nextProfiles: TriadRankProfile[] = Array.isArray(payload.rankProfiles)
      ? payload.rankProfiles.map(normalizeRankProfile).filter((profile: TriadRankProfile | null): profile is TriadRankProfile => Boolean(profile))
      : [];
    const nextLeaderboard: TriadRankProfile[] = Array.isArray(payload.leaderboard)
      ? payload.leaderboard.map(normalizeRankProfile).filter((profile: TriadRankProfile | null): profile is TriadRankProfile => Boolean(profile))
      : nextProfiles.filter((profile: TriadRankProfile) => profile.wins > 0);
    if (nextProfiles.length > 0 || Array.isArray(payload.rankProfiles)) {
      setRankProfiles(Object.fromEntries(nextProfiles.map((profile) => [profile.userId, profile])));
    }
    if (nextLeaderboard.length > 0 || Array.isArray(payload.leaderboard)) {
      setLeaderboard(nextLeaderboard);
    }
    const activeCode = activeRoomCodeRef.current;
    const snapshotCode = activeRoomSnapshotRef.current?.code || "";
    const knownActiveCode = activeCode || snapshotCode;
    const reconnectRoom = !activeCode ? nextRooms.find((room) => participantInRoom(room, participant.id)) : null;
    if (reconnectRoom) {
      activeRoomCodeRef.current = reconnectRoom.code;
      setActiveRoomCode(reconnectRoom.code);
      setStableActiveRoomSnapshot(reconnectRoom);
      setPhase(reconnectRoom.status === "playing" ? phaseForPlayingRoom(reconnectRoom, participant.id) || "battle" : "room");
      setLobbyMessage("");
    }
    if (knownActiveCode && !nextRooms.some((room) => room.code === knownActiveCode)) {
      activeRoomCodeRef.current = "";
      activeRoomSnapshotRef.current = null;
      setActiveRoomCode("");
      setActiveRoomSnapshot(null);
      writeCachedTriadRoom(participant.id, null);
      setPhase("lobby");
      setLobbyMessage("ห้องถูกปิดแล้ว");
    }
    setRooms((current) => mergeIncomingRooms(current, nextRooms));
    return nextRooms;
    } finally {
      setResumeChecking(false);
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
    setRooms((current) => mergeIncomingRoom(current, nextRoom));
    activeRoomSnapshotRef.current = nextRoom;
    setActiveRoomSnapshot(nextRoom);
    writeCachedTriadRoom(participant.id, nextRoom);
    if (activeRoomCodeRef.current === nextRoom.code) {
      setActiveRoomCode(nextRoom.code);
    }
    return nextRoom;
  };

  const setStableActiveRoomSnapshot = (room: TriadRoom) => {
    const currentSnapshot = activeRoomSnapshotRef.current || undefined;
    const stableRoom = currentSnapshot && shouldKeepCurrentRoomSnapshot(currentSnapshot, room) ? currentSnapshot : room;
    activeRoomSnapshotRef.current = stableRoom;
    setActiveRoomSnapshot(stableRoom);
    writeCachedTriadRoom(participant.id, stableRoom);
    return stableRoom;
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
    if (actionRoom) optimisticRoomLockUntilRef.current = 0;
    let nextRooms = Array.isArray(payload.rooms) ? normalizeApiRooms(payload.rooms) : rooms;
    if ((body.action === "disband" || (body.action === "leave" && !actionRoom)) && activeRoomCodeRef.current) {
      nextRooms = nextRooms.filter((room) => room.code !== activeRoomCodeRef.current);
    }
    setRooms((current) =>
      actionRoom
        ? mergeIncomingRoom(mergeIncomingRooms(current, nextRooms), actionRoom)
        : mergeIncomingRooms(current, nextRooms)
    );
    if (actionRoom) {
      const stableActionRoom = keepPendingOpeningTieBreakChoice(mergeRoomWithStableChat(activeRoomSnapshotRef.current, actionRoom));
      const activeStableRoom = setStableActiveRoomSnapshot(stableActionRoom);
      if (participantInRoom(activeStableRoom, participant.id) && activeStableRoom.status === "playing") {
        const nextPhase = phaseForPlayingRoom(activeStableRoom, participant.id);
        if (nextPhase) setPhase(nextPhase);
      }
    } else if (body.action === "disband" || (activeRoomCodeRef.current && !nextRooms.some((room) => room.code === activeRoomCodeRef.current))) {
      activeRoomCodeRef.current = "";
      activeRoomSnapshotRef.current = null;
      setActiveRoomCode("");
      setActiveRoomSnapshot(null);
      writeCachedTriadRoom(participant.id, null);
      setPhase("lobby");
    }
    const syncAfterAction = () => void syncRooms({ force: true }).catch(() => null);
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(syncAfterAction, { timeout: 900 });
    } else {
      globalThis.setTimeout(syncAfterAction, 260);
    }
    return { ok: response.ok, status: response.status, payload };
  };

  const sendRoomChat = async (textInput: string) => {
    const text = textInput.trim().replace(/\s+/g, " ").slice(0, 240);
    if (!currentRoom?.code || !text) return false;

    const optimisticMessage: RoomChatMessage = {
      id: `local-${Date.now()}-${participant.id}`,
      roomCode: currentRoom.code,
      senderId: participant.id,
      senderName: participant.name,
      senderImage: participant.image,
      text,
      createdAt: Date.now(),
    };

    patchCurrentRoom((room) => ({
      ...room,
      game: {
        ...room.game,
        chat: [...(room.game.chat || []), optimisticMessage].slice(-80),
      },
    }));

    const result = await postRoomAction({
      action: "chat",
      code: currentRoom.code,
      text,
    });

    if (!result.ok) {
      void syncRooms({ force: true }).catch(() => null);
      return false;
    }
    return true;
  };

  const chooseOpeningTieBreak = (choice: TriadRpsChoice) => {
    if (!currentRoom || !roomPlayerSide || choice === "unknown") return;
    const tieBreak = currentRoom.game.openerTieBreak;
    if (tieBreak.status !== "waiting") return;
    const choiceKey = openingTieBreakChoiceKey(currentRoom.code, tieBreak, roomPlayerSide);
    if (openingTieBreakPendingChoiceRef.current && openingTieBreakPendingKeyRef.current === choiceKey) return;
    if ((tieBreak.choices[roomPlayerSide] || "unknown") !== "unknown") return;
    openingTieBreakPendingChoiceRef.current = choice;
    openingTieBreakPendingKeyRef.current = choiceKey;
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
        openingTieBreakPendingKeyRef.current = "";
        setOpeningTieBreakPendingChoice(null);
        void syncRooms({ force: true }).catch(() => null);
        setBattleLog((current) => ["เลือกเป่ายิงฉุบไม่สำเร็จ ระบบจะซิงก์สถานะล่าสุดอีกครั้ง", ...current]);
      }
    });
  };

  const resetOpeningTieBreak = () => {
    if (!currentRoom || !roomPlayerSide || isSpectator || openingTieBreakResetting) return;
    const firstTurnDraw = currentRoom.game.turns.find((turn) => turn.turn === 1)?.winner === "draw";
    if (!firstTurnDraw) return;
    openingTieBreakPendingChoiceRef.current = null;
    openingTieBreakPendingKeyRef.current = "";
    setOpeningTieBreakPendingChoice(null);
    setOpeningTieBreakResultVisible(false);
    setOpeningTieBreakResetting(true);
    void postRoomAction({
      action: "reset-opening-tiebreak",
      code: currentRoom.code,
    }).then((result) => {
      if (!result.ok) {
        setBattleLog((current) => ["Reset RPS failed. Syncing latest room state.", ...current]);
      }
      void syncRooms({ force: true }).catch(() => null);
    }).finally(() => {
      setOpeningTieBreakResetting(false);
    });
  };

  useEffect(() => {
    const tieBreak = currentRoom?.game.openerTieBreak;
    if (!tieBreak || tieBreak.status !== "waiting" || !roomPlayerSide) {
      openingTieBreakPendingChoiceRef.current = null;
      openingTieBreakPendingKeyRef.current = "";
      setOpeningTieBreakPendingChoice(null);
      return;
    }
    const choiceKey = currentRoom ? openingTieBreakChoiceKey(currentRoom.code, tieBreak, roomPlayerSide) : "";
    const serverChoice = tieBreak.choices[roomPlayerSide] || "unknown";
    if (serverChoice !== "unknown") {
      openingTieBreakPendingChoiceRef.current = serverChoice;
      openingTieBreakPendingKeyRef.current = choiceKey;
      setOpeningTieBreakPendingChoice(null);
      return;
    }
    openingTieBreakPendingChoiceRef.current = null;
    openingTieBreakPendingKeyRef.current = "";
    setOpeningTieBreakPendingChoice(null);
  }, [
    currentRoom?.code,
    currentRoom?.game.openerTieBreak.fightNo,
    currentRoom?.game.openerTieBreak.round,
    currentRoom?.game.openerTieBreak.status,
    currentRoom?.game.openerTieBreak.choices.host,
    currentRoom?.game.openerTieBreak.choices.challenger,
    roomPlayerSide,
  ]);

  const visibleOpeningTieBreakPendingChoice =
    currentRoom?.game.openerTieBreak && roomPlayerSide && openingTieBreakPendingKeyRef.current === openingTieBreakChoiceKey(currentRoom.code, currentRoom.game.openerTieBreak, roomPlayerSide)
      ? openingTieBreakPendingChoice
      : null;

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
      playWithBot: createRoomWithBot,
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
    setPhase(room.status === "playing" ? phaseForPlayingRoom(room, participant.id) || "deck" : "room");
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

  const toggleBotOpponent = async () => {
    if (!currentRoom || !isRoomController) return;
    const result = await postRoomAction({
      action: "set-bot",
      code: currentRoom.code,
      enabled: !hasBotOpponent,
    });
    if (!result.ok) {
      setLobbyMessage(hasBotOpponent ? "เอาบอทออกจากห้องไม่สำเร็จ" : "เพิ่มบอทไม่ได้ ช่องผู้ท้าชิงอาจไม่ว่าง");
      return;
    }
    setLobbyMessage(!hasBotOpponent ? "BOT Level.99 ลงฝั่งผู้ท้าชิงแล้ว" : "เอา BOT Level.99 ออกจากห้องแล้ว");
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
    writeCachedTriadRoom(participant.id, null);
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
    writeCachedTriadRoom(participant.id, null);
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
          writeCachedTriadRoom(participant.id, null);
          setPhase("lobby");
        }
        return;
      }

      if (!room) {
        void syncRooms({ force: true }).catch(() => null);
        return;
      }

      const stableRoom = keepPendingOpeningTieBreakChoice(room);
      setRooms((current) => mergeIncomingRoom(current, stableRoom));

      const roomIncludesMe = participantInRoom(room, participant.id);
      if (activeRoomCodeRef.current === room.code || roomIncludesMe) {
        setStableActiveRoomSnapshot(stableRoom);
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
    roomPlayerSideRef.current = roomPlayerSide;
  }, [roomPlayerSide]);

  useEffect(() => {
    activeRoomSnapshotRef.current = activeRoomSnapshot;
  }, [activeRoomSnapshot]);

  useEffect(() => {
    if (pendingTurnReadyKey && (!currentTurnReadyKey || pendingTurnReadyKey !== currentTurnReadyKey)) {
      setPendingTurnReadyKey("");
    }
    if (turnReadySubmittingKey && (!currentTurnReadyKey || turnReadySubmittingKey !== currentTurnReadyKey)) {
      setTurnReadySubmittingKey("");
    }
  }, [currentTurnReadyKey, pendingTurnReadyKey, turnReadySubmittingKey]);

  useEffect(() => {
    const bothReady = Boolean(currentRoom?.game.turnReady.host && currentRoom.game.turnReady.challenger);
    if (!currentRoom || !roomPlayerSide || !currentResult || !bothReady) {
      turnReadyRecoveryKeyRef.current = "";
      return;
    }

    const recoveryKey = `${currentRoom.code}:${currentRoom.game.fightNo}:${currentRoom.game.activeTurn}`;
    if (turnReadyRecoveryKeyRef.current === recoveryKey) return;
    turnReadyRecoveryKeyRef.current = recoveryKey;

    const timer = window.setTimeout(() => {
      void postRoomAction({
        action: "advance-turn",
        code: currentRoom.code,
        fightNo: currentRoom.game.fightNo,
        turn: currentRoom.game.activeTurn,
      })
        .then(() => syncRooms({ force: true }))
        .catch(() => syncRooms({ force: true }).catch(() => null));
    }, 520);
    return () => window.clearTimeout(timer);
  }, [
    currentResult,
    currentRoom?.code,
    currentRoom?.game.activeTurn,
    currentRoom?.game.fightNo,
    currentRoom?.game.turnReady.challenger,
    currentRoom?.game.turnReady.host,
    roomPlayerSide,
  ]);

  useEffect(() => {
    return () => {
      if (openerTieBreakAdvanceTimerRef.current) window.clearTimeout(openerTieBreakAdvanceTimerRef.current);
      if (openerTieBreakResultTimerRef.current) window.clearTimeout(openerTieBreakResultTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const tieBreak = currentRoom?.game.openerTieBreak;
    const firstTurnResult = currentRoom?.game.turns.find((turn) => turn.turn === 1);
    if (
      !currentRoom ||
      firstTurnResult?.winner !== "draw" ||
      tieBreak?.status !== "resolved" ||
      !tieBreak.winner
    ) {
      if (openerTieBreakResultTimerRef.current) {
        window.clearTimeout(openerTieBreakResultTimerRef.current);
        openerTieBreakResultTimerRef.current = null;
      }
      setOpeningTieBreakResultVisible(false);
      return;
    }

    const hostChoice = tieBreak.revealChoices?.host || tieBreak.choices.host || "unknown";
    const challengerChoice = tieBreak.revealChoices?.challenger || tieBreak.choices.challenger || "unknown";
    const resultKey = `${currentRoom.code}:${currentRoom.game.fightNo}:${tieBreak.round || 1}:${tieBreak.winner}:${hostChoice}:${challengerChoice}`;
    if (openerTieBreakResultKeyRef.current === resultKey) return;

    openerTieBreakResultKeyRef.current = resultKey;
    setOpeningTieBreakResultKey(resultKey);
    setOpeningTieBreakResultVisible(true);
    if (openerTieBreakResultTimerRef.current) window.clearTimeout(openerTieBreakResultTimerRef.current);
    openerTieBreakResultTimerRef.current = window.setTimeout(() => {
      openerTieBreakResultTimerRef.current = null;
      setOpeningTieBreakResultVisible(false);
    }, 4600);
  }, [
    currentRoom?.code,
    currentRoom?.game.activeTurn,
    currentRoom?.game.fightNo,
    currentRoom?.game.openerTieBreak.round,
    currentRoom?.game.openerTieBreak.status,
    currentRoom?.game.openerTieBreak.winner,
    currentRoom?.game.openerTieBreak.choices.host,
    currentRoom?.game.openerTieBreak.choices.challenger,
    currentRoom?.game.openerTieBreak.revealChoices?.host,
    currentRoom?.game.openerTieBreak.revealChoices?.challenger,
    currentRoom?.game.turns,
  ]);

  useEffect(() => {
    const tieBreak = currentRoom?.game.openerTieBreak;
    const firstTurnResult = currentRoom?.game.turns.find((turn) => turn.turn === 1);
    if (
      !currentRoom ||
      !roomPlayerSide ||
      currentRoom.game.activeTurn !== 1 ||
      firstTurnResult?.winner !== "draw" ||
      tieBreak?.status !== "resolved" ||
      !tieBreak.winner
    ) {
      openerTieBreakAdvanceKeyRef.current = "";
      if (openerTieBreakAdvanceTimerRef.current) {
        window.clearTimeout(openerTieBreakAdvanceTimerRef.current);
        openerTieBreakAdvanceTimerRef.current = null;
      }
      return;
    }

    const advanceKey = `${currentRoom.code}:${currentRoom.game.fightNo}:${tieBreak.winner}`;
    if (openerTieBreakAdvanceKeyRef.current === advanceKey) return;
    openerTieBreakAdvanceKeyRef.current = advanceKey;
    if (openerTieBreakAdvanceTimerRef.current) window.clearTimeout(openerTieBreakAdvanceTimerRef.current);
    openerTieBreakAdvanceTimerRef.current = window.setTimeout(() => {
      openerTieBreakAdvanceTimerRef.current = null;
      void postRoomAction({ action: "advance-turn", code: currentRoom.code });
    }, 4600);
  }, [
    currentRoom?.code,
    currentRoom?.game.activeTurn,
    currentRoom?.game.fightNo,
    currentRoom?.game.openerTieBreak.status,
    currentRoom?.game.openerTieBreak.winner,
    currentRoom?.game.turns,
    roomPlayerSide,
  ]);

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
    if (!currentRoom?.game.matchEndedAt || !isRoomController) return;
    const delay = Math.max(0, 6500 - (Date.now() - currentRoom.game.matchEndedAt));
    const timer = window.setTimeout(() => {
      void postRoomAction({ action: "continue", code: currentRoom.code });
    }, delay);
    return () => window.clearTimeout(timer);
  }, [currentRoom?.code, currentRoom?.game.matchEndedAt, isRoomController]);

  useEffect(() => {
    if (!currentRoom || !roomPlayerSide || !opponentSide) return;
    const decksReadyForBattle = roomDecksReadyForBattle(currentRoom);
    if (!decksReadyForBattle) {
      const ownDeck = currentRoom.game.decks[roomPlayerSide];
      const enemyDeck = currentRoom.game.decks[opponentSide];
      if (ownDeckReady || phase !== "deck") setPlayerDeck(ownDeck);
      setBotDeck(enemyDeck);
      setTurnLocked(false);
      setPendingSkillChoice(null);
      setPendingBlessingChoice(null);
      setLockedFight(null);
      setPlayer({ top: "", left: "", right: "" });
      setActiveTurn(1);
      setFightNo(1);
      setPlacementLane("top");
      setTimeLeft(TURN_SECONDS);
      setDeckTimeLeft(roomDeckSecondsLeft(currentRoom));
      return;
    }
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
    const turnResolved = currentRoom.game.turns.some((turn) => turn.turn === currentRoom.game.activeTurn);
    setTurnLocked(Boolean(serverPlayerTriangle[activeLane]));
    setTimeLeft(roomTurnSecondsLeft(currentRoom));
    setPlayer((current) => {
      const next = { ...serverPlayerTriangle };
      if (!turnResolved && !serverPlayerTriangle[activeLane] && current[activeLane]) {
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
    if ((phase === "deck" || deckSelectionActive) && roomDecksReadyForBattle(currentRoom)) {
      setBattleLog((current) => current.length ? current : ["ทั้งสองฝั่งล็อกเด็คแล้ว เริ่มสู้กันได้เลย"]);
    }
  }, [currentRoom, deckSelectionActive, opponentSide, ownDeckReady, phase, roomPlayerSide]);

  useEffect(() => {
    if (!ownPendingRoomSkillChoice || !roomPlayerSide) {
      if (isPvpRoom) setPendingSkillChoice(null);
      if (isPvpRoom) setPendingBlessingChoice(null);
      if (!waitingPendingRoomSkillChoice) return;
      const tick = () => {
        setTimeLeft(Math.max(0, Math.ceil((waitingPendingRoomSkillChoice.deadlineAt - Date.now()) / 1000)));
      };
      tick();
      const timer = window.setInterval(tick, 250);
      return () => window.clearInterval(timer);
    }

    if (ownPendingRoomSkillChoice.cardNo === "254") {
      setPendingSkillChoice(null);
      if (currentRoom && opponentSide) {
        const previewTriangles = applyRoomBlessingPreview(
          currentRoom,
          currentRoom.game.triangles[roomPlayerSide],
          currentRoom.game.triangles[opponentSide]
        );
        setPendingBlessingChoice({
          side: "player",
          lane: ownPendingRoomSkillChoice.lane,
          player: previewTriangles[roomPlayerSide],
          bot: previewTriangles[opponentSide],
          choice: ownPendingRoomSkillChoice.blessingChoice,
          drawnCardNo: ownPendingRoomSkillChoice.blessingDrawCardNo,
          previewTopCardNo: ownPendingRoomSkillChoice.blessingPreviewTopNo,
        });
      }
      const tick = () => {
        setTimeLeft(Math.max(0, Math.ceil((ownPendingRoomSkillChoice.deadlineAt - Date.now()) / 1000)));
      };
      tick();
      const timer = window.setInterval(tick, 250);
      return () => window.clearInterval(timer);
    }

    setPendingBlessingChoice(null);
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
  }, [currentRoom, isPvpRoom, opponentSide, ownPendingRoomSkillChoice, roomPlayerSide, waitingPendingRoomSkillChoice]);

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
    if (ownDeckReady || deckReadySubmitting) return;
    const monsterCount = playerDeckCards.filter((card) => card.kind === "monster").length;
    if (!currentRoom && monsterCount < 3) {
      setBattleLog(["เด็คต้องมีมอนสเตอร์อย่างน้อย 3 ใบ เพื่อใช้เป็นการ์ดหลักของแต่ละรอบ"]);
      return;
    }

    if (currentRoom && roomPlayerSide && opponentSide) {
      if (!deckValidation.valid) return;
      setDeckReadySubmitting(true);
      optimisticRoomLockUntilRef.current = Date.now() + 3200;
      const optimisticRoom = patchCurrentRoom((room) => ({
        ...room,
        game: {
          ...room.game,
          decks: {
            ...room.game.decks,
            [roomPlayerSide]: playerDeck,
          },
          deckReady: {
            ...room.game.deckReady,
            [roomPlayerSide]: true,
          },
        },
      }));
      if (roomDecksReadyForBattle(optimisticRoom)) {
        setPhase("battle");
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
        setDeckReadySubmitting(false);
        optimisticRoomLockUntilRef.current = 0;
        setBattleLog(["กดพร้อมเด็คเข้าห้อง PvP ไม่ได้"]);
        return;
      }
      setDeckReadySubmitting(false);
      const room = normalizeApiRooms(result.payload?.room ? [result.payload.room] : [])[0] || currentRoom;
      const ownDeck = room.game.decks[roomPlayerSide];
      const enemyDeck = room.game.decks[opponentSide];
      setBotDeck(enemyDeck);
      setPlayerDeck(ownDeck);
      if (roomDecksReadyForBattle(room)) {
        setPhase("battle");
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
      if (phase === "deck" && nextLeft <= 0 && roomPlayerSide && opponentSide && !ownDeckReady && !deckReadySubmitting && deckValidation.valid) {
        setDeckReadySubmitting(true);
        void postRoomAction({
          action: "ready-deck",
          code: currentRoom.code,
          deck: playerDeck,
        }).then((result) => {
          setDeckReadySubmitting(false);
          if (result.ok) {
            const room = normalizeApiRooms(result.payload?.room ? [result.payload.room] : [])[0];
            if (roomDecksReadyForBattle(room)) {
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
    const decksReady = roomDecksReadyForBattle(currentRoom);
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

  useEffect(() => {
    if (!currentRoom || !hasBotOpponent || !participantInRoom(currentRoom, participant.id)) {
      botRunKeyRef.current = "";
      return;
    }
    const botKey = JSON.stringify({
      code: currentRoom.code,
      status: currentRoom.status,
      deckReady: currentRoom.game.deckReady,
      fightNo: currentRoom.game.fightNo,
      activeTurn: currentRoom.game.activeTurn,
      triangles: currentRoom.game.triangles,
      choices: currentRoom.game.skillChoices,
      turns: currentRoom.game.turns.map((turn) => [turn.turn, turn.winner, turn.playerTotal, turn.opponentTotal]),
      turnReady: currentRoom.game.turnReady,
      tieBreak: currentRoom.game.openerTieBreak,
      matchWinner: currentRoom.game.matchWinner,
    });
    if (botRunKeyRef.current === botKey) return;
    botRunKeyRef.current = botKey;
    const timer = window.setTimeout(() => {
      void postRoomAction({ action: "run-bot", code: currentRoom.code }).then((result) => {
        if (!result.ok) botRunKeyRef.current = "";
      });
    }, 420);
    return () => window.clearTimeout(timer);
  }, [currentRoom, hasBotOpponent, participant.id]);

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
    if (pvpPlacementClosed) {
      setBattleLog((current) => ["หมดเวลาหรือตานี้ถูกตัดสินแล้ว ไม่สามารถวางการ์ดเพิ่มได้ กดพร้อมเพื่อไปต่อเท่านั้น", ...current]);
      return false;
    }
    if (turnLocked || matchDone || displayUsedPlayerSet.has(cardNo) || lane !== laneForTurn(activeTurn)) return false;
    const alreadyPlayedLane = (["top", "left", "right"] as Lane[]).find((item) => item !== lane && player[item] === cardNo);
    if (alreadyPlayedLane) return false;
    const card = cardsByNo.get(cardNo);
    if (lane === "top" && card?.kind !== "monster") {
      setBattleLog((current) => ["ตาแรกต้องวางการ์ดมอนสเตอร์เท่านั้น", ...current]);
      return false;
    }
    if (lane === "top" && card?.kind !== "monster") {
      setBattleLog((current) => ["ตา 1 ต้องวางมอนสเตอร์เป็นการ์ดหลัก", ...current]);
      return false;
    }
    if (currentDeckMode === "monster" && card?.kind !== "monster") {
      setBattleLog((current) => ["โหมด MONSTER ใช้การ์ดมอนสเตอร์เท่านั้น", ...current]);
      return false;
    }
    if (currentDeckMode === "skill" && lane !== "top" && card?.kind !== "skill") {
      setBattleLog((current) => ["โหมด SKILL ใช้การ์ดสกิลในตานี้เท่านั้น", ...current]);
      return false;
    }
    if (lane !== "top" && card?.kind !== "monster" && card?.kind !== "skill") return false;
    setPlayer((current) => {
      const next = { ...current };
      (["top", "left", "right"] as Lane[]).forEach((item) => {
        if (next[item] === cardNo) next[item] = "";
      });
      next[lane] = cardNo;
      return next;
    });
    return true;
  };

  const drawRandomCard = () => {
    if (deckCatalog.length === 0) return "";
    const card = deckCatalog[Math.floor(Math.random() * deckCatalog.length)];
    setRandomDrawCardNo(card.cardNo);
    setBattleLog((current) => [`สุ่มจากกองกลางได้ No.${card.cardNo} ${card.name}`, ...current]);
    return card.cardNo;
  };

  const randomCardNoByKind = (kind: TriadCardKind, extraExcluded: string[] = []) => {
    const excluded = new Set(
      [
        ...playerDeck,
        ...botDeck,
        ...usedPlayerCards,
        ...usedBotCards,
        ...gravePlayerCards,
        ...graveBotCards,
        player.top,
        player.left,
        player.right,
        lockedFight?.player.top,
        lockedFight?.player.left,
        lockedFight?.player.right,
        lockedFight?.bot.top,
        lockedFight?.bot.left,
        lockedFight?.bot.right,
        pendingBlessingChoice?.drawnCardNo,
        pendingBlessingChoice?.previewTopCardNo,
        ...extraExcluded,
      ].filter(Boolean)
    );
    const pool = deckCatalog.filter((card) => card.kind === kind && !excluded.has(card.cardNo));
    const card = pool[Math.floor(Math.random() * Math.max(1, pool.length))];
    if (card) setRandomDrawCardNo(card.cardNo);
    return card?.cardNo || "";
  };

  const lockFight = (cardNoOverride = "", laneOverride?: Lane) => {
    if (pvpPlacementClosed) {
      setBattleLog((current) => ["หมดเวลาหรือตานี้ถูกตัดสินแล้ว ไม่สามารถล็อกการ์ดเพิ่มได้ กดพร้อมเพื่อไปต่อเท่านั้น", ...current]);
      void syncRooms({ force: true }).catch(() => null);
      return;
    }
    const lane = laneOverride || laneForTurn(activeTurn);
    const playerForLock = cardNoOverride ? { ...player, [lane]: cardNoOverride } : player;
    if (!playerForLock[lane]) {
      setBattleLog((current) => [`เลือกการ์ด 1 ใบสำหรับตาที่ ${activeTurn} ก่อนกดล็อก`, ...current]);
      return;
    }

    const playerCard = cardsByNo.get(playerForLock[lane] || "");
    const turnPrioritySide = lastTurnWinner === "bot" ? "opponent" : "player";

    if (currentRoom && roomPlayerSide && opponentSide) {
      const previousRoom = currentRoom;
      optimisticRoomLockUntilRef.current = Date.now() + 3200;
      patchCurrentRoom((room) => ({
        ...room,
        game: {
          ...room.game,
          triangles: {
            ...room.game.triangles,
            [roomPlayerSide]: {
              ...room.game.triangles[roomPlayerSide],
              [lane]: playerForLock[lane],
            },
          },
          usedCards: {
            ...room.game.usedCards,
            [roomPlayerSide]: Array.from(new Set([...(room.game.usedCards[roomPlayerSide] || []), playerForLock[lane]].filter(Boolean))),
          },
        },
      }));
      setTurnLocked(true);
      void postRoomAction({
        action: "lock-card",
        code: currentRoom.code,
        cardNo: playerForLock[lane],
      }).then((result) => {
        if (!result.ok) {
          optimisticRoomLockUntilRef.current = 0;
          const serverClosedTurn =
            result.payload?.resolved ||
            result.payload?.reason === "already_resolved" ||
            result.payload?.reason === "turn_expired";
          setTurnLocked(serverClosedTurn ? true : false);
          if (previousRoom) patchCurrentRoom(() => previousRoom);
          void syncRooms({ force: true }).catch(() => null);
          const lockError =
            serverClosedTurn
              ? "ตานี้ถูกตัดสินแล้วจากการหมดเวลา วางการ์ดเพิ่มไม่ได้ กดพร้อมเพื่อไปต่อ"
              : "ล็อกการ์ดในห้อง PvP ไม่ได้";
          setBattleLog((current) => [lockError, ...current]);
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
      player: playerForLock,
      bot: baseBot,
      botDeckCards: availableBotCards,
      deckMode: currentDeckMode,
    });
    const bot = { ...baseBot, [lane]: botCardNo };
    if (playerCard?.cardNo === "254") {
      setLockedFight({ fightNo, player: playerForLock, bot, turns: lockedFight?.turns || [] });
      setTurnLocked(true);
      setPendingBlessingChoice({ side: "player", lane, player: playerForLock, bot });
      setTimeLeft(TURN_SECONDS);
      setBattleLog((current) => [`${playerCard.name}: เลือกพร 1 ข้อเพื่อให้ผลเกิดทันที`, ...current]);
      return;
    }

    if (playerCard && skillNeedsChoice(playerCard)) {
      const targets = getSelectableSkillTargetIds(playerCard, "player", cardsByNo.get(player.top), cardsByNo.get(bot.top));
      if (targets.length === 0) {
        const result = resolveTriadTurn({
          turn: activeTurn,
          player: playerForLock,
          opponent: bot,
          prioritySide: turnPrioritySide,
        });
        const turns = [
          ...(lockedFight?.turns.filter((turn) => turn.turn !== activeTurn) || []),
          result,
        ].sort((a, b) => a.turn - b.turn);
        setLockedFight({ fightNo, player: playerForLock, bot, turns });
        setTurnLocked(true);
        setBattleLog((current) => [
          `${playerCard.name}: ไม่มีเป้าหมายที่เข้าเงื่อนไข สกิลไม่เกิดผล`,
          ...current,
        ]);
        return;
      }
      if (targets.length === 1) {
        const result = resolveTriadTurn({
          turn: activeTurn,
          player: playerForLock,
          opponent: bot,
          prioritySide: turnPrioritySide,
          skillTargets: {
            player: {
              [playerCard.cardNo]: targets[0],
            },
          },
        });
        const turns = [
          ...(lockedFight?.turns.filter((turn) => turn.turn !== activeTurn) || []),
          result,
        ].sort((a, b) => a.turn - b.turn);
        setLockedFight({ fightNo, player: playerForLock, bot, turns });
        setTurnLocked(true);
        setBattleLog((current) => [
          `${playerCard.name}: เลือกเป้าหมายอัตโนมัติแล้ว (${targets[0] === "bot-top" ? "มอนสเตอร์หลักฝั่งตรงข้าม" : "มอนสเตอร์หลักฝั่งเรา"})`,
          ...current,
        ]);
        return;
      }
      setLockedFight({ fightNo, player: playerForLock, bot, turns: lockedFight?.turns || [] });
      setTurnLocked(true);
      setPendingSkillChoice({ side: "player", lane, cardNo: playerCard.cardNo, selectedTarget: "" });
      setTimeLeft(TURN_SECONDS);
      setBattleLog((current) => [`${playerCard.name}: เลือกเป้าหมายก่อนคิดผลตาที่ ${activeTurn}`, ...current]);
      return;
    }

    const result = resolveTriadTurn({ turn: activeTurn, player: playerForLock, opponent: bot, prioritySide: turnPrioritySide });
    const turns = [
      ...(lockedFight?.turns.filter((turn) => turn.turn !== activeTurn) || []),
      result,
    ].sort((a, b) => a.turn - b.turn);

    setLockedFight({ fightNo, player: playerForLock, bot, turns });
    setTurnLocked(true);
    setBattleLog((current) => [
      `รอบสู้ ${fightNo} ตา ${activeTurn}: ล็อกการ์ด ${playerForLock[lane]} แล้ว`,
      ...current,
    ]);
  };

  const placeAndLockCard = (lane: Lane, cardNo: string) => {
    setPlacementLane(lane);
    if (setPlayerLane(lane, cardNo)) {
      lockFight(cardNo, lane);
    }
  };

  const placeCardFromHand = (cardNo: string) => {
    placeAndLockCard(laneForTurn(activeTurn), cardNo);
  };

  const confirmSkillTarget = () => {
    if (!pendingSkillChoice || !lockedFight) return;
    const skillCard = cardsByNo.get(pendingSkillChoice.cardNo);
    const fallbackTargets = getSelectableSkillTargetIds(
      skillCard,
      pendingSkillChoice.side,
      cardsByNo.get(lockedFight.player.top),
      cardsByNo.get(lockedFight.bot.top)
    );
    const selectedTarget = pendingSkillChoice.selectedTarget || (fallbackTargets.length === 1 ? fallbackTargets[0] : "");
    if (!selectedTarget) return;
    const selectableTargetIds = new Set(
      getSelectableSkillTargetIds(skillCard, pendingSkillChoice.side, cardsByNo.get(lockedFight.player.top), cardsByNo.get(lockedFight.bot.top))
    );
    const selectedTargets = parseSkillTargetSelection(selectedTarget);
    const validTargetSelection = isTwoStepTargetSkill(skillCard)
      ? selectedTargets.length === 2 && new Set(selectedTargets).size === 2 && selectedTargets.every((target) => selectableTargetIds.has(target))
      : selectableTargetIds.has(selectedTarget as SkillTargetId);
    if (!validTargetSelection) {
      setPendingSkillChoice((current) => (current ? { ...current, selectedTarget: "" } : current));
      setBattleLog((current) => [
        `เป้าหมายสกิลไม่ถูกต้อง: ${selectedTarget} กรุณาเลือกเป้าหมายของ ${skillCard?.name || pendingSkillChoice.cardNo} ใหม่`,
        ...current,
      ]);
      return;
    }

    if (currentRoom && roomPlayerSide && opponentSide) {
      optimisticRoomLockUntilRef.current = Date.now() + 3200;
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
          optimisticRoomLockUntilRef.current = 0;
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
      prioritySide: lastTurnWinner === "bot" ? "opponent" : "player",
      skillTargets: {
        player: {
          [pendingSkillChoice.cardNo]: selectedTarget,
        },
      },
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
      drawnCardNo = randomCardNoByKind("skill", ["254"]);
      if (drawnCardNo) {
        nextPlayer = { ...nextPlayer, [pendingBlessingChoice.lane]: drawnCardNo };
        summary = `ขอพรเปิดสกิลเพิ่ม No.${drawnCardNo} แทน No.254 เฉพาะตานี้ และใช้ผลสกิลทันที`;
      }
    } else if (choice === "reroll-own") {
      previewTopCardNo = randomCardNoByKind("monster");
      if (previewTopCardNo) {
        nextPlayer = { ...nextPlayer, top: previewTopCardNo };
        summary = `ขอพรสุ่มมอนสเตอร์ใหม่ให้ฝั่งเราเป็น No.${previewTopCardNo} เฉพาะตานี้`;
      }
    } else {
      previewTopCardNo = randomCardNoByKind("monster");
      if (previewTopCardNo) {
        nextBot = { ...nextBot, top: previewTopCardNo };
        summary = `ขอพรสุ่มมอนสเตอร์ใหม่ให้ฝ่ายตรงข้ามเป็น No.${previewTopCardNo} เฉพาะตานี้`;
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
      prioritySide: lastTurnWinner === "bot" ? "opponent" : "player",
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
    if (currentRoom && !roomDecksReadyForBattle(currentRoom)) return;
    if (matchDone || (!isPvpRoom && turnLocked && !pendingSkillChoice)) return;
    const lane = laneForTurn(activeTurn);

    if (currentRoom && roomPlayerSide && opponentSide) {
      void postRoomAction({ action: "timeout-turn", code: currentRoom.code }).then((result) => {
        if (result.ok) {
          const room = normalizeApiRooms(result.payload?.room ? [result.payload.room] : [])[0];
          const timeoutResult = room?.game.turns.find((turn) => turn.turn === activeTurn);
          const ownIsHost = roomPlayerSide === "host";
          const ownWon =
            timeoutResult?.winner === (ownIsHost ? "player" : "opponent");
          const opponentWon =
            timeoutResult?.winner === (ownIsHost ? "opponent" : "player");
          const timeoutMessage = timeoutResult
            ? ownWon
              ? `ตาที่ ${activeTurn}: คู่แข่งไม่วางการ์ดจนหมดเวลา คุณชนะตานี้ทันที`
              : opponentWon
                ? `ตาที่ ${activeTurn}: คุณไม่วางการ์ดจนหมดเวลา แพ้ตานี้ทันที`
                : `ตาที่ ${activeTurn}: ทั้งสองฝั่งไม่วางการ์ดทันเวลา ตานี้เสมอ`
            : `ตาที่ ${activeTurn}: หมดเวลา ระบบตัดสินผลให้แล้ว`;
          setBattleLog((current) => [timeoutMessage, ...current]);
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
    if (phase !== "battle" || !bothDecksReady || matchDone || pvpTurnResolved || (!isPvpRoom && turnLocked && !pendingSkillChoice)) return;

    const timer = window.setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setTimeout(timeoutTurn, 0);
          return isPvpRoom ? 0 : TURN_SECONDS;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [phase, bothDecksReady, matchDone, turnLocked, pendingSkillChoice, activeTurn, player, lockedFight, isPvpRoom, currentResult, roomTurnResolved, currentRoom?.code, roomPlayerSide, opponentSide]);

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

  const advanceRevealForTurn = (
    turn: TriadTurn,
    current: Record<TriadTurn, TurnReveal>
  ) => {
    if (!currentResult) return current;
    const state = current[turn];
    if (state.scored) return current;
    if (turn === 1) {
      const next = {
        ...current,
        [turn]: { ...state, player: true, bot: true },
      };
      return scoreTurnIfReady(turn, next);
    }
    const priorityKey = currentResult.prioritySide === "opponent" ? "bot" : "player";
    const secondaryKey = priorityKey === "player" ? "bot" : "player";
    const nextState = { ...state };

    if (!nextState[priorityKey]) {
      nextState[priorityKey] = true;
    } else if (!nextState[secondaryKey]) {
      nextState[secondaryKey] = true;
    }

    const next = {
      ...current,
      [turn]: nextState,
    };
    return scoreTurnIfReady(turn, next);
  };

  useEffect(() => {
    if (!isPvpRoom || !currentResult || !roomTurnResolved || pendingSkillChoice) return;
    const state = revealed[activeTurn];
    if (state.scored) return;
    const delay = state.player || state.bot ? 760 : 0;
    const timer = window.setTimeout(() => {
      setRevealed((current) => advanceRevealForTurn(activeTurn, current));
    }, delay);
    return () => window.clearTimeout(timer);
  }, [activeTurn, currentResult, isPvpRoom, pendingSkillChoice, revealed, roomTurnResolved]);

  const revealNext = () => {
    if (!lockedFight || !canRevealTurn || pendingSkillChoice || !currentResult) return;

    setRevealed((current) => {
      return advanceRevealForTurn(activeTurn, current);
    });
  };

  const markRoomTurnReady = () => {
    if (!currentRoom || !roomPlayerSide || !currentTurnReadyKey) return false;
    if (
      pendingTurnReadyKey === currentTurnReadyKey ||
      turnReadySubmittingKey === currentTurnReadyKey ||
      Boolean(currentRoom.game.turnReady[roomPlayerSide])
    ) {
      return true;
    }

    const readyKey = currentTurnReadyKey;
    setPendingTurnReadyKey(readyKey);
    setTurnReadySubmittingKey(readyKey);
    optimisticRoomLockUntilRef.current = Date.now() + 2600;
    patchCurrentRoom((room) => ({
      ...room,
      game: {
        ...room.game,
        turnReady: { ...room.game.turnReady, [roomPlayerSide]: true },
      },
    }));

    const actionPayload = {
      action: "advance-turn",
      code: currentRoom.code,
      fightNo: currentRoom.game.fightNo,
      turn: currentRoom.game.activeTurn,
    };
    const scheduleReadySync = (delayMs: number) => {
      window.setTimeout(() => void syncRooms({ force: true }).catch(() => null), delayMs);
    };

    void postRoomAction(actionPayload)
      .then((result) => {
        if (!result.ok) {
          setPendingTurnReadyKey((current) => (current === readyKey ? "" : current));
          void syncRooms({ force: true }).catch(() => null);
          return;
        }
        const room = normalizeApiRooms(result.payload?.room ? [result.payload.room] : [])[0];
        const advanced =
          room &&
          (room.game.fightNo !== currentRoom.game.fightNo || room.game.activeTurn !== currentRoom.game.activeTurn);
        if (advanced) {
          setPendingTurnReadyKey((current) => (current === readyKey ? "" : current));
          setTurnReadySubmittingKey((current) => (current === readyKey ? "" : current));
        }
        scheduleReadySync(450);
        scheduleReadySync(1400);
      })
      .catch(() => {
        setPendingTurnReadyKey((current) => (current === readyKey ? "" : current));
        void syncRooms({ force: true }).catch(() => null);
      })
      .finally(() => {
        setTurnReadySubmittingKey((current) => (current === readyKey ? "" : current));
      });
    return true;
  };

  const nextTurn = () => {
    if (!lockedFight || activeTurn >= 3) return;
    if (currentRoom && roomPlayerSide) {
      markRoomTurnReady();
      return;
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
    if (currentRoom && roomPlayerSide) {
      markRoomTurnReady();
      return;
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
  const showReadyAdvanceButton = Boolean(
      !isSpectator &&
      isPvpRoom &&
      roomPlayerSide &&
      (displayTurnLocked || roomTurnResolved) &&
      displayLockedFight &&
      activeTurnScored &&
      !matchDone &&
      (displayActiveTurn < 3 || displayRevealed[3].scored)
  );
  const readyAdvanceTargetLabel =
    displayActiveTurn >= 3 ? (displayFightNo >= 3 ? "จบเกม" : "รอบถัดไป") : "ตาถัดไป";
  const renderReadyAdvanceButton = () =>
    showReadyAdvanceButton ? (
      <ReadyAdvanceButton
        label={readyAdvanceTargetLabel}
        readyCount={readyCount}
        myReady={myTurnReady}
        opponentReady={opponentTurnReady}
        opponentName={opponentLabel}
        onClick={displayActiveTurn >= 3 ? nextFight : nextTurn}
        disabled={myTurnReady || turnReadySubmittingKey === currentTurnReadyKey}
      />
    ) : null;
  const renderRoomBattleActions = () =>
    showReadyAdvanceButton ? (
      <div className="triad-ready-advance-sidebar space-y-2">
        {renderReadyAdvanceButton()}
      </div>
    ) : null;
  useEffect(() => {
    if (phase !== "battle" || matchDone || !lockedFight || !activeTurnScored || isPvpRoom) {
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
          setTimeout(() => {
            if (activeTurn >= 3) nextFight();
            else nextTurn();
          }, 0);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [activeRoomCode, activeTurn, activeTurnScored, currentResult?.winner, fightNo, isPvpRoom, lockedFight, matchDone, phase]);

  const revealButtonLabel =
    !canRevealTurn
      ? "ล็อกการ์ดก่อน"
      : "เปิดทั้งสองฝั่ง";

  const shouldShowReconnectSplash =
    resumeChecking &&
    phase === "lobby" &&
    Boolean(activeRoomCode || activeRoomSnapshot || activeRoomCodeRef.current || activeRoomSnapshotRef.current);

  if (shouldShowReconnectSplash) {
    return (
      <main className="triad-lobby-screen grid min-h-[calc(var(--app-shell-height)-var(--app-header-height)-var(--app-mobile-nav-height))] place-items-center overflow-hidden rounded-[24px] border border-amber-200/12 bg-[#050507] px-4 text-white shadow-[0_30px_110px_rgba(0,0,0,0.58)]">
        <div className="w-[min(420px,92vw)] rounded-2xl border border-amber-200/22 bg-black/54 p-5 text-center shadow-[0_0_60px_rgba(251,191,36,0.16)] backdrop-blur-md">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-amber-200/40 bg-amber-200/12 text-amber-100 shadow-[0_0_34px_rgba(251,191,36,0.22)]">
            <Swords className="h-7 w-7" />
          </div>
          <div className="mt-4 text-xl font-black text-white">กำลังกลับเข้าสนาม</div>
          <div className="mt-2 text-sm font-semibold leading-6 text-white/56">
            กำลังเชื่อมต่อเกมที่กำลังดำเนินอยู่แบบเรียลไทม์
          </div>
          <div className="mx-auto mt-5 h-1.5 w-44 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/2 animate-[triad-reconnect_1.05s_ease-in-out_infinite] rounded-full bg-amber-200 shadow-[0_0_18px_rgba(251,191,36,0.65)]" />
          </div>
        </div>
        <style jsx>{`
          @keyframes triad-reconnect {
            0% { transform: translateX(-110%); }
            100% { transform: translateX(230%); }
          }
        `}</style>
      </main>
    );
  }

  if (phase === "lobby") {
    const visibleRooms = rooms
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 8);
    const searchedRoom = joinCode.length === 6 ? rooms.find((room) => room.code === joinCode) : null;

    return (
      <main className="triad-lobby-screen min-h-[calc(var(--app-shell-height)-var(--app-header-height)-var(--app-mobile-nav-height))] overflow-y-auto rounded-[24px] border border-amber-200/12 bg-[#050507] text-white shadow-[0_30px_110px_rgba(0,0,0,0.58)]">
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
                onClick={() => setCreateRoomWithBot((value) => !value)}
                className={`mt-4 flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
                  createRoomWithBot
                    ? "border-cyan-200/55 bg-cyan-300/14 shadow-[0_0_30px_rgba(34,211,238,0.16)]"
                    : "border-white/12 bg-black/34 hover:border-cyan-200/32"
                }`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${createRoomWithBot ? "border-cyan-100/70 bg-cyan-200 text-black" : "border-white/14 bg-white/6 text-cyan-100"}`}>
                    <Bot className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-white">สู้กับบอททันที</span>
                    <span className="mt-1 block text-xs font-semibold leading-5 text-white/55">สร้างแล้วเข้าสู่หน้าเลือกการ์ดเลย บอทจะลงฝั่งผู้ท้าชิงเป็น BOT Level.99</span>
                  </span>
                </span>
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-black ${createRoomWithBot ? "border-cyan-100 bg-cyan-200 text-black" : "border-white/18 bg-black/40 text-white/24"}`}>
                  {createRoomWithBot ? <Check className="h-4 w-4" /> : null}
                </span>
              </button>
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
        <section className="triad-lobby-hero relative min-h-[320px] overflow-hidden border-b border-amber-200/12 px-4 py-6 sm:px-6 lg:px-8">
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
              <button
                type="button"
                onClick={() => router.push("/")}
                className="triad-lobby-home-button mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-amber-100/60 bg-[linear-gradient(135deg,#fde68a,#facc15_42%,#d97706)] px-5 text-sm font-black text-black shadow-[0_0_36px_rgba(251,191,36,0.38),inset_0_0_0_1px_rgba(255,255,255,0.38)] transition hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.98] sm:w-auto"
              >
                <House className="h-4 w-4" />
                กลับหน้าหลัก
              </button>
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

        <section className="triad-lobby-content grid gap-4 p-4 sm:p-6 lg:grid-cols-[380px_1fr] lg:p-8">
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
          </div>

          <div className="space-y-4">
          <RankLeaderboardPanel leaderboard={leaderboard} currentParticipantId={participant.id} />
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
                      <RankAvatar participant={room.seats.host} profile={profileForParticipant(room.seats.host, rankProfiles)} size="md" />
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
          </div>
        </section>
      </main>
    );
  }

  if (phase === "room") {
    if (!currentRoom) {
      return (
        <main className="triad-room-screen grid min-h-[calc(var(--app-shell-height)-var(--app-header-height)-var(--app-mobile-nav-height))] place-items-center overflow-y-auto rounded-[24px] border border-white/8 bg-[#05070d] p-6 text-white">
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
      <main className="triad-room-screen min-h-[calc(var(--app-shell-height)-var(--app-header-height)-var(--app-mobile-nav-height))] overflow-y-auto rounded-[24px] border border-amber-200/12 bg-[#050507] text-white shadow-[0_30px_110px_rgba(0,0,0,0.58)]">
        <section className="triad-room-hero relative overflow-hidden border-b border-amber-200/12 px-4 py-5 sm:px-6 lg:px-8">
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
                onClick={toggleBotOpponent}
                disabled={!isRoomController || (Boolean(currentRoom.seats.challenger) && !hasBotOpponent)}
                className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-black uppercase tracking-[0.12em] transition disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/8 disabled:text-white/28 ${
                  hasBotOpponent
                    ? "border-cyan-100/55 bg-cyan-200 text-black shadow-[0_0_30px_rgba(34,211,238,0.22)] hover:bg-cyan-100"
                    : "border-cyan-200/28 bg-cyan-300/10 text-cyan-50 hover:border-cyan-100/60 hover:bg-cyan-300/16"
                }`}
              >
                <Bot className="h-4 w-4" />
                {hasBotOpponent ? "เอาบอทออก" : "สู้กับบอท"}
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

        <div className="triad-room-notice px-4 pb-2 sm:px-6 xl:px-8">
          <div className="rounded-2xl border border-cyan-200/14 bg-cyan-300/8 px-4 py-3 text-sm font-semibold leading-6 text-cyan-50/78">
            เมื่อเริ่มเกม ทั้งสองฝั่งจะเข้าสู่ช่วงเลือกเด็คพร้อมกัน ผู้ชมจะเห็นตัวนับถอยหลัง 5 นาทีและชื่อของฝั่งที่กำลังจัดเด็คอย่างชัดเจน
          </div>
        </div>

        <section className="triad-room-content grid gap-4 p-4 sm:p-6 xl:grid-cols-[1fr_320px] xl:p-8">
          <div className="grid gap-4 md:grid-cols-2">
            <RoomSeatCard
              label="ฝั่งเจ้าของห้อง"
              participant={currentRoom.seats.host}
              profile={profileForParticipant(currentRoom.seats.host, rankProfiles)}
              isLeader={currentRoom.seats.host?.id === currentRoom.hostId}
              tone="host"
              emptyText="ช่องเจ้าของห้องว่าง"
              canTake={currentIsSpectator && !currentRoom.seats.host}
              onTake={() => takeFieldSlot("host")}
            />
            <RoomSeatCard
              label="ฝั่งผู้ท้าชิง"
              participant={currentRoom.seats.challenger}
              profile={profileForParticipant(currentRoom.seats.challenger, rankProfiles)}
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
            <div className="md:col-span-2">
              <BattleRoomChatPanel room={currentRoom} currentUserId={participant.id} onSend={sendRoomChat} />
            </div>
          </div>

          <aside className="space-y-4">
            <SpectatorPanel
              spectators={currentRoom.spectators}
              currentId={participant.id}
              rankProfiles={rankProfiles}
              canWatch={!currentIsSpectator && currentRoom.status === "waiting"}
              onWatch={moveToSpectator}
            />
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
      <main className="triad-deck-screen min-h-[calc(var(--app-shell-height)-var(--app-header-height)-var(--app-mobile-nav-height))] overflow-y-auto rounded-[24px] border border-white/8 bg-[#050710] text-white shadow-[0_26px_90px_rgba(0,0,0,0.42)]">
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

        <section className="triad-deck-content grid gap-4 p-4 sm:p-6 lg:grid-cols-[1fr_280px] lg:p-8">
          <div className="triad-deck-card-grid grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
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
          <div className="triad-deck-readybar fixed inset-x-3 bottom-[calc(var(--app-mobile-nav-height)+12px)] z-40 mx-auto flex max-w-[560px] items-center gap-3 rounded-2xl border border-amber-200/24 bg-black/78 p-3 shadow-[0_0_44px_rgba(251,191,36,0.12)] backdrop-blur-md xl:bottom-5">
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
    <main className="triad-dominion-game relative h-full min-h-0 max-w-full overflow-x-hidden overflow-y-auto rounded-[20px] border border-white/8 bg-[#06080d] text-white shadow-[0_26px_90px_rgba(0,0,0,0.42)] sm:rounded-[24px]">
      {false && currentRoom && isFieldPlayer && !matchDone ? (
        <button
          type="button"
          onClick={surrenderBattle}
          className="absolute left-4 top-4 z-30 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-200/35 bg-red-500 px-4 text-xs font-black uppercase tracking-[0.12em] text-white shadow-[0_0_30px_rgba(239,68,68,0.28)] backdrop-blur transition hover:bg-red-400"
        >
          <Swords className="h-4 w-4" />
          ยอมแพ้
        </button>
      ) : null}
      {matchDone ? (
        <MatchFinalOverlay winner={winnerText} surrendered={surrenderedLabel} score={finalMatchScore} isDraw={finalMatchScore.player === finalMatchScore.bot && !forcedWinnerSide} rankUpEvents={currentRoom?.game.rankUpEvents || []} />
      ) : null}
      <OpeningTieBreakOverlay
        tieBreak={currentRoom?.game.activeTurn === 1 ? currentRoom?.game.openerTieBreak : null}
        hostName={currentRoom?.seats.host?.name || "ฝั่งบน"}
        challengerName={currentRoom?.seats.challenger?.name || "ฝั่งล่าง"}
        ownSide={roomPlayerSide}
        isSpectator={isSpectator}
        pendingChoice={visibleOpeningTieBreakPendingChoice}
        onChoose={chooseOpeningTieBreak}
        onReset={resetOpeningTieBreak}
        resetDisabled={openingTieBreakResetting}
        onExit={leaveRoom}
      />
      <OpeningTieBreakResultOverlay
        key={openingTieBreakResultKey}
        tieBreak={currentRoom?.game.openerTieBreak}
        hostName={currentRoom?.seats.host?.name || "ฝั่งบน"}
        challengerName={currentRoom?.seats.challenger?.name || "ฝั่งล่าง"}
        visible={openingTieBreakResultVisible}
      />
      {false && currentRoom ? (
        <button
          type="button"
          onClick={leaveRoom}
          className="absolute right-4 top-4 z-30 inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-black/55 px-4 text-xs font-black uppercase tracking-[0.12em] text-white/70 backdrop-blur transition hover:border-white/30"
        >
          ออกห้อง
        </button>
      ) : null}
      {false && deckSelectionActive ? (
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
      {isSpectator ? <CardHoverPreview card={spectatorPreviewCard} onClose={() => setSpectatorPreviewCard(null)} passive /> : null}
      <section className="triad-game-roombar relative z-20 mx-2 mt-2 rounded-2xl border border-white/8 bg-black/30 px-3 py-2.5 shadow-[0_18px_48px_rgba(0,0,0,0.28)] backdrop-blur-md sm:mx-3 sm:px-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(230px,0.85fr)_minmax(260px,1fr)_auto] lg:items-center">
          <div className="flex min-w-0 items-center gap-2">
            {currentRoom && isFieldPlayer && !matchDone ? (
              <button
                type="button"
                onClick={surrenderBattle}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-red-200/35 bg-red-500 px-3 text-[11px] font-black uppercase tracking-[0.1em] text-white shadow-[0_0_30px_rgba(239,68,68,0.22)] transition hover:bg-red-400 sm:px-4"
              >
                <Swords className="h-4 w-4" />
                ยอมแพ้
              </button>
            ) : null}
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-amber-100/52">
              <Swords className="h-3.5 w-3.5 text-amber-300" />
              Battle Room
            </div>
            <div className="mt-1 truncate text-xl font-black uppercase tracking-normal text-white sm:text-2xl">
              {currentDeckModeTitle}
            </div>
          </div>
          </div>
          <div className="min-w-0 lg:justify-self-end">
            <div className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-white/38 lg:text-right">
              ผู้ชม {currentRoom?.spectators.length || 0}/{SPECTATOR_LIMIT}
            </div>
            <SpectatorAvatarRail spectators={currentRoom?.spectators || []} rankProfiles={rankProfiles} currentParticipantId={participant.id} />
          </div>
          {currentRoom ? (
            <button
              type="button"
              onClick={leaveRoom}
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/55 px-4 text-xs font-black uppercase tracking-[0.12em] text-white/70 transition hover:border-white/30 lg:justify-self-end"
            >
              ออกห้อง
            </button>
          ) : null}
        </div>
      </section>
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

      <section className={`triad-game-layout grid min-h-0 max-w-full gap-2 p-2 sm:gap-3 sm:p-3 2xl:grid-cols-[minmax(0,1fr)_clamp(300px,18vw,340px)] ${deckSelectionActive ? "pt-2 sm:pt-3" : "pt-2 sm:pt-2"}`}>
        <section className="triad-game-playarea grid min-h-0 max-w-full grid-rows-[minmax(330px,auto)_auto_auto] gap-2 sm:grid-rows-[minmax(420px,auto)_auto_auto] sm:gap-3 2xl:grid-rows-[minmax(470px,calc(100vh-390px))_auto_auto]">
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
              <SpectatorDeckStrip title={`ฝั่งบน · ${displayBotName}`} cards={displayBotDeckCards} tone="top" onPreview={setSpectatorPreviewCard} onPreviewEnd={() => setSpectatorPreviewCard(null)} />
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
                playerParticipant={displayPlayerParticipant}
                botParticipant={displayBotParticipant}
                rankProfiles={rankProfiles}
                currentParticipantId={participant.id}
                placementLane={placementLane}
                timeLeft={displayTimeLeft}
                turnLocked={placementLocked}
                pendingSkillChoice={pendingSkillChoice}
                waitingSkillChoice={waitingSkillChoice}
                revealAllCards={isSpectator}
                randomCard={randomDrawCard}
                blessingAuras={displayBlessingAuras}
                skillOpenerName={displaySkillOpenerName}
                skillSecondName={displaySkillSecondName}
                nextSkillOpenerName={displayNextSkillOpenerName}
                nextSkillSecondName={displayNextSkillSecondName}
                onSelectSkillTarget={(target) =>
                  setPendingSkillChoice((current) => (current ? { ...current, selectedTarget: target } : current))
                }
                onConfirmSkillTarget={confirmSkillTarget}
                onDrawRandomCard={() => {
                  void drawRandomCard();
                }}
                onSelectLane={setPlacementLane}
                onPlaceCard={placeAndLockCard}
              />
              <SpectatorDeckStrip title={`ฝั่งล่าง · ${displayPlayerName}`} cards={displayPlayerDeckCards} tone="bottom" onPreview={setSpectatorPreviewCard} onPreviewEnd={() => setSpectatorPreviewCard(null)} />
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
              playerParticipant={displayPlayerParticipant}
              botParticipant={displayBotParticipant}
              rankProfiles={rankProfiles}
              currentParticipantId={participant.id}
              placementLane={placementLane}
              timeLeft={displayTimeLeft}
              turnLocked={placementLocked}
              pendingSkillChoice={pendingSkillChoice}
              waitingSkillChoice={waitingSkillChoice}
              revealAllCards={isSpectator}
              randomCard={randomDrawCard}
              blessingAuras={displayBlessingAuras}
              skillOpenerName={displaySkillOpenerName}
              skillSecondName={displaySkillSecondName}
              nextSkillOpenerName={displayNextSkillOpenerName}
              nextSkillSecondName={displayNextSkillSecondName}
              onSelectSkillTarget={(target) =>
                setPendingSkillChoice((current) => (current ? { ...current, selectedTarget: target } : current))
              }
              onConfirmSkillTarget={confirmSkillTarget}
              onDrawRandomCard={() => {
                void drawRandomCard();
              }}
              onSelectLane={setPlacementLane}
              onPlaceCard={placeAndLockCard}
              readyAdvanceSlot={showReadyAdvanceButton ? renderReadyAdvanceButton() : null}
            />
          )}
          <BlessingChoiceOverlay card={pendingBlessingChoice && !pendingBlessingChoice.choice ? cardsByNo.get("254") : undefined} onChoose={chooseBlessing} />

          {!isSpectator ? (
            <PlayerHand
              cards={playerDeckCards}
              usedSet={displayUsedPlayerSet}
              player={player}
              placementLane={placementLane}
              activeLane={laneForTurn(activeTurn)}
              locked={placementLocked}
              highlightCardNo={displayRandomDrawCardNo}
              onSelectLane={setPlacementLane}
              onPlayCard={placeCardFromHand}
              onDropToLane={placeAndLockCard}
            />
          ) : null}

          <div className="triad-game-status grid gap-3 md:grid-cols-[1fr_auto] md:items-stretch">
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
                    {isPvpRoom && opponentTurnReady && !myTurnReady ? (
                      <div className="mt-3 flex items-center gap-2 rounded-2xl border border-emerald-200/24 bg-emerald-300/10 px-3 py-2 text-xs font-black text-emerald-100 shadow-[0_0_30px_rgba(16,185,129,0.14)]">
                        <Check className="h-4 w-4 shrink-0" />
                        <span>{opponentLabel} กดพร้อมแล้ว รอคุณกดพร้อมเพื่อไปต่อ</span>
                      </div>
                    ) : null}
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
                ) : !isSpectator && (!isPvpRoom || roomPlayerSide) && displayTurnLocked && displayLockedFight && displayRevealed[3].scored ? (
                  isPvpRoom ? (
                    null
                  ) : (
                    <button
                      type="button"
                      onClick={nextFight}
                      className="inline-flex h-full min-h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-black transition hover:bg-amber-100 md:flex-none"
                    >
                      {displayFightNo >= 3 ? "จบเกม" : "รอบถัดไป"}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )
                ) : !isSpectator && (!isPvpRoom || roomPlayerSide) && displayTurnLocked && displayLockedFight && activeTurnScored && displayActiveTurn < 3 ? (
                  isPvpRoom ? (
                    null
                  ) : (
                    <button
                      type="button"
                      onClick={nextTurn}
                      className="inline-flex h-full min-h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-black transition hover:bg-amber-100 md:flex-none"
                    >
                      ตาถัดไป
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )
                ) : (
                  <>
                    {!isSpectator && canRevealTurn && displayLockedFight && !activeTurnScored ? (
                      <button
                        type="button"
                        onClick={revealNext}
                        className="inline-flex h-full min-h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-black transition hover:bg-amber-100 md:flex-none"
                      >
                        {revealButtonLabel}
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    ) : null}
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

          {currentRoom ? (
            <div className="triad-room-actions-mobile space-y-2 2xl:hidden">
              <BattleRoomChatPanel room={currentRoom} currentUserId={participant.id} onSend={sendRoomChat} />
              {deckSelectionActive ? (
                <DeckSelectionStatusBanner
                  title="กำลังเลือกเด็ค"
                  leftName={currentRoom?.seats.host?.name || "ฝั่งบน"}
                  rightName={currentRoom?.seats.challenger?.name || "ฝั่งล่าง"}
                  timerText={deckTimerText}
                  message="รอทั้งสองฝั่งกดพร้อมครบก่อนเริ่มสนามจริง"
                  compact
                />
              ) : null}
              {renderRoomBattleActions()}
            </div>
          ) : null}
        </section>

        <aside className="hidden min-h-0 flex-col gap-3 overflow-visible 2xl:flex 2xl:h-[calc(100vh-136px)] 2xl:max-h-[calc(100vh-136px)]">
          {currentRoom ? (
            <div className="space-y-2">
              <BattleRoomChatPanel room={currentRoom} currentUserId={participant.id} onSend={sendRoomChat} />
              {deckSelectionActive ? (
                <DeckSelectionStatusBanner
                  title="กำลังเลือกเด็ค"
                  leftName={currentRoom?.seats.host?.name || "ฝั่งบน"}
                  rightName={currentRoom?.seats.challenger?.name || "ฝั่งล่าง"}
                  timerText={deckTimerText}
                  message="รอทั้งสองฝั่งกดพร้อมครบก่อนเริ่มสนามจริง"
                  compact
                />
              ) : null}
              {renderRoomBattleActions()}
            </div>
          ) : null}

          <div className="hidden min-h-0 rounded-xl border border-white/8 bg-white/[0.035] p-4">
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

          <div className="hidden rounded-xl border border-white/8 bg-white/[0.035] p-4">
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

          <div className="hidden mt-auto pb-16 xl:pb-20">
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
