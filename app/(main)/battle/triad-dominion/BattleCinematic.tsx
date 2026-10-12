"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { FastForward, Shield, Sparkles, Swords, Volume2, VolumeX, Trophy, ArrowDown, ArrowUp, RefreshCw } from "lucide-react";
import { createPortal } from "react-dom";
import BattleParticles from "./BattleParticles";
import { battleAudioReady, playBattleSequence, primeBattleAudio } from "./BattleAudio";
import { triadSkillRuleByNo, type TriadCard, type TriadTurnResult } from "@/lib/triad-dominion";
import styles from "./BattleCinematic.module.css";

type Side = "player" | "opponent";
type Step = { side: Side; cardNo: string; kind: "skill" | "strike" | "result"; summary: string; blocked?: boolean; inactive?: boolean; field?: boolean; value?: number; effect?: "buff" | "debuff" | "shift" | "transform" | "swap" };

export function buildBattleSteps(result: TriadTurnResult, playerCard?: TriadCard, opponentCard?: TriadCard): Step[] {
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
    const card = side === "player" ? playerCard : opponentCard;
    if (!card || card.kind !== "monster") return [];
    return [{ side, cardNo: card.cardNo, kind: "strike", summary: "", value: side === "player" ? result.playerTotal : result.opponentTotal }];
  });
  return [...skills, ...strikes, { side: result.winner === "opponent" ? "opponent" : "player", cardNo: "", kind: "result", summary: "" }];
}

export default function BattleCinematic({ result, playerCard, opponentCard, cardsByNo, playerName, opponentName, onComplete }: {
  result: TriadTurnResult; playerCard?: TriadCard; opponentCard?: TriadCard;
  cardsByNo: Map<string, TriadCard>; playerName: string; opponentName: string; onComplete: () => void;
}) {
  const steps = useMemo(() => buildBattleSteps(result, playerCard, opponentCard), [result, playerCard, opponentCard]);
  const [index, setIndex] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [soundReady, setSoundReady] = useState(false);
  const cancelAudioRef = useRef<() => void>(() => {});
  const stepClockRef = useRef({ index: -1, at: 0 });
  const completeRef = useRef(onComplete);
  const finishedRef = useRef(false);
  completeRef.current = onComplete;
  const currentKind = steps[index]?.kind;
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
    }, reduced ? 450 : currentKind === "skill" ? 1500 : currentKind === "strike" ? 1350 : 1100);
    return () => window.clearTimeout(timer);
  }, [index, steps.length, reduced, currentKind]);
  const step = steps[Math.min(index, steps.length - 1)];
  const attacker = cardsByNo.get(step.cardNo) || (step.side === "player" ? playerCard : opponentCard);
  const activePlayer = step.side === "player" ? attacker : playerCard;
  const activeOpponent = step.side === "opponent" ? attacker : opponentCard;
  const actorName = step.side === "player" ? playerName : opponentName;
  const element = attacker?.element || "unknown";
  const color = { fire: "#ff654e", water: "#52d7ff", wood: "#67f0a3", earth: "#f3cd64", gold: "#e8f0ff", unknown: "#c5a6ff" }[element];
  const final = step.kind === "result";
  useEffect(() => { stepClockRef.current = { index, at: performance.now() }; }, [index, mounted]);
  useEffect(() => {
    if (!mounted || muted || !soundReady || finishedRef.current) return;
    // Enabling audio late in a step must not replay an impact that already happened.
    if (performance.now() - stepClockRef.current.at > 120) return;
    const stop = playBattleSequence({ element, kind: step.kind, side: step.side, blocked: Boolean(step.blocked), draw: result.winner === "draw", reduced });
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
    <div className={`${styles.overlay} ${reduced ? styles.reduced : ""}`} data-battle-cinematic data-step={index} data-element={element} data-effect={step.blocked ? "blocked" : step.effect || step.kind} style={{ "--impact": color } as CSSProperties}>
      <div className={styles.toolbar}>
        <label className={styles.motion}><input type="checkbox" checked={reduced} onChange={toggleReduced} /> ลดการเคลื่อนไหว</label>
        <button type="button" onClick={toggleSound} title={muted || !soundReady ? "เปิดเสียงการต่อสู้" : "ปิดเสียงการต่อสู้"} aria-label={muted || !soundReady ? "เปิดเสียงการต่อสู้" : "ปิดเสียงการต่อสู้"} aria-pressed={!muted && soundReady}>{muted || !soundReady ? <VolumeX size={19} /> : <Volume2 size={19} />}</button>
        <button type="button" onClick={finish} title="ข้ามอนิเมชั่น" aria-label="ข้ามอนิเมชั่น"><FastForward size={19} /></button>
      </div>
      <div className={styles.heading} aria-live="polite">
        <span>{final ? "ผลการปะทะ" : `${index + 1} / ${steps.length - 1}`}</span>
        <strong>{final ? result.winner === "draw" ? "เสมอ" : `${actorName} ได้แต้ม` : `${actorName} ${step.kind === "skill" ? "ใช้สกิล" : "โจมตี"}`}</strong>
        {!final && attacker ? <small>No.{attacker.cardNo} · {attacker.name}</small> : null}
      </div>
      <div key={index} className={`${styles.arena} ${step.kind === "strike" ? styles.strike : styles.cast} ${step.side === "opponent" ? styles.fromOpponent : styles.fromPlayer} ${step.blocked ? styles.blocked : ""} ${step.field ? styles.field : ""} ${final ? styles.final : ""}`}>
        {!final ? <BattleParticles color={color} element={element} side={step.side} skill={step.kind === "skill"} field={Boolean(step.field)} blocked={Boolean(step.blocked)} reduced={reduced} effect={step.effect} /> : null}
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
        {!final ? <>
          <div className={styles.trail} />
          <div className={styles.burst}>
            {step.blocked ? <Shield size={64} strokeWidth={1.5} /> : step.kind === "skill" ? <Sparkles size={52} /> : <Swords size={48} />}
          </div>
          {step.field ? <div className={styles.wave} /> : null}
          {step.value !== undefined ? <div className={styles.number}><span>แต้มปะทะ</span>{step.value.toLocaleString()}</div> : null}
          {step.blocked ? <div className={styles.guard}>{step.inactive ? "สกิลไม่ทำงานในตานี้" : "ป้องกัน / ยกเลิกสกิล"}</div> : null}
          {!step.blocked && step.effect ? <div className={`${styles.skillState} ${step.effect === "debuff" ? styles.debuff : styles.buff}`}>
            {step.effect === "debuff" ? <ArrowDown size={20} /> : step.effect === "buff" ? <ArrowUp size={20} /> : <RefreshCw size={20} />}
            {({ buff: "เสริมพลัง", debuff: "ลดพลัง", shift: "ถ่ายเทพลัง", transform: "เปลี่ยนธาตุ", swap: "สลับฝ่าย" })[step.effect]}
          </div> : null}
        </> : <>
          {result.winner === "draw" ? <div className={styles.drawClash} /> : null}
          <div className={styles.verdict}>{result.winner === "draw" ? <Swords size={28} /> : <Trophy size={28} />}</div>
          <div className={styles.scores}><strong>{result.playerTotal.toLocaleString()}</strong><span>VS</span><strong>{result.opponentTotal.toLocaleString()}</strong></div>
        </>}
      </div>
      <div className={styles.caption}>{step.summary || (final ? `${playerName} · ${opponentName}` : step.kind === "strike" ? result.metric === "attack" ? "ATK" : result.metric === "support" ? "SUP" : "ATK + SUP" : "เปิดใช้ผลสกิล")}</div>
      <div className={styles.progress}>{steps.map((_, i) => <i key={i} className={i <= index ? styles.passed : ""} />)}</div>
    </div>,
    document.body
  );
}
