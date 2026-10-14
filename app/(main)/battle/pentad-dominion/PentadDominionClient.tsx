"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, Check, ChevronRight, Clock3, Eye, Flag, History, Layers3, Loader2, LogOut, Plus, Search, SendHorizontal, Shuffle, Swords, X } from "lucide-react";
import { triadCardByNo, triadCards, type TriadTurnResult } from "@/lib/triad-dominion";
import { battleArenaForSeed } from "@/lib/triad-arena";
import { completePentadDeck, emptyPentadDeck, otherPentadSide, pentadElements, pentadElementNames, validatePentadDeck, type PentadDeck, type PentadSide } from "@/lib/pentad-dominion";
import type { PentadRoom, PentadRound } from "@/lib/pentad-room-store";
import { getBrowserSupabaseClient } from "@/lib/supabase-browser";
import { useBattleArenaActivity } from "@/lib/battle-ui-state";
import BattleArenaChat, { BattleArenaChatFrame } from "@/components/BattleArenaChat";
import BattleCinematic from "../triad-dominion/BattleCinematic";
import { playMenuCue, primeBattleAudio } from "../triad-dominion/BattleAudio";
import styles from "./PentadDominion.module.css";
import PentadCardPreview, { usePentadCardPreview } from "./PentadCardPreview";

type Listing = { code: string; host: string; challenger: string; phase: string; spectators: number };
const BACK = "/cards/card-backs/card-backs.png";
const deckKey = (room: PentadRoom, userId: string) => `nexora:pentad:deck:${room.code}:${room.epoch}:${userId}`;
const countdown = (ms: number) => { const seconds = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; };
const phaseNames: Record<PentadRoom["phase"], string> = { waiting: "รอผู้ท้าชิง", deck: "เตรียมเด็ค", select: "เลือกการ์ด", target: "เลือกเป้าหมายสกิล", result: "ปะทะ", finished: "จบเกม" };

function Card({ no, onClick, disabled, badge, className = "" }: { no?: string; onClick?: () => void; disabled?: boolean; badge?: string; className?: string }) {
  const card = no ? triadCardByNo.get(no) : undefined;
  const preview = usePentadCardPreview();
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const origin = useRef({ x: 0, y: 0 });
  const cancelHold = () => { if (hold.current) clearTimeout(hold.current); hold.current = null; };
  useEffect(() => () => cancelHold(), []);
  return <button type="button" className={`${styles.card} ${className}`} data-card-no={card?.cardNo} onClick={event => {
    cancelHold(); if (held.current) { event.preventDefault(); held.current = false; return; }
    if (onClick) { if (!disabled) { if (no) preview.hide(no); onClick(); } }
    else if (no) preview.show(no, true);
  }} disabled={Boolean(disabled && onClick)} aria-label={card ? `No.${no} ${card.name}` : "การ์ดคว่ำ"}
    onPointerEnter={event => { if (card && event.pointerType === "mouse") preview.show(card.cardNo); }}
    onPointerLeave={() => { cancelHold(); if (no) preview.hide(no); }}
    onFocus={() => { if (no) preview.show(no); }} onBlur={() => { if (no) preview.hide(no); }}
    onContextMenu={event => { if (card) { event.preventDefault(); preview.show(card.cardNo, true); } }}
    onPointerDown={event => { if (!card || event.pointerType === "mouse") return; held.current = false; origin.current = { x: event.clientX, y: event.clientY }; cancelHold(); hold.current = setTimeout(() => { held.current = true; preview.show(card.cardNo, true); }, 450); }}
    onPointerMove={event => { if (Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > 8) cancelHold(); }}
    onPointerUp={cancelHold} onPointerCancel={cancelHold}>
    {/* Native card artwork contains its own border. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={card?.sourceImage || BACK} alt={card?.name || "การ์ดคว่ำ"} draggable={false} />
    {badge && <span className={styles.badge}>{badge}</span>}
  </button>;
}
function cinematicResult(round: PentadRound): TriadTurnResult {
  const combined = round.turn === 1;
  return {
    turn: combined || round.turn === 2 || round.turn === 3 ? 2 : 3,
    ...(combined ? { skillEligibilityTurn: "combined" as const } : {}),
    prioritySide: round.opener === "host" ? "player" : "opponent", metric: combined ? "total" : round.turn < 4 ? "attack" : "support",
    playerTotal: round.totals.host, opponentTotal: round.totals.challenger,
    pointsAwarded: round.finalDuel || round.winner === "draw" ? 0 : 1,
    decisionReason: round.reason,
    pointScore: round.scoreAfter ? { player: round.scoreAfter.host, opponent: round.scoreAfter.challenger } : undefined,
    winner: round.winner === "host" ? "player" : round.winner === "challenger" ? "opponent" : "draw",
    effectivePlayer: { top: round.effective.host }, effectiveOpponent: { top: round.effective.challenger },
    originalPlayer: { top: round.mains.host }, originalOpponent: { top: round.mains.challenger },
    playerBreakdown: [round.reason], opponentBreakdown: [round.reason], unresolvedSkills: [], skillEvents: round.events,
  };
}

function ChoiceOption({ target, room, disabled, onChoose }: { target: string; room: PentadRoom; disabled: boolean; onChoose: () => void }) {
  if (target.startsWith("skill:")) return <div><Card no={target.split(":")[2]} disabled={disabled} onClick={onChoose} /><span>สกิลตา {Number(target.split(":")[1]) + 1}</span></div>;
  const targetSide = target.startsWith("player-top") ? "host" : "challenger";
  if (target.includes(">")) return <button className={styles.sequenceChoice} disabled={disabled} onClick={onChoose}><span>{room.seats[targetSide]?.name}</span><ChevronRight /><span>{room.seats[targetSide === "host" ? "challenger" : "host"]?.name}</span></button>;
  if (target === "draw-skill" || target.startsWith("reroll")) return <button disabled={disabled} onClick={onChoose}>{target === "draw-skill" ? "สุ่มสกิลเพิ่ม" : target === "reroll-own" ? "เปลี่ยนมอนสเตอร์เรา" : "เปลี่ยนมอนสเตอร์คู่ต่อสู้"}</button>;
  return <div><Card no={room.board[targetSide][0]} disabled={disabled} onClick={onChoose} /><span>{room.seats[targetSide]?.name}</span></div>;
}

function ElementClash({ round, room, arenaImage, onComplete }: { round: PentadRound; room: PentadRoom; arenaImage: string; onComplete: () => void }) {
  const complete = useRef(onComplete); complete.current = onComplete;
  const [stage, setStage] = useState(0);
  const stages = round.stages?.length ? round.stages : [{ title: "ธาตุปะทะ", detail: round.reason }];
  useEffect(() => { const timer = setInterval(() => setStage(value => value + 1), 3000); const end = setTimeout(() => complete.current(), stages.length * 3000); return () => { clearInterval(timer); clearTimeout(end); }; }, [round.id, stages.length]);
  const winner = round.winner === "draw" ? "host" : round.winner;
  const current = stages[Math.min(stage, stages.length - 1)];
  const resolved = stage >= stages.length - 1 && round.winner !== "draw";
  return createPortal(<div className={styles.elementClash} style={{ backgroundImage: `linear-gradient(#03070c80,#03070cb3),url('${arenaImage}')` }}><h2>ธาตุปะทะ · {Math.min(stage + 1, stages.length)}/{stages.length}</h2><div>{(["host", "challenger"] as const).map(side => <section key={side} className={resolved ? side === winner ? styles.elementWinner : styles.elementLoser : undefined}><strong>{room.seats[side]?.name}</strong><Card no={round.mains[side]} /><span>ธาตุ{pentadElementNames[triadCardByNo.get(round.mains[side])!.element]}</span></section>)}</div><h1>{current.title}</h1><p className={styles.stageDetail}>{current.detail}</p></div>, document.body);
}

export default function PentadDominionClient({ userId, initialRoomCode = "", initialSpectate = false }: { userId: string; initialRoomCode?: string; initialSpectate?: boolean }) {
  const router = useRouter();
  const [room, setRoom] = useState<PentadRoom | null>(null);
  const roomRef = useRef(room); roomRef.current = room;
  const [rooms, setRooms] = useState<Listing[]>([]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const loadGeneration = useRef(0);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [mounted, setMounted] = useState(false);
  const [deck, setDeck] = useState<PentadDeck>(emptyPentadDeck);
  const deckRef = useRef(deck); deckRef.current = deck;
  const dirtyDeck = useRef(false);
  const [group, setGroup] = useState<keyof PentadDeck>("monsters");
  const [element, setElement] = useState("all");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [presentation, setPresentation] = useState<{ room: PentadRoom; round: PentadRound } | null>(null);
  const seenRounds = useRef(new Set<string>());
  const [pendingPick, setPendingPick] = useState<{ code: string; epoch: number; side: PentadSide; cardNo: string } | null>(null);
  const pendingPickRef = useRef(pendingPick); pendingPickRef.current = pendingPick;
  const [entering, setEntering] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState("");
  const [introDone, setIntroDone] = useState("");
  const side: PentadSide | undefined = room?.seats.host?.id === userId ? "host" : room?.seats.challenger?.id === userId ? "challenger" : undefined;
  const lowerSide = side || "host";
  const upperSide = otherPentadSide(lowerSide);
  useBattleArenaActivity(Boolean(room) || entering);
  const arena = useMemo(() => battleArenaForSeed(`pentad:${room?.code || "lobby"}:${room?.createdAt || 0}`), [room?.code, room?.createdAt]);
  const accept = (next: PentadRoom) => {
    const previous = roomRef.current;
    if (previous && previous.code === next.code && previous.version > next.version) return;
    const pending = pendingPickRef.current;
    if (pending && (next.code !== pending.code || next.epoch !== pending.epoch || Boolean(next.picks[pending.side]))) { pendingPickRef.current = null; setPendingPick(null); }
    const round = next.rounds.at(-1);
    if (next.phase === "result" && round && round.fight === next.fight && round.turn === next.turn && round.endsAt > Date.now() + 500) {
      const key = `nexora:pentad:scene:${next.code}:${next.createdAt}:${round.id}`;
      let storedSeen = false;
      try { storedSeen = sessionStorage.getItem(key) === "1"; } catch { /* In-memory scene history still prevents replay. */ }
      if (!seenRounds.current.has(key) && !storedSeen) {
        seenRounds.current.add(key);
        try { sessionStorage.setItem(key, "1"); } catch { /* Storage must not block the arena. */ }
        setPresentation({ room: next, round });
      }
    }
    roomRef.current = next; setRoom(next); setNow(Date.now());
    try { localStorage.setItem("nexora:pentad:room", next.code); } catch { /* The room is already held in memory. */ }
  };
  const load = async (selectedCode?: string) => {
    const generation = loadGeneration.current;
    try {
      const response = await fetch(`/api/pentad-rooms${selectedCode ? `?room=${selectedCode}` : ""}`, { cache: "no-store", signal:AbortSignal.timeout(12000) });
      const data = await response.json();
      if (generation !== loadGeneration.current) return;
      if (data.closed) { roomRef.current=null;setRoom(null);setPresentation(null);try{localStorage.removeItem("nexora:pentad:room");}catch{}setError(data.error);return; }
      if (!response.ok) throw new Error(data.error || "โหลดห้องไม่สำเร็จ");
      if (data.room) accept(data.room); else setRooms(data.rooms || []);
    } catch (err) { if (generation === loadGeneration.current) setError(err instanceof Error ? err.message : "เชื่อมต่อไม่สำเร็จ"); }
  };
  const act = async (action: string, extra: Record<string, unknown> = {}, background = false) => {
    if (!background && busyRef.current) return false;
    if (!background) { busyRef.current = true; setBusy(true); setError(""); void primeBattleAudio(); playMenuCue(); }
    const current = roomRef.current;
    if (["create", "join", "leave"].includes(action)) loadGeneration.current++;
    if (action === "join") setEntering(true);
    const generation = loadGeneration.current;
    try {
      const response = await fetch("/api/pentad-rooms", { method: "POST", headers: { "Content-Type": "application/json" }, signal:AbortSignal.timeout(12000), body: JSON.stringify({ action, code: current?.code, epoch: current?.epoch, ...extra }) });
      const data = await response.json();
      if (generation !== loadGeneration.current) return false;
      if (data.closed) { try{localStorage.removeItem("nexora:pentad:room");}catch{} router.replace("/battle/triad-dominion");return false; }
      if (!response.ok) throw new Error(data.error || "คำสั่งไม่สำเร็จ");
      if (action === "leave") { loadGeneration.current++; roomRef.current = null; setRoom(null); setPresentation(null); try { localStorage.removeItem("nexora:pentad:room"); } catch { /* Storage may be unavailable. */ } router.replace("/battle/triad-dominion"); }
      else if (data.room) accept(data.room);
      return true;
    } catch (err) { if (generation === loadGeneration.current) { setError(err instanceof Error ? err.message : "เชื่อมต่อไม่สำเร็จ"); if (current) void load(current.code); } return false; }
    finally { if (action === "join") setEntering(false); if (!background) { busyRef.current = false; setBusy(false); } }
  };
  useLayoutEffect(() => {
    setMounted(true); let saved: string | null = null;
    const requested = initialRoomCode || new URLSearchParams(window.location.search).get("room");
    try { saved = requested || localStorage.getItem("nexora:pentad:room"); } catch { saved = requested; }
    const restoring = saved && /^\d{6}$/.test(saved);
    if (!restoring) { router.replace("/battle/triad-dominion"); return; }
    if (restoring) setEntering(true);
    void act("join", { code: saved, spectate: initialSpectate || new URLSearchParams(window.location.search).get("spectate") === "1" });
    const clock = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(clock);
    // Initial restoration runs once; mutable room state lives in roomRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    let stopped = false; let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (stopped) return;
      await load(roomRef.current?.code);
      if (!stopped) timer = setTimeout(poll, document.hidden ? 5000 : roomRef.current?.deadline && roomRef.current.deadline - Date.now() < 1500 ? 300 : roomRef.current ? 1500 : 5000);
    };
    timer = setTimeout(poll, 1500);
    const supabase = getBrowserSupabaseClient();
    const channel = room?.code && supabase ? supabase.channel(`pentad:${room.code}`).on("broadcast", { event: "changed" }, () => { void load(roomRef.current?.code); }).subscribe() : null;
    const visible = () => { if (!document.hidden) void load(roomRef.current?.code); };
    document.addEventListener("visibilitychange", visible);
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener("visibilitychange", visible); if (channel && supabase) void supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.code]);
  useEffect(() => {
    if (!room || room.phase !== "deck" || !side) return;
    let local: PentadDeck | null = null;
    try { local = JSON.parse(localStorage.getItem(deckKey(room, userId)) || "null"); } catch { /* Ignore corrupt local drafts. */ }
    const initial = local && Array.isArray(local.monsters) && Array.isArray(local.hand) && Array.isArray(local.reserve) && !validatePentadDeck(local, true).length && (!room.pools || (["monsters","hand","reserve"] as const).every(key=>local![key].every(no=>room.pools![key].includes(no)))) ? local : room.decks[side];
    setDeck(initial); deckRef.current = initial; dirtyDeck.current = Boolean(local);
    // Drafts restore only when entering a new preparation epoch, never on a poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.code, room?.epoch, room?.phase, side]);
  useEffect(() => {
    if (!room || room.phase !== "deck" || !side || room.ready[side] || !dirtyDeck.current) return;
    try { localStorage.setItem(deckKey(room, userId), JSON.stringify(deck)); } catch { /* Server draft synchronization remains available. */ }
    const timer = setTimeout(async () => {
      const snapshot = deckRef.current;
      if (await act("deck", { deck: snapshot }, true) && deckRef.current === snapshot) dirtyDeck.current = false;
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck, room?.phase, room?.epoch, side]);
  useEffect(() => {
    if (!room?.deadline || room.phase === "finished") return;
    const timer = setTimeout(() => void load(roomRef.current?.code), Math.max(0, room.deadline - Date.now()) + 25);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.deadline]);
  const changeDeck = (next: PentadDeck) => { const errors = validatePentadDeck(next, true); if (errors.length) { setError(errors[0]); return; } try { completePentadDeck(next,Math.random,room?.pools); } catch(err) { setError(err instanceof Error ? err.message : "เด็คผิดกติกา");return; } dirtyDeck.current = true; deckRef.current = next; setDeck(next); };
  const pickCard = async (cardNo: string) => {
    const current = roomRef.current;
    if (!current || !side || current.phase !== "select" || current.picks[side] || pendingPickRef.current) return;
    const pending = { code: current.code, epoch: current.epoch, side, cardNo };
    pendingPickRef.current = pending; setPendingPick(pending); setError(""); playMenuCue();
    const ok = await act("pick", { cardNo }, true);
    if (!ok && pendingPickRef.current === pending) { pendingPickRef.current = null; setPendingPick(null); }
  };
  const available = (player: PentadSide) => {
    if (!room) return [];
    const cards = [...(room.turn === 1 ? room.decks[player].monsters : room.decks[player].hand)];
    for (const no of room.used[player]) { const index = cards.indexOf(no); if (index >= 0) cards.splice(index, 1); }
    return cards;
  };
  const currentRound = presentation?.round;
  const cine = useMemo(() => currentRound ? cinematicResult(currentRound) : null, [currentRound]);
  const completeScene = () => { if (!currentRound) return; setPresentation(null); void act("complete", { roundId: currentRound.id }, true); };
  const ownPick = side ? (pendingPick && pendingPick.epoch === room?.epoch ? pendingPick.cardNo : room?.picks[side]) : "";
  const selectedCards = triadCards.filter(card => card.kind === (group === "monsters" ? "monster" : "skill") && (!room?.pools || room.pools[group].includes(card.cardNo)) && (element === "all" || element === card.element) && (!query || `${card.cardNo} ${card.name} ${card.skillText}`.toLowerCase().includes(query.toLowerCase())));
  const total = [...deck.monsters, ...deck.hand, ...deck.reserve];
  const fixedDeck = false;
  const pendingChoice = room?.choices.find(choice => !choice.value);
  const choiceKey = pendingChoice ? `${room?.code}:${room?.epoch}:${room?.choices.indexOf(pendingChoice)}:${pendingChoice.sourceCardNo || pendingChoice.cardNo}` : "";
  useEffect(() => setSelectedTarget(pendingChoice?.options.length === 1 ? pendingChoice.options[0] : ""), [choiceKey]);
  const panelStyle = { "--pentad-arena": `url('${arena.image}')` } as CSSProperties;

  return <PentadCardPreview contextKey={`${room?.code || "lobby"}:${room?.epoch || 0}:${room?.phase || "lobby"}`}><main className={styles.shell} style={panelStyle} data-pentad-phase={room?.phase || "lobby"}>
    <header className={styles.header}>
      <Link href="/battle/triad-dominion" className={styles.brand}>NEXORA <small>PENTAD DOMINION</small></Link>
      {!room && <Link href="/battle/triad-dominion" className={styles.backLobby}>กลับหน้า PLAY</Link>}
      {room && <span className={styles.roomCode}>ห้อง {room.code}</span>}
      <div className={styles.headerActions}>{busy && <Loader2 className={styles.spin} aria-label="กำลังส่งคำสั่ง" />}{room && <><span><Clock3 size={16} /> {countdown(room.deadline - now)}</span><button title="ออกจากห้อง" aria-label="ออกจากห้อง" onClick={() => { busyRef.current=false;setBusy(false);void act("leave",{},true); }}><LogOut /></button></>}</div>
    </header>
    {error && <div className={styles.error} role="alert">{error}<button onClick={() => setError("")} aria-label="ปิดข้อความ"><X size={16} /></button></div>}
    {!room ? <section className={styles.entering}>{entering ? <><Loader2 className={styles.spin} /><strong>กำลังเข้าสนาม</strong></> : <Link href="/battle/triad-dominion" className={styles.backLobby}>กลับหน้า PLAY</Link>}</section> : room.phase === "waiting" ? <section className={styles.waiting}>
      <h1>อำนาจห้าผนึก</h1><div className={styles.versus}>{(["host", "challenger"] as const).map(player => <div key={player} className={styles.seat}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={room.seats[player]?.image || "/avatar.png"} alt="" /><strong>{room.seats[player]?.name || "รอผู้ท้าชิง"}</strong></div>)}</div>
      <span className={styles.vs}>VS</span><div className={styles.waitingActions}>{side === "host" && <><button disabled={busy || Boolean(room.seats.challenger)} onClick={() => void act("bot")}><Bot /> เพิ่มบอท</button><button className={styles.primary} disabled={busy || !room.seats.challenger} onClick={() => void act("start")}><Swords /> เริ่มเกม</button></>}<span><Eye size={18} /> ผู้ชม {room.spectators.length}/10</span></div>
    </section> : room.phase === "deck" ? <section className={styles.deckBuilder}>
      <aside className={styles.deckTray}><h2>เตรียมเด็ค <b>{total.length}/30</b></h2>
        {!side ? <h3>ผู้เล่นกำลังเตรียมเด็ค</h3> : <><div className={styles.tabs}>{(["monsters", "hand", "reserve"] as const).map(key => <button key={key} aria-pressed={group === key} onClick={() => setGroup(key)}>{key === "monsters" ? "มอนสเตอร์" : key === "hand" ? "บนมือ" : "กองเสริม"}<b>{deck[key].length}/{key === "monsters" ? 5 : key === "hand" ? 15 : 10}</b></button>)}</div>
        <div className={styles.elementCounts}>{pentadElements.map(value => <span key={value}>{pentadElementNames[value]} {total.filter(no => triadCardByNo.get(no)?.element === value).length}/6</span>)}</div>
        <div className={styles.chosenCards}>{deck[group].map((no, index) => <Card key={`${no}:${index}`} no={no} badge={fixedDeck ? undefined : "−"} disabled={fixedDeck || room.ready[side] || busy} onClick={() => changeDeck({ ...deck, [group]: deck[group].filter((_, i) => i !== index) })} />)}</div>
        <div className={styles.deckActions}>{!fixedDeck && <button title="สุ่มเติมเด็ค" disabled={busy || room.ready[side]} onClick={() => changeDeck(completePentadDeck(deck,Math.random,room.pools))}><Shuffle /> เติมเด็ค</button>}<button className={styles.primary} disabled={busy || room.ready[side] || validatePentadDeck(deck).length > 0} onClick={() => void act("ready", { deck })}><Check /> {room.ready[side] ? "พร้อมแล้ว" : "พร้อม"}</button></div></>}
        <div className={styles.readiness}>{(["host", "challenger"] as const).map(player => <span key={player}>{room.seats[player]?.name} {room.ready[player] ? "✓ พร้อม" : "กำลังจัดเด็ค"}</span>)}</div>
      </aside>
      {side && <div className={styles.catalog}><div className={styles.filters}><label><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="ค้นหาการ์ด" aria-label="ค้นหาการ์ด" /></label><select aria-label="ธาตุ" value={element} onChange={event => setElement(event.target.value)}><option value="all">ทุกธาตุ</option>{pentadElements.map(value => <option key={value} value={value}>{pentadElementNames[value]}</option>)}</select></div><div className={styles.catalogCards}>{selectedCards.filter(card => !fixedDeck || deck[group].includes(card.cardNo)).map(card => <Card key={card.cardNo} no={card.cardNo} disabled={fixedDeck || room.ready[side] || busy || total.includes(card.cardNo)} badge={String(total.filter(no => no === card.cardNo).length || "+")} onClick={() => changeDeck({ ...deck, [group]: [...deck[group], card.cardNo] })} />)}</div></div>}
    </section> : <section className={styles.battle}>
      <div className={styles.battleStatus}><span>ไฟต์ {room.fight}/3 · ตา {room.turn}/5</span><strong>{room.finalDuel ? "ตัดสินมอนสเตอร์สุดท้าย" : phaseNames[room.phase]}</strong><span>{room.turn === 1 ? "ธาตุปะทะ" : room.turn < 4 ? "ATTACK" : "SUPPORT"}</span></div>
      <div className={styles.scoreboard}>{[upperSide, lowerSide].map(player => <span key={player} title={room.seats[player]?.name}><span className={styles.playerName}>{room.seats[player]?.name}</span><b>{room.score[player]}</b></span>)}</div>
      <div className={styles.board} data-pentad-chat-arena>{[upperSide, lowerSide].map(player => <div key={player} className={`${styles.formation} ${player === lowerSide ? styles.lower : styles.upper}`} data-pentad-side={player}>{[0, 1, 2, 3, 4].map(index => {
        const selected = player === side ? ownPick : room.picks[player];
        const placed = index === room.turn - 1 && room.phase === "select" && Boolean(selected);
        return <Card key={index} no={placed && selected !== "hidden" ? selected : room.board[player][index]} className={`${index === 0 ? styles.mainCard : styles.skillCard} ${placed ? styles.placed : ""}`} badge={placed ? "พร้อม" : String(index + 1)} />;
      })}</div>)}</div>
      {room.phase === "select" && <div className={styles.hand}><div className={styles.handTitle}><Layers3 size={18} /><strong>{!side ? "กำลังรอผู้เล่นเลือกการ์ด" : ownPick ? "ลงการ์ดแล้ว รออีกฝ่าย" : room.turn > 1 && side !== room.opener && !room.picks[room.opener] ? `รอ ${room.seats[room.opener]?.name} เปิดก่อน` : "เลือกการ์ดลงสนาม"}</strong></div><div className={styles.handCards}>{side && available(side).map((no, index) => <Card key={`${no}:${index}`} no={no} disabled={Boolean(ownPick) || (room.turn > 1 && side !== room.opener && !room.picks[room.opener])} onClick={() => void pickCard(no)} />)}</div></div>}
      {room.notice && <p className={styles.notice}>{room.notice}</p>}
      {room.phase === "finished" && <div className={styles.endgame}><h1>{room.winner === "draw" ? "เสมอ" : `${room.seats[room.winner as PentadSide]?.name || "ผู้เล่น"} ชนะ`}</h1><strong>{room.score.host} : {room.score.challenger}</strong><p>{room.notice}</p><button className={styles.primary} onClick={() => void act("leave")} disabled={busy}><LogOut /> กลับล็อบบี้</button></div>}
      {side && room.phase !== "finished" && <button className={styles.surrender} title="ยอมแพ้" aria-label="ยอมแพ้" onClick={() => { if (window.confirm("ยืนยันยอมแพ้?")) void act("surrender"); }}><Flag size={18} /></button>}
    </section>}
    {mounted && room && <BattleArenaChatFrame arenaSelector={`[data-pentad-phase="${room.phase}"] [data-pentad-chat-arena]`} cinematicActive={Boolean(presentation)} rotateBreakpoint={1000}><BattleArenaChat messages={room.chat.map(item => ({ id:item.id, senderId:item.id.slice(0,item.id.lastIndexOf(":")), senderName:item.name, text:item.text }))} currentUserId={userId} draft={message} onDraftChange={setMessage} onSubmit={() => { const text=message; if (!text.trim()) return; setMessage(""); void act("chat", {text}, true).then(ok => { if (!ok) setMessage(current => current || text); }); }} /></BattleArenaChatFrame>}
    {mounted && !presentation && room?.phase === "target" && pendingChoice && createPortal(<div className={styles.choiceOverlay}><section className={styles.choicePanel}><small>{pendingChoice.kind === "copy" ? "เลือกสกิลฝ่ายตรงข้ามที่จะคัดลอก" : "เลือกเป้าหมายสกิล"}</small><h2>{triadCardByNo.get(pendingChoice.sourceCardNo || pendingChoice.cardNo)?.name}</h2><p>{triadCardByNo.get(pendingChoice.sourceCardNo || pendingChoice.cardNo)?.skillText}</p><strong>{countdown(pendingChoice.deadline - now)}</strong><div className={styles.choiceCards}>{pendingChoice.options.map(target => <div key={target} data-selected={selectedTarget === target}><ChoiceOption target={target} room={room} disabled={busy || side !== pendingChoice.side} onChoose={() => setSelectedTarget(target)} /></div>)}</div>{side === pendingChoice.side ? <button className={styles.primary} disabled={busy || !pendingChoice.options.includes(selectedTarget)} onClick={() => void act("target", { target: selectedTarget, choiceIndex: room.choices.indexOf(pendingChoice), cardNo: pendingChoice.cardNo, sourceCardNo: pendingChoice.sourceCardNo || "" })}><Check />ยืนยันเป้าหมาย</button> : <p>รอ {room.seats[pendingChoice.side]?.name} เลือกเป้าหมาย</p>}</section></div>, document.body)}
    {mounted && room && createPortal(<div className={styles.hudPlane}><button className={styles.historyToggle} title="ประวัติการต่อสู้" aria-label="ประวัติการต่อสู้" onClick={() => setHistoryOpen(!historyOpen)}><History size={20} /></button></div>, document.body)}
    {mounted && room && historyOpen && createPortal(<aside className={styles.historyPanel}><header><h2>บันทึกสนาม</h2><button aria-label="ปิดประวัติ" onClick={() => setHistoryOpen(false)}><X /></button></header>{room.rounds.length ? [...room.rounds].reverse().map(round => <details key={round.id} open={round.id === room.rounds.at(-1)?.id}><summary>ไฟต์ {round.fight} · ตา {round.turn} · {round.winner === "draw" ? "เสมอ" : `${room.seats[round.winner]?.name} ชนะ`}</summary><p>{round.reason} · {round.totals.host.toLocaleString()} : {round.totals.challenger.toLocaleString()}</p>{(["host", "challenger"] as const).map(player => <p key={player}><strong>{room.seats[player]?.name}</strong> · No.{round.mains[player]}{round.skills[player] ? ` · สกิล No.${round.skills[player]} ${triadCardByNo.get(round.skills[player])?.name || ""}` : ""}</p>)}{round.stages?.map((stage, index) => <p key={index}><b>{stage.title}</b><br />{stage.detail}</p>)}{round.events.map((event, index) => <p key={index}><b>{room.seats[event.side === "player" ? "host" : "challenger"]?.name} · No.{event.cardNo}</b><br />{event.summary}</p>)}</details>) : <p>ยังไม่มีตาที่ตัดสินผล</p>}</aside>, document.body)}
    {cine && currentRound && presentation && (currentRound.turn === 1 && !currentRound.finalDuel && introDone !== `${presentation.room.code}:${currentRound.id}` ? <ElementClash key={`${presentation.room.code}:${currentRound.id}`} round={currentRound} room={presentation.room} arenaImage={arena.image} onComplete={() => { if (currentRound.reason.startsWith("ธาตุ")) completeScene(); else setIntroDone(`${presentation.room.code}:${currentRound.id}`); }} /> : <BattleCinematic key={`${presentation.room.code}:${currentRound.id}`} result={cine} cardsByNo={triadCardByNo} playerCard={triadCardByNo.get(currentRound.skills.host || currentRound.mains.host)} opponentCard={triadCardByNo.get(currentRound.skills.challenger || currentRound.mains.challenger)} playerMainCard={triadCardByNo.get(currentRound.effective.host)} opponentMainCard={triadCardByNo.get(currentRound.effective.challenger)} playerName={presentation.room.seats.host?.name || "PLAYER"} opponentName={presentation.room.seats.challenger?.name || "PLAYER"} arena={arena} landscape onComplete={completeScene} />)}
  </main></PentadCardPreview>;
}
