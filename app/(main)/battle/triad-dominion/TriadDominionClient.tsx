"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  Bot,
  Brain,
  Check,
  ChevronRight,
  Flame,
  Layers3,
  Lock,
  RotateCcw,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Zap,
} from "lucide-react";
import {
  resolveTriadTurn,
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
};

type BattlePhase = "deck" | "battle";
type Side = "player" | "bot";
type Lane = "top" | "left" | "right";

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

const elementStyles: Record<TriadElement, string> = {
  earth: "border-amber-500/40 bg-amber-500/10 text-amber-100",
  fire: "border-rose-500/40 bg-rose-500/10 text-rose-100",
  gold: "border-yellow-300/40 bg-yellow-300/10 text-yellow-100",
  wood: "border-emerald-400/40 bg-emerald-400/10 text-emerald-100",
  water: "border-cyan-400/40 bg-cyan-400/10 text-cyan-100",
  unknown: "border-white/15 bg-white/8 text-white/60",
};

const elementLabel: Record<TriadElement, string> = {
  earth: "EARTH",
  fire: "FIRE",
  gold: "GOLD",
  wood: "WOOD",
  water: "WATER",
  unknown: "UNKNOWN",
};

function uniqueByNo(cards: CardView[]) {
  const seen = new Set<string>();
  return cards.filter((card) => {
    if (seen.has(card.cardNo)) return false;
    seen.add(card.cardNo);
    return true;
  });
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
  if (!card) return "Empty";
  return `ATK ${card.attack.toLocaleString()} / SUP ${card.support.toLocaleString()}`;
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

function chooseBotDeck(monsters: CardView[], playerDeck: string[]) {
  const blocked = new Set(playerDeck);
  return monsters
    .filter((card) => !blocked.has(card.cardNo))
    .sort((a, b) => b.attack + b.support - (a.attack + a.support))
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

function hiddenCard() {
  return (
    <div className="grid aspect-[3/4] place-items-center overflow-hidden rounded-2xl border border-cyan-200/20 bg-[radial-gradient(circle_at_50%_25%,rgba(34,211,238,0.28),rgba(7,12,22,0.98)_58%)] shadow-[0_22px_60px_rgba(0,0,0,0.38)]">
      <div className="text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-cyan-200/20 bg-cyan-200/10">
          <Lock className="h-7 w-7 text-cyan-100" />
        </div>
        <div className="mt-3 text-xs font-black uppercase tracking-[0.22em] text-white/48">
          Hidden
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
        <div className="truncate text-sm font-black text-white">No.{card.cardNo} {card.name}</div>
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
        <div className="truncate text-xs font-black text-white">No.{card.cardNo} {card.name}</div>
        <div className="mt-1 truncate text-[11px] font-semibold text-white/58">{cardLabel(card)}</div>
        <div className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black ${elementStyles[card.element]}`}>
          {elementLabel[card.element]}
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
          Base 3
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
          <span className="rounded-md border border-white/10 bg-black/30 px-2 py-1">DECK {deckLeft}</span>
          <span className="rounded-md border border-white/10 bg-black/30 px-2 py-1">HP 200</span>
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
    ["SET", 0],
    ["TURN 1", 1],
    ["TURN 2", 2],
    ["TURN 3", 3],
    ["END", 4],
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
              {hidden ? "Hidden" : label}
            </div>
          </div>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-black/72 px-1.5 py-1 text-center text-[9px] font-black uppercase tracking-[0.08em] text-white/74">
        {card && !hidden ? `No.${card.cardNo}` : label}
      </div>
    </div>
  );
}

function BoardPile({
  label,
  sublabel,
  tone,
  rotate,
}: {
  label: string;
  sublabel: string;
  tone: "red" | "blue" | "gold";
  rotate?: boolean;
}) {
  const color =
    tone === "red"
      ? "border-red-500/70"
      : tone === "blue"
        ? "border-cyan-400/70"
        : "border-amber-400/70";

  return (
    <div
      className={`grid w-[clamp(54px,7vw,94px)] place-items-center rounded-lg border bg-[#08080c] shadow-[0_16px_34px_rgba(0,0,0,0.36)] ${color} ${
        rotate ? "rotate-180" : ""
      }`}
      style={{ aspectRatio: "3 / 4" }}
    >
      <div className="text-center">
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
}) {
  const playerTriangle = lockedFight?.player || player;
  const botTriangle = lockedFight?.bot || { top: "", left: "", right: "" };
  const activeLane = laneForTurn(activeTurn);
  const botVisible = (lane: Lane) => Boolean(revealed[turnForLane(lane)]?.bot);

  return (
    <div className="relative h-full min-h-0 overflow-hidden rounded-[24px] border border-amber-100/14 bg-[#0a0908] shadow-[0_28px_90px_rgba(0,0,0,0.55)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(251,191,36,0.12),transparent_20%),radial-gradient(circle_at_20%_30%,rgba(124,58,237,0.18),transparent_16%),radial-gradient(circle_at_78%_70%,rgba(14,165,233,0.14),transparent_18%),repeating-linear-gradient(90deg,rgba(255,255,255,0.03)_0,rgba(255,255,255,0.03)_1px,transparent_1px,transparent_42px),linear-gradient(180deg,#171008,#050506)]" />
      <div className="absolute inset-x-0 top-0 h-[13%] border-b border-amber-100/20 bg-[linear-gradient(180deg,rgba(255,244,214,0.34),rgba(0,0,0,0.18))]" />
      <div className="absolute inset-x-0 bottom-0 h-[13%] border-t border-amber-100/20 bg-[linear-gradient(0deg,rgba(255,244,214,0.34),rgba(0,0,0,0.18))]" />
      <div className="absolute left-1/2 top-0 h-full w-[9%] -translate-x-1/2 border-x border-amber-100/14 bg-black/20" />

      <div className="relative grid h-full min-h-0 grid-rows-[15%_23%_1fr_23%_15%] px-[clamp(8px,2vw,28px)] py-[clamp(8px,1.5vw,18px)]">
        <div className="flex items-center justify-between gap-3">
          <FighterPanel name="NEXORA BOT" score={matchScore.bot} tone="bot" deckLeft={botDeckLeft} side="left" />
          <div className="hidden rounded-2xl border border-white/10 bg-black/38 px-4 py-2 text-center sm:block">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/42">Fight</div>
            <div className="text-2xl font-black text-white">{Math.min(fightNo, 3)} / 3</div>
          </div>
        </div>

        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <BoardPile label="Grave" sublabel="bot" tone="red" rotate />
          <div className="flex justify-center gap-[clamp(10px,2vw,28px)]">
            <BoardCardSlot card={cardsByNo.get(botTriangle.top)} hidden={!botVisible("top")} active={activeLane === "top"} label="TOP" tone="bot" />
            <BoardCardSlot card={botTriangle.left ? cardsByNo.get(botTriangle.left) : undefined} hidden={!botVisible("left")} active={activeLane === "left"} label="ATK" tone="bot" />
            <BoardCardSlot card={botTriangle.right ? cardsByNo.get(botTriangle.right) : undefined} hidden={!botVisible("right")} active={activeLane === "right"} label="SUP" tone="bot" />
          </div>
          <BoardPile label="Deck" sublabel={`${botDeckLeft}`} tone="blue" rotate />
        </div>

        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <div className="hidden sm:block">
            <BoardPile label="Deck" sublabel={`${playerDeckLeft}`} tone="blue" />
          </div>
          <div className="mx-auto w-full max-w-[720px]">
            <PhaseTrack activeTurn={activeTurn} />
            <div className="mt-2 text-center text-xs font-black uppercase tracking-[0.16em] text-amber-100/58">
              Match {matchScore.player}-{matchScore.bot} / Fight {fightScore.player}-{fightScore.bot}
            </div>
          </div>
          <div className="hidden sm:block">
            <BoardPile label="Grave" sublabel="admin" tone="red" />
          </div>
        </div>

        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
          <BoardPile label="Deck" sublabel={`${playerDeckLeft}`} tone="blue" />
          <div className="flex justify-center gap-[clamp(10px,2vw,28px)]">
            <BoardCardSlot card={cardsByNo.get(playerTriangle.top)} active={activeLane === "top"} label="TOP" tone="player" />
            <BoardCardSlot card={playerTriangle.left ? cardsByNo.get(playerTriangle.left) : undefined} active={activeLane === "left"} label="ATK" tone="player" />
            <BoardCardSlot card={playerTriangle.right ? cardsByNo.get(playerTriangle.right) : undefined} active={activeLane === "right"} label="SUP" tone="player" />
          </div>
          <BoardPile label="Grave" sublabel="admin" tone="red" />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="hidden rounded-2xl border border-white/10 bg-black/38 px-4 py-2 text-center sm:block">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/42">Turn</div>
            <div className="text-2xl font-black text-white">{activeTurn}</div>
          </div>
          <FighterPanel name="ADMIN" score={matchScore.player} tone="player" deckLeft={playerDeckLeft} side="right" />
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

export default function TriadDominionClient({ cards, reviewSkills, summary }: Props) {
  const cardsByNo = useMemo(() => new Map(cards.map((card) => [card.cardNo, card])), [cards]);
  const monsters = useMemo(
    () => uniqueByNo(cards.filter((card) => card.kind === "monster")),
    [cards]
  );

  const defaultDeck = useMemo(
    () =>
      monsters
        .slice()
        .sort((a, b) => b.attack + b.support - (a.attack + a.support))
        .slice(0, DECK_SIZE)
        .map((card) => card.cardNo),
    [monsters]
  );

  const [phase, setPhase] = useState<BattlePhase>("deck");
  const [playerDeck, setPlayerDeck] = useState<string[]>(defaultDeck);
  const [botDeck, setBotDeck] = useState<string[]>([]);
  const [usedPlayerCards, setUsedPlayerCards] = useState<string[]>([]);
  const [usedBotCards, setUsedBotCards] = useState<string[]>([]);
  const [player, setPlayer] = useState<TriadTriangle>({ top: "", left: "", right: "" });
  const [lockedFight, setLockedFight] = useState<LockedFight | null>(null);
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
  const availablePlayerCards = playerDeckCards.filter((card) => !usedPlayerSet.has(card.cardNo));
  const availableBotCards = botDeckCards.filter((card) => !usedBotSet.has(card.cardNo));
  const currentResult = lockedFight?.turns.find((turn) => turn.turn === activeTurn);
  const fightScore = lockedFight ? getFightScore(lockedFight.turns, revealed) : { player: 0, bot: 0 };
  const matchDone = fightNo > 3;
  const winnerText =
    matchScore.player === matchScore.bot
      ? "MATCH DRAW"
      : matchScore.player > matchScore.bot
        ? "ADMIN WINS"
        : "NEXORA BOT WINS";

  const toggleDeckCard = (cardNo: string) => {
    setPlayerDeck((current) => {
      if (current.includes(cardNo)) return current.filter((item) => item !== cardNo);
      if (current.length >= DECK_SIZE) return current;
      return [...current, cardNo];
    });
  };

  const enterBattle = () => {
    if (playerDeck.length !== DECK_SIZE) return;

    const nextBotDeck = chooseBotDeck(monsters, playerDeck);
    const firstCards = playerDeck.slice(0, 3);
    setBotDeck(nextBotDeck);
    setPlayer({ top: firstCards[0] || "", left: firstCards[1] || "", right: firstCards[2] || "" });
    setPhase("battle");
    setBattleLog(["Deck locked. Entered the Triad Dominion arena."]);
  };

  const resetBattle = () => {
    const nextDefault = defaultDeck;
    setPhase("deck");
    setPlayerDeck(nextDefault);
    setBotDeck([]);
    setUsedPlayerCards([]);
    setUsedBotCards([]);
    setPlayer({ top: "", left: "", right: "" });
    setLockedFight(null);
    setActiveTurn(1);
    setRevealed(emptyRevealState());
    setLastTurnWinner(null);
    setFightNo(1);
    setMatchScore({ player: 0, bot: 0 });
    setBattleLog([]);
  };

  const setPlayerLane = (lane: Lane, cardNo: string) => {
    setPlayer((current) => ({ ...current, [lane]: cardNo }));
  };

  const lockFight = () => {
    const selectedCards = [player.top, player.left, player.right].filter(Boolean);
    if (selectedCards.length !== 3 || new Set(selectedCards).size !== 3) {
      setBattleLog((current) => ["Choose 3 different monster cards before locking the fight.", ...current]);
      return;
    }

    const bot = chooseBotTriangle(player, availableBotCards);
    const turns = ([1, 2, 3] as TriadTurn[]).map((turn) =>
      resolveTriadTurn({ turn, player, opponent: bot })
    );

    setLockedFight({ fightNo, player, bot, turns });
    setActiveTurn(1);
    setRevealed(emptyRevealState());
    setLastTurnWinner(null);
    setBattleLog((current) => [
      `Fight ${fightNo}: both sides locked 3 cards. Turn 1 opens together.`,
      ...current,
    ]);
  };

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
      `Turn ${turn}: ${winner === "draw" ? "draw" : `${winner} scores`} (${result.playerTotal.toLocaleString()} vs ${result.opponentTotal.toLocaleString()})`,
      ...current,
    ]);

    return {
      ...nextReveal,
      [turn]: { ...state, scored: true },
    };
  };

  const revealNext = () => {
    if (!lockedFight) return;

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
    if (activeTurn < 3) setActiveTurn((activeTurn + 1) as TriadTurn);
  };

  const nextFight = () => {
    if (!lockedFight) return;

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

    setUsedPlayerCards(Array.from(new Set(nextUsedPlayer)));
    setUsedBotCards(Array.from(new Set(nextUsedBot)));
    setLockedFight(null);
    setActiveTurn(1);
    setRevealed(emptyRevealState());
    setLastTurnWinner(null);
    setFightNo((current) => current + 1);
    setPlayer({
      top: nextAvailablePlayer[0]?.cardNo || "",
      left: nextAvailablePlayer[1]?.cardNo || "",
      right: nextAvailablePlayer[2]?.cardNo || "",
    });
  };

  const revealState = revealed[activeTurn];
  const activeTurnScored = Boolean(revealState?.scored);
  const needsSecondReveal =
    lockedFight &&
    activeTurn > 1 &&
    lastTurnWinner !== null &&
    lastTurnWinner !== "draw" &&
    (revealState.player !== revealState.bot);
  const revealButtonLabel =
    !lockedFight
      ? "Lock cards first"
      : activeTurn === 1 || lastTurnWinner === null || lastTurnWinner === "draw"
        ? "Reveal Both"
        : needsSecondReveal
          ? "Reveal Counter"
          : lastTurnWinner === "bot"
            ? "Bot Opens"
            : "Admin Opens";

  if (phase === "deck") {
    return (
      <main className="min-h-[calc(var(--app-shell-height)-var(--app-header-height)-var(--app-mobile-nav-height))] overflow-hidden rounded-[24px] border border-white/8 bg-[#050710] text-white shadow-[0_26px_90px_rgba(0,0,0,0.42)]">
        <section className="relative overflow-hidden border-b border-white/8 px-4 py-5 sm:px-6 lg:px-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(245,158,11,0.22),transparent_26%),radial-gradient(circle_at_80%_18%,rgba(34,211,238,0.18),transparent_24%),linear-gradient(180deg,#08111e,#050710)]" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-amber-200">
                <Layers3 className="h-3.5 w-3.5" />
                Deck Setup
              </div>
              <h1 className="text-[clamp(2.2rem,8vw,6rem)] font-black uppercase leading-[0.88] tracking-normal">
                Choose Your Deck
              </h1>
              <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-white/60 sm:text-base">
                Pick 9 unique monster cards for 3 fights. Each card can be used once in the match.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/42">
                Selected
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
                Enter Arena
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[1fr_280px] lg:p-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {monsters.slice(0, 90).map((card) => {
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

          <aside className="rounded-2xl border border-white/8 bg-white/[0.035] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-white">
              <Sparkles className="h-4 w-4 text-amber-300" />
              Current Deck
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
                    <div className="truncate text-sm font-black text-white">No.{card.cardNo} {card.name}</div>
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
    <main className="h-[calc(var(--app-shell-height)-var(--app-header-height)-var(--app-mobile-nav-height))] overflow-hidden rounded-[24px] border border-white/8 bg-[#06080d] text-white shadow-[0_26px_90px_rgba(0,0,0,0.42)] xl:h-[calc(var(--app-shell-height)-var(--app-desktop-chrome-height))]">
      <section className="hidden relative overflow-hidden border-b border-white/8 bg-[#070b12] px-4 py-5 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(245,158,11,0.22),transparent_28%),radial-gradient(circle_at_82%_4%,rgba(14,165,233,0.16),transparent_26%),linear-gradient(135deg,rgba(255,255,255,0.04),transparent)]" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-amber-200">
              <Swords className="h-3.5 w-3.5" />
              Admin Test Arena
            </div>
            <h1 className="text-[clamp(2.1rem,8vw,6.2rem)] font-black uppercase leading-[0.88] tracking-normal">
              Triad Dominion
            </h1>
            <p className="mt-4 max-w-2xl text-sm font-semibold leading-6 text-white/62 sm:text-base">
              Fight 3 battles, 9 turns total. Turn 1 opens together; after that, the previous turn winner opens first.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 xl:min-w-[560px]">
            {[
              ["MATCH", `${matchScore.player}-${matchScore.bot}`],
              ["FIGHT", Math.min(fightNo, 3)],
              ["DECK", `${playerDeck.length}/${DECK_SIZE}`],
              ["CARDS", summary.totalCards],
              ["REVIEW", summary.reviewSkills],
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

      <section className="grid h-full min-h-0 gap-3 p-2 sm:p-3 xl:grid-cols-[260px_minmax(0,1fr)_240px]">
        <aside className="min-h-0 space-y-3 overflow-hidden">
          <div className="rounded-xl border border-white/8 bg-white/[0.035] p-4">
            <div className="mb-4 flex items-center gap-2">
              <Layers3 className="h-5 w-5 text-amber-300" />
              <div>
                <div className="text-lg font-black">Choose Fight Cards</div>
                <div className="text-sm font-semibold text-white/45">3 different cards from your deck</div>
              </div>
            </div>
            <div className="space-y-3">
              {(["top", "left", "right"] as Lane[]).map((lane, index) => (
                <label key={lane} className="block">
                  <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/42">
                    {index === 0 ? "Turn 1 top" : index === 1 ? "Turn 2 attack" : "Turn 3 support"}
                  </span>
                  <select
                    value={player[lane] || ""}
                    onChange={(event) => setPlayerLane(lane, event.target.value)}
                    disabled={Boolean(lockedFight) || matchDone}
                    className="h-11 w-full rounded-lg border border-white/10 bg-[#0b1017] px-3 text-sm font-bold text-white outline-none transition focus:border-amber-300/70 disabled:opacity-45"
                  >
                    {availablePlayerCards
                      .filter((card) => card.cardNo === player[lane] || ![player.top, player.left, player.right].includes(card.cardNo))
                      .map((card) => (
                        <option key={card.cardNo} value={card.cardNo} className="bg-[#10141c]">
                          No.{card.cardNo} {card.name}
                        </option>
                      ))}
                  </select>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={lockFight}
              disabled={Boolean(lockedFight) || matchDone}
              className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-amber-300 px-4 text-sm font-black text-black shadow-[0_18px_34px_rgba(245,158,11,0.22)] transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-white/32"
            >
              <Brain className="h-4 w-4" />
              Lock Fight vs AI
            </button>
          </div>

          <div className="rounded-xl border border-white/8 bg-white/[0.035] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-white">
              <Flame className="h-4 w-4 text-amber-300" />
              Reveal Rule
            </div>
            <div className="space-y-2 text-sm font-semibold leading-6 text-white/56">
              <p>Turn 1: both sides open together.</p>
              <p>Turn 2-3: previous winner opens first. If draw, both open together.</p>
            </div>
          </div>
        </aside>

        <section className="grid min-h-0 grid-rows-[minmax(0,1fr)_auto] gap-3">
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
          />

          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-stretch">
              <div className="rounded-xl border border-white/8 bg-black/24 p-4">
                {matchDone ? (
                  <div className="flex items-center gap-3">
                    <Trophy className="h-7 w-7 text-amber-300" />
                    <div>
                      <div className="text-2xl font-black">{winnerText}</div>
                      <div className="text-sm font-semibold text-white/52">
                        Final score {matchScore.player}-{matchScore.bot}
                      </div>
                    </div>
                  </div>
                ) : currentResult && activeTurnScored ? (
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-lg font-black">
                      {currentResult.winner === "draw" ? (
                        <Shield className="h-5 w-5 text-white/55" />
                      ) : currentResult.winner === "player" ? (
                        <Zap className="h-5 w-5 text-emerald-300" />
                      ) : (
                        <Zap className="h-5 w-5 text-rose-300" />
                      )}
                      {currentResult.winner === "draw"
                        ? "Turn draw"
                        : currentResult.winner === "player"
                          ? "Admin scores 1"
                          : "Bot scores 1"}
                    </div>
                    <div className="text-sm font-semibold text-white/52">
                      Turn {activeTurn}: {currentResult.playerTotal.toLocaleString()} vs {currentResult.opponentTotal.toLocaleString()}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-lg font-black">
                      <Flame className="h-5 w-5 text-amber-300" />
                      {lockedFight ? "Ready to reveal" : "Waiting for lock"}
                    </div>
                    <div className="text-sm font-semibold text-white/52">
                      {lockedFight
                        ? revealButtonLabel
                        : "Choose 3 cards and lock the fight before opening cards."}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {matchDone ? (
                  <button
                    type="button"
                    onClick={resetBattle}
                    className="inline-flex h-full min-h-14 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-black transition hover:bg-amber-100"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Restart
                  </button>
                ) : lockedFight && revealed[3].scored ? (
                  <button
                    type="button"
                    onClick={nextFight}
                    className="inline-flex h-full min-h-14 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-black transition hover:bg-amber-100"
                  >
                    {fightNo >= 3 ? "Finish Match" : "Next Fight"}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : lockedFight && activeTurnScored && activeTurn < 3 ? (
                  <button
                    type="button"
                    onClick={nextTurn}
                    className="inline-flex h-full min-h-14 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-black transition hover:bg-amber-100"
                  >
                    Next Turn
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={revealNext}
                    disabled={!lockedFight || activeTurnScored}
                    className="inline-flex h-full min-h-14 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-black transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-white/32"
                  >
                    {revealButtonLabel}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </div>
          </div>

          {currentResult && activeTurnScored ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-emerald-300/16 bg-emerald-300/[0.05] p-4">
                <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-100/70">
                  Admin calculation
                </div>
                {currentResult.playerBreakdown.map((line) => (
                  <div key={line} className="text-sm font-semibold leading-6 text-white/62">
                    {line}
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-rose-300/16 bg-rose-300/[0.05] p-4">
                <div className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-rose-100/70">
                  Bot calculation
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

        <aside className="space-y-4">
          <div className="rounded-xl border border-white/8 bg-white/[0.035] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-white">
              <Trophy className="h-4 w-4 text-amber-300" />
              Battle Log
            </div>
            <div className="max-h-[360px] space-y-2 overflow-auto pr-1">
              {battleLog.length > 0 ? (
                battleLog.map((line, index) => (
                  <div key={`${line}-${index}`} className="rounded-lg border border-white/8 bg-black/22 p-3 text-xs font-semibold leading-5 text-white/58">
                    {line}
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-white/8 bg-black/22 p-3 text-sm font-semibold text-white/42">
                  No battle events yet.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-white/8 bg-white/[0.035] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-white">
              <Bot className="h-4 w-4 text-cyan-200" />
              Bot Deck
            </div>
            <div className="grid grid-cols-3 gap-2">
              {botDeckCards.map((card) => {
                const used = usedBotSet.has(card.cardNo);
                return (
                  <div key={card.cardNo} className={`rounded-lg border p-2 text-center text-xs font-black ${used ? "border-white/8 bg-white/5 text-white/24" : "border-cyan-300/18 bg-cyan-300/8 text-white/70"}`}>
                    {used ? "USED" : "LOCKED"}
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
