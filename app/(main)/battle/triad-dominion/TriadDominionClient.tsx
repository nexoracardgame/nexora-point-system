"use client";
import HoldCardButton from "@/components/HoldCardButton";
import GameLobbyNavigation from '@/components/GameLobbyNavigation';
import {useCardGesture} from '@/lib/use-card-gesture';
import GameLobbyProfile from '@/components/GameLobbyProfile';

import { confirmBattleSurrender, confirmBattleLeave } from "@/lib/battle-surrender-dialog";
import { sendBattleRoomExit } from '@/lib/battle-room-exit';
import BattleForfeitVictory from "@/components/BattleForfeitVictory";
import BattleMatchResult from "@/components/BattleMatchResult";
import BattleVersusIntro from "@/components/BattleVersusIntro";
import BattleWaitingRoom from "@/components/BattleWaitingRoom";
import BattleConnectingScreen from "@/components/BattleConnectingScreen";
import { normalizeBattleForfeit, type BattleForfeit } from "@/lib/battle-forfeit";
import GameModeModal from "@/components/GameModeModal";
import TargetSelectionModal from "@/components/TargetSelectionModal";
import LobbyActionButton from "@/components/LobbyActionButton";
import LobbyBanner from "@/components/LobbyBanner";
import type { TargetOptionView } from "@/lib/target-selection-view";

import Image from "next/image";
import { useRouter } from "next/navigation";
import dynamic from 'next/dynamic';
import { savePentadHandoff } from '@/lib/pentad-room-handoff';
import type { PentadRoom } from '@/lib/pentad-room-store';
import type { HeptadRoom } from '@/lib/heptad-room-store';
import { Fragment, type CSSProperties, type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
const preparePentadClient = () => import('../pentad-dominion/PentadDominionClient');
const prepareHeptadClient = () => import('@/app/game/heptad/HeptadClient');
const PentadHandoffClient = dynamic(preparePentadClient,{ssr:false});
const HeptadHandoffClient = dynamic(prepareHeptadClient,{ssr:false});
import BattleArenaChat, { BattleArenaChatFrame } from "@/components/BattleArenaChat";
import { BATTLE_CHAT_CHANGED } from "@/lib/battle-chat-messages";
import DuelistLeaderboard from "@/components/DuelistLeaderboard";
import { playDrawerSound } from "@/lib/play-drawer-audio";
import { playGameUiSound } from "@/lib/game-ui-audio";
import { useBattleLoadingStage } from "@/components/BattleLoadingScreen";
import BattleCardInspector from "@/components/BattleCardInspector";
import { BattleArenaHeader, BattleArenaHand, BattleArenaFormation, BattleArenaStatus, type ArenaCardFilter } from "@/components/BattleArenaControls";
import { DeckPreparationHeader, DeckPreparationLayout, DeckPreparationTools, TRIAD_TITLE } from "@/components/DeckPreparation";
import { freshDeck, randomTriadDeck } from "@/lib/deck-reroll";
import { bestTriadBotPlay } from "@/lib/battle-bot-search";
import { BattleArenaScoreplate, BattleArenaPhaseTrack, BattleArenaProgress, BattleArenaSurface, BattleArenaCardFrame } from "@/components/BattleArenaHud";
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
import BattleCinematic from "./BattleCinematic";
import NexoraCommandScene from "./NexoraCommandScene";
import "./NexoraCommand.css";
import "./NexoraLobbyDrawer.css";
import { playCardDeployment, playMenuCue, primeBattleAudio } from "./BattleAudio";
import { battleArenaForSeed, type TriadArena } from "@/lib/triad-arena";
import {
  resolveTriadTurn as resolveTriadTurnRules,
  triadCardByNo,
  triadSkillElementConditionMatches,
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
import { useBattleArenaActivity, useBattleCombatActivity } from "@/lib/battle-ui-state";
import {
  TRIAD_ROOM_REALTIME_CHANNEL,
  TRIAD_ROOM_REALTIME_EVENT,
  type TriadRoomRealtimePayload,
} from "@/lib/triad-room-realtime";

const TRIAD_CARD_BACK_SRC = "/cards/card-backs/card-backs.png";

function resolveTriadTurn(input: Parameters<typeof resolveTriadTurnRules>[0]) {
  const lane = input.turn === 1 ? "top" : input.turn === 2 ? "left" : "right";
  const blessings = (["player", "opponent"] as const).filter(side => input.skillTargets?.[side]?.["245"]?.startsWith("copy:254>"));
  if (blessings.length) {
    const next = {...input,player:{...input.player},opponent:{...input.opponent},skillTargets:{...input.skillTargets},skippedSkillCardNos:[...(input.skippedSkillCardNos || []),"245"]};
    for (const side of blessings) {
      const action=input.skillTargets?.[side]?.["245"]?.split(">")[1];
      const kind=action==="draw-skill"?"skill":"monster";
      const pool=Array.from(triadCardByNo.values()).filter(card=>card.kind===kind&&!["245","254",input.player.top,input.opponent.top,...(input.excludedRandomMonsterNos || [])].includes(card.cardNo));
      const seed=`${input.randomMonsterSeed || "copy-blessing"}:${side}:${input.player.top}:${input.opponent.top}`;
      const index=Array.from(seed).reduce((hash,char)=>(hash*31+char.charCodeAt(0))>>>0,0)%Math.max(1,pool.length);
      const drawn=pool[index];if(!drawn)continue;
      if(action==="draw-skill")next[side][lane]=drawn.cardNo;
      else next[action==="reroll-own"?side:side==="player"?"opponent":"player"].top=drawn.cardNo;
      next.skillTargets[side]={...next.skillTargets[side],"245":""};
    }
    return resolveTriadTurn(next);
  }
  const no = input.opponent[lane] || "";
  const target = input.skillTargets?.opponent?.[no];
  if (no && target === undefined && triadCardByNo.get(no)?.kind === "skill") {
    const best = bestTriadBotPlay(input.turn,input.player,input.opponent,[no],input.prioritySide);
    return resolveTriadTurnRules({...input,skillTargets:{...input.skillTargets,opponent:{...input.skillTargets?.opponent,[no]:best.target}}});
  }
  return resolveTriadTurnRules(input);
}

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
    role?: string;
  };
};

type BattlePhase = "lobby" | "room" | "deck" | "battle";
type Side = "player" | "bot";
type Lane = "top" | "left" | "right";
type RoomAccess = "public" | "private";
type RoomStatus = "waiting" | "playing";
type RoomPlayerSide = "host" | "challenger";
type DeckMode = "all" | "monster" | "skill";
type GmRescueAction = "gm-reset-decks" | "gm-refresh-app" | "gm-restart-turn";

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
  forfeit?: BattleForfeit;
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
const TRIAD_SELECTION_POOL_SIZE = 293;
const SKILL_MODE_MONSTER_LIMIT = 10;
const SKILL_MODE_SKILL_LIMIT = 10;
const TURN_SECONDS = 120;
const RESULT_SECONDS = 60;
const SPECTATOR_LIMIT = 10;
const ROOM_API_PATH = "/api/triad-rooms";
const LOBBY_SYNC_MS = 1200;
const ACTIVE_ROOM_SYNC_MS = 450;
const HIDDEN_SYNC_MS = 2500;
const MIN_SYNC_GAP_MS = 35;
const TRIAD_RESUME_ROOM_CACHE_KEY = "nexora:triad:active-room";
const TRIAD_BOT_ID = "triad-bot-level-99";
const rankFrames = [
  { key: "bronze", name: "Bronze", aura: "from-orange-700/40 via-amber-900/18 to-black/20", ring: "border-orange-400/58 shadow-[0_0_26px_rgba(251,146,60,0.24)]", badge: "bg-orange-400 text-black" },
  { key: "silver", name: "Silver", aura: "from-white/46 via-slate-300/18 to-black/18", ring: "border-slate-100/75 shadow-[0_0_34px_rgba(226,232,240,0.3)]", badge: "bg-slate-100 text-black" },
  { key: "gold", name: "Gold", aura: "from-yellow-100/62 via-amber-400/28 to-black/18", ring: "border-yellow-200/90 shadow-[0_0_42px_rgba(250,204,21,0.44)]", badge: "bg-yellow-200 text-black" },
  { key: "platinum", name: "Platinum", aura: "from-cyan-100/58 via-teal-300/24 to-black/20", ring: "border-cyan-100/85 shadow-[0_0_46px_rgba(125,211,252,0.42)]", badge: "bg-cyan-100 text-black" },
  { key: "diamond", name: "Diamond", aura: "from-sky-100/70 via-blue-400/32 to-violet-400/16", ring: "border-sky-100 shadow-[0_0_56px_rgba(96,165,250,0.54)]", badge: "bg-sky-200 text-black" },
  { key: "master", name: "Master", aura: "from-fuchsia-200/64 via-rose-500/28 to-violet-700/24", ring: "border-fuchsia-100 shadow-[0_0_64px_rgba(217,70,239,0.55)]", badge: "bg-fuchsia-200 text-black" },
  { key: "god-of-legends", name: "God Of Legends", aura: "from-yellow-100/80 via-rose-300/42 to-violet-400/32", ring: "border-yellow-100 shadow-[0_0_82px_rgba(250,204,21,0.72)]", badge: "bg-gradient-to-r from-yellow-100 via-rose-200 to-violet-200 text-black" },
] as const;

type SkillTargetId = "player-top" | "bot-top" | `copy:${string}` | "draw-skill" | "reroll-own" | "reroll-opponent";
type SkillTargetSelection = SkillTargetId | `${SkillTargetId}>${SkillTargetId}` | `copy:${string}>${SkillTargetId}>${SkillTargetId}` | "";

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

function sortCardsByNo(cards: CardView[]) {
  return [...cards].sort((a, b) => a.cardNo.localeCompare(b.cardNo, "en", { numeric: true }));
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

function isClientAdminRole(role?: string | null) {
  const normalized = safeText(role).toLowerCase();
  return normalized === "admin" || normalized === "gm" || normalized === "superadmin";
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
  crown = false,
}: {
  participant?: RoomParticipant | null;
  name?: string;
  image?: string;
  profile?: TriadRankProfile | null;
  label?: string;
  align?: "left" | "right";
  placement?: "top" | "bottom";
  size?: "sm" | "md" | "xl";
  currentParticipantId?: string;
  crown?: boolean;
}) {
  const profileName = name || participant?.name || "ผู้เล่น";
  const profileImage = image || participant?.image || "/avatar.png";
  const frame = rankFrames[rankIndexForParticipant(participant || { id: profileName }, profile)] || rankFrames[0];
  const avatarSize = size === "xl" ? "h-24 w-24" : size === "md" ? "h-11 w-11" : "h-9 w-9";
  const wins = profile?.wins || 0;
  const losses = profile?.losses || 0;
  const totalMatches = wins + losses;
  const winRate = totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0;
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});

  const clearCloseTimer = () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  };
  const updatePanelPosition = () => {
    if (!anchorRef.current || typeof window === "undefined") return;
    const rect = anchorRef.current.getBoundingClientRect();
    const width = 288;
    const estimatedHeight = 272;
    const safe = 12;
    const gap = 12;
    const preferredLeft = align === "right" ? rect.left - width - gap : rect.right + gap;
    const fallbackLeft = align === "right" ? rect.right + gap : rect.left - width - gap;
    const hasPreferredRoom = preferredLeft >= safe && preferredLeft + width <= window.innerWidth - safe;
    const left = hasPreferredRoom ? preferredLeft : fallbackLeft;
    const preferredTop = placement === "top" ? rect.top - estimatedHeight - gap : rect.bottom + gap;
    setPanelStyle({
      left: Math.min(Math.max(safe, left), window.innerWidth - width - safe),
      top: Math.min(Math.max(safe, preferredTop), Math.max(safe, window.innerHeight - estimatedHeight - safe)),
      maxHeight: Math.max(220, window.innerHeight - safe * 2),
      overflowY: "auto",
    });
  };
  const showPanel = () => {
    clearCloseTimer();
    updatePanelPosition();
    setOpen(true);
  };
  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => {
    setPortalReady(true);
    return () => clearCloseTimer();
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePanelPosition();
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);
    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [open, align, placement]);

  return (
    <div className="triad-mini-profile-anchor relative z-50 inline-flex shrink-0 items-center">
      <button
        ref={anchorRef}
        type="button"
        onMouseEnter={showPanel}
        onMouseLeave={scheduleClose}
        onPointerEnter={showPanel}
        onPointerLeave={scheduleClose}
        onFocus={showPanel}
        onBlur={scheduleClose}
        className={`relative grid ${avatarSize} place-items-center rounded-full border ${frame.ring} bg-black/70 p-[3px] outline-none transition hover:scale-105 focus:scale-105`}
      >
        <span className={`absolute -inset-2 rounded-full bg-gradient-to-br ${frame.aura} opacity-70 blur-lg`} />
        <span className="relative h-full w-full overflow-hidden rounded-full border border-black/70 bg-black">
          <Image src={profileImage} alt={profileName} width={48} height={48} className="h-full w-full object-cover" />
        </span>
        {crown ? (
          <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full border border-amber-100/70 bg-amber-300 text-black shadow-[0_0_22px_rgba(251,191,36,0.5)]">
            <Crown className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </button>
      <div
        className={`nexora-battle-preview-portal triad-mini-profile-panel pointer-events-auto fixed z-[9999] w-72 max-w-[calc(100vw-24px)] rounded-2xl border border-amber-100/28 bg-[#07080d]/96 p-3 text-left shadow-[0_28px_90px_rgba(0,0,0,0.72),0_0_56px_rgba(251,191,36,0.22)] backdrop-blur-xl transition duration-150 ${
          open && portalReady ? "visible opacity-100" : "invisible opacity-0"
        }`}
        style={panelStyle}
        onMouseEnter={showPanel}
        onMouseLeave={scheduleClose}
        onPointerEnter={showPanel}
        onPointerLeave={scheduleClose}
        onFocus={showPanel}
        onBlur={scheduleClose}
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
            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-100/60">ชนะ</div>
            <div className="mt-1 text-lg font-black text-emerald-100">{wins.toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-rose-200/16 bg-rose-300/10 px-2 py-2 text-center">
            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-rose-100/60">แพ้</div>
            <div className="mt-1 text-lg font-black text-rose-100">{losses.toLocaleString()}</div>
          </div>
          <div className="rounded-xl border border-amber-200/16 bg-amber-300/10 px-2 py-2 text-center">
            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-100/60">ชนะ%</div>
            <div className="mt-1 text-lg font-black text-amber-100">{winRate}%</div>
          </div>
        </div>
        <div className={`mt-3 rounded-xl border px-3 py-2 text-xs font-black leading-5 ${frame.badge}`}>
          {profile?.rankName || frame.name}
          {profile?.nextRankWins ? <span className="ml-2 opacity-70">อีก {Math.max(0, profile.nextRankWins - wins).toLocaleString()} ชนะเพื่อแรงก์ถัดไป</span> : <span className="ml-2 opacity-80">แรงก์สูงสุดแล้ว</span>}
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
  if (room.status !== "playing") return "room";
  if (spectator) return "battle";
  return roomDecksReadyForBattle(room) ? "battle" : "deck";
}

function roomDecksReadyForBattle(room: TriadRoom | null | undefined) {
  return Boolean(
    room?.game.deckReady.host &&
      room.game.deckReady.challenger
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

function roomWithOptimisticJoin(room: TriadRoom, participant: RoomParticipant, forceSpectator: boolean): TriadRoom {
  if (participantInRoom(room, participant.id)) return room;
  const mustSpectate = Boolean(forceSpectator || room.status === "playing" || (room.seats.host && room.seats.challenger));
  if (!mustSpectate && !room.seats.host) {
    return {
      ...room,
      seats: { ...room.seats, host: participant },
      hostId: participant.id,
      updatedAt: Date.now(),
    };
  }
  if (!mustSpectate) {
    return {
      ...room,
      seats: { ...room.seats, challenger: participant },
      updatedAt: Date.now(),
    };
  }
  return {
    ...room,
    spectators: [participant, ...room.spectators].slice(0, SPECTATOR_LIMIT),
    updatedAt: Date.now(),
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
  const cleanPool = (deck: unknown) => Array.isArray(deck) ? deck.map((item) => safeText(item)).filter(Boolean).slice(0, TRIAD_SELECTION_POOL_SIZE) : [];
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
    forfeit: normalizeBattleForfeit(raw.forfeit),
    rankedRecordedAt: Number(raw.rankedRecordedAt || 0),
    rankUpEvents: cleanRankUpEvents(raw.rankUpEvents),
    chat: cleanChat(raw.chat),
  };
}

function roomProgressValue(room: TriadRoom) {
  return room.game.fightNo * 10 + room.game.activeTurn;
}

function roomBattleStartKey(room: TriadRoom) {
  return `${room.code}:${Number(room.game.deckStartedAt || 0)}`;
}

function shouldKeepCurrentRoomSnapshot(currentRoom: TriadRoom | undefined, nextRoom: TriadRoom) {
  if (!currentRoom || currentRoom.code !== nextRoom.code) return false;
  const currentDeckStart = Number(currentRoom.game.deckStartedAt || 0);
  const nextDeckStart = Number(nextRoom.game.deckStartedAt || 0);
  if (currentDeckStart !== nextDeckStart) return currentDeckStart > nextDeckStart;
  if (currentRoom.status === "playing" && nextRoom.status === "playing" && (
    (currentRoom.game.deckReady.host && !nextRoom.game.deckReady.host) ||
    (currentRoom.game.deckReady.challenger && !nextRoom.game.deckReady.challenger)
  )) return true;
  if (Number(nextRoom.updatedAt || 0) < Number(currentRoom.updatedAt || 0)) return true;
  if (Number(nextRoom.updatedAt || 0) > Number(currentRoom.updatedAt || 0)) return false;
  if (currentRoom.status === "playing" && nextRoom.status === "waiting") {
    return true;
  }
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
  if (existing && JSON.stringify(existing) === JSON.stringify(room)) return rooms;
  if (shouldKeepCurrentRoomSnapshot(existing, room)) return rooms;
  return existing ? rooms.map((item) => (item.code === room.code ? mergeRoomWithStableChat(item, room) : item)) : [room, ...rooms];
}

function forceReplaceRoomByCode(rooms: TriadRoom[], room?: TriadRoom | null) {
  if (!room?.code) return rooms;
  const existing = rooms.find((item) => item.code === room.code);
  const stableRoom = mergeRoomWithStableChat(existing, room);
  return existing ? rooms.map((item) => (item.code === room.code ? stableRoom : item)) : [stableRoom, ...rooms];
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
  if (room.status !== "playing" || !roomDecksReadyForBattle(room)) return TURN_SECONDS;
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

function restoreLockedFightAfterBlessing(fight: LockedFight, blessing: PendingBlessingChoice | null) {
  if (!blessing?.choice) return fight;
  return {
    ...fight,
    player: { ...blessing.player },
    bot: { ...blessing.bot },
  };
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
    lane === "top" ? "monster" : deckMode === "monster" ? "monster" : deckMode === "skill" || deckMode === "all" ? "skill" : "any";
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
  const searched = bestTriadBotPlay(turn, player, bot, scoringCards.map(card => card.cardNo));
  if (searched.cardNo) return searched.cardNo;
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
  if (mode === "skill" || mode === "all") return "skill";
  return "any";
}

function deckAllowsCard(mode: DeckMode, lane: Lane, card?: CardView | null) {
  if (!card) return false;
  const requiredKind = deckModeCardKind(mode, lane);
  if (requiredKind === "any") return card.kind !== "unknown";
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

function monsterHasGoldenRegis018Element(card?: CardView) {
  return Boolean(card?.kind === "monster" && card.element === "gold");
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
    .filter((item): item is SkillTargetId => item === "player-top" || item === "bot-top" || /^copy:\d{3}$/.test(item) || ["draw-skill", "reroll-own", "reroll-opponent"].includes(item));
}

function targetMatchesSkillElementCondition(
  rule: ReturnType<typeof triadSkillRuleByNo.get>,
  target: SkillTargetId,
  playerTop?: CardView,
  botTop?: CardView
) {
  if (!rule?.elementCondition) return true;
  const targetCard = target === "player-top" ? playerTop : botTop;
  return Boolean(targetCard?.kind === "monster" && triadSkillElementConditionMatches(rule, targetCard));
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
  const withElementCondition = (targets: SkillTargetId[]) =>
    targets.filter((target) => targetMatchesSkillElementCondition(rule, target, playerTop, botTop));

  if (card?.cardNo === "254") return [];
  if (!rule) return [ownTarget];
  if (card?.cardNo === "234") return withElementCondition([ownTarget]);
  if (card?.cardNo === "232") {
    return withElementCondition([
      playerTop?.kind === "monster" ? "player-top" as const : null,
      botTop?.kind === "monster" ? "bot-top" as const : null,
    ].filter((target): target is "player-top" | "bot-top" => Boolean(target)));
  }
  if (card?.cardNo === "231") {
    return withElementCondition([
      monsterHasUnequalStats(playerTop) ? "player-top" as const : null,
      monsterHasUnequalStats(botTop) ? "bot-top" as const : null,
    ].filter((target): target is "player-top" | "bot-top" => Boolean(target)));
  }
  if (card?.cardNo === "227") {
    return withElementCondition([
      monsterHasGravityFieldStat(playerTop) ? "player-top" as const : null,
      monsterHasGravityFieldStat(botTop) ? "bot-top" as const : null,
    ].filter((target): target is "player-top" | "bot-top" => Boolean(target)));
  }
  if (card?.cardNo === "259") {
    return withElementCondition([
      monsterHasTidebombStat(playerTop) ? "player-top" as const : null,
      monsterHasTidebombStat(botTop) ? "bot-top" as const : null,
    ].filter((target): target is "player-top" | "bot-top" => Boolean(target)));
  }
  if (card?.cardNo === "255") {
    const opposingCard = side === "player" ? botTop : playerTop;
    return opposingCard?.kind === "monster" && opposingCard.element === "water" ? withElementCondition([opponentTarget]) : [];
  }
  if (card?.cardNo === "018") {
    const ownCard = side === "player" ? playerTop : botTop;
    return monsterHasGoldenRegis018Element(ownCard) ? withElementCondition([ownTarget]) : [];
  }
  if (card?.cardNo === "019") {
    const ownCard = side === "player" ? playerTop : botTop;
    return monsterHasVerdant019Element(ownCard) ? withElementCondition([ownTarget]) : [];
  }
  if (card?.cardNo === "223") {
    const ownCard = side === "player" ? playerTop : botTop;
    return monsterHasPitfall223Stat(ownCard) ? withElementCondition([ownTarget]) : [];
  }
  if (card?.cardNo === "238") {
    const ownCard = side === "player" ? playerTop : botTop;
    return monsterHasMetalShield238Stat(ownCard) ? withElementCondition([ownTarget]) : [];
  }
  if (card?.cardNo === "239") {
    const ownCard = side === "player" ? playerTop : botTop;
    return monsterHasIronWings239Stat(ownCard) ? withElementCondition([ownTarget]) : [];
  }
  if (card?.cardNo === "243") {
    const ownCard = side === "player" ? playerTop : botTop;
    return monsterHasCounterBlade243Stat(ownCard) ? withElementCondition([ownTarget]) : [];
  }
  if (rule.target.startsWith("own")) return withElementCondition([ownTarget]);
  if (rule.target.startsWith("opponent")) return withElementCondition([opponentTarget]);
  if (rule.target === "any-one" || rule.target === "all") return withElementCondition([ownTarget, opponentTarget]);

  return withElementCondition([ownTarget]);
}

function getPlayableSkillTargetIds(card?: CardView, side: Side = "player", playerTop?: CardView, botTop?: CardView, turn: TriadTurn = 1, copyField?: TriadTriangle): SkillTargetId[] {
  if (card?.cardNo === "254") return ["draw-skill", "reroll-own", "reroll-opponent"];
  if (card?.cardNo === "245") return (["top", "left", "right"] as const).slice(0, turn).flatMap(lane => {
    const no = copyField?.[lane] || "";
    return no !== "245" && triadCardByNo.get(no)?.kind === "skill" ? [`copy:${no}` as SkillTargetId] : [];
  });
  const selectable = getSelectableSkillTargetIds(card, side, playerTop, botTop);
  if (card?.cardNo === "225") return selectable.filter(target => {
    const monster = target === "player-top" ? playerTop : botTop;
    return Boolean(monster?.kind === "monster" && monster.attack <= 5000);
  });
  if (card?.cardNo === "226") return selectable.filter(target => {
    const monster = target === "player-top" ? playerTop : botTop;
    return Boolean(monster?.kind === "monster" && monster.attack <= 3000);
  });
  if (card?.cardNo === "227") {
    return selectable.filter(target => { const monster = target === "player-top" ? playerTop : botTop; return Boolean(monster && Math.max(monster.attack, monster.support) > 7000); });
  }
  return selectable;
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
  onPreview,
  onPreviewEnd,
}: {
  card: CardView;
  selected: boolean;
  disabled: boolean;
  disabledReason?: string;
  onClick: () => void;
  onPreview?: (card: CardView) => void;
  onPreviewEnd?: () => void;
}) {
  return (
    <HoldCardButton
      type="button"
      onClick={() => {
        if (disabled && !selected) return;
        onClick();
      }}
      
      
      
      
      
      
      
      aria-disabled={disabled && !selected}
      title={disabled && !selected ? disabledReason : selected ? "คลิกอีกครั้งเพื่อลบการ์ดใบนี้" : undefined}
      className={`group relative min-w-0 overflow-hidden rounded-xl border bg-black/52 text-left shadow-[0_18px_48px_rgba(0,0,0,0.32)] transition hover:-translate-y-1 hover:border-amber-300/60 ${
        disabled && !selected ? "cursor-not-allowed opacity-45" : ""
      } ${
        selected ? "border-amber-300 ring-2 ring-amber-300/30" : "border-white/10"
      }`} onPreview={()=>onPreview?.(card)} onPreviewEnd={()=>onPreviewEnd?.()}
    >
      <div className="relative aspect-[815/1110]">
        <Image src={card.sourceImage} alt={card.name} fill sizes="180px" className="object-contain" />
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
    </HoldCardButton>
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
  return <BattleArenaPhaseTrack activeTurn={activeTurn} />;
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
  const [reducedDeployment, setReducedDeployment] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try { setReducedDeployment(localStorage.getItem("triad-reduced-motion") === "1"); } catch { /* Optional preference. */ }
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const deployedCardNo = card?.cardNo || "";
  const deployedElement = card?.element || "unknown";
  const previousCard = useRef(deployedCardNo);
  useEffect(() => {
    const changed = previousCard.current !== deployedCardNo;
    previousCard.current = deployedCardNo;
    if (changed && deployedCardNo && !hidden && tone === "player") return playCardDeployment(deployedElement);
  }, [deployedCardNo, deployedElement, hidden, tone]);

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
      <div className="triad-card-anchor relative overflow-visible rounded-[6px] bg-transparent aspect-[815/1110]" data-board-card data-card-no={card?.cardNo || ""} data-face-up={Boolean(card && !hidden)} data-deploy-motion={!reducedDeployment} data-active={active || Boolean(aura)} style={{ "--summon-color": ({ fire: "#ff765e", water: "#7be4ff", wood: "#86f2ab", earth: "#efca7a", gold: "#ffe3a4", unknown: "#d4b8ff" })[card?.element || "unknown"] } as CSSProperties}>
        {card && !hidden ? (
          <div key={card.cardNo} className={`triad-card-face ${tone === "player" ? "triad-card-deploy" : ""}`}>
            <BattleArenaCardFrame><Image src={card.sourceImage} alt={card.name} fill loading="eager" sizes="(max-width: 700px) 120px, 200px" className="object-contain" /></BattleArenaCardFrame>
            {tone === "player" ? (
              <div className="triad-deploy-fx" aria-hidden="true">
                <i /><i />
                <img src="/battle-fx/magic_01.png" alt="" draggable={false} />
                <img src="/battle-fx/spark_01.png" alt="" draggable={false} />
                <div className="triad-deploy-rays">
                  {[0, 1, 2, 3].map(direction => <img key={direction} src="/battle-fx/slash_01.png" alt="" style={{ "--ray-angle": `${direction * 90 + 45}deg` } as CSSProperties} />)}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <Image
              src={TRIAD_CARD_BACK_SRC}
              alt={`${label} card back`}
              fill
              sizes="(max-width: 700px) 120px, 200px"
              quality={72}
              priority={active}
              className="triad-card-back-art nexora-card-back-art object-contain"
            />
          </>
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
      <div className={`relative z-10 rounded-md bg-black/55 px-2 py-1 text-center backdrop-blur-sm ${rotate ? "rotate-180" : ""}`}>
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
              <div data-battle-card-face className="relative aspect-[815/1110] overflow-hidden">
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
              <div data-battle-card-face className="relative aspect-[815/1110] overflow-hidden">
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
    <BattleArenaFormation upper={tone === "bot"} className="triad-arena-triangle">
      {lanes.map(({ lane, label, className }) => {
        const cardNo = triangle[lane];
        const card = cardNo ? cardsByNo.get(cardNo) : undefined;
        const visible = isVisible(lane);
        const canPreview = Boolean(card && visible);
        return (
          <Fragment key={lane}>
            <HoldCardButton
              type="button"
              data-triad-lane={lane}
              data-arena-slot={lane === "top" ? 0 : lane === "left" ? 1 : 3}
              
              
              
              
              
              
              
              
              
              
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
              }`} onPreview={()=>{if(card&&canPreview)onPreview?.(card,"hover")}} onPreviewEnd={()=>onPreviewEnd?.()} onClick={()=>onSlotClick?.(lane)}
            >
              <BoardCardSlot
                card={card}
                hidden={!visible}
                active={activeLane === lane}
                aura={auraByLane?.[lane]}
                label={label}
                tone={tone}
              />
            </HoldCardButton>
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
    </BattleArenaFormation>
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
  const gesture=useCardGesture({onChoose:onClick,onPreview:()=>onPreview(card),onPreviewEnd,disabled:disabled||used});
  const holdPreviewPointerRef = useRef<number | null>(null);
  const playStampRef = useRef(0);
  const playCardOnce = () => {
    const now = Date.now();
    if (now - playStampRef.current < 220) return;
    playStampRef.current = now;
    onPreviewEnd();
    onClick();
  };
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
      
      
      
      
      
      
      
      onDragStart={(event) => {
        if (isPreviewOnlyInput()) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.setData("text/plain", card.cardNo);
        event.dataTransfer.effectAllowed = "move";
      }}
      
      
      
      
      
      {...gesture}
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
      <div className="relative aspect-[815/1110]">
        <BattleArenaCardFrame><Image src={card.sourceImage} alt={card.name} fill sizes="110px" draggable={false} className="select-none object-contain [-webkit-touch-callout:none]" /></BattleArenaCardFrame>
        {used ? <div className="absolute inset-0 bg-black/62" /> : null}
      </div>
      {used ? (
        <div className="absolute inset-x-1 bottom-1 rounded-md border border-white/10 bg-black/78 px-1 py-1 text-center text-[8px] font-black uppercase tracking-[0.08em] text-white/58">
          ใช้แล้ว
        </div>
      ) : null}
      {highlighted ? <div className="pointer-events-none absolute inset-0 rounded-[inherit] ring-2 ring-cyan-200/65" /> : null}
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
  const [handFilter, setHandFilter] = useState<ArenaCardFilter>("all");
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
  const renderHandCard = (card: CardView) => {
    const placedLane = placedByNo.get(card.cardNo);
    const unavailable = usedSet.has(card.cardNo) || Boolean(placedLane && placedLane !== activeLane);
    return (
      <HandCard
        key={card.cardNo}
        card={card}
        used={unavailable}
        placedLane={placedLane}
        disabled={locked || unavailable || (activeLane === "top" && card.kind === "skill")}
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
      <BattleArenaHand title={activeLane === "top" ? "เลือกมอนสเตอร์ลงสนาม" : "เลือกการ์ดลงสนาม"} filter={handFilter} onFilterChange={setHandFilter}>
        {cards.filter(card => handFilter === "all" || card.kind === handFilter).map(renderHandCard)}
      </BattleArenaHand>
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
          <HoldCardButton
            key={card.cardNo}
            type="button"
            
            
            
            
            
            className="group relative aspect-[3/4] min-w-0 overflow-hidden rounded-lg border border-white/10 bg-black shadow-[0_12px_22px_rgba(0,0,0,0.24)] transition duration-200 hover:-translate-y-1 hover:scale-[1.03] hover:border-amber-200/60 hover:shadow-[0_0_34px_rgba(251,191,36,0.24)] focus:outline-none focus:ring-2 focus:ring-amber-200/70" onPreview={()=>onPreview?.(card)} onPreviewEnd={()=>onPreview?.(null)} onClick={()=>{}}
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
          </HoldCardButton>
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

  return createPortal(
    <div className="triad-tiebreak-result-overlay fixed inset-0 z-[96] grid place-items-center bg-black/78 px-4 backdrop-blur-lg" style={{ zIndex: 2147483101 }}>
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
    </div>,
    document.body
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

  return createPortal(
    <div className="triad-rps-overlay fixed inset-0 grid place-items-center overflow-y-auto bg-black/72 px-4 py-4 backdrop-blur-md" style={{ zIndex: 2147483100 }} role="dialog" aria-modal="true" aria-label="เป่ายิงฉุบ">
      <div className="triad-rps-panel w-[min(560px,94vw)] overflow-y-auto rounded-2xl border border-amber-200/36 bg-[#080a12] p-5 text-white shadow-[0_28px_110px_rgba(0,0,0,0.62)]" style={{ maxHeight: "calc(100dvh - 2rem)" }}>
        <div className="triad-rps-header text-center">
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
    </div>,
    document.body
  );
}

function CardHoverPreview({
  card,
  onClose,
  onUseCard,
  passive = false,
  variant = "battle",
}: {
  card: CardView | null;
  onClose?: () => void;
  onUseCard?: (cardNo: string) => void;
  passive?: boolean;
  variant?: "battle" | "deck";
}) {
  const useCardStampRef = useRef(0);
  const [portalReady, setPortalReady] = useState(false);
  const [coarsePreviewInput, setCoarsePreviewInput] = useState(false);
  const allowMobileUse = passive && Boolean(onUseCard) && coarsePreviewInput;
  const interactive = (!passive || allowMobileUse) && (Boolean(onUseCard) || Boolean(onClose));
  const useCardFromPreview = () => {
    if (!card || !onUseCard) return;
    const now = Date.now();
    if (now - useCardStampRef.current < 180) return;
    useCardStampRef.current = now;
    onUseCard(card.cardNo);
  };

  useEffect(() => {
    setPortalReady(true);
    const mediaQuery = window.matchMedia("(hover: none), (pointer: coarse)");
    const syncInputMode = () => setCoarsePreviewInput(mediaQuery.matches || window.navigator.maxTouchPoints > 0);
    syncInputMode();
    mediaQuery.addEventListener("change", syncInputMode);
    return () => mediaQuery.removeEventListener("change", syncInputMode);
  }, []);

  useEffect(() => {
    if (!card || !onClose) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [card, onClose]);

  if (!card || !portalReady || typeof document === "undefined") return null;
  return <BattleCardInspector card={card} element={elementLabel[card.element]} interactive={interactive} onClose={onClose} onUseCard={onUseCard && (!passive || allowMobileUse) ? useCardFromPreview : undefined} />;
}

function BattleRoomChatPanel({
  room,
  currentUserId,
  rankProfiles,
  onSend,
  compact = false,
}: {
  room: TriadRoom | null | undefined;
  currentUserId: string;
  rankProfiles: Record<string, TriadRankProfile>;
  onSend: (text: string) => Promise<boolean>;
  compact?: boolean;
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
    try {
      const ok = await onSend(text);
      if (!ok) setDraft((current) => current || text);
      return ok;
    } finally { setSending(false); }
  };

  if (compact) return (
    <BattleArenaChat messages={messages} currentUserId={currentUserId} currentUserName={[room?.seats.host,room?.seats.challenger,...(room?.spectators || [])].find(person=>person?.id===currentUserId)?.name} room={room?.code ? {mode:"triad",code:room.code} : undefined} draft={draft} onDraftChange={setDraft} onSubmit={submit} disabled={!room?.code} />
  );

  return (
    <section className="triad-battle-chat-panel flex min-h-[300px] flex-col rounded-2xl border border-amber-200/24 bg-[radial-gradient(circle_at_18%_0%,rgba(251,191,36,0.16),transparent_34%),linear-gradient(180deg,rgba(18,13,5,0.94),rgba(4,4,7,0.98))] shadow-[0_24px_70px_rgba(0,0,0,0.42),0_0_42px_rgba(251,191,36,0.08),inset_0_0_0_1px_rgba(255,244,214,0.055)] 2xl:h-[min(560px,calc(100vh-300px))] 2xl:min-h-[380px]">
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
            const messageParticipant: RoomParticipant = {
              id: message.senderId,
              name: message.senderName,
              image: message.senderImage || "/avatar.png",
              joinedAt: message.createdAt,
            };
            return (
              <div key={message.id} className={`flex gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                {!mine ? (
                  <MiniProfileHover
                    participant={messageParticipant}
                    profile={profileForParticipant(messageParticipant, rankProfiles)}
                    label="แชทสนาม"
                    currentParticipantId={currentUserId}
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

function BattleRoomChatHud({ cinematicActive, ...props }: Parameters<typeof BattleRoomChatPanel>[0] & { cinematicActive: boolean }) {
  return <BattleArenaChatFrame arenaSelector=".nexora-battle-shell .triad-arena-board" cinematicActive={cinematicActive}><BattleRoomChatPanel {...props} compact /></BattleArenaChatFrame>;
}

const gmRescueCopy: Record<GmRescueAction, { title: string; body: string; button: string; tone: string }> = {
  "gm-reset-decks": {
    title: "รีเซ็ตห้องเลือกเด็คใหม่",
    body: "บังคับรีเซ็ตสนามทั้งหมด ให้ผู้เล่นทั้งสองฝั่งสุ่มพูลการ์ดใหม่และเลือกเด็คใหม่โดยไม่ต้องออกห้อง",
    button: "รีเซ็ตเลือกเด็ค",
    tone: "border-red-200/28 text-red-50 shadow-[0_0_30px_rgba(248,113,113,0.12)] hover:border-red-200/54",
  },
  "gm-refresh-app": {
    title: "อัปเดท/รีเฟรชสนามล่าสุด",
    body: "บังคับทุกคนในห้องโหลดแพตช์ล่าสุดและเชื่อมกลับห้องเดิมทันที สถานะการเล่นยังอยู่ ไม่ต้องเลือกเด็คใหม่",
    button: "อัปเดทสนาม",
    tone: "border-cyan-100/28 text-cyan-50 shadow-[0_0_30px_rgba(34,211,238,0.12)] hover:border-cyan-100/54",
  },
  "gm-restart-turn": {
    title: "เริ่มตานี้ใหม่",
    body: "ล้างเฉพาะตาปัจจุบัน ให้ทั้งสองฝั่งเลือกการ์ดลงใหม่ในตาเดิม เช่นอยู่ตา 3 ก็เริ่มตา 3 ใหม่เท่านั้น",
    button: "เริ่มตานี้ใหม่",
    tone: "border-amber-100/30 text-amber-50 shadow-[0_0_30px_rgba(251,191,36,0.13)] hover:border-amber-100/58",
  },
};

function GmRescuePanel({
  open,
  confirmAction,
  submitting,
  onToggle,
  onAskConfirm,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  confirmAction: GmRescueAction | null;
  submitting: boolean;
  onToggle: () => void;
  onAskConfirm: (action: GmRescueAction) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const confirm = confirmAction ? gmRescueCopy[confirmAction] : null;
  return (
    <>
      <div className="triad-gm-rescue fixed bottom-[calc(var(--app-mobile-nav-height)+86px)] right-3 top-auto z-[120] flex flex-row-reverse items-end gap-2 sm:bottom-auto sm:top-[46%] sm:flex-row sm:items-center 2xl:right-[360px]">
        <button
          type="button"
          onClick={onToggle}
          className="grid h-12 w-12 place-items-center rounded-2xl border border-red-100/32 bg-[radial-gradient(circle_at_35%_22%,rgba(255,255,255,0.13),transparent_32%),linear-gradient(145deg,rgba(20,20,24,0.96),rgba(0,0,0,0.92))] text-red-50 shadow-[0_0_26px_rgba(248,113,113,0.34),0_18px_48px_rgba(0,0,0,0.58),inset_0_0_0_1px_rgba(255,255,255,0.06)] backdrop-blur-md transition hover:-translate-y-0.5 hover:scale-105 hover:border-red-100/58 sm:h-14 sm:w-14"
          title="GM Rescue Tools"
        >
          <Swords className="h-6 w-6" />
        </button>
        <div
          className={`triad-gm-rescue-panel max-h-[min(72dvh,520px)] overflow-hidden rounded-2xl border border-white/12 bg-black/82 shadow-[0_26px_90px_rgba(0,0,0,0.68),0_0_44px_rgba(255,255,255,0.055),inset_0_0_0_1px_rgba(255,255,255,0.045)] backdrop-blur-2xl transition-all duration-200 ${
            open ? "w-[min(390px,calc(100vw-86px))] opacity-100" : "w-0 opacity-0"
          }`}
        >
          <div className="min-w-[min(360px,calc(100vw-86px))] max-h-[min(72dvh,520px)] overflow-y-auto p-3.5 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-white/42">GM RESCUE</div>
                <div className="text-base font-black text-white drop-shadow-[0_0_18px_rgba(255,255,255,0.16)]">เครื่องมือแก้สนามสด</div>
              </div>
              <div className="rounded-full border border-white/14 bg-white/[0.045] px-2.5 py-1 text-[10px] font-black text-white/72 shadow-[0_0_20px_rgba(255,255,255,0.05)]">ADMIN</div>
            </div>
            <div className="grid gap-2.5">
              {(Object.keys(gmRescueCopy) as GmRescueAction[]).map((action) => {
                const item = gmRescueCopy[action];
                return (
                  <button
                    key={action}
                    type="button"
                    disabled={submitting}
                    onClick={() => onAskConfirm(action)}
                    className={`group relative overflow-hidden rounded-xl border bg-[radial-gradient(circle_at_8%_0%,rgba(255,255,255,0.105),transparent_34%),linear-gradient(135deg,rgba(18,18,22,0.96),rgba(0,0,0,0.9))] ${item.tone} px-3.5 py-3.5 text-left transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45`}
                  >
                    <div className="absolute inset-y-2 left-0 w-px bg-current opacity-45 shadow-[0_0_18px_currentColor]" />
                    <div className="flex items-center gap-2 text-sm font-black text-white">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.045] text-current shadow-[0_0_18px_currentColor]">
                        {action === "gm-refresh-app" ? <Zap className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
                      </span>
                      {item.button}
                    </div>
                    <div className="mt-2 line-clamp-3 text-[11px] font-semibold leading-5 text-white/58 group-hover:text-white/72">{item.body}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {confirm ? (
        <div className="fixed inset-0 z-[130] grid place-items-center bg-black/62 p-4 backdrop-blur-sm">
          <div className="w-[min(560px,calc(100vw-24px))] overflow-hidden rounded-[26px] border border-white/14 bg-black/90 text-center shadow-[0_0_100px_rgba(255,255,255,0.08),0_30px_100px_rgba(0,0,0,0.72)]">
            <div className={`border-b border-white/10 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.12),transparent_38%),linear-gradient(135deg,rgba(18,18,22,0.98),rgba(0,0,0,0.92))] ${confirm.tone} p-5`}>
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-white/16 bg-white/[0.045] shadow-[0_0_28px_currentColor]">
                <Swords className="h-7 w-7 text-current" />
              </div>
              <div className="mt-3 text-2xl font-black text-white">{confirm.title}</div>
            </div>
            <div className="p-5">
              <div className="mx-auto max-w-md text-sm font-semibold leading-6 text-white/68">{confirm.body}</div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={onCancel}
                  className="h-12 rounded-xl border border-white/14 bg-white/[0.045] text-sm font-black text-white transition hover:border-white/24 hover:bg-white/[0.07] disabled:opacity-45"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={onConfirm}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-red-100/30 bg-[linear-gradient(135deg,rgba(26,26,30,0.98),rgba(0,0,0,0.94))] text-sm font-black text-white shadow-[0_0_34px_rgba(248,113,113,0.2),inset_0_0_0_1px_rgba(255,255,255,0.05)] transition hover:border-red-100/58 disabled:opacity-45"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
                  ยืนยัน
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
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
    <div className={`triad-spectator-deck-strip rounded-2xl border bg-black/42 px-3 py-2 shadow-[0_18px_52px_rgba(0,0,0,0.3)] backdrop-blur-sm ${tone === "top" ? "border-cyan-200/18" : "border-rose-200/18"}`}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className={`text-[10px] font-black uppercase tracking-[0.18em] ${tone === "top" ? "text-cyan-100/72" : "text-rose-100/72"}`}>
          {title}
        </div>
        <div className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] ${accent}`}>
          {cards.length} ใบ
        </div>
      </div>
      <div className="triad-spectator-deck-cards grid grid-cols-10 gap-1 md:grid-cols-[repeat(20,minmax(0,1fr))]">
        {cards.map((card) => (
          <HoldCardButton
            key={card.cardNo}
            type="button"
            
            
            
            
            
            
            
            
            className="group relative aspect-[815/1110] min-w-0 overflow-hidden rounded-md bg-transparent transition duration-200 hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-amber-200/70" onPreview={()=>onPreview?.(card)} onPreviewEnd={()=>onPreview?.(null)} onClick={()=>{}}
          >
            <Image
              src={card.sourceImage}
              alt={card.name}
              fill
              sizes="54px"
              quality={92}
              unoptimized
              loading="eager"
              className="object-contain"
            />
            <div className="absolute left-1 top-1 rounded bg-black/72 px-1 py-0.5 text-[8px] font-black text-white">{card.cardNo}</div>
          </HoldCardButton>
        ))}
      </div>
    </div>
  );
}

function NexoraCommandLobby({ participant, rankProfiles, leaderboard, rooms, roomAccess, setRoomAccess, roomPassword, setRoomPassword, joinCode, setJoinCode, joiningRoomCode, lobbyMessage, onCreate, onEnter, onNavigate }: {
  participant: RoomParticipant; rankProfiles: Record<string, TriadRankProfile>; leaderboard: TriadRankProfile[]; rooms: TriadRoom[];
  roomAccess: RoomAccess; setRoomAccess: (value: RoomAccess) => void; roomPassword: string; setRoomPassword: (value: string) => void;
  joinCode: string; setJoinCode: (value: string) => void; joiningRoomCode: string; lobbyMessage: string;
  onCreate: (format: "triad" | "pentad" | "heptad") => void; onEnter: (room: TriadRoom | string) => void; onNavigate: (path: string) => void;
}) {
  const [panel, setPanel] = useState<"create" | "join" | "rank" | null>(null);
  useEffect(() => {
    if (!panel) return;
    const back = (event: Event) => { event.preventDefault(); clearTimeout(panelTimer.current); setPanel(null); setPanelClosing(false); };
    window.addEventListener("nexora:navigate-back", back);
    return () => window.removeEventListener("nexora:navigate-back", back);
  }, [panel]);
  const [format, setFormat] = useState<"triad" | "pentad" | "heptad">("triad");
  const [panelClosing, setPanelClosing] = useState(false);
  const panelTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const panelTrigger = useRef<HTMLElement | null>(null);
  const hoverSoundAt = useRef(0);
  const closePanel = () => {
    clearTimeout(panelTimer.current);
    if (panel === "rank") { setPanel(null); return; }
    setPanelClosing(true);
    playGameUiSound("back");
    panelTimer.current = setTimeout(() => { setPanel(null); setPanelClosing(false); panelTrigger.current?.focus(); }, 240);
  };
  const openPanel = (next: "create" | "join") => {
    clearTimeout(panelTimer.current); panelTrigger.current = document.activeElement as HTMLElement;
    setPanelClosing(false); playDrawerSound(); setPanel(next);
  };
  useEffect(() => () => clearTimeout(panelTimer.current), []);
  useEffect(() => {
    if (panel === "rank") {
      const closeRank = (event: KeyboardEvent) => { if (event.key === "Escape") setPanel(null); };
      window.addEventListener("keydown", closeRank); return () => window.removeEventListener("keydown", closeRank);
    }
    if (panel !== "create" && panel !== "join") return;
    const sheet = artRef.current?.querySelector<HTMLElement>(".nexora-play-drawer");
    sheet?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closePanel(); }
      if (event.key !== "Tab") return;
      const controls = [...(sheet?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)') || [])];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === sheet)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener("keydown", keyboard); return () => window.removeEventListener("keydown", keyboard);
  }, [panel]);
  const [pentadRooms, setPentadRooms] = useState<{ code: string; host: string; phase: string }[]>([]);
  useEffect(() => {
    if (panel !== "join" || format === "triad") return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try { const response=await fetch(`/api/${format}-rooms`,{cache:"no-store",signal:controller.signal});const data=await response.json();if(!controller.signal.aborted && response.ok)setPentadRooms(data.rooms || []); } catch {}
      if (!controller.signal.aborted) timer=setTimeout(refresh,1500);
    };
    void refresh();
    return () => {controller.abort();clearTimeout(timer);};
  }, [panel, format]);
  const createRoom = async () => {
    onCreate(format);
  };
  const artRef = useRef<HTMLDivElement>(null);
  const pointerFrame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(pointerFrame.current), []);
  const profile = profileForParticipant(participant, rankProfiles);
  return (
    <div ref={artRef} className="nexora-command-lobby" onClickCapture={(event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>("button");
      if (button && !button.disabled && !button.hasAttribute("data-command-audio-control")) playMenuCue();
    }} onPointerMove={(event) => {
      if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      if (!event.currentTarget.querySelector('[data-motion="running"]')) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width - .5) * 14;
      const y = ((event.clientY - rect.top) / rect.height - .5) * 8;
      cancelAnimationFrame(pointerFrame.current);
      pointerFrame.current = requestAnimationFrame(() => { artRef.current?.style.setProperty("--command-x", `${x}px`); artRef.current?.style.setProperty("--command-y", `${y}px`); });
    }} onPointerLeave={() => { cancelAnimationFrame(pointerFrame.current); artRef.current?.style.setProperty("--command-x", "0px"); artRef.current?.style.setProperty("--command-y", "0px"); }}>
      <NexoraCommandScene homeVideo /><div className="nexora-command-shade" />
      <header className="nexora-command-brand"><img className="nexora-official-logo" src="/images/triad/nexora-official-logo.webp" alt="NEXORA CARD GAME" />
        <GameLobbyProfile name={participant.name} image={participant.image || "/avatar.png"} rank={profile?.rankName || "BRONZE"} wins={profile?.wins || 0} />
      </header>
      <div className="nexora-command-status"><span><Users />{rooms.length} ห้อง</span><span><Swords />{rooms.filter(room => room.status === "playing").length} กำลังต่อสู้</span></div>
      <GameLobbyNavigation onRank={() => setPanel("rank")} onJoin={() => openPanel("join")} onHome={() => { setPanel(null); setPanelClosing(false); }} />
      <div className="nexora-lobby-promo-rail"><LobbyBanner />
      <section className="nexora-command-actions" aria-label="เลือกการเล่น">
        <LobbyActionButton artwork="play" title="PLAY" subtitle="สร้างสนามประลอง" onClick={() => {if(panel==='create')closePanel();else openPanel("create");}} />
      </section></div>
      <footer className="nexora-command-footer"><span>มอนสเตอร์ · สกิล · กลยุทธ์</span></footer>
      {(panel === "create" || panel === "join") && <div className="nexora-play-drawer-backdrop" data-closing={panelClosing} onClick={closePanel} aria-hidden="true" />}
      {panel === "rank" ? <DuelistLeaderboard players={leaderboard} userId={participant.id} onClose={()=>setPanel(null)} /> : <section className={`nexora-command-sheet nexora-play-drawer ${panel === "join" ? "nexora-join-drawer" : "nexora-create-drawer"}`} data-open={Boolean(panel)} aria-hidden={!panel} inert={!panel||panelClosing} data-closing={panelClosing} tabIndex={-1} role="dialog" aria-modal={panel?true:undefined} aria-label={panel !== "join" ? "สร้างห้อง" : "ค้นหาห้อง"} onPointerOver={event => {
        const button = (event.target as Element).closest("button");
        if (!button || button.disabled || button.contains(event.relatedTarget as Node | null) || event.pointerType !== "mouse") return;
        if (performance.now() - hoverSoundAt.current > 160) { hoverSoundAt.current = performance.now(); playGameUiSound("click"); }
      }}>
        <svg className="nexora-lobby-drawer-outline" viewBox="0 0 1040 600" preserveAspectRatio="none" aria-hidden="true"><path d="M0 1H240L335 97H359L265 1H310L581 276H607L656 326H675L626 276H718L1037 598H987L933 544H904L957 598H101L0 496" /><path d="M240 1L335 97H359M607 276H625L675 326" /></svg>
        <div className="nexora-command-sheet-head"><h2>{panel !== "join" ? <><b>PLAY</b><span>สนามประลอง</span></> : <><b>JOIN</b><span>เข้าร่วม / ชมการต่อสู้</span></>}</h2><button onClick={closePanel} title="ปิด" aria-label="ปิด"><X className="h-5 w-5" /></button></div>
        <div className="nexora-command-sheet-body">
          {panel !== "join" ? <>
            <div className="nexora-command-segment" role="group" aria-label="รูปแบบการต่อสู้">{(["triad", "pentad", "heptad"] as const).map(value => <button key={value} aria-pressed={format === value} onClick={() => setFormat(value)}>{value === "triad" ? "TRIAD 3 ใบ" : value === "pentad" ? "PENTAD 5 ใบ" : "HEPTAD 7 ใบ"}<svg className="nexora-play-mode-edge" viewBox="0 0 1000 160" preserveAspectRatio="none" aria-hidden="true"><path pathLength="100" d="M30 8H855L975 80L855 152H100L25 108Z" /></svg></button>)}</div>
            <>
              <div className="nexora-command-segment" role="group" aria-label="การเข้าถึงห้อง">{(["public", "private"] as RoomAccess[]).map(access => <button key={access} aria-pressed={roomAccess === access} onClick={() => setRoomAccess(access)}>{access === "public" ? "สาธารณะ" : "ส่วนตัว"}</button>)}</div>
              <label>รหัสผ่านห้อง<input value={roomPassword} disabled={roomAccess !== "private"} onChange={event => setRoomPassword(event.target.value)} placeholder="อย่างน้อย 4 ตัว" /></label>
            </>
            <button className="nexora-command-primary" aria-label="สร้างสนามประลอง" onClick={() => void createRoom()} disabled={roomAccess === "private" && roomPassword.trim().length < 4}><Plus className="h-4 w-4" />สร้าง</button>
          </> : panel === "join" ? <>
            <div className="nexora-command-segment" role="group" aria-label="รูปแบบห้อง">{(["triad", "pentad", "heptad"] as const).map(value => <button key={value} aria-pressed={format === value} onClick={() => setFormat(value)}>{value === "triad" ? "TRIAD 3 ใบ" : value === 'pentad' ? "PENTAD 5 ใบ" : 'HEPTAD 7 ใบ'}</button>)}</div>
            <form onSubmit={event => { event.preventDefault(); if (joinCode.length === 6 && joiningRoomCode !== joinCode) { if (format !== "triad") onNavigate(`/game/${format}?room=${joinCode}`); else onEnter(joinCode); } }}>
              <label>หมายเลขห้อง<input value={joinCode} onChange={event => setJoinCode(event.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} inputMode="numeric" placeholder="000000" /></label>
              <button className="nexora-command-primary" disabled={joinCode.length !== 6 || joiningRoomCode === joinCode}>{joiningRoomCode === joinCode && joinCode ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}เข้าห้อง</button>
            </form>
            <div className="nexora-command-room-list">{format !== "triad" ? pentadRooms.map(room => <article key={room.code} className="nexora-command-room-row"><div><strong>{room.code}</strong><small>{room.host} · {room.phase === "waiting" ? "รอผู้ท้าชิง" : "กำลังต่อสู้"}</small></div><button onClick={() => onNavigate(`/game/${format}?room=${room.code}${room.phase === "waiting" ? "" : "&spectate=1"}`)}>{room.phase === "waiting" ? "เข้าห้อง" : "เข้าชม"}</button></article>) : rooms.length ? rooms.map(room => <article key={room.code} className="nexora-command-room-row"><div><strong>{room.code}</strong><small>{room.seats.host?.name || "NEXORA"} · {room.status === "playing" ? "กำลังต่อสู้" : "รอผู้ท้าชิง"}</small></div><button onClick={() => onEnter(room)} disabled={joiningRoomCode === room.code}>{room.access === "private" ? <Lock className="h-3 w-3" /> : null}{joiningRoomCode === room.code ? "กำลังเข้า" : room.status === "playing" ? "เข้าชม" : "เข้าห้อง"}</button></article>) : null}</div>
          </> : <RankLeaderboardPanel leaderboard={leaderboard} currentParticipantId={participant.id} />}
          {lobbyMessage ? <div role="status" className="nexora-command-alert">{lobbyMessage}</div> : null}
        </div>
      </section>}
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
  currentParticipantId,
}: {
  label: string;
  participant: RoomParticipant | null;
  profile?: TriadRankProfile | null;
  isLeader?: boolean;
  tone: "host" | "challenger";
  emptyText: string;
  canTake: boolean;
  onTake: () => void;
  currentParticipantId?: string;
}) {
  const toneClass =
    tone === "host"
      ? "border-amber-300/45 from-amber-300/18 via-[#120806]/82 to-black"
      : "border-amber-200/28 from-[#2a1112]/82 via-[#120608]/88 to-black";
  const botSeat = isBotParticipant(participant);
  return (
    <div className={`nexora-command-seat relative min-h-[320px] rounded-[18px] border bg-gradient-to-b p-4 shadow-[0_24px_70px_rgba(0,0,0,0.42)] ${toneClass}`}>
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
          <MiniProfileHover
            participant={participant}
            profile={profile}
            label={botSeat ? "AI COMBAT CORE" : profile?.rankName || rankFrames[rankIndexForParticipant(participant, profile)].name}
            size="xl"
            align="right"
            crown={isLeader}
            currentParticipantId={currentParticipantId}
          />
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
                <MiniProfileHover
                  participant={spectator}
                  profile={profileForParticipant(spectator, rankProfiles)}
                  label={`ผู้ชม ${index + 1}`}
                  align="right"
                  currentParticipantId={currentId}
                />
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

function ResultBanner({
  result,
  activeTurn,
  playerName = "เรา",
  opponentName = "คู่แข่ง",
}: {
  result: TriadTurnResult;
  activeTurn: TriadTurn;
  playerName?: string;
  opponentName?: string;
}) {
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
  const neutralTitle =
    result.winner === "draw"
      ? "ตานี้เสมอ"
      : result.winner === "player"
        ? `${playerName} ได้แต้ม +1`
        : `${opponentName} ได้แต้ม +1`;
  void title;

  return (
    <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-r ${tone} p-4 shadow-[0_18px_54px_rgba(0,0,0,0.35)]`}>
      <div className="absolute inset-y-0 left-0 w-1/2 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.18),transparent)] opacity-70" />
      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/48">
            ผลตาที่ {activeTurn}
          </div>
          <div className="mt-1 text-[clamp(1.25rem,3vw,2.4rem)] font-black uppercase leading-none text-white drop-shadow-[0_0_18px_rgba(255,255,255,0.28)]">
            {neutralTitle}
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
  onExitLobby,
}: {
  winner: string;
  surrendered?: string;
  score: { player: number; bot: number };
  isDraw?: boolean;
  rankUpEvents?: TriadRankUpEvent[];
  onExitLobby?: () => void;
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
          {onExitLobby ? (
            <button
              type="button"
              onClick={onExitLobby}
              className="pointer-events-auto mx-auto mt-4 inline-flex h-11 items-center justify-center rounded-xl border border-white/18 bg-white/10 px-5 text-xs font-black uppercase tracking-[0.14em] text-white/82 shadow-[0_0_28px_rgba(255,255,255,0.08)] transition hover:border-amber-100/55 hover:bg-amber-300 hover:text-black"
            >
              ออกห้อง
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SkillTargetOverlay({
  card, side, playerTop, botTop, targetPlayerTop, targetBotTop, selectedTarget, timeLeft, turn = 1, onSelect, onConfirm, copyField,
}: {
  card?: CardView; turn?: TriadTurn; side: Side; playerTop?: CardView; botTop?: CardView; targetPlayerTop?: CardView; targetBotTop?: CardView; copyField?: TriadTriangle;
  selectedTarget: PendingSkillChoice["selectedTarget"]; timeLeft: number; onSelect: (target: SkillTargetSelection) => void; onConfirm: () => void | Promise<void>;
}) {
  const [copyTargetStep, setCopyTargetStep] = useState(false);
  if (!card) return null;
  const [rawCopyId, ...copiedTargets] = selectedTarget.split(">");
  const sourceOptions = card.cardNo === "245" ? getPlayableSkillTargetIds(card, side, playerTop, botTop, turn, copyField) : [];
  const copyId = rawCopyId || (sourceOptions.length === 1 ? sourceOptions[0] : "");
  const copiedCard = card.cardNo === "245" ? triadCardByNo.get(copyId?.slice(5)) : undefined;
  const targetCard = copyTargetStep && copiedCard ? copiedCard : card;
  const ownId = side === "player" ? "player-top" : "bot-top";
  const eligible = getPlayableSkillTargetIds(targetCard, side, targetPlayerTop || playerTop, targetBotTop || botTop, turn, copyField);
  const options: TargetOptionView[] = targetCard.cardNo === "254" ? eligible.map(id => ({ id, faction: id === "reroll-opponent" ? "enemy" : "ally", action: true, label: id === "draw-skill" ? "สุ่มสกิลเข้ามือ" : id === "reroll-own" ? "สุ่มมอนสเตอร์เรา" : "สุ่มมอนสเตอร์อีกฝ่าย" })) : targetCard.cardNo === "245" ? eligible.map(id => ({ id, faction: "enemy", label: "สกิลบนสนามฝ่ายตรงข้าม", card: triadCardByNo.get(id.slice(5)) })) : eligible.filter(id => Boolean(id === "player-top" ? targetPlayerTop || playerTop : targetBotTop || botTop)).map(id => ({
    id, faction: id === ownId ? "ally" : "enemy",
    label: id === ownId ? "มอนสเตอร์หลักฝั่งเรา" : "มอนสเตอร์หลักฝั่งศัตรู",
    card: id === "player-top" ? targetPlayerTop || playerTop : targetBotTop || botTop,
  }));
  const two = isTwoStepTargetSkill(targetCard);
  const selection = copyTargetStep ? copiedTargets.join(">") : card.cardNo === "245" ? copyId : selectedTarget;
  const selected = selection ? parseSkillTargetSelection(selection) : !two && options.length === 1 ? [options[0].id] : [];
  return <TargetSelectionModal contextKey={`${card.cardNo}:${side}:${turn}:${copyTargetStep ? copyId : "source"}`} skillName={copyTargetStep ? `${card.name} → ${targetCard.name}` : card.name} description={targetCard.skillText} options={options} selected={selected} min={two ? 2 : 1} max={two ? 2 : 1} timeLeft={timeLeft}
    selectionHint={two ? "เลือกตามลำดับ: ตัวที่ 1 ลด ATK 2,000 · ตัวที่ 2 เพิ่ม ATK 2,000" : undefined}
    onSelect={ids => onSelect((copyTargetStep ? [copyId, ...ids] : ids).join(">") as SkillTargetSelection)} onConfirm={() => {
      if (copiedCard && !copyTargetStep && /เลือก|choose|target/i.test(copiedCard.skillText)) {
        const targets = getPlayableSkillTargetIds(copiedCard, side, targetPlayerTop || playerTop, targetBotTop || botTop, turn);
        if (targets.length) {
          if (targets.length === 1) onSelect(`${copyId}>${targets[0]}` as SkillTargetSelection);
          setCopyTargetStep(true); return;
        }
      }
      return onConfirm();
    }} />;
}

function BlessingChoiceOverlay({ card, onChoose }: { card?: CardView; onChoose: (choice: BlessingChoice) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  if (!card) return null;
  const options: TargetOptionView[] = [
    { id: "draw-skill", faction: "ally", label: "สุ่มสกิลเข้ามือ", note: "สุ่มสกิล 1 ใบเพิ่มเข้าแถวล่างทันที", action: true },
    { id: "reroll-own", faction: "ally", label: "สุ่มมอนสเตอร์เรา", note: "เปลี่ยนมอนสเตอร์หลักฝั่งเราในตานี้", action: true },
    { id: "reroll-opponent", faction: "enemy", label: "สุ่มมอนสเตอร์อีกฝ่าย", note: "เปลี่ยนมอนสเตอร์หลักฝั่งตรงข้ามในตานี้", action: true },
  ];
  return <TargetSelectionModal contextKey={card.cardNo} skillName={card.name} description={card.skillText} options={options} selected={selected} onSelect={setSelected} onConfirm={() => onChoose(selected[0] as BlessingChoice)} />;
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
  onCinematicActivity,
  onCinematicComplete,
  battleSessionKey,
  arena,
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
  battleActive,
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
  onCinematicActivity?: (playing: boolean) => void;
  onCinematicComplete?: (key: string) => void;
  battleSessionKey: string;
  arena: TriadArena;
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
  battleActive: boolean;
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
  // A local placement must remain visible while the room snapshot catches up.
  const playerTriangle = lockedFight ? {
    ...lockedFight.player,
    ...Object.fromEntries(Object.entries(player).filter(([, cardNo]) => Boolean(cardNo))),
  } as TriadTriangle : player;
  const botTriangle = lockedFight?.bot || { top: "", left: "", right: "" };
  const activeLane = laneForTurn(activeTurn);
  const currentResult = lockedFight?.turns.find((turn) => turn.turn === activeTurn);
  const [completedCinematic, setCompletedCinematic] = useState("");
  const cinematicKey = currentResult ? `${battleSessionKey}:${fightNo}:${activeTurn}` : "";
  const cinematicPlaying = Boolean(battleActive && currentResult && (revealAllCards || revealed[activeTurn]?.scored) && completedCinematic !== cinematicKey);
  useLayoutEffect(() => {
    onCinematicActivity?.(cinematicPlaying);
    return () => onCinematicActivity?.(false);
  }, [cinematicPlaying, onCinematicActivity]);
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
    ? getPlayableSkillTargetIds(pendingSkillCard, pendingSkillChoice.side, cardsByNo.get(playerTriangle.top), cardsByNo.get(botTriangle.top), activeTurn, pendingSkillChoice.side === "player" ? botTriangle : playerTriangle)
    : [];
  const pendingTarget = pendingSkillChoice?.selectedTarget || (pendingFallbackTargets.length === 1 ? pendingFallbackTargets[0] : "");
  const playerAuraByLane: Partial<Record<Lane, TargetAura>> = {};
  const botAuraByLane: Partial<Record<Lane, TargetAura>> = {};
  const timeoutMissingNames =
    battleActive && timeLeft <= 30 && timeLeft > 0 && !currentResult
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
  const botRoleLabel = revealAllCards ? "ฝั่งบน" : "คู่แข่ง";
  const playerRoleLabel = revealAllCards ? "ฝั่งล่าง" : "เรา";
  void botRoleLabel;
  void playerRoleLabel;
  return (
    <div data-battle-arena={arena.id} className={`triad-compact-board triad-arena-board ${revealAllCards ? "triad-spectator-board" : ""} relative h-full min-h-[clamp(330px,62dvh,600px)] max-w-full overflow-hidden rounded-[18px] border border-amber-100/14 bg-[#0a0908] shadow-[0_28px_90px_rgba(0,0,0,0.55)] [container-type:inline-size]`} style={{ "--arena-color": arena.color } as CSSProperties}>
      <CardHoverPreview card={previewCard} onClose={closeBoardPreview} passive={previewMode === "hover"} />
      <BattleArenaStatus fight={fightNo} turn={activeTurn} turns={3} title={pendingSkillChoice || waitingSkillChoice ? "เลือกเป้าหมายสกิล" : turnLocked ? "ปะทะ" : "เลือกการ์ด"} hint={activeTurn === 1 ? "มอนสเตอร์ปะทะ" : activeTurn === 2 ? "ATTACK" : "SUPPORT"} />
      <BattleArenaScoreplate name={botName} score={matchScore.bot} avatar={null} identity={{id:botParticipant?.id,name:botName,image:botImage}} rank={rankProfiles?.[botParticipant?.id||'']} currentUserId={currentParticipantId} />
      <BattleArenaScoreplate name={playerName} score={matchScore.player} player avatar={null} identity={{id:playerParticipant?.id||currentParticipantId,name:playerName,image:playerImage}} rank={rankProfiles?.[playerParticipant?.id||currentParticipantId||'']} currentUserId={currentParticipantId} />
      {cinematicPlaying && currentResult ? (
        <BattleCinematic
          key={cinematicKey}
          result={currentResult}
          playerCard={cardsByNo.get(playerTriangle[activeLane] || "")}
          opponentCard={cardsByNo.get(botTriangle[activeLane] || "")}
          playerMainCard={cardsByNo.get(playerTriangle.top || "")}
          opponentMainCard={cardsByNo.get(botTriangle.top || "")}
          cardsByNo={cardsByNo}
          playerName={playerName}
          opponentName={botName}
          arena={arena}
          landscape
          onComplete={() => {
            setCompletedCinematic(cinematicKey);
            onCinematicComplete?.(`${battleSessionKey}:${fightNo}:${activeTurn}`);
          }}
        />
      ) : null}
      {!cinematicPlaying && !showResolvedBoard && botVisible(activeLane) ? <RevealSpotlight
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
      /> : null}
      <SkillTargetOverlay
        key={`${fightNo}:${activeTurn}:${pendingSkillChoice?.cardNo || "none"}`}
        turn={activeTurn}
        copyField={pendingSkillChoice?.side === "bot" ? displayPlayerTriangle : displayBotTriangle}
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
          const selectable = new Set(getPlayableSkillTargetIds(skillCard, pendingSkillChoice.side, displayPlayerTriangle.top ? cardsByNo.get(displayPlayerTriangle.top) : undefined, displayBotTriangle.top ? cardsByNo.get(displayBotTriangle.top) : undefined, activeTurn, pendingSkillChoice.side === "player" ? displayBotTriangle : displayPlayerTriangle));
          const parts = parseSkillTargetSelection(target);
          if (skillCard?.cardNo === "245") {
            if (!selectable.has(parts[0])) return;
            const copied = triadCardByNo.get(parts[0].slice(5));
            const legal = getPlayableSkillTargetIds(copied, pendingSkillChoice.side, cardsByNo.get(displayPlayerTriangle.top), cardsByNo.get(displayBotTriangle.top), activeTurn);
            if (parts.slice(1).some(item => !legal.includes(item))) return;
          } else if (!parts.every((item) => selectable.has(item))) return;
          onSelectSkillTarget(target);
        }}
        onConfirm={onConfirmSkillTarget}
      />
      {battleActive && !pendingSkillChoice && !waitingSkillChoice ? (
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
          <BattleArenaProgress fight={fightNo} turn={activeTurn} turns={3} time={`${Math.floor(timeLeft/60)}:${String(timeLeft%60).padStart(2,"0")}`} playerScore={fightScore.player} opponentScore={fightScore.bot} scoreLabel="แต้มไฟต์นี้" wins={{player:matchScore.player,opponent:matchScore.bot}} />
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
  const [cinematicActive, setCinematicActive] = useState(false);
  const [completedCinematicTurn, setCompletedCinematicTurn] = useState("");
  const [autoAdvanceRetry, setAutoAdvanceRetry] = useState(0);
  const autoAdvanceAttemptRef = useRef("");
  const soloArenaSeedRef = useRef(Date.now());
  useEffect(() => {
    const unlock = () => { void primeBattleAudio(); };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);
  const cardsByNo = useMemo(() => new Map(cards.map((card) => [card.cardNo, card])), [cards]);
  const deckCatalog = useMemo(
    () => uniqueByNo(cards.filter((card) => card.kind !== "unknown")),
    [cards]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    const syncBattleViewport = () => {
      const viewport = window.visualViewport;
      const width = Math.max(1, Math.floor(viewport?.width || window.innerWidth));
      const height = Math.max(1, Math.floor(viewport?.height || window.innerHeight));
      root.style.setProperty("--triad-battle-vw", `${width}px`);
      root.style.setProperty("--triad-battle-vh", `${height}px`);
    };
    syncBattleViewport();
    window.addEventListener("resize", syncBattleViewport);
    window.addEventListener("orientationchange", syncBattleViewport);
    window.visualViewport?.addEventListener("resize", syncBattleViewport);
    window.visualViewport?.addEventListener("scroll", syncBattleViewport);
    return () => {
      window.removeEventListener("resize", syncBattleViewport);
      window.removeEventListener("orientationchange", syncBattleViewport);
      window.visualViewport?.removeEventListener("resize", syncBattleViewport);
      window.visualViewport?.removeEventListener("scroll", syncBattleViewport);
      root.style.removeProperty("--triad-battle-vw");
      root.style.removeProperty("--triad-battle-vh");
    };
  }, []);

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
      target instanceof Element &&
      Boolean(target.closest(".nexora-battle-shell, .nexora-battle-preview-portal, .nexora-battle-target-portal, .nexora-battle-blessing-portal"));
    const blockNativeMobileMenu = (event: Event) => {
      if (!isBattleTarget(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      const selection = window.getSelection?.();
      if (selection && !selection.isCollapsed) selection.removeAllRanges();
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
  const [createFormat, setCreateFormat] = useState<"triad" | "pentad">("triad");
  const [pentadHandoff,setPentadHandoff]=useState<PentadRoom|null>(null);
  const [heptadHandoff,setHeptadHandoff]=useState<HeptadRoom|null>(null);
  useEffect(()=>{void import('../pentad-dominion/PentadDominionClient');},[]);
  const [creatingRoom, setCreatingRoom] = useState(false);
  const creatingRoomRef = useRef(false);
  const dismissedRoomCodesRef = useRef(new Set<string>());
  useEffect(() => {
    router.prefetch("/game/pentad");
    router.prefetch("/game/heptad");
    // Warm only the two room modules; do not decode full card collections here.
    void preparePentadClient().catch(()=>{});
    void prepareHeptadClient().catch(()=>{});
    void import('@/lib/home-wallpaper').then(module=>module.loadHomeWallpaper('preparation')).catch(()=>{});
  }, [router]);
  const [creatingFormat,setCreatingFormat]=useState<"triad"|"pentad"|"heptad">("triad");
  const startingRoomCodeRef = useRef("");
  const roomResponseRevisionRef = useRef(0);
  const [createRoomMode, setCreateRoomMode] = useState<DeckMode>("all");
  const [createRoomWithBot, setCreateRoomWithBot] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [joiningRoomCode, setJoiningRoomCode] = useState("");
  const joiningRoomCodeRef = useRef("");
  const [passwordRoom, setPasswordRoom] = useState<TriadRoom | null>(null);
  const [activeRoomSnapshot, setActiveRoomSnapshot] = useState<TriadRoom | null>(null);
  const [gmPanelOpen, setGmPanelOpen] = useState(false);
  const [gmConfirmAction, setGmConfirmAction] = useState<GmRescueAction | null>(null);
  const [gmSubmitting, setGmSubmitting] = useState(false);
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
  const lastRankSyncAtRef = useRef(0);
  const deckSyncTimerRef = useRef<number | null>(null);
  const deckSyncQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const localDeckSessionRef = useRef("");
  const resultAdvanceKeyRef = useRef("");
  const turnReadyRecoveryKeyRef = useRef("");
  const deckBattleStartKeyRef = useRef("");
  const startedBattleRoomKeysRef = useRef<Set<string>>(new Set());
  const optimisticRoomLockUntilRef = useRef(0);
  const startRoomLockRef = useRef<{ code: string; until: number }>({ code: "", until: 0 });
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
  const [deckPreviewCard, setDeckPreviewCard] = useState<CardView | null>(null);
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
    if (roomDecksReadyForBattle(cachedRoom)) markBattleStartedForRoom(cachedRoom);
    setPhase(cachedRoom.status === "playing" ? phaseForRoomWithBattleLock(cachedRoom, "battle") || "battle" : "room");
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
  const activeListedRoom = rooms.find((room) => room.code === activeRoomCode) || null;
  const activeSnapshotRoom = activeRoomSnapshot?.code === activeRoomCode ? activeRoomSnapshot : null;
  const currentRoom =
    activeSnapshotRoom &&
    (Date.now() < optimisticRoomLockUntilRef.current ||
      !activeListedRoom ||
      !participantInRoom(activeListedRoom, participant.id) ||
      shouldKeepCurrentRoomSnapshot(activeSnapshotRoom, activeListedRoom))
      ? activeSnapshotRoom
      : activeListedRoom || activeSnapshotRoom;
  const markBattleStartedForRoom = (room: TriadRoom | null | undefined) => {
    if (!room) return;
    startedBattleRoomKeysRef.current.add(roomBattleStartKey(room));
  };
  useBattleArenaActivity(Boolean(currentRoom) || phase !== "lobby");
  useBattleCombatActivity(phase === "battle");
  useBattleLoadingStage(`${currentRoom?.code || ""}:${phase}`);
  const hasBattleStartedForRoom = (room: TriadRoom | null | undefined) =>
    Boolean(room && startedBattleRoomKeysRef.current.has(roomBattleStartKey(room)));
  const deckBattleStartKeyForRoom = (room: TriadRoom) =>
    `${roomBattleStartKey(room)}:${Number(room.game.turnStartedAt || 0)}`;
  const rememberDeckBattleStart = (room: TriadRoom | null | undefined) => {
    if (!room) return;
    markBattleStartedForRoom(room);
    deckBattleStartKeyRef.current = deckBattleStartKeyForRoom(room);
  };
  const phaseForRoomWithBattleLock = (room: TriadRoom, fallback: BattlePhase | null = null): BattlePhase | null => {
    const nextPhase = phaseForPlayingRoom(room, participant.id) || fallback;
    return nextPhase === "deck" && hasBattleStartedForRoom(room) ? "battle" : nextPhase;
  };
  const currentDeckMode: DeckMode = currentRoom?.game.deckMode || "all";
  const battleSessionKey = currentRoom ? roomBattleStartKey(currentRoom) : `solo:${soloArenaSeedRef.current}`;
  const arena = useMemo(() => battleArenaForSeed(battleSessionKey), [battleSessionKey]);
  const currentDeckModeTitle =
    currentDeckMode === "monster"
      ? "โหมดมอนสเตอร์"
      : currentDeckMode === "skill"
        ? "โหมดสกิล"
        : "โหมดรวม";
  const currentResult = lockedFight?.turns.find((turn) => turn.turn === activeTurn);
  const roomTurnResolved = Boolean(currentRoom?.game.turns.some((turn) => turn.turn === activeTurn));
  const roomActiveTurnResolved = Boolean(
    currentRoom?.game.turns.some((turn) => turn.turn === currentRoom.game.activeTurn)
  );
  const roomActiveTurnScored = Boolean(
    currentRoom &&
      (revealed[currentRoom.game.activeTurn]?.scored ||
        currentRoom.game.turns.some((turn) => turn.turn === currentRoom.game.activeTurn))
  );
  const fightScore = lockedFight ? getFightScore(lockedFight.turns, revealed) : { player: 0, bot: 0 };
  const playerGraveCards = gravePlayerCards.map((cardNo) => cardsByNo.get(cardNo)).filter(Boolean) as CardView[];
  const botGraveCards = graveBotCards.map((cardNo) => cardsByNo.get(cardNo)).filter(Boolean) as CardView[];
  const forcedWinnerSide = currentRoom?.game.matchWinner || "";
  const surrenderedSide = currentRoom?.game.surrenderedBy || "";
  const serverMatchDone = Boolean(currentRoom?.game.matchEndedAt || forcedWinnerSide);
  const matchDone = currentRoom ? serverMatchDone : fightNo > 3;
  const isRoomHost = Boolean(currentRoom && currentRoom.hostId === participant.id);
  const isRoomController = Boolean(
    currentRoom && (currentRoom.hostId === participant.id || currentRoom.seats.host?.id === participant.id)
  );
  const hasBotOpponent = Boolean(currentRoom && (isBotParticipant(currentRoom.seats.challenger)||isBotParticipant(currentRoom.seats.host)));
  const roomPlayerSide: RoomPlayerSide | null = participantRoomSide(currentRoom, participant);
  const isFieldPlayer = Boolean(roomPlayerSide);
  const isSpectator = Boolean(currentRoom && !isFieldPlayer && currentRoom.spectators.some((viewer) => viewer.id === participant.id));
  const canUseGmRescuePanel = Boolean(currentRoom && isSpectator && isClientAdminRole(currentUser.role));
  const matchEndingTurn =
    currentRoom?.game.activeTurn === 1 || currentRoom?.game.activeTurn === 2 || currentRoom?.game.activeTurn === 3
      ? currentRoom.game.activeTurn
      : activeTurn;
  const matchEndingReveal = revealed[matchEndingTurn];
  const matchFinalVisible = Boolean(
    matchDone &&
      (!currentRoom?.game.matchEndedAt || surrenderedSide || isSpectator || matchEndingReveal?.scored)
  );
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
      playerDeckCards: currentRoom.game.deckReady.host
        ? (currentRoom.game.decks.host.map((cardNo) => cardsByNo.get(cardNo)).filter(Boolean) as CardView[])
        : [],
      botDeckCards: currentRoom.game.deckReady.challenger
        ? (currentRoom.game.decks.challenger.map((cardNo) => cardsByNo.get(cardNo)).filter(Boolean) as CardView[])
        : [],
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
      return sortCardsByNo(orderedCards);
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
    return sortCardsByNo(deckCatalog);
  }, [cardsByNo, currentDeckMode, currentRoom, deckCatalog, roomPlayerSide]);
  const isPvpRoom = Boolean(currentRoom && roomPlayerSide && opponentSide);
  const roomBattleReady = roomDecksReadyForBattle(currentRoom);
  const pvpPlacementClosed = Boolean(isPvpRoom && roomTurnResolved);
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
  const ownActiveLaneLocked = Boolean(
    currentRoom && roomPlayerSide
      ? currentRoom.game.triangles[roomPlayerSide]?.[laneForTurn(currentRoom.game.activeTurn)]
      : player[laneForTurn(activeTurn)]
  );
  const handPlacementLocked = Boolean(matchDone || pvpPlacementClosed || (isPvpRoom ? ownActiveLaneLocked : displayTurnLocked));
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

  useEffect(() => {
    if (!currentRoom || !isFieldPlayer || phase !== "battle" || !handPlacementLocked || matchDone) return;
    const timer = window.setInterval(() => {
      void syncRooms({ force: true }).catch(() => null);
    }, 1600);
    return () => window.clearInterval(timer);
  }, [currentRoom?.code, currentRoom?.game.activeTurn, currentRoom?.game.fightNo, handPlacementLocked, isFieldPlayer, matchDone, phase]);
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
  const spectatorDeckSelectionWaiting = Boolean(isSpectator && deckSelectionActive);
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

  const neutralPlayerLabel = isSpectator ? displayPlayerName : playerLabel;
  const neutralOpponentLabel = isSpectator ? displayBotName : opponentLabel;
  const neutralWinnerText = forcedWinnerLabel
    ? `${forcedWinnerLabel} ชนะ`
    : displayMatchScore.player === displayMatchScore.bot
      ? "เสมอกัน"
      : displayMatchScore.player > displayMatchScore.bot
        ? `${neutralPlayerLabel} ชนะ`
        : `${neutralOpponentLabel} ชนะ`;
  void winnerText;

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

  const shouldKeepOptimisticRoomOverIncoming = (optimisticRoom: TriadRoom | null | undefined, incomingRoom: TriadRoom) => {
    if (!optimisticRoom || optimisticRoom.code !== incomingRoom.code) return false;
    if (roomBattleStartKey(optimisticRoom) !== roomBattleStartKey(incomingRoom)) return false;
    if (Date.now() >= optimisticRoomLockUntilRef.current) return false;
    if (incomingRoom.game.matchEndedAt) return false;
    if (roomProgressValue(incomingRoom) > roomProgressValue(optimisticRoom)) return false;
    if (
      incomingRoom.game.fightNo === optimisticRoom.game.fightNo &&
      incomingRoom.game.activeTurn === optimisticRoom.game.activeTurn &&
      incomingRoom.game.turns.some((turn) => turn.turn === incomingRoom.game.activeTurn)
    ) {
      return false;
    }
    return true;
  };

  const mergeOptimisticRoomOverIncoming = (incomingRoom: TriadRoom, optimisticRoom: TriadRoom) => {
    const stableIncoming = mergeRoomWithStableChat(optimisticRoom, incomingRoom);
    return {
      ...stableIncoming,
      game: {
        ...stableIncoming.game,
        triangles: {
          host: {
            top: stableIncoming.game.triangles.host.top || optimisticRoom.game.triangles.host.top,
            left: stableIncoming.game.triangles.host.left || optimisticRoom.game.triangles.host.left,
            right: stableIncoming.game.triangles.host.right || optimisticRoom.game.triangles.host.right,
          },
          challenger: {
            top: stableIncoming.game.triangles.challenger.top || optimisticRoom.game.triangles.challenger.top,
            left: stableIncoming.game.triangles.challenger.left || optimisticRoom.game.triangles.challenger.left,
            right: stableIncoming.game.triangles.challenger.right || optimisticRoom.game.triangles.challenger.right,
          },
        },
      },
    };
  };

  const mergeIncomingRooms = (current: TriadRoom[], nextRooms: TriadRoom[]) => {
    const merged = mergeRoomListsWithStableChat(current, nextRooms).map((room) => {
      const existing = current.find((item) => item.code === room.code);
      if (existing && JSON.stringify(existing) === JSON.stringify(room)) return existing;
      if (shouldKeepCurrentRoomSnapshot(existing, room)) return existing!;
      const optimisticRoom = activeRoomSnapshotRef.current;
      if (
        optimisticRoom && shouldKeepOptimisticRoomOverIncoming(optimisticRoom, room)
      ) {
        return keepPendingOpeningTieBreakChoice(mergeOptimisticRoomOverIncoming(room, optimisticRoom));
      }
      return keepPendingOpeningTieBreakChoice(room);
    }).concat((() => {
      const optimisticRoom = activeRoomSnapshotRef.current;
      if (!optimisticRoom || Date.now() >= optimisticRoomLockUntilRef.current) return [];
      return nextRooms.some((room) => room.code === optimisticRoom.code) ? [] : [keepPendingOpeningTieBreakChoice(optimisticRoom)];
    })());
    return merged.length === current.length && merged.every((room, index) => room === current[index]) ? current : merged;
  };

  const mergeIncomingRoom = (current: TriadRoom[], room: TriadRoom) => {
    const optimisticRoom = activeRoomSnapshotRef.current;
    const stableRoom =
      optimisticRoom && shouldKeepOptimisticRoomOverIncoming(optimisticRoom, room)
        ? mergeOptimisticRoomOverIncoming(room, optimisticRoom)
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
    const requestRevision = roomResponseRevisionRef.current;
    const requestedCode = activeRoomCodeRef.current;
    const includeRanks = !lastRankSyncAtRef.current || now - lastRankSyncAtRef.current >= 30000;
    try {
      const params = new URLSearchParams({ ts: String(now), ranks: includeRanks ? "1" : "0" });
      if (requestedCode) params.set("room", requestedCode);
      const response = await fetch(`${ROOM_API_PATH}?${params}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || requestRevision !== roomResponseRevisionRef.current || requestedCode !== activeRoomCodeRef.current) return [];
      if (!Array.isArray(payload.rooms)) return [];
    const roomOnly = payload.scope === "room";
    const startPending = requestedCode && startingRoomCodeRef.current === requestedCode;
    if (startPending && payload.rooms.some((room: { code?: string; status?: string }) => room.code === requestedCode && room.status === "waiting")) return [];
    const nextRooms = normalizeApiRooms(payload.rooms);
    const nextProfiles: TriadRankProfile[] = Array.isArray(payload.rankProfiles)
      ? payload.rankProfiles.map(normalizeRankProfile).filter((profile: TriadRankProfile | null): profile is TriadRankProfile => Boolean(profile))
      : [];
    const nextLeaderboard: TriadRankProfile[] = Array.isArray(payload.leaderboard)
      ? payload.leaderboard.map(normalizeRankProfile).filter((profile: TriadRankProfile | null): profile is TriadRankProfile => Boolean(profile))
      : nextProfiles.filter((profile: TriadRankProfile) => profile.wins > 0);
    if (nextProfiles.length > 0 || Array.isArray(payload.rankProfiles)) {
      lastRankSyncAtRef.current = now;
      setRankProfiles(Object.fromEntries(nextProfiles.map((profile) => [profile.userId, profile])));
    }
    if (nextLeaderboard.length > 0 || Array.isArray(payload.leaderboard)) {
      setLeaderboard(nextLeaderboard);
    }
    const activeCode = activeRoomCodeRef.current;
    const snapshotCode = activeRoomSnapshotRef.current?.code || "";
    const knownActiveCode = activeCode || snapshotCode;
    const reconnectRoom = !roomOnly && !creatingRoomRef.current && !activeCode ? nextRooms.find((room) => !dismissedRoomCodesRef.current.has(room.code) && participantInRoom(room, participant.id)) : null;
    if (reconnectRoom) {
      activeRoomCodeRef.current = reconnectRoom.code;
      setActiveRoomCode(reconnectRoom.code);
      setStableActiveRoomSnapshot(reconnectRoom);
      if (roomDecksReadyForBattle(reconnectRoom)) markBattleStartedForRoom(reconnectRoom);
      setPhase(reconnectRoom.status === "playing" ? phaseForRoomWithBattleLock(reconnectRoom, "battle") || "battle" : "room");
      setLobbyMessage("");
    }
    if (
      knownActiveCode &&
      roomOnly &&
      !creatingRoomRef.current &&
      !startPending &&
      joiningRoomCodeRef.current !== knownActiveCode &&
      !nextRooms.some((room) => room.code === knownActiveCode) &&
      !(activeRoomSnapshotRef.current?.code === knownActiveCode && Date.now() < optimisticRoomLockUntilRef.current)
    ) {
      activeRoomCodeRef.current = "";
      activeRoomSnapshotRef.current = null;
      setActiveRoomCode("");
      setActiveRoomSnapshot(null);
      writeCachedTriadRoom(participant.id, null);
      setPhase("lobby");
      setLobbyMessage("ห้องถูกปิดแล้ว");
    }
    setRooms((current) => roomOnly
      ? nextRooms.reduce((merged, room) => mergeIncomingRoom(merged, room), current)
      : mergeIncomingRooms(current, nextRooms));
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
    if (currentSnapshot && JSON.stringify(currentSnapshot) === JSON.stringify(stableRoom)) return currentSnapshot;
    activeRoomSnapshotRef.current = stableRoom;
    setActiveRoomSnapshot(stableRoom);
    writeCachedTriadRoom(participant.id, stableRoom);
    return stableRoom;
  };

  const forceApplyServerRoom = (room: TriadRoom) => {
    optimisticRoomLockUntilRef.current = 0;
    const stableRoom = keepPendingOpeningTieBreakChoice(mergeRoomWithStableChat(activeRoomSnapshotRef.current, room));
    activeRoomSnapshotRef.current = stableRoom;
    setActiveRoomSnapshot(stableRoom);
    setRooms((current) => forceReplaceRoomByCode(current, stableRoom));
    writeCachedTriadRoom(participant.id, stableRoom);
    if (activeRoomCodeRef.current === stableRoom.code || participantInRoom(stableRoom, participant.id)) {
      activeRoomCodeRef.current = stableRoom.code;
      setActiveRoomCode(stableRoom.code);
      if (roomDecksReadyForBattle(stableRoom)) markBattleStartedForRoom(stableRoom);
      const nextPhase = stableRoom.status === "playing" ? phaseForRoomWithBattleLock(stableRoom, "battle") || "battle" : "room";
      setPhase(nextPhase);
    }
    return stableRoom;
  };

  const resetLocalDeckSelectionState = (room: TriadRoom) => {
    if (deckSyncTimerRef.current) window.clearTimeout(deckSyncTimerRef.current);
    deckSyncTimerRef.current = null;
    localDeckSessionRef.current = "";
    optimisticRoomLockUntilRef.current = 0;
    setDeckPreviewCard(null);
    setSpectatorPreviewCard(null);
    startedBattleRoomKeysRef.current.delete(roomBattleStartKey(room));
    deckBattleStartKeyRef.current = "";
    pvpTurnKeyRef.current = "";
    turnReadyRecoveryKeyRef.current = "";
    resultAdvanceKeyRef.current = "";
    setDeckReadySubmitting(false);
    setPendingTurnReadyKey("");
    setTurnReadySubmittingKey("");
    setPlayerDeck([]);
    setBotDeck([]);
    setUsedPlayerCards([]);
    setUsedBotCards([]);
    setGravePlayerCards([]);
    setGraveBotCards([]);
    setPlayer({ top: "", left: "", right: "" });
    setLockedFight(null);
    setTurnLocked(false);
    setPendingSkillChoice(null);
    setPendingBlessingChoice(null);
    setRandomDrawCardNo("");
    setActiveTurn(1);
    setFightNo(1);
    setPlacementLane("top");
    setRevealed(emptyRevealState());
    setLastTurnWinner(null);
    setMatchScore({ player: 0, bot: 0 });
    setTimeLeft(TURN_SECONDS);
    setResultTimeLeft(RESULT_SECONDS);
    setDeckTimeLeft(roomDeckSecondsLeft(room));
  };

  const resetLocalRestartedTurnState = (room: TriadRoom) => {
    const restartedTurn = room.game.activeTurn;
    const restartedLane = laneForTurn(restartedTurn);
    optimisticRoomLockUntilRef.current = 0;
    pvpTurnKeyRef.current = `${room.code}:${room.game.fightNo}:${room.game.activeTurn}`;
    turnReadyRecoveryKeyRef.current = "";
    resultAdvanceKeyRef.current = "";
    setPendingTurnReadyKey("");
    setTurnReadySubmittingKey("");
    setTurnLocked(false);
    setPendingSkillChoice(null);
    setPendingBlessingChoice(null);
    setTimeLeft(roomTurnSecondsLeft(room));
    setResultTimeLeft(RESULT_SECONDS);
    setActiveTurn(restartedTurn);
    setFightNo(room.game.fightNo);
    setPlacementLane(restartedLane);
    setRevealed((current) => ({
      ...current,
      [restartedTurn]: { player: false, bot: false, scored: false },
    }));
    if (roomPlayerSide && opponentSide) {
      const previewTriangles = applyRoomBlessingPreview(
        room,
        room.game.triangles.host,
        room.game.triangles.challenger
      );
      setPlayer(previewTriangles[roomPlayerSide]);
      setLockedFight({
        fightNo: room.game.fightNo,
        player: previewTriangles[roomPlayerSide],
        bot: previewTriangles[opponentSide],
        turns: roomPlayerSide === "host" ? room.game.turns : room.game.turns.map(flipTriadResult),
      });
    }
    setBattleLog((current) => [
      `GM รีตาที่ ${restartedTurn} แล้ว เลือกการ์ดลงสนามใหม่ได้เลย`,
      ...current,
    ]);
  };

  const postRoomAction = async (body: Record<string, unknown>) => {
    roomResponseRevisionRef.current += 1;
    try {
    const response = await fetch(ROOM_API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
      body: JSON.stringify({ ...body, participant }),
    });
    const payload = await response.json().catch(() => ({}));
    const actionRoom = normalizeApiRooms(payload.room ? [payload.room] : [])[0] || null;
    if (
      (body.action === "set-deck" || body.action === "ready-deck" || ((body.action === "choose-skill-target" || body.action === "advance-turn") && typeof body.deckStartedAt === "number")) &&
      (activeRoomCodeRef.current !== body.code ||
        activeRoomSnapshotRef.current?.game.deckStartedAt !== body.deckStartedAt)
    ) {
      return { ok: false, status: 409, payload: { reason: "stale_deck_session" } };
    }
    const isGmRescueAction =
      body.action === "gm-reset-decks" || body.action === "gm-refresh-app" || body.action === "gm-restart-turn";
    const appliesToActiveRoom = body.action !== "create" && body.code === activeRoomCodeRef.current;
    if (actionRoom && appliesToActiveRoom) {
      optimisticRoomLockUntilRef.current =
        body.action === "lock-card" && !payload.resolved
          ? Math.max(optimisticRoomLockUntilRef.current, Date.now() + 1400)
          : 0;
    }
    const responseRooms = Array.isArray(payload.rooms) ? normalizeApiRooms(payload.rooms) : null;
    setRooms((current) => {
      let nextRooms = responseRooms || current;
      if (body.action === "disband" || (body.action === "leave" && !actionRoom)) {
        nextRooms = nextRooms.filter((room) => room.code !== body.code);
      }
      return (
      actionRoom
        ? isGmRescueAction
          ? forceReplaceRoomByCode(mergeIncomingRooms(current, nextRooms), actionRoom)
          : mergeIncomingRoom(mergeIncomingRooms(current, nextRooms), actionRoom)
        : mergeIncomingRooms(current, nextRooms)
      );
    });
    if (actionRoom && appliesToActiveRoom) {
      const activeStableRoom = isGmRescueAction
        ? forceApplyServerRoom(actionRoom)
        : setStableActiveRoomSnapshot(
            keepPendingOpeningTieBreakChoice(mergeRoomWithStableChat(activeRoomSnapshotRef.current, actionRoom))
          );
      if (body.action === "gm-reset-decks") {
        resetLocalDeckSelectionState(activeStableRoom);
      } else if (body.action === "gm-restart-turn") {
        resetLocalRestartedTurnState(activeStableRoom);
      }
      if (participantInRoom(activeStableRoom, participant.id) && activeStableRoom.status === "playing") {
        if (payload.battleReady || roomDecksReadyForBattle(activeStableRoom)) rememberDeckBattleStart(activeStableRoom);
        const nextPhase = payload.battleReady ? "battle" : phaseForRoomWithBattleLock(activeStableRoom);
        if (nextPhase) {
          setPhase((currentPhase) =>
            hasBattleStartedForRoom(activeStableRoom) && nextPhase === "deck"
              ? "battle"
              : nextPhase
          );
        }
      }
    } else if (body.action === "disband" && appliesToActiveRoom) {
      activeRoomCodeRef.current = "";
      activeRoomSnapshotRef.current = null;
      setActiveRoomCode("");
      setActiveRoomSnapshot(null);
      writeCachedTriadRoom(participant.id, null);
      setPhase("lobby");
    }
    if (!actionRoom || !response.ok) {
      globalThis.setTimeout(() => void syncRooms({ force: true }).catch(() => null), 60);
    }
    return { ok: response.ok, status: response.status, payload };
    } catch {
      return { ok: false, status: 0, payload: { reason: "network_error" } };
    } finally {
      roomResponseRevisionRef.current += 1;
    }
  };

  const scheduleDeckSync = (deck: string[]) => {
    if (!currentRoom || !roomPlayerSide || !opponentSide) return;
    const code = currentRoom.code;
    const deckStartedAt = currentRoom.game.deckStartedAt;
    const side = roomPlayerSide;
    if (deckSyncTimerRef.current) {
      window.clearTimeout(deckSyncTimerRef.current);
    }
    deckSyncTimerRef.current = window.setTimeout(() => {
      deckSyncTimerRef.current = null;
      deckSyncQueueRef.current = deckSyncQueueRef.current.catch(() => null).then(() => {
        const active = activeRoomSnapshotRef.current;
        if (!active || active.code !== code || active.game.deckStartedAt !== deckStartedAt || active.game.deckReady[side]) return;
        return postRoomAction({ action: "set-deck", code, deck, deckStartedAt });
      }).catch(() => null);
    }, 120);
  };

  useEffect(() => {
    return () => {
      if (deckSyncTimerRef.current) {
        window.clearTimeout(deckSyncTimerRef.current);
      }
    };
  }, []);

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
    const recoverChoice = () => {
      if (openingTieBreakPendingKeyRef.current !== choiceKey) return;
      openingTieBreakPendingChoiceRef.current = null;
      openingTieBreakPendingKeyRef.current = "";
      setOpeningTieBreakPendingChoice(null);
      patchCurrentRoom((room) => {
        if (openingTieBreakChoiceKey(room.code, room.game.openerTieBreak, roomPlayerSide) !== choiceKey || room.game.openerTieBreak.status !== "waiting") return room;
        const choices = { ...room.game.openerTieBreak.choices };
        delete choices[roomPlayerSide];
        return { ...room, game: { ...room.game, openerTieBreak: { ...room.game.openerTieBreak, choices } } };
      });
      void syncRooms({ force: true }).catch(() => null);
      setBattleLog((current) => ["เลือกเป่ายิงฉุบไม่สำเร็จ ระบบจะซิงก์สถานะล่าสุดอีกครั้ง", ...current]);
    };
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
      fightNo: currentRoom.game.fightNo,
      round: tieBreak.round || 1,
    }).then((result) => {
      if (!result.ok) {
        recoverChoice();
      }
    }).catch(recoverChoice);
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
      fightNo: currentRoom.game.fightNo,
      round: currentRoom.game.openerTieBreak.round || 1,
    }).then((result) => {
      if (!result.ok) {
        setBattleLog((current) => ["Reset RPS failed. Syncing latest room state.", ...current]);
      }
      void syncRooms({ force: true }).catch(() => null);
    }).catch(() => {
      void syncRooms({ force: true }).catch(() => null);
      setBattleLog((current) => ["Reset RPS failed. Syncing latest room state.", ...current]);
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
    if (creatingRoomRef.current) return;
    const access = roomAccess;
    const password = access === "private" ? roomPassword.trim() : "";
    if (access === "private" && password.length < 4) {
      setLobbyMessage("รหัสห้องส่วนตัวต้องมีอย่างน้อย 4 ตัว");
      return;
    }

    creatingRoomRef.current = true;
    setCreatingFormat(createFormat);
    setCreatingRoom(true);
    setLobbyMessage("");
    try {
    if (createFormat === "pentad") {
      const response=await fetch("/api/pentad-rooms",{method:"POST",headers:{"Content-Type":"application/json"},signal:AbortSignal.timeout(12000),body:JSON.stringify({action:"create",access,password,deckSource:deckMode === "all" ? "all" : "random",playWithBot:createRoomWithBot})});
      const data=await response.json();
      if (!response.ok || !data.room?.code) { setLobbyMessage(data.error || "สร้างห้องไม่สำเร็จ");return; }
      savePentadHandoff(participant.id,data.room);
      setPentadHandoff(data.room);
      router.push(`/game/pentad?room=${data.room.code}`);return;
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
    setCreateModeDialogOpen(false);
    setLobbyMessage("");
    if (roomDecksReadyForBattle(room)) markBattleStartedForRoom(room);
    setPhase(room.status === "playing" ? phaseForRoomWithBattleLock(room, "deck") || "deck" : "room");
    } catch(error) {
      setLobbyMessage(error instanceof Error?error.message:"สร้างห้องไม่สำเร็จ");
    } finally {
      creatingRoomRef.current = false;
      setCreatingRoom(false);
    }
  };

  const enterRoom = async (codeInput = joinCode, forceSpectator = false, passwordInput = joinPassword) => {
    const code = codeInput.replace(/\D/g, "").slice(0, 6);
    const room = rooms.find((item) => item.code === code);
    if (code.length !== 6) {
      setLobbyMessage("ไม่พบห้องนี้");
      return;
    }
    if (joiningRoomCodeRef.current) return;
    if (room?.access === "private" && !passwordInput.trim() && room.hostId !== participant.id) {
      setPasswordRoom(room);
      setLobbyMessage("");
      return;
    }

    const shouldEnterAsSpectator = forceSpectator || room?.status === "playing";
    const canOptimisticallyEnter = Boolean(room && (room.access !== "private" || room.hostId === participant.id));
    const optimisticRoom = room ? roomWithOptimisticJoin(room, participant, shouldEnterAsSpectator) : null;
    const previousRoomCode = activeRoomCodeRef.current;
    const previousRoomSnapshot = activeRoomSnapshotRef.current;
    const previousPhase = phase;
    let usedOptimisticRoom = false;

    setJoiningRoomCode(code);
    joiningRoomCodeRef.current = code;
    setLobbyMessage("");
    if (canOptimisticallyEnter && optimisticRoom) {
      usedOptimisticRoom = true;
      activeRoomCodeRef.current = optimisticRoom.code;
      setActiveRoomCode(optimisticRoom.code);
      setStableActiveRoomSnapshot(optimisticRoom);
      setRooms((current) => mergeIncomingRoom(current, optimisticRoom));
      if (roomDecksReadyForBattle(optimisticRoom)) markBattleStartedForRoom(optimisticRoom);
      setPhase(optimisticRoom.status === "playing" ? phaseForRoomWithBattleLock(optimisticRoom, "battle") || "battle" : "room");
    } else {
      setLobbyMessage("กำลังเข้าห้อง...");
    }

    const restoreBeforeOptimisticJoin = () => {
      if (!usedOptimisticRoom) return;
      activeRoomCodeRef.current = previousRoomCode;
      activeRoomSnapshotRef.current = previousRoomSnapshot;
      setActiveRoomCode(previousRoomCode);
      setActiveRoomSnapshot(previousRoomSnapshot);
      writeCachedTriadRoom(participant.id, previousRoomSnapshot);
      setPhase(previousPhase);
    };

    const result = await postRoomAction({
      action: "join",
      code,
      password: passwordInput.trim(),
      forceSpectator: shouldEnterAsSpectator,
    }).catch(() => null);

    if (joiningRoomCodeRef.current !== code) return;
    joiningRoomCodeRef.current = "";
    if (!result?.ok) {
      const lockedRoom = normalizeApiRooms(result?.payload?.room ? [result.payload.room] : [])[0] || null;
      restoreBeforeOptimisticJoin();
      setJoiningRoomCode("");
      if (result?.payload?.reason === "wrong_password" && lockedRoom && !passwordInput.trim()) {
        setPasswordRoom(lockedRoom);
        setLobbyMessage("");
        return;
      }
      setLobbyMessage(result?.payload?.reason === "wrong_password" ? "รหัสห้องไม่ถูกต้อง" : "เข้าห้องนี้ไม่ได้");
      return;
    }

    setPasswordRoom(null);
    setJoinPassword("");
    const joinedRoom = normalizeApiRooms(result.payload?.room ? [result.payload.room] : [])[0] || optimisticRoom || room;
    if (!joinedRoom?.code) {
      restoreBeforeOptimisticJoin();
      setJoiningRoomCode("");
      setLobbyMessage("ไม่พบห้องนี้");
      return;
    }
    activeRoomSnapshotRef.current = joinedRoom;
    activeRoomCodeRef.current = joinedRoom.code;
    setActiveRoomCode(joinedRoom.code);
    setStableActiveRoomSnapshot(joinedRoom);
    setJoiningRoomCode("");
    setLobbyMessage(result.payload?.joinedAs === "spectator" ? "เข้ามาเป็นผู้ชมแล้ว" : "");
    if (roomDecksReadyForBattle(joinedRoom)) markBattleStartedForRoom(joinedRoom);
    setPhase(joinedRoom.status === "playing" ? phaseForRoomWithBattleLock(joinedRoom, "battle") || "battle" : "room");
  };

  const moveToSpectator = async () => {
    if (!currentRoom || currentRoom.status === "playing") return;
    const result = await postRoomAction({ action: "spectate", code: currentRoom.code });
    if (!result.ok) setLobbyMessage("ย้ายไปนั่งชมไม่ได้");
  };

  const takeFieldSlot = async (slot: "host" | "challenger") => {
    if (!currentRoom || currentRoom.status === "playing") return;
    const result = await postRoomAction({ action: "take-slot", code: currentRoom.code, slot });
    if (!result.ok) setLobbyMessage("ลงช่องนี้ไม่ได้");
  };

  const toggleBotOpponent = async (side:'host'|'challenger'='challenger',enabled=!isBotParticipant(currentRoom?.seats[side])) => {
    if (!currentRoom || !isRoomController) return;
    const result = await postRoomAction({
      action: "set-bot",
      code: currentRoom.code,
      enabled,side,
    });
    if (!result.ok) {
      setLobbyMessage("เปลี่ยนบอทไม่ได้ ที่นั่งอาจมีผู้เล่นแล้ว");
      return;
    }
    setLobbyMessage(enabled?`เพิ่มบอทฝั่ง ${side==='host'?'A':'B'} แล้ว`:`เอาบอทฝั่ง ${side==='host'?'A':'B'} ออกแล้ว`);
  };

  const changeRoomDeckMode = async (deckMode: DeckMode) => {
    if (!currentRoom || !isRoomController || currentRoom.status !== "waiting") return;
    setLobbyMessage("");
    const result = await postRoomAction({
      action: "set-mode",
      code: currentRoom.code,
      deckMode,
    });
    if (!result.ok) {
      setLobbyMessage("เปลี่ยนโหมดห้องไม่สำเร็จ");
      return;
    }
    const room = normalizeApiRooms(result.payload?.room ? [result.payload.room] : [])[0];
    if (room) {
      setStableActiveRoomSnapshot(room);
      setRooms((current) => mergeIncomingRoom(current, room));
    }
    setLobbyMessage("เปลี่ยนโหมดห้องแล้ว");
  };

  const startRoomGame = async () => {
    if (!currentRoom || !isRoomController) return;
    if (startingRoomCodeRef.current) return;
    const code = currentRoom.code;
    const startedAsFieldPlayer = Boolean(
      currentRoom.seats.host?.id === participant.id || currentRoom.seats.challenger?.id === participant.id
    );
    startingRoomCodeRef.current = code;
    startRoomLockRef.current = { code, until: Number.POSITIVE_INFINITY };
    resetBattle();
    setPhase(startedAsFieldPlayer ? "deck" : "battle");
    const result = await postRoomAction({ action: "start", code });
    startingRoomCodeRef.current = "";
    startRoomLockRef.current = { code: "", until: 0 };
    if (activeRoomCodeRef.current !== code) return;
    if (!result.ok) {
      const confirmedRoom = activeRoomSnapshotRef.current;
      if (confirmedRoom?.code === code && confirmedRoom.status === "playing" && confirmedRoom.game.deckStartedAt !== currentRoom.game.deckStartedAt) {
        setPhase(phaseForRoomWithBattleLock(confirmedRoom, "deck") || "deck");
        return;
      }
      setLobbyMessage(result.status === 0 ? "เชื่อมต่อไม่สำเร็จ กดเริ่มเกมอีกครั้งได้" : "เจ้าของห้องเริ่มเกมได้เมื่อมีผู้เล่นครบ 2 ฝั่ง");
      setPhase("room");
      void syncRooms({ force: true }).catch(() => null);
      return;
    }
    const startedRoom = normalizeApiRooms(result.payload?.room ? [result.payload.room] : [])[0] || currentRoom;
    const serverStartedAsFieldPlayer = Boolean(
      startedRoom?.seats.host?.id === participant.id || startedRoom?.seats.challenger?.id === participant.id
    );
    setPhase(serverStartedAsFieldPlayer ? "deck" : "battle");
  };

  const leavingRoomRef = useRef(false);
  const leaveRoom = async () => {
    if (leavingRoomRef.current) return;
    leavingRoomRef.current = true;
    try {
    if (currentRoom?.status === "playing" && isFieldPlayer && !currentRoom.game.matchEndedAt) {
      if (!await confirmBattleLeave()) return;
    }
    joiningRoomCodeRef.current = "";
    setJoiningRoomCode("");
    const code = currentRoom?.code || "";
    if (code) dismissedRoomCodesRef.current.add(code);
    activeRoomCodeRef.current = "";
    activeRoomSnapshotRef.current = null;
    setActiveRoomCode("");
    setActiveRoomSnapshot(null);
    writeCachedTriadRoom(participant.id, null);
    setPhase("lobby");
    if (code) {
      setRooms(current => current.filter(room => room.code !== code));
      void sendBattleRoomExit(ROOM_API_PATH, { code, participant }).then(ok => {
        if (!ok) setLobbyMessage('ออกจากสนามแล้ว แต่ยังยืนยันกับเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบการเชื่อมต่อ');
      });
    }
    } finally { leavingRoomRef.current = false; }
  };


  const continueRoomBattle = async () => {
    if (!currentRoom || !participantInRoom(currentRoom, participant.id)) return;
    const code = currentRoom.code;
    resetBattle();
    setPhase("room");
    const result = await postRoomAction({ action: "continue", code });
    if (!result.ok) {
      setLobbyMessage("เริ่มสู้ต่อในห้องนี้ไม่ได้");
      void syncRooms({ force: true }).catch(() => null);
      return;
    }
    setPhase("room");
  };

  const confirmGmRescueAction = async () => {
    if (!currentRoom || !gmConfirmAction || gmSubmitting || !canUseGmRescuePanel) return;
    const action = gmConfirmAction;
    setGmSubmitting(true);
    const result = await postRoomAction({ action, code: currentRoom.code }).catch(() => null);
    setGmSubmitting(false);
    if (!result?.ok) {
      setLobbyMessage("GM action failed");
      void syncRooms({ force: true }).catch(() => null);
      return;
    }
    setGmConfirmAction(null);
    setGmPanelOpen(false);
    if (action === "gm-reset-decks") {
      const room = normalizeApiRooms(result.payload?.room ? [result.payload.room] : [])[0] || currentRoom;
      setPhase(phaseForRoomWithBattleLock(room, "room") || "room");
      void syncRooms({ force: true }).catch(() => null);
    } else if (action === "gm-restart-turn") {
      setPhase("battle");
      void syncRooms({ force: true }).catch(() => null);
    } else if (action === "gm-refresh-app") {
      writeCachedTriadRoom(participant.id, currentRoom);
      window.setTimeout(() => window.location.reload(), 160);
    }
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
    if (!await confirmBattleSurrender()) return;
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
      if (event.action === "chat") {
        if (event.code === activeRoomCodeRef.current) window.dispatchEvent(new CustomEvent(BATTLE_CHAT_CHANGED, { detail: { mode: "triad", code: event.code } }));
        return;
      }
      const room = normalizeApiRooms(event.room ? [event.room] : [])[0] || null;
      const code = safeText(event.code || room?.code);
      if (room?.status === "waiting" && startingRoomCodeRef.current === code) return;
      if (room && joiningRoomCodeRef.current === code && !participantInRoom(room, participant.id)) return;
      if (room && shouldKeepCurrentRoomSnapshot(activeRoomSnapshotRef.current || undefined, room)) return;

      if (event.refresh) {
        if (event.reload && code && (activeRoomCodeRef.current === code || activeRoomSnapshotRef.current?.code === code)) {
          if (room) writeCachedTriadRoom(participant.id, room);
          void syncRooms({ force: true }).finally(() => {
            window.setTimeout(() => window.location.reload(), 120);
          });
          return;
        }
        if (room) {
          const stableRoom = forceApplyServerRoom(room);
          if (event.action === "gm-reset-decks") {
            resetLocalDeckSelectionState(stableRoom);
          } else if (event.action === "gm-restart-turn") {
            resetLocalRestartedTurnState(stableRoom);
          }
        }
        void syncRooms({ force: true }).catch(() => null);
        return;
      }

      if (event.deleted && code) {
        if (room) return; // A delayed deletion event cannot override a live room snapshot.
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
      const staleActiveEcho =
        activeRoomCodeRef.current === room.code &&
        !roomIncludesMe &&
        activeRoomSnapshotRef.current?.code === room.code &&
        Date.now() < optimisticRoomLockUntilRef.current;
      if ((activeRoomCodeRef.current === room.code || roomIncludesMe) && !staleActiveEcho) {
        setStableActiveRoomSnapshot(stableRoom);
      }

      if (!activeRoomCodeRef.current && roomIncludesMe) {
        activeRoomCodeRef.current = room.code;
        setActiveRoomCode(room.code);
      }

      if (roomIncludesMe) {
        setPhase((currentPhase) => {
          if (room.status === "playing") {
            if (roomDecksReadyForBattle(room)) markBattleStartedForRoom(room);
            const nextPhase = phaseForRoomWithBattleLock(room, currentPhase) || currentPhase;
            return hasBattleStartedForRoom(room) && nextPhase === "deck"
              ? "battle"
              : nextPhase;
          }
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
    if (!currentRoom || !roomPlayerSide || !roomActiveTurnResolved || !bothReady || !roomActiveTurnScored) {
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
    currentRoom?.code,
    currentRoom?.game.activeTurn,
    currentRoom?.game.fightNo,
    currentRoom?.game.turnReady.challenger,
    currentRoom?.game.turnReady.host,
    roomActiveTurnResolved,
    roomActiveTurnScored,
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
      cinematicActive ||
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
    cinematicActive,
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
      cinematicActive ||
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
      void postRoomAction({ action: "advance-turn", code: currentRoom.code, fightNo: currentRoom.game.fightNo, turn: currentRoom.game.activeTurn, deckStartedAt: currentRoom.game.deckStartedAt }).catch(() => { void syncRooms({ force: true }).catch(() => null); });
    }, 4600);
  }, [
    currentRoom?.code,
    currentRoom?.game.activeTurn,
    currentRoom?.game.fightNo,
    currentRoom?.game.openerTieBreak.status,
    currentRoom?.game.openerTieBreak.winner,
    currentRoom?.game.turns,
    roomPlayerSide,
    cinematicActive,
  ]);

  useEffect(() => {
    if (!currentRoom || !participantInRoom(currentRoom, participant.id)) return;
    if (currentRoom.status === "waiting" && (phase === "deck" || phase === "battle")) {
      if (startRoomLockRef.current.code === currentRoom.code && Date.now() < startRoomLockRef.current.until) return;
      resetBattle();
      setPhase("room");
      return;
    }
    if (currentRoom.status === "playing") {
      if (startRoomLockRef.current.code === currentRoom.code) {
        startRoomLockRef.current = { code: "", until: 0 };
      }
      if (roomDecksReadyForBattle(currentRoom)) markBattleStartedForRoom(currentRoom);
      const nextPhase = phaseForRoomWithBattleLock(currentRoom);
      if (hasBattleStartedForRoom(currentRoom) && nextPhase === "deck") return;
      if (nextPhase && phase !== nextPhase) setPhase(nextPhase);
    }
  }, [currentRoom, participant.id, phase]);


  useEffect(() => {
    if (!currentRoom || !roomPlayerSide || !opponentSide) return;
    const sessionKey = `${roomBattleStartKey(currentRoom)}:${roomPlayerSide}`;
    if (localDeckSessionRef.current !== sessionKey) {
      resetLocalDeckSelectionState(currentRoom);
      localDeckSessionRef.current = sessionKey;
      setPlayerDeck(currentRoom.game.decks[roomPlayerSide]);
    }
    const decksReadyForBattle = roomDecksReadyForBattle(currentRoom);
    if (!decksReadyForBattle) {
      if (hasBattleStartedForRoom(currentRoom)) return;
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
      if (
        Date.now() < optimisticRoomLockUntilRef.current &&
        !turnResolved &&
        !serverPlayerTriangle[activeLane] &&
        current[activeLane]
      ) {
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

    let lastDeadlineSync = 0;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((ownPendingRoomSkillChoice.deadlineAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0 && Date.now() - lastDeadlineSync >= 1000) {
        lastDeadlineSync = Date.now();
        void syncRooms({ force: true }).catch(() => null);
      }
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [currentRoom, isPvpRoom, opponentSide, ownPendingRoomSkillChoice, roomPlayerSide, waitingPendingRoomSkillChoice]);

  const toggleDeckCard = (cardNo: string) => {
    if (currentRoom?.status === "waiting" || ownDeckReady || deckReadySubmitting) return;
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
      scheduleDeckSync(nextDeck);
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
    if (currentRoom?.status === "waiting" || ownDeckReady || deckReadySubmitting) return;
    const monsterCount = playerDeckCards.filter((card) => card.kind === "monster").length;
    if (!currentRoom && monsterCount < 3) {
      setBattleLog(["เด็คต้องมีมอนสเตอร์อย่างน้อย 3 ใบ เพื่อใช้เป็นการ์ดหลักของแต่ละรอบ"]);
      return;
    }

    if (currentRoom && roomPlayerSide && opponentSide) {
      if (!deckValidation.valid) return;
      setDeckReadySubmitting(true);
      if (deckSyncTimerRef.current) window.clearTimeout(deckSyncTimerRef.current);
      deckSyncTimerRef.current = null;
      setBattleLog(["กำลังยืนยันเด็คกับสนาม"]);
      const result = await postRoomAction({
        action: "ready-deck",
        code: currentRoom.code,
        deck: playerDeck,
        deckStartedAt: currentRoom.game.deckStartedAt,
      }).catch(() => null);
      if (activeRoomSnapshotRef.current?.game.deckStartedAt !== currentRoom.game.deckStartedAt) return;
      if (!result) {
        setDeckReadySubmitting(false);
        optimisticRoomLockUntilRef.current = 0;
        setBattleLog(["ส่งสถานะพร้อมไม่สำเร็จ กดพร้อมอีกครั้งได้"]);
        void syncRooms({ force: true }).catch(() => null);
        return;
      }
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
      if (result.payload?.battleReady || roomDecksReadyForBattle(room)) {
        rememberDeckBattleStart(room);
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
    let syncing = false;
    let lastDeadlineSync = 0;
    const tick = () => {
      const nextLeft = roomDeckSecondsLeft(currentRoom);
      setDeckTimeLeft(nextLeft);
      if (nextLeft === 0 && !syncing && Date.now() - lastDeadlineSync >= 1000) {
        syncing = true;
        lastDeadlineSync = Date.now();
        void syncRooms({ force: true }).catch(() => null).finally(() => { syncing = false; });
      }
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [currentRoom, deckSelectionActive, phase]);

  useEffect(() => {
    if (!currentRoom || currentRoom.status !== "playing") return;
    const decksReady = roomDecksReadyForBattle(currentRoom);
    if (!decksReady) {
      deckBattleStartKeyRef.current = "";
      return;
    }

    const startKey = deckBattleStartKeyForRoom(currentRoom);
    if (deckBattleStartKeyRef.current === startKey) {
      if (phase !== "battle") setPhase("battle");
      return;
    }
    const alreadyInBattle = phase === "battle" || hasBattleStartedForRoom(currentRoom);
    deckBattleStartKeyRef.current = startKey;

    markBattleStartedForRoom(currentRoom);
    if (!alreadyInBattle) resetBattlePlayState();
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
    }, isBotParticipant(currentRoom.seats.host)&&isBotParticipant(currentRoom.seats.challenger)?1000:25);
    return () => window.clearTimeout(timer);
  }, [currentRoom, hasBotOpponent, participant.id]);

  function resetBattle() {
    soloArenaSeedRef.current = Date.now();
    setCompletedCinematicTurn("");
    autoAdvanceAttemptRef.current = "";
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
      setBattleLog((current) => ["ตานี้ถูกตัดสินแล้ว กำลังแสดงผลการปะทะก่อนเริ่มตาถัดไป", ...current]);
      return false;
    }
    if (handPlacementLocked || displayUsedPlayerSet.has(cardNo) || lane !== laneForTurn(activeTurn)) return false;
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
    if ((currentDeckMode === "skill" || currentDeckMode === "all") && lane !== "top" && card?.kind !== "skill") {
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
      const targets = getPlayableSkillTargetIds(playerCard, "player", cardsByNo.get(player.top), cardsByNo.get(bot.top), activeTurn, bot);
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
    if (currentRoom && roomPlayerSide && opponentSide) {
      const roomActiveLane = laneForTurn(currentRoom.game.activeTurn);
      const roomTurnResolvedNow = currentRoom.game.turns.some((turn) => turn.turn === currentRoom.game.activeTurn);
      if (lane !== roomActiveLane || roomTurnResolvedNow || matchDone) return;
      const existingRoomCard = currentRoom.game.triangles[roomPlayerSide]?.[roomActiveLane] || "";
      if (existingRoomCard && existingRoomCard !== cardNo) {
        setBattleLog((current) => ["ตานี้ล็อกการ์ดไปแล้ว รอผลจากระบบ", ...current]);
        return;
      }
      const card = cardsByNo.get(cardNo);
      if (!card) return;
      if (roomActiveLane === "top" && card.kind !== "monster") {
        setBattleLog((current) => ["ตาแรกต้องวางการ์ดมอนสเตอร์เท่านั้น", ...current]);
        return;
      }
      if (currentDeckMode === "monster" && card.kind !== "monster") {
        setBattleLog((current) => ["โหมด MONSTER ใช้การ์ดมอนสเตอร์เท่านั้น", ...current]);
        return;
      }
      if ((currentDeckMode === "skill" || currentDeckMode === "all") && roomActiveLane !== "top" && card.kind !== "skill") {
        setBattleLog((current) => ["ตานี้ต้องใช้การ์ดสกิล", ...current]);
        return;
      }
      setActiveTurn(currentRoom.game.activeTurn);
      setPlayer((current) => ({ ...current, [roomActiveLane]: cardNo }));
      lockFight(cardNo, roomActiveLane);
      return;
    }
    if (setPlayerLane(lane, cardNo)) {
      lockFight(cardNo, lane);
    }
  };

  const placeCardFromHand = (cardNo: string) => {
    placeAndLockCard(currentRoom ? laneForTurn(currentRoom.game.activeTurn) : laneForTurn(activeTurn), cardNo);
  };

  const confirmSkillTarget = async () => {
    if (!pendingSkillChoice || !lockedFight) {
      if (currentRoom) void syncRooms({ force: true }).catch(() => null);
      throw new Error("skill_state_not_ready");
    }
    const skillCard = cardsByNo.get(pendingSkillChoice.cardNo);
    const fallbackTargets = getPlayableSkillTargetIds(
      skillCard,
      pendingSkillChoice.side,
      cardsByNo.get(lockedFight.player.top),
      cardsByNo.get(lockedFight.bot.top), activeTurn, lockedFight.bot
    );
    const selectedTarget = pendingSkillChoice.selectedTarget || (fallbackTargets.length === 1 ? fallbackTargets[0] : "");
    if (!selectedTarget) return;
    const selectableTargetIds = new Set(
      getPlayableSkillTargetIds(skillCard, pendingSkillChoice.side, cardsByNo.get(lockedFight.player.top), cardsByNo.get(lockedFight.bot.top), activeTurn, pendingSkillChoice.side === "player" ? lockedFight.bot : lockedFight.player)
    );
    const selectedTargets = parseSkillTargetSelection(selectedTarget);
    const copyCard = skillCard?.cardNo === "245" ? triadCardByNo.get(selectedTargets[0]?.slice(5)) : undefined;
    const copyTargets = copyCard ? getPlayableSkillTargetIds(copyCard, pendingSkillChoice.side, cardsByNo.get(lockedFight.player.top), cardsByNo.get(lockedFight.bot.top), activeTurn) : [];
    const copyNeedsTarget = Boolean(copyCard && /เลือก|choose|target/i.test(copyCard.skillText) && copyTargets.length);
    const validTargetSelection = skillCard?.cardNo === "245"
      ? selectableTargetIds.has(selectedTargets[0]) && selectedTargets.slice(1).every(target => copyTargets.includes(target)) && (!copyNeedsTarget || selectedTargets.length === (isTwoStepTargetSkill(copyCard) ? 3 : 2))
      : isTwoStepTargetSkill(skillCard)
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
      const result = await postRoomAction({
        action: "choose-skill-target",
        code: currentRoom.code,
        selectedTarget,
        deckStartedAt: currentRoom.game.deckStartedAt,
        fightNo: currentRoom.game.fightNo,
        turn: currentRoom.game.activeTurn,
        cardNo: pendingSkillChoice.cardNo,
        deadlineAt: ownPendingRoomSkillChoice?.deadlineAt,
      }).catch(() => null);
      if (!result) {
        void syncRooms({ force: true }).catch(() => null);
        throw new Error("skill_target_network");
      }
      if (!result.ok) {
        optimisticRoomLockUntilRef.current = 0;
        void syncRooms({ force: true }).catch(() => null);
        setBattleLog((current) => ["เลือกเป้าหมายสกิลไม่สำเร็จ หรือหมดเวลา 30 วินาทีแล้ว", ...current]);
        throw new Error("skill_target_rejected");
      }
      setBattleLog((current) => [`${skillCard?.name || pendingSkillChoice.cardNo}: ยืนยันเป้าหมายแล้ว`, ...current]);
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
    const originalPlayer = { ...pendingBlessingChoice.player };
    const originalBot = { ...pendingBlessingChoice.bot };
    let nextPlayer = { ...originalPlayer };
    let nextBot = { ...originalBot };
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
        player: originalPlayer,
        bot: originalBot,
      });
      void postRoomAction({
        action: "choose-skill-target",
        code: currentRoom.code,
        selectedTarget: choice,
        deckStartedAt: currentRoom.game.deckStartedAt,
        fightNo: currentRoom.game.fightNo,
        turn: currentRoom.game.activeTurn,
        cardNo: "254",
        deadlineAt: ownPendingRoomSkillChoice?.deadlineAt,
      }).then((result) => {
        if (!result.ok) {
          void syncRooms({ force: true }).catch(() => null);
          setBattleLog((current) => ["ขอพรศักดิ์สิทธิ์ยืนยันไม่สำเร็จ", ...current]);
          return;
        }
        const room = normalizeApiRooms(result.payload?.room ? [result.payload.room] : [])[0];
        const serverChoice = room?.game.skillChoices.find(
          (item) =>
            item.fightNo === room.game.fightNo &&
            item.turn === room.game.activeTurn &&
            item.side === roomPlayerSide &&
            item.cardNo === "254" &&
            item.selectedTarget === choice &&
            !item.skipped
        );
        const serverDrawnCardNo = serverChoice?.blessingDrawCardNo || "";
        const serverPreviewTopCardNo = serverChoice?.blessingPreviewTopNo || "";
        const serverSummary =
          choice === "draw-skill"
            ? serverDrawnCardNo
              ? `No.254 ขอพรศักดิ์สิทธิ์: เปิดสกิลเพิ่ม No.${serverDrawnCardNo} แทน No.254 เฉพาะตานี้`
              : "No.254 ขอพรศักดิ์สิทธิ์: สุ่มสกิลเพิ่มไม่สำเร็จ"
            : serverPreviewTopCardNo
              ? `No.254 ขอพรศักดิ์สิทธิ์: สุ่มเปลี่ยนมอนสเตอร์${choice === "reroll-own" ? "ฝั่งเรา" : "ฝั่งตรงข้าม"}เป็น No.${serverPreviewTopCardNo} เฉพาะตานี้ จบตาจะกลับเป็นมอนสเตอร์เดิม`
              : `No.254 ขอพรศักดิ์สิทธิ์: สุ่มเปลี่ยนมอนสเตอร์${choice === "reroll-own" ? "ฝั่งเรา" : "ฝั่งตรงข้าม"}ไม่สำเร็จ`;
        setPendingBlessingChoice((current) =>
          current
            ? {
                ...current,
                choice,
                drawnCardNo: serverDrawnCardNo,
                previewTopCardNo: serverPreviewTopCardNo,
              }
            : current
        );
        if (serverDrawnCardNo || serverPreviewTopCardNo) setRandomDrawCardNo(serverDrawnCardNo || serverPreviewTopCardNo);
        setBattleLog((current) => [serverSummary || summary, ...current]);
      }).catch(() => {
        if (activeRoomSnapshotRef.current?.game.deckStartedAt !== currentRoom.game.deckStartedAt) return;
        setPendingBlessingChoice((current) => current ? { ...current, choice: undefined } : current);
        void syncRooms({ force: true }).catch(() => null);
        setBattleLog((current) => ["ส่งคำขอพรไม่สำเร็จ เลือกใหม่ได้", ...current]);
      });
      return;
    }

    if ((choice === "reroll-own" || choice === "reroll-opponent") && previewTopCardNo) {
      summary = `${summary} จบตาจะกลับเป็นมอนสเตอร์เดิม`;
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
      player: originalPlayer,
      bot: originalBot,
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
    const readyTurn = currentRoom.game.activeTurn;
    const hasServerResult = currentRoom.game.turns.some((turn) => turn.turn === readyTurn);
    if (!revealed[readyTurn]?.scored && !hasServerResult) return false;
    if (!revealed[readyTurn]?.scored && hasServerResult) {
      setRevealed((current) => ({
        ...current,
        [readyTurn]: { player: true, bot: true, scored: true },
      }));
    }
    if (
      pendingTurnReadyKey === currentTurnReadyKey ||
      turnReadySubmittingKey === currentTurnReadyKey ||
      Boolean(currentRoom.game.turnReady[roomPlayerSide])
    ) {
      return true;
    }

    const readyKey = currentTurnReadyKey;
    const attemptedKey = autoAdvanceAttemptRef.current;
    setPendingTurnReadyKey(readyKey);
    setTurnReadySubmittingKey(readyKey);

    const actionPayload = {
      action: "advance-turn",
      code: currentRoom.code,
      fightNo: currentRoom.game.fightNo,
      turn: currentRoom.game.activeTurn,
      deckStartedAt: currentRoom.game.deckStartedAt,
    };
    const retryAdvance = () => {
      setPendingTurnReadyKey((current) => current === readyKey ? "" : current);
      setTurnReadySubmittingKey((current) => current === readyKey ? "" : current);
      void syncRooms({ force: true }).catch(() => null);
      window.setTimeout(() => {
        if (autoAdvanceAttemptRef.current !== attemptedKey) return;
        autoAdvanceAttemptRef.current = "";
        setAutoAdvanceRetry((current) => current + 1);
      }, 1200);
    };
    const scheduleReadySync = (delayMs: number) => {
      window.setTimeout(() => void syncRooms({ force: true }).catch(() => null), delayMs);
    };

    void postRoomAction(actionPayload)
      .then((result) => {
        if (!result.ok) {
          retryAdvance();
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
        scheduleReadySync(120);
        scheduleReadySync(650);
      })
      .catch(() => {
        retryAdvance();
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
    const restoredFight = restoreLockedFightAfterBlessing(lockedFight, pendingBlessingChoice);

    setUsedPlayerCards((current) =>
      Array.from(new Set([...current, restoredFight.player[lane]].filter((cardNo): cardNo is string => Boolean(cardNo))))
    );
    setUsedBotCards((current) =>
      Array.from(new Set([...current, restoredFight.bot[lane]].filter((cardNo): cardNo is string => Boolean(cardNo))))
    );
    setPlayer(restoredFight.player);
    setLockedFight(restoredFight);
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
    const restoredFight = restoreLockedFightAfterBlessing(lockedFight, pendingBlessingChoice);

    const nextUsedPlayer = [
      ...usedPlayerCards,
      restoredFight.player.top,
      restoredFight.player.left || "",
      restoredFight.player.right || "",
    ].filter(Boolean);
    const nextUsedBot = [
      ...usedBotCards,
      restoredFight.bot.top,
      restoredFight.bot.left || "",
      restoredFight.bot.right || "",
    ].filter(Boolean);
    const nextAvailablePlayer = playerDeckCards.filter((card) => !new Set(nextUsedPlayer).has(card.cardNo));

    const completedPlayerCards = [restoredFight.player.top, restoredFight.player.left, restoredFight.player.right].filter(
      (cardNo): cardNo is string => Boolean(cardNo)
    );
    const completedBotCards = [restoredFight.bot.top, restoredFight.bot.left, restoredFight.bot.right].filter(
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
  const activeTurnScored = Boolean(revealState?.scored || (isPvpRoom && roomTurnResolved));
  const canRevealTurn = Boolean(displayCurrentResult) && (displayTurnLocked || Boolean(isPvpRoom && roomTurnResolved));
  const autoCinematicTurnKey = `${battleSessionKey}:${currentRoom?.game.fightNo || fightNo}:${currentRoom?.game.activeTurn || activeTurn}`;
  useEffect(() => {
    if (phase !== "battle" || matchDone || isSpectator || !activeTurnScored || completedCinematicTurn !== autoCinematicTurnKey) return;
    if (currentRoom && (!roomPlayerSide || (currentRoom.game.activeTurn === 1 && currentRoom.game.turns.find(turn => turn.turn === 1)?.winner === "draw"))) return;
    if (autoAdvanceAttemptRef.current === autoCinematicTurnKey) return;
    autoAdvanceAttemptRef.current = autoCinematicTurnKey;
    if (currentRoom) markRoomTurnReady();
    else if (activeTurn >= 3) nextFight();
    else nextTurn();
  }, [completedCinematicTurn, autoCinematicTurnKey, autoAdvanceRetry, activeTurnScored, phase, matchDone, isSpectator, roomPlayerSide, currentRoom?.game.activeTurn, currentRoom?.game.turns]);

  const revealButtonLabel =
    !canRevealTurn
      ? "ล็อกการ์ดก่อน"
      : "เปิดทั้งสองฝั่ง";

  const shouldShowReconnectSplash =
    resumeChecking &&
    phase === "lobby" &&
    Boolean(activeRoomCode || activeRoomSnapshot || activeRoomCodeRef.current || activeRoomSnapshotRef.current);

  const exitHandoffToLobby=()=>{
    setPentadHandoff(null);setHeptadHandoff(null);
    setCreateModeDialogOpen(false);setCreatingRoom(false);creatingRoomRef.current=false;
    activeRoomCodeRef.current='';activeRoomSnapshotRef.current=null;
    setActiveRoomCode('');setActiveRoomSnapshot(null);setPhase('lobby');
    try{sessionStorage.removeItem('nexora:heptad:handoff');sessionStorage.removeItem('nexora:pentad:handoff');}catch{}
  };
  if (pentadHandoff) return <PentadHandoffClient userId={participant.id} initialRoomCode={pentadHandoff.code} initialRoom={pentadHandoff} onExitToLobby={exitHandoffToLobby}/>;
  if (heptadHandoff) return <HeptadHandoffClient userId={participant.id} initialCode={heptadHandoff.code} initialRoom={heptadHandoff} spectate={false} onExitToLobby={exitHandoffToLobby}/>;
  if (creatingRoom) return <BattleArenaSurface image={arena.image} className="nexora-room-create-preview">
    <div role="status" className="nexora-room-create-status">{creatingFormat.toUpperCase()} · ยืนยันห้องกับเซิร์ฟเวอร์</div>
    <BattleWaitingRoom seats={{host:participant,challenger:null}} spectators={[]} userId={participant.id} leaderId={participant.id} modes={[{id:'all',title:'ALL IN ONE',description:'มอนสเตอร์ + สกิล'}]} mode="all" canChange={false} busy onMode={()=>{}} onWatch={()=>{}} onTake={()=>{}}/>
  </BattleArenaSurface>;

  if (shouldShowReconnectSplash) {
    return <BattleConnectingScreen />;
  }

  if (phase === "lobby") {
    const visibleRooms = rooms
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt);

    return (
      <main className="nexora-command triad-lobby-screen">
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
                  onClick={() => enterRoom(passwordRoom.code, passwordRoom.status === "playing", joinPassword)}
                  disabled={joiningRoomCode === passwordRoom.code}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-300 text-xs font-black uppercase tracking-[0.12em] text-black transition hover:bg-amber-200 disabled:cursor-wait disabled:opacity-70"
                >
                  {joiningRoomCode === passwordRoom.code ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {joiningRoomCode === passwordRoom.code ? "กำลังเข้า..." : "ยืนยัน"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
        {createModeDialogOpen ? (
          <GameModeModal
            format={createFormat}
            modes={createFormat === "pentad" ? [
              { id: "all", title: "ALL IN ONE", detail: "เลือกมอนสเตอร์ 5 ใบ สกิลบนมือ 15 ใบ และกองเสริม 10 ใบ จากการ์ดทั้งหมด" },
              { id: "monster", title: "สุ่มพูล", detail: "ตัวเลือกมอนสเตอร์ 30 ใบ สกิลบนมือ 30 ใบ และกองเสริม 30 ใบ ใช้พูลเดียวกันทั้งสองฝ่าย" },
            ] : [
              { id: "all", title: "ALL IN ONE", detail: "เปิดการ์ดทั้งหมด 293 ใบให้ทั้งสองฝั่งเลือกจัดเด็คเอง" },
              { id: "monster", title: "MONSTER", detail: "สุ่ม pool ฝั่งละ 20 ใบ: มอนสเตอร์ล้วนสำหรับโหมดนี้" },
              { id: "skill", title: "SKILL", detail: `บังคับเด็ค ${SKILL_MODE_MONSTER_LIMIT} มอนสเตอร์ + ${SKILL_MODE_SKILL_LIMIT} สกิล และให้กติกาตรงตามโหมดสกิล` },
            ]}
            selected={createRoomMode}
            withBot={createRoomWithBot}
            busy={creatingRoom}
            onSelect={setCreateRoomMode}
            onBotChange={setCreateRoomWithBot}
            onConfirm={() => { void createRoom(createRoomMode); }}
            onClose={() => setCreateModeDialogOpen(false)}
          />
        ) : null}
        <NexoraCommandLobby participant={participant} rankProfiles={rankProfiles} leaderboard={leaderboard} rooms={visibleRooms} roomAccess={roomAccess} setRoomAccess={setRoomAccess} roomPassword={roomPassword} setRoomPassword={setRoomPassword} joinCode={joinCode} setJoinCode={setJoinCode} joiningRoomCode={joiningRoomCode} lobbyMessage={lobbyMessage}
          onCreate={(format) => {
            if(format==='heptad'){
              if(creatingRoomRef.current)return;creatingRoomRef.current=true;setCreatingFormat('heptad');setCreatingRoom(true);setLobbyMessage('');
              void (async()=>{try{const response=await fetch('/api/heptad-rooms',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(12000),body:JSON.stringify({action:'create',access:roomAccess,password:roomPassword})}),data=await response.json();
                if(!response.ok||!data.room)throw Error(data.error||'สร้างห้องไม่สำเร็จ');
                try{sessionStorage.setItem('nexora:heptad:handoff',JSON.stringify({userId:participant.id,room:data.room,at:Date.now()}));}catch{}
                setHeptadHandoff(data.room);router.push(`/game/heptad?room=${data.room.code}`);
              }catch(error){setLobbyMessage(error instanceof Error?error.message:'สร้างห้องไม่สำเร็จ');}finally{creatingRoomRef.current=false;setCreatingRoom(false);}})();return;
            }
            setCreateFormat(format);setCreateRoomMode("all");setCreateModeDialogOpen(true);
          }}
          onEnter={(target) => {
            const room = typeof target === "string" ? rooms.find(room => room.code === target) : target;
            const code = typeof target === "string" ? target : target.code;
            if (room?.access === "private" && room.hostId !== participant.id) setPasswordRoom(room);
            else void enterRoom(code, room?.status === "playing");
          }} onNavigate={path => router.push(path)} />
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

    return (
      <main className="nexora-command nexora-command-room triad-room-screen">
        <NexoraCommandScene /><div className="nexora-command-shade" />
        <BattleWaitingRoom key={currentRoom.code} code={currentRoom.code} onExit={()=>void leaveRoom()} onStart={()=>startRoomGame()} chat={<BattleRoomChatPanel room={currentRoom} currentUserId={participant.id} rankProfiles={rankProfiles} onSend={sendRoomChat} compact />} seats={currentRoom.seats} spectators={currentRoom.spectators} userId={participant.id} leaderId={currentRoom.hostId} modes={[{id:'all',title:'ALL IN ONE',description:'มอนสเตอร์ + สกิล'},{id:'monster',title:'MONSTER',description:'มอนสเตอร์ล้วน'},{id:'skill',title:'SKILL',description:'10 มอนสเตอร์ + 10 สกิล'}]} mode={currentDeckMode} canChange={isRoomController} onMode={mode=>changeRoomDeckMode(mode as DeckMode)} onWatch={()=>moveToSpectator()} onTake={side=>takeFieldSlot(side)} onBot={(side,enabled)=>toggleBotOpponent(side,enabled)} />
      </main>
    );
  }

  if (phase === "deck") {
    const deckSessionOpening = currentRoom?.status === "waiting";
    const deckReadyDisabled = deckSessionOpening || deckReadySubmitting || (currentRoom ? ownDeckReady || !deckValidation.valid : !deckValidation.valid);
    const deckReadyLabel = deckSessionOpening ? "กำลังเปิดสนาม" : deckReadySubmitting ? "กำลังยืนยัน" : ownDeckReady ? "พร้อมแล้ว" : currentRoom ? "พร้อม" : "เข้าสนาม";
    const deckTimerText = `${Math.floor(deckTimeLeft / 60)}:${String(deckTimeLeft % 60).padStart(2, "0")}`;
    return (
      <main className="nexora-command-deck triad-deck-screen nexora-deck-screen">
        <BattleForfeitVictory result={currentRoom?.game.forfeit} userId={participant.id} onExit={() => { void leaveRoom(); }} />
        <DeckPreparationHeader title={TRIAD_TITLE} time={deckTimerText} onExit={leaveRoom} />
        <DeckPreparationLayout tray={<>
          <h2>เตรียมเด็ค <b>{playerDeck.length}/{DECK_SIZE}</b></h2>
          <div className="nexora-deck-guide">{deckSelectionGuide}<br />{deckSelectionNotice}</div>
          <div className="nexora-deck-chosen">{playerDeckCards.map(card => <HoldCardButton key={card.cardNo} type="button" aria-label={`นำ No.${card.cardNo} ออกจากเด็ค`} disabled={ownDeckReady || deckReadySubmitting} onClick={() => toggleDeckCard(card.cardNo)}   onPreview={()=>setDeckPreviewCard(card)} onPreviewEnd={()=>setDeckPreviewCard(null)}><img src={card.sourceImage} alt={card.name} /><span>−</span></HoldCardButton>)}</div>
        </>} actions={<><DeckPreparationTools disabled={deckSessionOpening || ownDeckReady || deckReadySubmitting} onShuffle={() => { const next=freshDeck(()=>randomTriadDeck(selectableDeckCatalog,currentDeckMode),playerDeck,value=>value);setPlayerDeck(next);if(currentRoom && roomPlayerSide)scheduleDeckSync(next); }} onClear={()=>{setPlayerDeck([]);if(currentRoom && roomPlayerSide)scheduleDeckSync([]);}} /><button type="button" className="nexora-deck-ready" onClick={enterBattle} disabled={deckReadyDisabled}><Check size={18} />{deckReadyLabel}</button><div className="nexora-deck-readiness">{ownDeckReady ? "คุณพร้อมแล้ว" : "กำลังจัดเด็ค"} · {opponentDeckReady ? "อีกฝ่ายพร้อมแล้ว" : "รออีกฝ่าย"}</div></>} catalog={<div className="nexora-deck-grid">{selectableDeckCatalog.map(card => {
          const selected = playerDeck.includes(card.cardNo);
          const disabled = deckSessionOpening || ownDeckReady || deckReadySubmitting ||
            (playerDeck.length >= DECK_SIZE && !selected) ||
            (currentDeckMode === "skill" && !selected && card.kind === "monster" && deckSelectionCounts.monsters >= SKILL_MODE_MONSTER_LIMIT) ||
            (currentDeckMode === "skill" && !selected && card.kind === "skill" && deckSelectionCounts.skills >= SKILL_MODE_SKILL_LIMIT);
          return <DeckCard key={card.cardNo} card={card} selected={selected} disabled={disabled} onClick={() => { if (!deckSessionOpening && !ownDeckReady && !deckReadySubmitting) toggleDeckCard(card.cardNo); }} onPreview={setDeckPreviewCard} onPreviewEnd={() => setDeckPreviewCard(null)} />;
        })}</div>} />
        {currentRoom && <BattleArenaChatFrame arenaSelector=".triad-deck-screen" cinematicActive={false}><BattleRoomChatPanel room={currentRoom} currentUserId={participant.id} rankProfiles={rankProfiles} onSend={sendRoomChat} compact /></BattleArenaChatFrame>}
        <CardHoverPreview card={deckPreviewCard} onClose={() => setDeckPreviewCard(null)} passive variant="deck" />
      </main>
    );
  }

  return (
    <BattleArenaSurface image={arena.image} className={`triad-dominion-game ${isSpectator ? "triad-spectator-mode" : ""} ${spectatorDeckSelectionWaiting ? "triad-spectator-deck-waiting" : ""} relative h-full min-h-0 max-w-full overflow-x-hidden overflow-y-auto rounded-[20px] border border-white/8 bg-[#06080d] text-white shadow-[0_26px_90px_rgba(0,0,0,0.42)] sm:rounded-[24px]`}>
      <BattleVersusIntro sessionKey={battleSessionKey} enabled={(currentRoom ? bothDecksReady : phase === "battle") && !matchDone && (currentRoom?.game.fightNo || fightNo) === 1 && (currentRoom?.game.activeTurn || activeTurn) === 1} left={currentRoom?.seats.host || participant} right={currentRoom?.seats.challenger || {name:"BOT Level.99",image:"/avatar.png"}} ranks={{left:profileForParticipant(currentRoom?.seats.host || participant,rankProfiles)?.rankName,right:profileForParticipant(currentRoom?.seats.challenger,rankProfiles)?.rankName}} />
      <BattleForfeitVictory result={currentRoom?.game.forfeit} userId={participant.id} onExit={() => { void leaveRoom(); }} />
      {currentRoom ? <BattleRoomChatHud key={currentRoom.code} room={currentRoom} currentUserId={participant.id} rankProfiles={rankProfiles} onSend={sendRoomChat} cinematicActive={cinematicActive} /> : null}
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
      {matchFinalVisible && !currentRoom?.game.forfeit ? (
        <BattleMatchResult title={neutralWinnerText} detail={surrenderedLabel ? `${surrenderedLabel} ยอมแพ้` : "การแข่งขันสิ้นสุด"} score={[finalMatchScore.player,finalMatchScore.bot]} draw={finalMatchScore.player === finalMatchScore.bot && !forcedWinnerSide} onExit={leaveRoom}>
          {currentRoom?.game.rankUpEvents?.map(event => <p className="nexora-result-rank" key={`${event.userId}:${event.at}`}>{event.name} เลื่อนสู่ {event.rankName} · {event.wins.toLocaleString()} ชัยชนะ</p>)}
        </BattleMatchResult>
      ) : null}
      {canUseGmRescuePanel ? (
        <GmRescuePanel
          open={gmPanelOpen}
          confirmAction={gmConfirmAction}
          submitting={gmSubmitting}
          onToggle={() => setGmPanelOpen((current) => !current)}
          onAskConfirm={setGmConfirmAction}
          onCancel={() => setGmConfirmAction(null)}
          onConfirm={confirmGmRescueAction}
        />
      ) : null}
      <OpeningTieBreakOverlay
        tieBreak={!cinematicActive && currentRoom?.game.activeTurn === 1 ? currentRoom?.game.openerTieBreak : null}
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
        visible={openingTieBreakResultVisible && !cinematicActive}
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
      {deckSelectionActive && !isSpectator ? (
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
      <BattleArenaHeader title={TRIAD_TITLE} code={currentRoom?.code} time={`${Math.floor(displayTimeLeft / 60)}:${String(displayTimeLeft % 60).padStart(2, "0")}`} onExit={leaveRoom} onSurrender={currentRoom && isFieldPlayer && !matchDone ? surrenderBattle : undefined} />
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
          {deckSelectionActive && !isSpectator ? (
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
            <div className="triad-spectator-live-stack grid gap-2 sm:gap-3">
              {!spectatorDeckSelectionWaiting ? (
                <SpectatorDeckStrip title={`ฝั่งบน · ${displayBotName}`} cards={displayBotDeckCards} tone="top" onPreview={setSpectatorPreviewCard} onPreviewEnd={() => setSpectatorPreviewCard(null)} />
              ) : null}
              <div className="triad-spectator-board-shell relative min-h-0">
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
                  battleActive={phase === "battle" && !deckSelectionActive}
                  onCinematicActivity={setCinematicActive}
                  onCinematicComplete={setCompletedCinematicTurn}
                  battleSessionKey={battleSessionKey}
                  arena={arena}
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
                {spectatorDeckSelectionWaiting ? (
                  <div className="triad-spectator-waiting-overlay pointer-events-none absolute inset-x-3 top-3 z-[86] flex flex-col gap-3 sm:inset-x-5 sm:top-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-[min(620px,100%)] rounded-2xl border border-amber-100/22 bg-black/62 px-4 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.38),0_0_38px_rgba(251,191,36,0.1)] backdrop-blur-md">
                      <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-amber-100/62">
                        <Clock3 className="h-3.5 w-3.5 text-amber-300" />
                        กำลังเลือกเด็ค
                      </div>
                      <div className="mt-1 text-base font-black text-white sm:text-xl">
                        {currentRoom?.seats.host?.name || "ฝั่งบน"} และ {currentRoom?.seats.challenger?.name || "ฝั่งล่าง"} กำลังเตรียมเด็ค
                      </div>
                      <div className="mt-1 text-xs font-semibold leading-5 text-white/58">
                        ผู้ชมเห็นสนามจริงได้ทันที เกมจะเริ่มเมื่อทั้งสองฝั่งกดพร้อมครบ
                      </div>
                    </div>
                    <div className="w-fit rounded-2xl border border-amber-100/22 bg-black/68 px-4 py-3 text-left shadow-[0_18px_60px_rgba(0,0,0,0.38)] backdrop-blur-md lg:text-right">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-100/52">เวลาเลือกเด็ค</div>
                      <div className="text-4xl font-black leading-none text-amber-100 sm:text-5xl">{deckTimerText}</div>
                    </div>
                  </div>
                ) : null}
              </div>
              {!spectatorDeckSelectionWaiting ? (
                <SpectatorDeckStrip title={`ฝั่งล่าง · ${displayPlayerName}`} cards={displayPlayerDeckCards} tone="bottom" onPreview={setSpectatorPreviewCard} onPreviewEnd={() => setSpectatorPreviewCard(null)} />
              ) : null}
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
              battleActive={phase === "battle" && !deckSelectionActive}
              onCinematicActivity={setCinematicActive}
              onCinematicComplete={setCompletedCinematicTurn}
              battleSessionKey={battleSessionKey}
              arena={arena}
              turnLocked={handPlacementLocked}
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
          )}
          <BlessingChoiceOverlay card={pendingBlessingChoice && !pendingBlessingChoice.choice ? cardsByNo.get("254") : undefined} onChoose={chooseBlessing} />

          {!isSpectator ? (
            <PlayerHand
              cards={playerDeckCards}
              usedSet={displayUsedPlayerSet}
              player={player}
              placementLane={placementLane}
              activeLane={laneForTurn(activeTurn)}
              locked={handPlacementLocked}
              highlightCardNo={displayRandomDrawCardNo}
              onSelectLane={setPlacementLane}
              onPlayCard={placeCardFromHand}
              onDropToLane={placeAndLockCard}
            />
          ) : null}

          <div className="triad-game-status grid gap-3 md:grid-cols-[1fr_auto] md:items-stretch">
              <div className="rounded-xl border border-white/8 bg-black/24 p-4">
                {matchFinalVisible ? (
                  <div className="flex items-center gap-3">
                    <Trophy className="h-7 w-7 text-amber-300" />
                    <div>
                      <div className="text-2xl font-black">{neutralWinnerText}</div>
                      <div className="text-sm font-semibold text-white/52">
                        คะแนนรวม {displayMatchScore.player}-{displayMatchScore.bot}
                      </div>
                    </div>
                  </div>
                ) : displayCurrentResult && activeTurnScored ? (
                  <div>
                    <ResultBanner
                      result={displayCurrentResult}
                      activeTurn={displayActiveTurn}
                      playerName={neutralPlayerLabel}
                      opponentName={neutralOpponentLabel}
                    />
                    {isPvpRoom && opponentTurnReady && !myTurnReady ? (
                      <div className="mt-3 flex items-center gap-2 rounded-2xl border border-emerald-200/24 bg-emerald-300/10 px-3 py-2 text-xs font-black text-emerald-100 shadow-[0_0_30px_rgba(16,185,129,0.14)]">
                        <Check className="h-4 w-4 shrink-0" />
                        <span>อีกฝ่ายดูผลการปะทะจบแล้ว</span>
                      </div>
                    ) : null}
                    <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-amber-200/20 bg-amber-200/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-amber-100">
                      {cinematicActive ? "กำลังแสดงผลการปะทะ" : "กำลังเข้าสู่ตาถัดไปอัตโนมัติ"}
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
                {matchFinalVisible ? (
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
                ) : activeTurnScored ? null : (
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

        </section>

        <aside className="hidden min-h-0 flex-col gap-3 overflow-visible 2xl:flex 2xl:h-[calc(100vh-136px)] 2xl:max-h-[calc(100vh-136px)]">

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
    </BattleArenaSurface>
  );
}
