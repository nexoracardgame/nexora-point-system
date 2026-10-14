"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bot, Check, ChevronRight, Clock3, Eye, Flag, Layers3, Loader2, LogOut, Plus, Search, SendHorizontal, Shuffle, Swords, X } from "lucide-react";
import { triadCardByNo, triadCards, type TriadTurnResult } from "@/lib/triad-dominion";
import { battleArenaForSeed } from "@/lib/triad-arena";
import { completePentadDeck, emptyPentadDeck, pentadElements, pentadElementNames, validatePentadDeck, type PentadDeck, type PentadSide } from "@/lib/pentad-dominion";
import type { PentadRoom, PentadRound } from "@/lib/pentad-room-store";
import { getBrowserSupabaseClient } from "@/lib/supabase-browser";
import BattleCinematic from "../triad-dominion/BattleCinematic";
import { playMenuCue, primeBattleAudio } from "../triad-dominion/BattleAudio";
import styles from "./PentadDominion.module.css";

type Listing = { code: string; host: string; challenger: string; phase: string; spectators: number };
const BACK = "/cards/card-backs/card-backs.png";
const deckKey = (room: PentadRoom, userId: string) => `nexora:pentad:deck:${room.code}:${room.epoch}:${userId}`;
const countdown = (ms: number) => { const seconds = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`; };
const phaseNames: Record<PentadRoom["phase"], string> = { waiting: "รอผู้ท้าชิง", deck: "เตรียมเด็ค", select: "เลือกการ์ด", target: "เลือกเป้าหมายสกิล", result: "ปะทะ", finished: "จบเกม" };

function Card({ no, onClick, disabled, badge, className = "" }: { no?: string; onClick?: () => void; disabled?: boolean; badge?: string; className?: string }) {
  const card = no ? triadCardByNo.get(no) : undefined;
  return <button type="button" className={`${styles.card} ${className}`} onClick={onClick} disabled={disabled || !onClick} title={card ? `No.${no} ${card.name}\nATK ${card.attack} / SUP ${card.support}\n${card.skillText}` : "การ์ดคว่ำ"} aria-label={card ? `No.${no} ${card.name}` : "การ์ดคว่ำ"}>
    {/* Native card artwork contains its own border. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={card?.sourceImage || BACK} alt={card?.name || "การ์ดคว่ำ"} draggable={false} />
    {badge && <span className={styles.badge}>{badge}</span>}
  </button>;
}
function cinematicResult(round: PentadRound): TriadTurnResult {
  const combined = round.turn === 1 || (round.fight === 3 && round.turn === 4);
  return {
    turn: combined || round.turn === 2 || round.turn === 3 ? 2 : 3,
    ...(combined ? { skillEligibilityTurn: "combined" as const } : {}),
    prioritySide: round.opener === "host" ? "player" : "opponent", metric: combined ? "total" : round.turn < 4 ? "attack" : "support",
    playerTotal: round.totals.host, opponentTotal: round.totals.challenger,
    winner: round.winner === "host" ? "player" : round.winner === "challenger" ? "opponent" : "draw",
    effectivePlayer: { top: round.effective.host }, effectiveOpponent: { top: round.effective.challenger },
    playerBreakdown: [round.reason], opponentBreakdown: [round.reason], unresolvedSkills: [], skillEvents: round.events,
  };
}

function ChoiceOption({ target, room, disabled, onChoose }: { target: string; room: PentadRoom; disabled: boolean; onChoose: () => void }) {
  const targetSide = target.startsWith("player-top") ? "host" : "challenger";
  if (target.includes(">")) return <button className={styles.sequenceChoice} disabled={disabled} onClick={onChoose}><span>{room.seats[targetSide]?.name}</span><ChevronRight /><span>{room.seats[targetSide === "host" ? "challenger" : "host"]?.name}</span></button>;
  if (target === "draw-skill" || target.startsWith("reroll")) return <button disabled={disabled} onClick={onChoose}>{target === "draw-skill" ? "สุ่มสกิลเพิ่ม" : target === "reroll-own" ? "เปลี่ยนมอนสเตอร์เรา" : "เปลี่ยนมอนสเตอร์คู่ต่อสู้"}</button>;
  return <div><Card no={room.board[targetSide][0]} disabled={disabled} onClick={onChoose} /><span>{room.seats[targetSide]?.name}</span></div>;
}

function ElementClash({ round, room, arenaImage, onComplete }: { round: PentadRound; room: PentadRoom; arenaImage: string; onComplete: () => void }) {
  const complete = useRef(onComplete); complete.current = onComplete;
  useEffect(() => { const timer = setTimeout(() => complete.current(), Math.max(500, Math.min(5500, round.endsAt - Date.now()))); return () => clearTimeout(timer); }, [round.id, round.endsAt]);
  const winner = round.winner === "draw" ? "host" : round.winner;
  return createPortal(<div className={styles.elementClash} style={{ backgroundImage: `linear-gradient(#03070c80,#03070cb3),url('${arenaImage}')` }}><h2>ธาตุปะทะ</h2><div>{(["host", "challenger"] as const).map(side => <section key={side} className={side === winner ? styles.elementWinner : styles.elementLoser}><strong>{room.seats[side]?.name}</strong><Card no={round.mains[side]} /><span>ธาตุ{pentadElementNames[triadCardByNo.get(round.mains[side])!.element]}</span></section>)}</div><h1>{round.reason}</h1><p>{room.seats[winner]?.name} +1 คะแนน</p></div>, document.body);
}

export default function PentadDominionClient({ userId }: { userId: string }) {
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
  const [chatOpen, setChatOpen] = useState(true);
  const [completedRound, setCompletedRound] = useState(0);
  const chatEnd = useRef<HTMLDivElement>(null);
  const side = room?.seats.host?.id === userId ? "host" : room?.seats.challenger?.id === userId ? "challenger" : undefined;
  const arena = useMemo(() => battleArenaForSeed(`pentad:${room?.code || "lobby"}:${room?.createdAt || 0}`), [room?.code, room?.createdAt]);
  const accept = (next: PentadRoom) => {
    const previous = roomRef.current;
    if (previous && previous.code === next.code && previous.version > next.version) return;
    roomRef.current = next; setRoom(next); setNow(Date.now()); localStorage.setItem("nexora:pentad:room", next.code);
  };
  const load = async (selectedCode?: string) => {
    const generation = loadGeneration.current;
    try {
      const response = await fetch(`/api/pentad-rooms${selectedCode ? `?room=${selectedCode}` : ""}`, { cache: "no-store" });
      const data = await response.json();
      if (generation !== loadGeneration.current) return;
      if (!response.ok) throw new Error(data.error || "โหลดห้องไม่สำเร็จ");
      if (data.room) accept(data.room); else setRooms(data.rooms || []);
    } catch (err) { if (generation === loadGeneration.current) setError(err instanceof Error ? err.message : "เชื่อมต่อไม่สำเร็จ"); }
  };
  const act = async (action: string, extra: Record<string, unknown> = {}, background = false) => {
    if (!background && busyRef.current) return false;
    if (!background) { busyRef.current = true; setBusy(true); setError(""); void primeBattleAudio(); playMenuCue(); }
    const current = roomRef.current;
    if (["create", "join", "leave"].includes(action)) loadGeneration.current++;
    const generation = loadGeneration.current;
    try {
      const response = await fetch("/api/pentad-rooms", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, code: current?.code, epoch: current?.epoch, ...extra }) });
      const data = await response.json();
      if (generation !== loadGeneration.current) return false;
      if (!response.ok) throw new Error(data.error || "คำสั่งไม่สำเร็จ");
      if (action === "leave") { loadGeneration.current++; roomRef.current = null; setRoom(null); localStorage.removeItem("nexora:pentad:room"); void load(); }
      else if (data.room) accept(data.room);
      return true;
    } catch (err) { if (generation === loadGeneration.current) { setError(err instanceof Error ? err.message : "เชื่อมต่อไม่สำเร็จ"); if (current) void load(current.code); } return false; }
    finally { if (!background) { busyRef.current = false; setBusy(false); } }
  };
  useEffect(() => {
    setMounted(true); const saved = localStorage.getItem("nexora:pentad:room");
    void load(saved && /^\d{6}$/.test(saved) ? saved : undefined);
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
    const initial = local && Array.isArray(local.monsters) && Array.isArray(local.hand) && Array.isArray(local.reserve) && !validatePentadDeck(local, true).length ? local : room.decks[side];
    setDeck(initial); deckRef.current = initial; dirtyDeck.current = Boolean(local);
    // Drafts restore only when entering a new preparation epoch, never on a poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.code, room?.epoch, room?.phase, side]);
  useEffect(() => {
    if (!room || room.phase !== "deck" || !side || room.ready[side] || !dirtyDeck.current) return;
    localStorage.setItem(deckKey(room, userId), JSON.stringify(deck));
    const timer = setTimeout(async () => {
      const snapshot = deckRef.current;
      if (await act("deck", { deck: snapshot }, true) && deckRef.current === snapshot) dirtyDeck.current = false;
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck, room?.phase, room?.epoch, side]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ block: "nearest" }); }, [room?.chat.length]);
  useEffect(() => {
    if (!room?.deadline || room.phase === "finished") return;
    const timer = setTimeout(() => void load(roomRef.current?.code), Math.max(0, room.deadline - Date.now()) + 25);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.deadline]);
  const changeDeck = (next: PentadDeck) => { const errors = validatePentadDeck(next, true); if (errors.length) { setError(errors[0]); return; } dirtyDeck.current = true; deckRef.current = next; setDeck(next); };
  const available = (player: PentadSide) => {
    if (!room) return [];
    const cards = [...(room.turn === 1 ? room.decks[player].monsters : room.decks[player].hand)];
    for (const no of room.used[player]) { const index = cards.indexOf(no); if (index >= 0) cards.splice(index, 1); }
    return cards;
  };
  const currentRound = room?.rounds.at(-1);
  const cine = currentRound && room?.phase === "result" && completedRound !== currentRound.id ? cinematicResult(currentRound) : null;
  const selectedCards = triadCards.filter(card => card.kind === (group === "monsters" ? "monster" : "skill") && (element === "all" || element === card.element) && (!query || `${card.cardNo} ${card.name} ${card.skillText}`.toLowerCase().includes(query.toLowerCase())));
  const total = [...deck.monsters, ...deck.hand, ...deck.reserve];
  const pendingChoice = room?.choices.find(choice => !choice.value);
  const panelStyle = { "--pentad-arena": `url('${arena.image}')` } as CSSProperties;

  return <main className={styles.shell} style={panelStyle} data-pentad-phase={room?.phase || "lobby"}>
    <header className={styles.header}>
      <Link href="/battle/triad-dominion" className={styles.brand}>NEXORA <small>PENTAD DOMINION</small></Link>
      {room && <span className={styles.roomCode}>ห้อง {room.code}</span>}
      <div className={styles.headerActions}>{busy && <Loader2 className={styles.spin} aria-label="กำลังส่งคำสั่ง" />}{room && <><span><Clock3 size={16} /> {countdown(room.deadline - now)}</span><button title="ออกจากห้อง" aria-label="ออกจากห้อง" onClick={() => void act("leave")} disabled={busy}><LogOut /></button></>}</div>
    </header>
    {error && <div className={styles.error} role="alert">{error}<button onClick={() => setError("")} aria-label="ปิดข้อความ"><X size={16} /></button></div>}
    {!room ? <section className={styles.lobby}>
      <div className={styles.lobbyTitle}><h1>PENTAD DOMINION</h1><p>อำนาจห้าผนึก</p><span>3 ไฟต์ · 5 ตา · 15 คะแนน</span></div>
      <div className={styles.lobbyActions}><button className={styles.primary} disabled={busy} onClick={() => void act("create")}><Plus /> สร้างห้อง <ChevronRight /></button>
        <form onSubmit={event => { event.preventDefault(); void act("join", { code }); }}><input aria-label="รหัสห้อง" placeholder="รหัสห้อง 6 หลัก" inputMode="numeric" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ""))} /><button disabled={busy || code.length !== 6} aria-label="เข้าห้อง"><ChevronRight /></button></form>
        <div className={styles.roomList}>{rooms.map(item => <div key={item.code}><span><strong>{item.code}</strong><small>{item.host} · {item.challenger || "รอผู้ท้าชิง"}</small></span><button disabled={busy} title="เข้าร่วม" onClick={() => void act("join", { code: item.code })}><Swords size={18} /></button><button disabled={busy} title="เข้าชม" onClick={() => void act("join", { code: item.code, spectate: true })}><Eye size={18} /></button></div>)}</div>
      </div>
    </section> : room.phase === "waiting" ? <section className={styles.waiting}>
      <h1>อำนาจห้าผนึก</h1><div className={styles.versus}>{(["host", "challenger"] as const).map(player => <div key={player} className={styles.seat}>{/* eslint-disable-next-line @next/next/no-img-element */}<img src={room.seats[player]?.image || "/avatar.png"} alt="" /><strong>{room.seats[player]?.name || "รอผู้ท้าชิง"}</strong></div>)}</div>
      <span className={styles.vs}>VS</span><div className={styles.waitingActions}>{side === "host" && <><button disabled={busy || Boolean(room.seats.challenger)} onClick={() => void act("bot")}><Bot /> เพิ่มบอท</button><button className={styles.primary} disabled={busy || !room.seats.challenger} onClick={() => void act("start")}><Swords /> เริ่มเกม</button></>}<span><Eye size={18} /> ผู้ชม {room.spectators.length}/10</span></div>
    </section> : room.phase === "deck" ? <section className={styles.deckBuilder}>
      <aside className={styles.deckTray}><h2>เตรียมเด็ค <b>{total.length}/30</b></h2>
        {!side ? <h3>ผู้เล่นกำลังเตรียมเด็ค</h3> : <><div className={styles.tabs}>{(["monsters", "hand", "reserve"] as const).map(key => <button key={key} aria-pressed={group === key} onClick={() => setGroup(key)}>{key === "monsters" ? "มอนสเตอร์" : key === "hand" ? "บนมือ" : "กองเสริม"}<b>{deck[key].length}/{key === "monsters" ? 5 : key === "hand" ? 15 : 10}</b></button>)}</div>
        <div className={styles.elementCounts}>{pentadElements.map(value => <span key={value}>{pentadElementNames[value]} {total.filter(no => triadCardByNo.get(no)?.element === value).length}/6</span>)}</div>
        <div className={styles.chosenCards}>{deck[group].map((no, index) => <Card key={`${no}:${index}`} no={no} badge="−" disabled={room.ready[side] || busy} onClick={() => changeDeck({ ...deck, [group]: deck[group].filter((_, i) => i !== index) })} />)}</div>
        <div className={styles.deckActions}><button title="สุ่มเติมเด็ค" disabled={busy || room.ready[side]} onClick={() => changeDeck(completePentadDeck(deck))}><Shuffle /> เติมเด็ค</button><button className={styles.primary} disabled={busy || room.ready[side] || validatePentadDeck(deck).length > 0} onClick={() => void act("ready", { deck })}><Check /> {room.ready[side] ? "พร้อมแล้ว" : "พร้อม"}</button></div></>}
        <div className={styles.readiness}>{(["host", "challenger"] as const).map(player => <span key={player}>{room.seats[player]?.name} {room.ready[player] ? "✓ พร้อม" : "กำลังจัดเด็ค"}</span>)}</div>
      </aside>
      {side && <div className={styles.catalog}><div className={styles.filters}><label><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="ค้นหาการ์ด" aria-label="ค้นหาการ์ด" /></label><select aria-label="ธาตุ" value={element} onChange={event => setElement(event.target.value)}><option value="all">ทุกธาตุ</option>{pentadElements.map(value => <option key={value} value={value}>{pentadElementNames[value]}</option>)}</select></div><div className={styles.catalogCards}>{selectedCards.map(card => <Card key={card.cardNo} no={card.cardNo} disabled={room.ready[side] || busy} badge={String(total.filter(no => no === card.cardNo).length || "+")} onClick={() => changeDeck({ ...deck, [group]: [...deck[group], card.cardNo] })} />)}</div></div>}
    </section> : <section className={styles.battle}>
      <div className={styles.battleStatus}><span>ไฟต์ {room.fight}/3 · ตา {room.turn}/5</span><strong>{room.finalDuel ? "ตัดสินมอนสเตอร์สุดท้าย" : phaseNames[room.phase]}</strong><span>{room.turn === 1 ? "ธาตุปะทะ" : room.fight === 3 && room.turn === 4 ? "ATK + SUP" : room.turn < 4 ? "ATTACK" : "SUPPORT"}</span></div>
      <div className={styles.scoreboard}>{(["challenger", "host"] as const).map(player => <span key={player}>{room.seats[player]?.name}<b>{room.score[player]}</b></span>)}</div>
      <div className={styles.board}>{(["challenger", "host"] as const).map(player => <div key={player} className={`${styles.formation} ${player === "host" ? styles.lower : styles.upper}`} data-pentad-side={player}>{[0, 1, 2, 3, 4].map(index => <Card key={index} no={index === room.turn - 1 && room.phase === "select" && room.picks[player] && room.picks[player] !== "hidden" ? room.picks[player] : room.board[player][index]} className={index === 0 ? styles.mainCard : styles.skillCard} badge={String(index + 1)} />)}</div>)}</div>
      {room.phase === "select" && <div className={styles.hand}><div className={styles.handTitle}><Layers3 size={18} /><strong>{!side ? "กำลังรอผู้เล่นเลือกการ์ด" : room.picks[side] ? "ลงการ์ดแล้ว รออีกฝ่าย" : room.turn > 1 && side !== room.opener && !room.picks[room.opener] ? `รอ ${room.seats[room.opener]?.name} เปิดก่อน` : "เลือกการ์ดลงสนาม"}</strong></div><div className={styles.handCards}>{side && available(side).map((no, index) => <Card key={`${no}:${index}`} no={no} disabled={busy || Boolean(room.picks[side]) || (room.turn > 1 && side !== room.opener && !room.picks[room.opener])} onClick={() => void act("pick", { cardNo: no })} />)}</div></div>}
      {room.notice && <p className={styles.notice}>{room.notice}</p>}
      {room.phase === "finished" && <div className={styles.endgame}><h1>{room.winner === "draw" ? "เสมอ" : `${room.seats[room.winner as PentadSide]?.name || "ผู้เล่น"} ชนะ`}</h1><strong>{room.score.host} : {room.score.challenger}</strong><p>{room.notice}</p><button className={styles.primary} onClick={() => void act("leave")} disabled={busy}><LogOut /> กลับล็อบบี้</button></div>}
      {side && room.phase !== "finished" && <button className={styles.surrender} title="ยอมแพ้" aria-label="ยอมแพ้" onClick={() => { if (window.confirm("ยืนยันยอมแพ้?")) void act("surrender"); }}><Flag size={18} /></button>}
    </section>}
    {mounted && room && createPortal(<div className={styles.hudPlane}><aside className={`${styles.chat} ${chatOpen ? "" : styles.chatClosed}`}><button className={styles.chatToggle} onClick={() => setChatOpen(!chatOpen)}>แชทสนาม {chatOpen ? <X size={14} /> : <Plus size={14} />}</button>{chatOpen && <><div className={styles.messages}>{room.chat.map(item => <p key={item.id}><strong>{item.name}</strong> {item.text}</p>)}<div ref={chatEnd} /></div><form onSubmit={async event => { event.preventDefault(); const text = message; if (!text.trim()) return; if (await act("chat", { text }, true)) setMessage(current => current === text ? "" : current); }}><input aria-label="ข้อความแชท" placeholder="พิมพ์ข้อความ…" value={message} maxLength={240} onChange={event => setMessage(event.target.value)} /><button aria-label="ส่งข้อความ" disabled={!message.trim()}><SendHorizontal size={18} /></button></form></>}</aside></div>, document.body)}
    {mounted && room?.phase === "target" && pendingChoice && createPortal(<div className={styles.choiceOverlay}><section className={styles.choicePanel}><small>เลือกเป้าหมายสกิล</small><h2>{triadCardByNo.get(pendingChoice.cardNo)?.name}</h2><p>{triadCardByNo.get(pendingChoice.cardNo)?.skillText}</p><strong>{countdown(pendingChoice.deadline - now)}</strong><div className={styles.choiceCards}>{pendingChoice.options.map(target => <ChoiceOption key={target} target={target} room={room} disabled={busy || side !== pendingChoice.side} onChoose={() => void act("target", { target })} />)}</div>{side !== pendingChoice.side && <p>รอ {room.seats[pendingChoice.side]?.name} เลือกเป้าหมาย</p>}</section></div>, document.body)}
    {cine && currentRound && room && (currentRound.reason.startsWith("ธาตุ") ? <ElementClash key={`${room.code}:${currentRound.id}`} round={currentRound} room={room} arenaImage={arena.image} onComplete={() => { setCompletedRound(currentRound.id); void load(roomRef.current?.code); }} /> : <BattleCinematic key={`${room.code}:${currentRound.id}`} result={cine} cardsByNo={triadCardByNo} playerCard={triadCardByNo.get(currentRound.skills.host || currentRound.mains.host)} opponentCard={triadCardByNo.get(currentRound.skills.challenger || currentRound.mains.challenger)} playerMainCard={triadCardByNo.get(currentRound.effective.host)} opponentMainCard={triadCardByNo.get(currentRound.effective.challenger)} playerName={room.seats.host?.name || "PLAYER"} opponentName={room.seats.challenger?.name || "PLAYER"} arena={arena} landscape onComplete={() => { setCompletedRound(currentRound.id); void load(roomRef.current?.code); }} />)}
  </main>;
}
