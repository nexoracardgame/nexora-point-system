"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { FastForward, Shield, Sparkles, Swords, Volume2, VolumeX, Trophy, ArrowDown, ArrowUp, RefreshCw } from "lucide-react";
import { createPortal } from "react-dom";
import BattleParticles from "./BattleParticles";
import { battleAudioReady, playBattleSequence, primeBattleAudio } from "./BattleAudio";
import { BATTLE_CONTACT_MS, BATTLE_MOTION_MS, battleStepDuration } from "./BattleTiming";
import { triadSkillRuleByNo, type TriadCard, type TriadTurnResult } from "@/lib/triad-dominion";
import styles from "./BattleCinematic.module.css";

type Side = "player" | "opponent";
type Step = { side: Side; cardNo: string; kind: "intro" | "skill" | "strike" | "result"; summary: string; blocked?: boolean; inactive?: boolean; field?: boolean; value?: number; effect?: "buff" | "debuff" | "shift" | "transform" | "swap" };

export function buildBattleSteps(result: TriadTurnResult, playerCard?: TriadCard, opponentCard?: TriadCard, playerMainCard?: TriadCard, opponentMainCard?: TriadCard): Step[] {
  const skills: Step[] = result.skillEvents.map((event) => {
    const rule = triadSkillRuleByNo.get(event.cardNo);
    const inactive = rule?.allowedTurns?.includes(result.turn) === false;
    const deltas = rule?.effects?.map((effect) => effect.delta) || [];
    const positive = deltas.some(delta => delta > 0);
    const negative = deltas.some(delta => delta < 0);
    return {
    side: event.side, cardNo: event.cardNo, kind: "skill", summary: event.summary,
    blocked: Boolean(inactive || event.blocked || event.type === "skill-cancel" || event.type === "block-stat-gain"),
    inactive,
    field: !inactive && ["all", "own-all", "opponent-all"].includes(rule?.target || ""),
    effect: event.type === "element-transform" ? "transform" : event.type === "swap-control" ? "swap" : positive && negative ? "shift" : negative ? "debuff" : positive ? "buff" : undefined,
  }; });
  const order: Side[] = result.prioritySide === "opponent" ? ["opponent", "player"] : ["player", "opponent"];
  const strikes = order.flatMap((side): Step[] => {
    const laneCard = side === "player" ? playerCard : opponentCard;
    const mainCard = side === "player" ? playerMainCard : opponentMainCard;
    const card = laneCard?.kind === "monster" ? laneCard : mainCard || laneCard;
    return [{ side, cardNo: card?.cardNo || "", kind: "strike", summary: "", value: Math.max(0, side === "player" ? result.playerTotal : result.opponentTotal) }];
  });
  return [{ side: order[0], cardNo: "", kind: "intro", summary: "" }, ...skills, ...strikes, { side: result.winner === "opponent" ? "opponent" : "player", cardNo: "", kind: "result", summary: "" }];
}

export function battleHpAtStep(result: TriadTurnResult, steps: Step[], index: number, hit: boolean) {
  const hp = { player: Math.max(0, result.playerTotal), opponent: Math.max(0, result.opponentTotal) };
  for (let i = 0; i <= index && i < steps.length; i++) {
    const step = steps[i];
    if (step.kind !== "strike" || (i === index && !hit)) continue;
    hp[step.side === "player" ? "opponent" : "player"] -= step.value || 0;
  }
  return hp;
}

function HpMeter({ side, name, initial, value, reduced }: { side: Side; name: string; initial: number; value: number; reduced: boolean }) {
  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);
  useEffect(() => {
    if (reduced) { displayRef.current = value; setDisplay(value); return; }
    const from = displayRef.current;
    const started = performance.now();
    let frame = 0;
    const draw = (now: number) => {
      const progress = Math.min(1, (now - started) / 650);
      const next = Math.round(from + (value - from) * (1 - Math.pow(1 - progress, 3)));
      displayRef.current = next; setDisplay(next);
      if (progress < 1) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);
  const percent = initial > 0 ? Math.max(0, Math.min(100, value / initial * 100)) : 0;
  return <div className={`${styles.hpMeter} ${side === "player" ? styles.playerHp : styles.opponentHp}`} data-hp-side={side} data-hp-value={value}>
    <div className={styles.hpTitle}><span>{name}</span><small>พลังโจมตี {initial.toLocaleString()}</small></div>
    <div className={styles.hpTrack} role="progressbar" aria-label={`HP ${name}`} aria-valuemin={0} aria-valuemax={Math.max(1, initial)} aria-valuenow={Math.max(0, value)} aria-valuetext={`${value.toLocaleString()} / ${initial.toLocaleString()}`}>
      <div className={styles.hpTrail} style={{ width: `${percent}%` }} />
      <div className={styles.hpFill} style={{ width: `${percent}%` }} />
    </div>
    <div className={`${styles.hpValue} ${value < 0 ? styles.overkill : ""}`}><span>HP {display.toLocaleString()}</span><small>/ {initial.toLocaleString()}</small></div>
  </div>;
}

export default function BattleCinematic({ result, playerCard, opponentCard, playerMainCard, opponentMainCard, cardsByNo, playerName, opponentName, onComplete }: {
  result: TriadTurnResult; playerCard?: TriadCard; opponentCard?: TriadCard;
  playerMainCard?: TriadCard; opponentMainCard?: TriadCard;
  cardsByNo: Map<string, TriadCard>; playerName: string; opponentName: string; onComplete: () => void;
}) {
  const steps = useMemo(() => buildBattleSteps(result, playerCard, opponentCard, playerMainCard, opponentMainCard), [result, playerCard, opponentCard, playerMainCard, opponentMainCard]);
  const [index, setIndex] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [soundReady, setSoundReady] = useState(false);
  const [impactedIndex, setImpactedIndex] = useState(-1);
  const cancelAudioRef = useRef<() => void>(() => {});
  const stepClockRef = useRef({ index: -1, at: 0 });
  const completeRef = useRef(onComplete);
  const finishedRef = useRef(false);
  completeRef.current = onComplete;
  const currentKind = steps[index]?.kind;
  const currentSummaryLength = steps[index]?.summary.length || 0;
  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    cancelAudioRef.current();
    completeRef.current();
  };
  useEffect(() => {
    setMounted(true);
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    let saved = false;
    try { saved = localStorage.getItem("triad-reduced-motion") === "1"; } catch { /* Storage may be disabled. */ }
    setReduced(query.matches || saved);
    try { setMuted(localStorage.getItem("triad-battle-muted") === "1"); } catch { /* Storage may be disabled. */ }
    const syncAudio = () => setSoundReady(battleAudioReady());
    syncAudio();
    window.addEventListener("triad-audio-ready", syncAudio);
    return () => window.removeEventListener("triad-audio-ready", syncAudio);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (index >= steps.length - 1) {
        if (!finishedRef.current) { finishedRef.current = true; completeRef.current(); }
      } else setIndex((current) => current + 1);
    }, battleStepDuration(currentKind || "result", reduced, currentSummaryLength));
    return () => window.clearTimeout(timer);
  }, [index, steps.length, reduced, currentKind, currentSummaryLength]);
  const step = steps[Math.min(index, steps.length - 1)];
  const attacker = cardsByNo.get(step.cardNo) || (step.side === "player" ? playerCard : opponentCard);
  const playerFighter = playerCard?.kind === "monster" ? playerCard : playerMainCard || playerCard;
  const opponentFighter = opponentCard?.kind === "monster" ? opponentCard : opponentMainCard || opponentCard;
  const activePlayer = step.kind === "skill" && step.side === "player" ? attacker : playerFighter;
  const activeOpponent = step.kind === "skill" && step.side === "opponent" ? attacker : opponentFighter;
  const actorName = step.side === "player" ? playerName : opponentName;
  const element = attacker?.element || "unknown";
  const color = { fire: "#ff654e", water: "#52d7ff", wood: "#67f0a3", earth: "#f3cd64", gold: "#e8f0ff", unknown: "#c5a6ff" }[element];
  const final = step.kind === "result";
  const intro = step.kind === "intro";
  const hp = battleHpAtStep(result, steps, index, impactedIndex === index);
  useEffect(() => {
    if (step.kind !== "strike") return;
    const timer = window.setTimeout(() => setImpactedIndex(index), reduced ? 250 : BATTLE_CONTACT_MS);
    return () => window.clearTimeout(timer);
  }, [index, step.kind, reduced]);
  useEffect(() => { stepClockRef.current = { index, at: performance.now() }; }, [index, mounted]);
  useEffect(() => {
    if (!mounted || intro || muted || !soundReady || finishedRef.current) return;
    // Enabling audio late in a step must not replay an impact that already happened.
    if (performance.now() - stepClockRef.current.at > 120) return;
    const stop = playBattleSequence({ element, kind: step.kind as "skill" | "strike" | "result", side: step.side, blocked: Boolean(step.blocked), draw: result.winner === "draw", reduced });
    cancelAudioRef.current = stop;
    return stop;
  }, [index, mounted, muted, soundReady, element, step.kind, step.side, step.blocked, result.winner, reduced]);
  const toggleSound = async () => {
    const nextMuted = !muted && soundReady;
    setMuted(nextMuted);
    try { localStorage.setItem("triad-battle-muted", nextMuted ? "1" : "0"); } catch { /* Keep the setting for this battle. */ }
    if (!nextMuted) setSoundReady(await primeBattleAudio());
  };
  const toggleReduced = () => {
    setReduced((current) => {
      try { localStorage.setItem("triad-reduced-motion", current ? "0" : "1"); } catch { /* Keep the setting for this battle. */ }
      return !current;
    });
  };
  if (!mounted) return null;
  return createPortal(
    <div className={`${styles.overlay} ${reduced ? styles.reduced : ""}`} data-battle-cinematic data-step={index} data-kind={step.kind} data-element={element} data-effect={step.blocked ? "blocked" : step.effect || step.kind} style={{ "--impact": color, "--motion-duration": `${BATTLE_MOTION_MS}ms`, "--contact-delay": `${BATTLE_CONTACT_MS}ms` } as CSSProperties}>
      <div className={styles.toolbar}>
        <label className={styles.motion}><input type="checkbox" checked={reduced} onChange={toggleReduced} /> ลดการเคลื่อนไหว</label>
        <button type="button" onClick={toggleSound} title={muted || !soundReady ? "เปิดเสียงการต่อสู้" : "ปิดเสียงการต่อสู้"} aria-label={muted || !soundReady ? "เปิดเสียงการต่อสู้" : "ปิดเสียงการต่อสู้"} aria-pressed={!muted && soundReady}>{muted || !soundReady ? <VolumeX size={19} /> : <Volume2 size={19} />}</button>
        <button type="button" onClick={finish} title="ข้ามอนิเมชั่น" aria-label="ข้ามอนิเมชั่น"><FastForward size={19} /></button>
      </div>
      <div className={styles.heading} aria-live="polite">
        <span>{final ? "ผลการปะทะ" : intro ? "เตรียมปะทะ" : `${index} / ${steps.length - 2}`}</span>
        <strong>{final ? result.winner === "draw" ? "เสมอ" : `${actorName} ได้แต้ม` : intro ? "พลังทั้งสองฝ่าย" : `${actorName} ${step.kind === "skill" ? "ใช้สกิล" : "โจมตี"}`}</strong>
        {!final && !intro && attacker ? <small>No.{attacker.cardNo} · {attacker.name}</small> : <small>{result.metric === "total" ? "ATK + SUP" : result.metric === "attack" ? "ATK" : "SUP"}</small>}
      </div>
      <div className={styles.hpRow}>
        <HpMeter side="player" name={playerName} initial={Math.max(0, result.playerTotal)} value={hp.player} reduced={reduced} />
        <HpMeter side="opponent" name={opponentName} initial={Math.max(0, result.opponentTotal)} value={hp.opponent} reduced={reduced} />
      </div>
      <div key={index} className={`${styles.arena} ${step.kind === "strike" ? styles.strike : step.kind === "skill" ? styles.cast : ""} ${step.side === "opponent" ? styles.fromOpponent : styles.fromPlayer} ${step.blocked ? styles.blocked : ""} ${step.field ? styles.field : ""} ${final ? styles.final : ""}`}>
        {!final && !intro ? <BattleParticles color={color} element={element} side={step.side} skill={step.kind === "skill"} field={Boolean(step.field)} blocked={Boolean(step.blocked)} reduced={reduced} effect={step.effect} /> : null}
        {[{ side: "player", card: activePlayer }, { side: "opponent", card: activeOpponent }].map(({ side, card }) => (
          <div key={side} data-fighter={step.side === side ? "source" : "target"} className={`${styles.fighter} ${side === "player" ? styles.player : styles.opponent} ${step.side === side ? styles.source : styles.target} ${final && result.winner !== "draw" ? result.winner === side ? styles.winner : styles.defeated : ""}`}>
            <div className={styles.card}>
              {card ? <img src={card.sourceImage} alt={card.name} draggable={false} /> : <Swords size={40} />}
            </div>
          </div>
        ))}
        <span className={`${styles.name} ${styles.playerName}`}>{playerName}</span>
        <span className={`${styles.name} ${styles.opponentName}`}>{opponentName}</span>
        {!final && step.kind === "strike" ? <>
          <span className={`${styles.intent} ${step.side === "player" ? styles.playerIntent : styles.opponentIntent}`}><Swords size={14} /> โจมตี</span>
          <span className={`${styles.intent} ${step.side === "player" ? styles.opponentIntent : styles.playerIntent}`}><Shield size={14} /> เป้าหมาย</span>
        </> : null}
        {!final && !intro ? <>
          <div className={styles.trail} />
          <div className={styles.burst}>
            {step.blocked ? <Shield size={64} strokeWidth={1.5} /> : step.kind === "skill" ? <Sparkles size={52} /> : <Swords size={48} />}
          </div>
          {step.field ? <div className={styles.wave} /> : null}
          {step.value !== undefined ? <div className={styles.number}><span>ดาเมจ</span>-{step.value.toLocaleString()}</div> : null}
          {step.blocked ? <div className={styles.guard}>{step.inactive ? "สกิลไม่ทำงานในตานี้" : "ป้องกัน / ยกเลิกสกิล"}</div> : null}
          {!step.blocked && step.effect ? <div className={`${styles.skillState} ${step.effect === "debuff" ? styles.debuff : styles.buff}`}>
            {step.effect === "debuff" ? <ArrowDown size={20} /> : step.effect === "buff" ? <ArrowUp size={20} /> : <RefreshCw size={20} />}
            {({ buff: "เสริมพลัง", debuff: "ลดพลัง", shift: "ถ่ายเทพลัง", transform: "เปลี่ยนธาตุ", swap: "สลับฝ่าย" })[step.effect]}
          </div> : null}
        </> : final ? <>
          {result.winner === "draw" ? <div className={styles.drawClash} /> : null}
          <div className={styles.verdict}>{result.winner === "draw" ? <Swords size={28} /> : <Trophy size={28} />}</div>
          <div className={styles.scores}><strong>{result.playerTotal.toLocaleString()}</strong><span>VS</span><strong>{result.opponentTotal.toLocaleString()}</strong></div>
        </> : null}
      </div>
      <div className={styles.caption}>{step.summary || (final ? `${playerName} HP ${hp.player.toLocaleString()} · ${opponentName} HP ${hp.opponent.toLocaleString()}` : intro ? `${playerName} ${Math.max(0, result.playerTotal).toLocaleString()} · ${opponentName} ${Math.max(0, result.opponentTotal).toLocaleString()}` : step.kind === "strike" ? `${actorName} โจมตี ${step.value?.toLocaleString()} → ${step.side === "player" ? opponentName : playerName} HP ${(step.side === "player" ? hp.opponent : hp.player).toLocaleString()}` : "เปิดใช้ผลสกิล")}</div>
      <div className={styles.progress}>{steps.map((_, i) => <i key={i} className={i <= index ? styles.passed : ""} />)}</div>
    </div>,
    document.body
  );
}
