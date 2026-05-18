"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Brain,
  CheckCircle2,
  ChevronRight,
  Cpu,
  Flame,
  Layers3,
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

type LockedFight = {
  fightNo: number;
  player: TriadTriangle;
  bot: TriadTriangle;
  turns: TriadTurnResult[];
};

const elementStyles: Record<TriadElement, string> = {
  earth: "border-amber-500/35 bg-amber-500/10 text-amber-100",
  fire: "border-rose-500/35 bg-rose-500/10 text-rose-100",
  gold: "border-yellow-300/35 bg-yellow-300/10 text-yellow-100",
  wood: "border-emerald-400/35 bg-emerald-400/10 text-emerald-100",
  water: "border-cyan-400/35 bg-cyan-400/10 text-cyan-100",
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

function cardLabel(card?: CardView) {
  if (!card) return "Empty";
  if (card.kind === "skill") return "SKILL";
  return `ATK ${card.attack.toLocaleString()} / SUP ${card.support.toLocaleString()}`;
}

function uniqueByNo(cards: CardView[]) {
  const seen = new Set<string>();
  return cards.filter((card) => {
    if (seen.has(card.cardNo)) return false;
    seen.add(card.cardNo);
    return true;
  });
}

function getWinnerPoints(turns: TriadTurnResult[]) {
  return turns.reduce(
    (score, turn) => {
      if (turn.winner === "player") score.player += 1;
      if (turn.winner === "opponent") score.bot += 1;
      return score;
    },
    { player: 0, bot: 0 }
  );
}

function chooseBotTriangle(
  player: TriadTriangle,
  monsters: CardView[],
  playable: CardView[],
  usedCards: Set<string>
): TriadTriangle {
  const openMonsters = monsters
    .filter((card) => !usedCards.has(card.cardNo) && card.cardNo !== player.top)
    .sort((a, b) => b.attack + b.support - (a.attack + a.support))
    .slice(0, 18);
  const openPlayable = playable
    .filter((card) => !usedCards.has(card.cardNo))
    .filter((card) => ![player.top, player.left, player.right].includes(card.cardNo))
    .sort((a, b) => {
      const aPower = a.kind === "monster" ? a.attack + a.support : a.skillText.length;
      const bPower = b.kind === "monster" ? b.attack + b.support : b.skillText.length;
      return bPower - aPower;
    })
    .slice(0, 34);

  let best: { triangle: TriadTriangle; points: number; total: number } | null = null;

  for (const top of openMonsters) {
    for (const left of openPlayable) {
      if (left.cardNo === top.cardNo) continue;
      for (const right of openPlayable) {
        if (right.cardNo === top.cardNo || right.cardNo === left.cardNo) continue;

        const bot = { top: top.cardNo, left: left.cardNo, right: right.cardNo };
        const turns = ([1, 2, 3] as TriadTurn[]).map((turn) =>
          resolveTriadTurn({ turn, player, opponent: bot })
        );
        const score = getWinnerPoints(turns);
        const total = turns.reduce((sum, turn) => sum + turn.opponentTotal - turn.playerTotal, 0);
        const candidate = { triangle: bot, points: score.bot - score.player, total };

        if (!best || candidate.points > best.points || (candidate.points === best.points && candidate.total > best.total)) {
          best = candidate;
        }
      }
    }
  }

  return (
    best?.triangle || {
      top: openMonsters[0]?.cardNo || "006",
      left: openPlayable[0]?.cardNo || "016",
      right: openPlayable[1]?.cardNo || "017",
    }
  );
}

function CardSelect({
  label,
  value,
  cards,
  onChange,
}: {
  label: string;
  value?: string;
  cards: CardView[];
  onChange: (value: string) => void;
}) {
  const selected = cards.find((card) => card.cardNo === value);

  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-white/42">
        {label}
      </span>
      <select
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-lg border border-white/10 bg-[#0b1017] px-3 text-sm font-bold text-white outline-none transition focus:border-amber-300/70"
      >
        {cards.map((card) => (
          <option key={card.cardNo} value={card.cardNo} className="bg-[#10141c]">
            No.{card.cardNo} {card.name}
          </option>
        ))}
      </select>
      <div className="mt-2 flex items-center justify-between gap-2 text-xs font-semibold text-white/52">
        <span>{cardLabel(selected)}</span>
        {selected ? (
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${elementStyles[selected.element]}`}>
            {elementLabel[selected.element]}
          </span>
        ) : null}
      </div>
    </label>
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
  if (!card || hidden) {
    return (
      <div className="grid aspect-[3/4] place-items-center overflow-hidden rounded-lg border border-white/10 bg-[radial-gradient(circle_at_50%_24%,rgba(245,158,11,0.22),rgba(13,18,27,0.96)_58%)] shadow-[0_18px_44px_rgba(0,0,0,0.25)]">
        <div className="text-center">
          <Sparkles className="mx-auto h-8 w-8 text-amber-300/80" />
          <div className="mt-2 text-xs font-black uppercase tracking-[0.2em] text-white/45">
            Locked
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-lg border bg-black/45 shadow-[0_18px_44px_rgba(0,0,0,0.28)] transition ${
        active ? "border-amber-300/80 ring-2 ring-amber-300/30" : "border-white/10"
      }`}
    >
      <div className="relative aspect-[3/4] bg-black/45">
        <Image src={card.sourceImage} alt={card.name} fill sizes="180px" className="object-cover" />
      </div>
      <div className="space-y-1 p-2">
        <div className="truncate text-xs font-black text-white">No.{card.cardNo} {card.name}</div>
        <div className="truncate text-[11px] font-semibold text-white/55">{cardLabel(card)}</div>
      </div>
    </div>
  );
}

function TriangleArena({
  title,
  triangle,
  cardsByNo,
  activeTurn,
  reveal,
  bot,
}: {
  title: string;
  triangle: TriadTriangle;
  cardsByNo: Map<string, CardView>;
  activeTurn: TriadTurn;
  reveal: boolean;
  bot?: boolean;
}) {
  const activeLane = activeTurn === 1 ? "top" : activeTurn === 2 ? "left" : "right";

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.035] p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-black text-white">
          {bot ? <Bot className="h-4 w-4 text-rose-200" /> : <Shield className="h-4 w-4 text-emerald-200" />}
          {title}
        </div>
        <div className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/42">
          Base 3
        </div>
      </div>

      <div className="mx-auto grid max-w-[330px] grid-cols-2 gap-3">
        <div className="col-span-2 mx-auto w-[46%]">
          <BattleCard card={cardsByNo.get(triangle.top)} active={activeLane === "top"} hidden={bot && !reveal && activeTurn === 1} />
        </div>
        <BattleCard card={triangle.left ? cardsByNo.get(triangle.left) : undefined} active={activeLane === "left"} hidden={bot && !reveal && activeTurn <= 2} />
        <BattleCard card={triangle.right ? cardsByNo.get(triangle.right) : undefined} active={activeLane === "right"} hidden={bot && !reveal && activeTurn <= 3} />
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

export default function TriadDominionClient({ cards, reviewSkills, summary }: Props) {
  const cardsByNo = useMemo(() => new Map(cards.map((card) => [card.cardNo, card])), [cards]);
  const monsters = useMemo(() => uniqueByNo(cards.filter((card) => card.kind === "monster")), [cards]);
  const playable = useMemo(() => uniqueByNo(cards.filter((card) => card.kind !== "unknown")), [cards]);

  const [usedCards, setUsedCards] = useState<string[]>([]);
  const usedSet = useMemo(() => new Set(usedCards), [usedCards]);
  const availableMonsters = monsters.filter((card) => !usedSet.has(card.cardNo));
  const availablePlayable = playable.filter((card) => !usedSet.has(card.cardNo));

  const initialPlayer = useMemo<TriadTriangle>(
    () => ({
      top: availableMonsters[0]?.cardNo || "006",
      left: availablePlayable.find((card) => card.kind === "skill")?.cardNo || availablePlayable[1]?.cardNo || "016",
      right: availablePlayable.find((card) => card.kind === "skill" && card.cardNo !== "016")?.cardNo || availablePlayable[2]?.cardNo || "017",
    }),
    [availableMonsters, availablePlayable]
  );

  const [player, setPlayer] = useState<TriadTriangle>(initialPlayer);
  const [lockedFight, setLockedFight] = useState<LockedFight | null>(null);
  const [activeTurn, setActiveTurn] = useState<TriadTurn>(1);
  const [revealedTurns, setRevealedTurns] = useState<TriadTurn[]>([]);
  const [fightNo, setFightNo] = useState(1);
  const [matchScore, setMatchScore] = useState({ player: 0, bot: 0 });
  const [battleLog, setBattleLog] = useState<string[]>([]);

  const currentResult = lockedFight?.turns.find((turn) => turn.turn === activeTurn);
  const fightScore = lockedFight ? getWinnerPoints(lockedFight.turns.filter((turn) => revealedTurns.includes(turn.turn))) : { player: 0, bot: 0 };
  const matchDone = fightNo > 3;
  const winnerText =
    matchScore.player === matchScore.bot
      ? "MATCH DRAW"
      : matchScore.player > matchScore.bot
        ? "ADMIN WINS"
        : "NEXORA BOT WINS";

  const resetBattle = () => {
    setUsedCards([]);
    setPlayer(initialPlayer);
    setLockedFight(null);
    setActiveTurn(1);
    setRevealedTurns([]);
    setFightNo(1);
    setMatchScore({ player: 0, bot: 0 });
    setBattleLog([]);
  };

  const lockFight = () => {
    const playerCards = [player.top, player.left, player.right].filter(Boolean);
    if (new Set(playerCards).size !== 3) return;

    const bot = chooseBotTriangle(player, monsters, playable, usedSet);
    const turns = ([1, 2, 3] as TriadTurn[]).map((turn) =>
      resolveTriadTurn({ turn, player, opponent: bot })
    );

    setLockedFight({ fightNo, player, bot, turns });
    setActiveTurn(1);
    setRevealedTurns([]);
    setBattleLog((current) => [
      `Fight ${fightNo}: bot analyzed your triangle and locked its counter play.`,
      ...current,
    ]);
  };

  const revealTurn = () => {
    if (!lockedFight || revealedTurns.includes(activeTurn)) return;

    const result = lockedFight.turns.find((turn) => turn.turn === activeTurn);
    if (!result) return;

    setRevealedTurns((current) => [...current, activeTurn]);
    setBattleLog((current) => [
      `Turn ${activeTurn}: ${
        result.winner === "draw"
          ? "draw"
          : result.winner === "player"
            ? "admin scores"
            : "bot scores"
      } (${result.playerTotal.toLocaleString()} vs ${result.opponentTotal.toLocaleString()})`,
      ...current,
    ]);

    if (activeTurn < 3) {
      setActiveTurn((activeTurn + 1) as TriadTurn);
      return;
    }

    const score = getWinnerPoints(lockedFight.turns);
    setMatchScore((current) => ({
      player: current.player + score.player,
      bot: current.bot + score.bot,
    }));
  };

  const nextFight = () => {
    if (!lockedFight) return;

    const consumed = [
      lockedFight.player.top,
      lockedFight.player.left,
      lockedFight.player.right,
      lockedFight.bot.top,
      lockedFight.bot.left,
      lockedFight.bot.right,
    ].filter((cardNo): cardNo is string => Boolean(cardNo));
    const nextUsed = Array.from(new Set([...usedCards, ...consumed]));
    const nextUsedSet = new Set(nextUsed);
    const nextMonsters = monsters.filter((card) => !nextUsedSet.has(card.cardNo));
    const nextPlayable = playable.filter((card) => !nextUsedSet.has(card.cardNo));
    const nextPlayer = {
      top: nextMonsters[0]?.cardNo || "",
      left: nextPlayable.find((card) => card.kind === "skill")?.cardNo || nextPlayable[0]?.cardNo || "",
      right:
        nextPlayable.find(
          (card) => card.kind === "skill" && card.cardNo !== nextPlayable.find((item) => item.kind === "skill")?.cardNo
        )?.cardNo ||
        nextPlayable[1]?.cardNo ||
        "",
    };

    setUsedCards(nextUsed);
    setLockedFight(null);
    setActiveTurn(1);
    setRevealedTurns([]);
    setFightNo((current) => current + 1);
    setPlayer(nextPlayer);
  };

  return (
    <main className="min-h-[calc(var(--app-shell-height)-var(--app-header-height)-var(--app-mobile-nav-height))] overflow-hidden rounded-[24px] border border-white/8 bg-[#06080d] text-white shadow-[0_26px_90px_rgba(0,0,0,0.42)]">
      <section className="relative overflow-hidden border-b border-white/8 bg-[#070b12] px-4 py-5 sm:px-6 lg:px-8">
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
              สู้กับ NEXORA BOT แบบ 3 ไฟต์ 9 คะแนน บอทอ่านสามเหลี่ยมของเราแล้วเลือกแผนตอบโต้จากฐานการ์ดจริง
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 xl:min-w-[560px]">
            {[
              ["MATCH", `${matchScore.player}-${matchScore.bot}`],
              ["FIGHT", Math.min(fightNo, 3)],
              ["CARDS", summary.totalCards],
              ["SKILLS", summary.skills],
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

      <section className="grid gap-4 p-4 sm:p-6 xl:grid-cols-[360px_1fr_360px] xl:p-8">
        <aside className="space-y-4">
          <div className="rounded-xl border border-white/8 bg-white/[0.035] p-4">
            <div className="mb-4 flex items-center gap-2">
              <Layers3 className="h-5 w-5 text-amber-300" />
              <div>
                <div className="text-lg font-black">Your Triangle</div>
                <div className="text-sm font-semibold text-white/45">เลือก 3 ใบก่อนล็อกไฟต์</div>
              </div>
            </div>
            <div className="space-y-3">
              <CardSelect label="Top monster" value={player.top} cards={availableMonsters} onChange={(top) => setPlayer((current) => ({ ...current, top }))} />
              <CardSelect label="Turn 2 left" value={player.left} cards={availablePlayable} onChange={(left) => setPlayer((current) => ({ ...current, left }))} />
              <CardSelect label="Turn 3 right" value={player.right} cards={availablePlayable} onChange={(right) => setPlayer((current) => ({ ...current, right }))} />
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
              <Cpu className="h-4 w-4 text-cyan-200" />
              AI Brain
            </div>
            <div className="space-y-3 text-sm font-semibold leading-6 text-white/56">
              <p>บอทไม่มีสุ่ม เลือกจากผลจำลองทุกตาเพื่อเอาชนะคะแนนรวมของไฟต์นั้น</p>
              <p>สกิลที่ engine ยังไม่ฟันธงจะขึ้นเตือน ไม่เอาไปเดาเป็นกติกาจริง</p>
            </div>
          </div>
        </aside>

        <section className="space-y-4">
          <div className="rounded-2xl border border-white/8 bg-[radial-gradient(circle_at_50%_20%,rgba(245,158,11,0.14),rgba(255,255,255,0.035)_42%,rgba(0,0,0,0.16)_100%)] p-3 sm:p-4">
            <div className="mb-4 grid grid-cols-3 items-center gap-2">
              <ScorePill label="Admin" value={matchScore.player} tone="player" />
              <div className="text-center">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-white/36">
                  Fight {Math.min(fightNo, 3)} / 3
                </div>
                <div className="mt-1 text-2xl font-black text-white">Turn {activeTurn}</div>
                <div className="mt-1 text-xs font-bold text-white/42">
                  {lockedFight ? `${fightScore.player}-${fightScore.bot} in this fight` : "waiting lock"}
                </div>
              </div>
              <ScorePill label="Bot" value={matchScore.bot} tone="bot" />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <TriangleArena
                title="Admin Field"
                triangle={lockedFight?.player || player}
                cardsByNo={cardsByNo}
                activeTurn={activeTurn}
                reveal
              />
              <TriangleArena
                title="NEXORA BOT"
                triangle={lockedFight?.bot || { top: "", left: "", right: "" }}
                cardsByNo={cardsByNo}
                activeTurn={activeTurn}
                reveal={Boolean(lockedFight && revealedTurns.includes(activeTurn))}
                bot
              />
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-stretch">
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
                ) : currentResult && revealedTurns.includes(activeTurn) ? (
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-lg font-black">
                      {currentResult.winner === "draw" ? (
                        <Shield className="h-5 w-5 text-white/55" />
                      ) : currentResult.winner === "player" ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                      ) : (
                        <Zap className="h-5 w-5 text-rose-300" />
                      )}
                      {currentResult.winner === "draw"
                        ? "ตานี้เสมอ"
                        : currentResult.winner === "player"
                          ? "Admin ได้ 1 คะแนน"
                          : "Bot ได้ 1 คะแนน"}
                    </div>
                    <div className="text-sm font-semibold text-white/52">
                      {currentResult.playerTotal.toLocaleString()} vs {currentResult.opponentTotal.toLocaleString()}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-lg font-black">
                      <Flame className="h-5 w-5 text-amber-300" />
                      {lockedFight ? "พร้อมเปิดตา" : "รอเลือกแผน"}
                    </div>
                    <div className="text-sm font-semibold text-white/52">
                      {lockedFight
                        ? "กด Reveal เพื่อเปิดการ์ดและให้ engine ตัดสินคะแนน"
                        : "เลือกการ์ด 3 ใบ แล้วกด Lock Fight vs AI"}
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
                ) : lockedFight && revealedTurns.length === 3 ? (
                  <button
                    type="button"
                    onClick={nextFight}
                    className="inline-flex h-full min-h-14 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-black transition hover:bg-amber-100"
                  >
                    {fightNo >= 3 ? "Finish Match" : "Next Fight"}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={revealTurn}
                    disabled={!lockedFight || revealedTurns.includes(activeTurn)}
                    className="inline-flex h-full min-h-14 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-black text-black transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:bg-white/12 disabled:text-white/32"
                  >
                    Reveal
                    <ChevronRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {currentResult && revealedTurns.includes(activeTurn) ? (
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
            <div className="max-h-[280px] space-y-2 overflow-auto pr-1">
              {battleLog.length > 0 ? (
                battleLog.map((line, index) => (
                  <div key={`${line}-${index}`} className="rounded-lg border border-white/8 bg-black/22 p-3 text-xs font-semibold leading-5 text-white/58">
                    {line}
                  </div>
                ))
              ) : (
                <div className="rounded-lg border border-white/8 bg-black/22 p-3 text-sm font-semibold text-white/42">
                  ยังไม่มีจังหวะต่อสู้
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-amber-300/16 bg-amber-300/[0.05] p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-white">
              <AlertTriangle className="h-4 w-4 text-amber-300" />
              Skill Review Queue
            </div>
            <div className="max-h-[390px] space-y-2 overflow-auto pr-1">
              {reviewSkills.slice(0, 12).map((skill) => (
                <div key={skill.cardNo} className="rounded-lg border border-white/8 bg-black/22 p-3">
                  <div className="truncate text-sm font-black text-white">
                    No.{skill.cardNo} {skill.name}
                  </div>
                  <div className="mt-1 line-clamp-3 text-xs font-semibold leading-5 text-white/50">
                    {skill.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
