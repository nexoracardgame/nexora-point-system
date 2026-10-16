import { randomInt, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { prisma } from "./prisma";
import type { BattleForfeit } from "./battle-forfeit";
import { recordForfeitRank } from "./battle-forfeit-rank";
import { triadCardByNo, triadCards, triadSkillRuleByNo, triadSkillElementConditionMatches } from "./triad-dominion";
import { completePentadDeck, makePentadPools, emptyPentadDeck, otherPentadSide, pentadElementRelation, resolvePentadTurn, validatePentadDeck, PENTAD_DECK_MS, PENTAD_TARGET_MS, PENTAD_TURN_MS, type PentadDeck, type PentadResolution, type PentadSide, type PentadTurn } from "./pentad-dominion";

export type PentadParticipant = { id: string; name: string; image: string };
export type PentadChoice = { side: PentadSide; cardNo: string; sourceCardNo?: string; kind?: "copy"; options: string[]; value: string; deadline: number };
export type PentadRound = PentadResolution & { id: number; fight: number; turn: PentadTurn; mains: Record<PentadSide, string>; skills: Record<PentadSide, string>; opener: PentadSide; endsAt: number; finalDuel: boolean; scoreBefore?: Record<PentadSide,number>; scoreAfter?: Record<PentadSide,number> };
export type PentadRoom = {
  forfeit?: BattleForfeit;
  forfeitRankedAt?: number;
  code: string; version: number; epoch: number; createdAt: number; updatedAt: number;
  deckSource?: "all" | "random";
  access?: "public" | "private";
  passwordHash?: string;
  pools?: PentadDeck;
  seats: Record<PentadSide, PentadParticipant | null>; spectators: PentadParticipant[];
  phase: "waiting" | "deck" | "select" | "target" | "result" | "finished";
  decks: Record<PentadSide, PentadDeck>; ready: Record<PentadSide, boolean>;
  used: Record<PentadSide, string[]>; spent: string[]; board: Record<PentadSide, string[]>;
  picks: Record<PentadSide, string>; boost: Record<PentadSide, string>;
  choices: PentadChoice[]; targets: Record<PentadSide, string>;
  copiedSkills?: Record<PentadSide, string>;
  completedBy?: string[];
  score: Record<PentadSide, number>; fight: number; turn: PentadTurn; opener: PentadSide;
  deadline: number; rounds: PentadRound[]; winner: PentadSide | "draw" | ""; finalDuel: boolean;
  notice: string; chat: { id: string; name: string; text: string; at: number }[];
};
export const PENTAD_BOT_ID = "pentad-bot";
const sides: PentadSide[] = ["host", "challenger"];
const pair = <T>(value: () => T): Record<PentadSide, T> => ({ host: value(), challenger: value() });
const random = () => randomInt(0x1000000) / 0x1000000;
const choose = (cards: string[]) => cards.length ? cards[randomInt(cards.length)] : "";
const globals = globalThis as typeof globalThis & { pentadSchema?: Promise<void> };

async function ensureSchema() {
  globals.pentadSchema ??= prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PentadRoom" ("code" TEXT PRIMARY KEY, "data" JSONB NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW())`).then(() => undefined).catch(error => { globals.pentadSchema = undefined; throw error; });
  await globals.pentadSchema;
}

export function newPentadRoom(code: string, host: PentadParticipant, now = Date.now()): PentadRoom {
  return { code, version: 0, epoch: 0, createdAt: now, updatedAt: now, seats: { host, challenger: null }, spectators: [], phase: "waiting", decks: pair(emptyPentadDeck), ready: pair(() => false), used: pair(() => []), spent: [], board: pair(() => []), picks: pair(() => ""), boost: pair(() => ""), choices: [], targets: pair(() => ""), score: pair(() => 0), fight: 1, turn: 1, opener: "host", deadline: 0, rounds: [], winner: "", finalDuel: false, notice: "", chat: [] };
}
export const pentadSeat = (room: PentadRoom, id: string) => sides.find(side => room.seats[side]?.id === id);
export function pentadAvailable(room: PentadRoom, side: PentadSide, kind: "monster" | "skill") {
  const cards = kind === "monster" ? room.decks[side].monsters : room.decks[side].hand;
  const remaining = [...cards];
  for (const no of room.used[side]) { const index = remaining.indexOf(no); if (index >= 0) remaining.splice(index, 1); }
  return remaining;
}
const activeSkills = (room: PentadRoom): Record<PentadSide, string> => room.turn === 1 ? { ...room.boost } : { ...room.picks };

function finish(room: PentadRoom, winner: PentadRoom["winner"], notice: string) {
  room.phase = "finished"; room.winner = winner; room.deadline = 0; room.notice = notice; room.epoch++;
}
function startSelection(room: PentadRoom, now: number) {
  room.phase = "select"; room.picks = pair(() => ""); room.boost = pair(() => ""); room.targets = pair(() => ""); room.choices = []; room.deadline = now + PENTAD_TURN_MS; room.epoch++;
  room.copiedSkills = pair(() => ""); room.completedBy = [];
  const empty = sides.filter(side => !pentadAvailable(room, side, room.turn === 1 ? "monster" : "skill").length);
  if (empty.length) finish(room, empty.length === 2 ? "draw" : otherPentadSide(empty[0]), empty.length === 2 ? "ทั้งสองฝ่ายไม่มีการ์ดเหลือ จบเสมอ" : "อีกฝ่ายไม่มีการ์ดเหลือ");
}
function targetOptions(room: PentadRoom, side: PentadSide, no: string) {
  const rule = triadSkillRuleByNo.get(no);
  if (!rule || no === "265") return [];
  const combined = room.turn === 1;
  if (!combined && !rule.allowedTurns.includes(room.turn < 4 ? 2 : 3)) return [];
  if (no === "245") {
    const opposing = otherPentadSide(side);
    const field = [...room.board[opposing]];
    if (room.turn > 1 && room.picks[opposing]) field[room.turn - 1] = room.picks[opposing];
    return field.flatMap((cardNo, lane) => triadCardByNo.get(cardNo)?.kind === "skill" && cardNo !== "245" ? [`skill:${lane}:${cardNo}`] : []);
  }
  if (no === "254") return ["draw-skill", "reroll-own", "reroll-opponent"];
  if (no === "232") return ["player-top>bot-top", "bot-top>player-top"];
  if (!/เลือก|choose|target/i.test(rule.text) && !["own-one", "opponent-one", "any-one"].includes(rule.target)) return [];
  const candidates = rule.target.startsWith("own") ? [side] : rule.target.startsWith("opponent") ? [otherPentadSide(side)] : sides;
  return candidates.filter(target => {
    const card = triadCardByNo.get(room.board[target][0]);
    if (!card) return false;
    if (no === "225" && card.attack > 5000) return false;
    if (no === "226" && card.attack > 3000) return false;
    if (no === "231" && card.attack === card.support) return false;
    if (no === "227") {
      if (Math.max(card.attack, card.support) <= 7000) return false;
    }
    return triadSkillElementConditionMatches(rule, card);
  }).map(target => target === "host" ? "player-top" : "bot-top");
}
function prepareChoices(room: PentadRoom, now: number) {
  const skills = activeSkills(room);
  room.choices = [room.opener, otherPentadSide(room.opener)].flatMap(side => {
    const rule = triadSkillRuleByNo.get(skills[side]);
    if (room.turn === 1 && (room.finalDuel || rule?.shape !== "stat" || !rule.effects.length)) return [];
    const options = targetOptions(room, side, skills[side]);
    return options.length ? [{ side, cardNo: skills[side], ...(skills[side] === "245" ? { kind: "copy" as const } : {}), options, value: "", deadline: 0 }] : [];
  });
  room.phase = "target";
  tickChoices(room, now);
}
function tickChoices(room: PentadRoom, now: number) {
  for (let index = 0; index < room.choices.length; index++) {
    const choice = room.choices[index];
    if (choice.value) continue;
    if (!choice.deadline) choice.deadline = now + PENTAD_TARGET_MS;
    if (room.seats[choice.side]?.id === PENTAD_BOT_ID) choice.value = bestPentadTarget(room, choice);
    else if (now >= choice.deadline) choice.value = choice.options[0];
    if (!choice.value) { room.deadline = choice.deadline; return; }
    settleChoice(room, choice, index);
  }
  resolveRound(room, now);
}

function pentadBotValue(room: PentadRoom, side: PentadSide, skills: Record<PentadSide,string>, targets: Record<PentadSide,string>, copiedSkills = room.copiedSkills) {
  const result = resolvePentadTurn({fight:room.fight,turn:room.turn,mains:{host:room.board.host[0],challenger:room.board.challenger[0]},skills,opener:room.opener,targets,copiedSkills,spent:[...room.spent,...room.used.host,...room.used.challenger]});
  return (result.winner === side ? 1_000_000 : result.winner === "draw" ? 0 : -1_000_000) + Math.max(-100_000,Math.min(100_000,result.totals[side]-result.totals[otherPentadSide(side)]));
}

function bestPentadTarget(room: PentadRoom, choice: PentadChoice) {
  let best = choice.options[0], score = -Infinity;
  for (const option of choice.options) {
    const copies = {...room.copiedSkills} as Record<PentadSide,string>;
    const no = choice.kind === "copy" ? option.split(":")[2] : choice.sourceCardNo || choice.cardNo;
    if (choice.kind === "copy") copies[choice.side] = no;
    const follow = choice.kind === "copy" ? targetOptions(room,choice.side,no) : [option];
    for (const target of follow.length ? follow : [""]) {
      const value = pentadBotValue(room,choice.side,activeSkills(room),{...room.targets,[choice.side]:target},copies);
      if (value > score) {score=value;best=option;}
    }
  }
  return best;
}

function choosePentadBotCard(room: PentadRoom, side: PentadSide, available: string[]) {
  const enemy=otherPentadSide(side);
  if (room.turn === 1) {
    const rivals=pentadAvailable(room,enemy,"monster");
    return available.map(no=>{
      const own=triadCardByNo.get(no)!;
      const strength=rivals.reduce((sum,other)=>{const card=triadCardByNo.get(other)!;const relation=pentadElementRelation(own.element,card.element);return sum+(relation.winner==="host"?100_000:relation.winner==="challenger"?-100_000:own.attack+own.support-card.attack-card.support);},0)/Math.max(1,rivals.length);
      const synergy=pentadAvailable(room,side,"skill").reduce((sum,skill)=>{const rule=triadSkillRuleByNo.get(skill);return sum+(rule?.target.startsWith("own")&&triadSkillElementConditionMatches(rule,own)?rule.effects.reduce((n,e)=>n+Math.max(0,e.delta),0):0);},0);
      return {no,value:strength+synergy*.2};
    }).sort((a,b)=>b.value-a.value)[0]?.no || "";
  }
  const responses=room.picks[enemy]?[room.picks[enemy]]:pentadAvailable(room,enemy,"skill");
  return available.map(no=>{
    let worst=Infinity,total=0;
    for(const response of responses.length?responses:[""]){
      const skills={...room.picks,[side]:no,[enemy]:response};
      const options=targetOptions(room,side,no);let best=-Infinity;
      for(const option of options.length?options:[""]){
        const copies={...room.copiedSkills} as Record<PentadSide,string>;
        const copied=no==="245"?option.split(":")[2]:"";
        if(copied)copies[side]=copied;
        const follow=copied?targetOptions(room,side,copied):[option];
        for(const target of follow.length?follow:[""]){
          const enemyOptions=targetOptions(room,enemy,response);let risk=Infinity;
          for(const enemyTarget of enemyOptions.length?enemyOptions:[""]){
            risk=Math.min(risk,pentadBotValue(room,side,skills,{...room.targets,[side]:target,[enemy]:enemyTarget},copies));
          }
          best=Math.max(best,risk);
        }
      }
      worst=Math.min(worst,best);total+=best;
    }
    const rule=triadSkillRuleByNo.get(no);
    const future=rule?.allowedTurns.some(turn=>turn===(room.turn<3?2:3))?rule.effects.reduce((n,e)=>n+Math.abs(e.delta),0):0;
    return {no,value:worst*.7+total/Math.max(1,responses.length)*.3-future*.02};
  }).sort((a,b)=>b.value-a.value)[0]?.no || "";
}

function tournamentPentadDeck(room: PentadRoom) {
  let best: PentadDeck | undefined, value=-Infinity;
  for (let attempt=0;attempt<8;attempt++) {
    const deck=completePentadDeck(emptyPentadDeck(),random,room.pools);
    const monsters=deck.monsters.map(no=>triadCardByNo.get(no)!);
    const score=monsters.reduce((sum,card)=>sum+card.attack+card.support,0)+deck.hand.reduce((sum,no)=>{
      const rule=triadSkillRuleByNo.get(no);if(!rule)return sum;
      const coverage=rule.target.startsWith("own")?monsters.filter(card=>triadSkillElementConditionMatches(rule,card)).length/5:1;
      const power=rule.effects.reduce((n,e)=>n+Math.abs(e.delta),0);
      return sum+coverage*(power+(rule.blockedUseMetric?10000:rule.shape==="skill-cancel"?9000:rule.shape==="swap-control"?8000:3000));
    },0);
    if(score>value){best=deck;value=score;}
  }
  return best!;
}
function settleChoice(room: PentadRoom, choice: PentadChoice, index: number) {
  if (choice.kind === "copy") {
    const cardNo = choice.value.split(":")[2];
    room.copiedSkills ??= pair(() => ""); room.copiedSkills[choice.side] = cardNo;
    const options = targetOptions(room, choice.side, cardNo);
    if (options.length && !room.choices.some(item => item.side === choice.side && item.sourceCardNo === cardNo)) {
      room.choices.splice(index + 1, 0, { side: choice.side, cardNo: "245", sourceCardNo: cardNo, options, value: "", deadline: 0 });
    }
  } else room.targets[choice.side] = choice.value;
}
function resolveRound(room: PentadRoom, now: number) {
  const mains = { host: room.board.host[0], challenger: room.board.challenger[0] };
  const skills = activeSkills(room);
  const blessingEvents: PentadResolution["events"] = [];
  for (const side of [room.opener, otherPentadSide(room.opener)]) {
    const blessingCopy = skills[side] === "245" && room.copiedSkills?.[side] === "254";
    if ((skills[side] !== "254" && !blessingCopy) || room.turn === 1) continue;
    const action = room.targets[side];
    const kind = action === "draw-skill" ? "skill" : "monster";
    const excluded = new Set([...room.used.host, ...room.used.challenger, ...room.spent, mains.host, mains.challenger, "254"]);
    const no = choose(triadCards.filter(card => card.kind === kind && !excluded.has(card.cardNo)).map(card => card.cardNo));
    if (no) {
      if (kind === "skill") {
        if (blessingCopy) room.copiedSkills![side] = no;
        else skills[side] = no;
      }
      else mains[action === "reroll-opponent" ? otherPentadSide(side) : side] = no;
      room.spent.push(no);
      blessingEvents.push({ side: side === "host" ? "player" : "opponent", cardNo: "254", name: "ขอพรศักดิ์สิทธิ์", type: "stat", text: "", summary: `ขอพรศักดิ์สิทธิ์ สุ่ม No.${no} เฉพาะตานี้` });
    }
  }
  const result = resolvePentadTurn({ fight: room.fight, turn: room.turn, mains, skills, opener: room.opener, targets: room.targets, copiedSkills: room.copiedSkills, finalDuel: room.finalDuel, spent: [...room.used.host, ...room.used.challenger, ...room.spent] });
  for (const no of Object.values(result.effective)) if (!Object.values(mains).includes(no)) room.spent.push(no);
  result.events.unshift(...blessingEvents);
  for (const event of result.events) {
    if (event.cardNo !== "265" || event.blocked) continue;
    const target = event.side === "player" ? "challenger" : "host";
    if (result.effective[target] !== mains[target]) room.board[target][0] = result.effective[target];
  }
  room.score = pair(()=>0);
  for (const previous of room.rounds) if (previous.winner !== "draw" && !previous.finalDuel) room.score[previous.winner]++;
  const scoreBefore = { ...room.score };
  if (result.winner !== "draw" && !room.finalDuel) room.score[result.winner]++;
  const duration = (result.reason.startsWith("ธาตุ") ? 5500 : 12_000 + result.events.reduce((time, event) => time + Math.max(3500, Math.min(7000, event.summary.length * 35)), 0)) + (result.stages?.length || 0) * 3000;
  const round: PentadRound = { ...result, id: room.rounds.length + 1, fight: room.fight, turn: room.turn, mains, skills, opener: room.opener, endsAt: now + duration, finalDuel: room.finalDuel, scoreBefore, scoreAfter: { ...room.score } };
  room.rounds.push(round); room.phase = "result"; room.deadline = round.endsAt; room.epoch++;
  room.completedBy = [];
}
function revealPicks(room: PentadRoom, now: number) {
  for (const side of sides) {
    room.used[side].push(room.picks[side]);
    room.board[side][room.turn - 1] = room.picks[side];
  }
  if (room.turn === 1 && !room.finalDuel) {
    const relation = pentadElementRelation(triadCardByNo.get(room.picks.host)!.element, triadCardByNo.get(room.picks.challenger)!.element);
    if (!relation.winner && relation.boosted) {
      const reserve = room.decks[relation.boosted].reserve;
      const no = choose(reserve);
      if (no) { reserve.splice(reserve.indexOf(no), 1); room.boost[relation.boosted] = no; room.spent.push(no); }
    }
    if (relation.winner) { resolveRound(room, now); return; }
  }
  prepareChoices(room, now);
}

export function tickPentadRoom(room: PentadRoom, now = Date.now()) {
  if (room.phase === "deck") {
    if (room.deckSource === "random" && !room.pools) {
      room.pools=makePentadPools(random);room.decks=pair(emptyPentadDeck);room.ready=pair(()=>false);room.epoch++;room.deadline=now+PENTAD_DECK_MS;
      if (room.seats.challenger?.id===PENTAD_BOT_ID) {room.decks.challenger=tournamentPentadDeck(room);room.ready.challenger=true;}
      room.notice="อัปเดตเป็นพูลสุ่มกองละ 20 ใบ เลือกเด็คใหม่ได้แล้ว";
    }
    if (now >= room.deadline) for (const side of sides) { room.decks[side] = completePentadDeck(room.decks[side], random,room.pools); room.ready[side] = true; }
    if (sides.every(side => room.ready[side])) { room.board = pair(() => []); startSelection(room, now); }
  }
  if (room.phase === "result" && now >= room.deadline) {
    const last = room.rounds.at(-1)!;
    if ((room.turn === 1 || room.finalDuel) && last.winner === "draw") {
      room.board = pair(() => []); room.notice = "มอนสเตอร์เสมอทั้งพลังรวม ATK และ SUP ทิ้งทั้งสองใบแล้วเลือกใหม่"; startSelection(room, now);
    } else if (room.finalDuel) finish(room, last.winner, "จบการตัดสินมอนสเตอร์ที่เหลือ");
    else {
      if (last.winner !== "draw") room.opener = last.winner;
      if (room.turn < 5) room.turn = (room.turn + 1) as PentadTurn;
      else if (room.fight < 3) { room.fight++; room.turn = 1; room.board = pair(() => []); }
      else if (room.score.host !== room.score.challenger) { finish(room, room.score.host > room.score.challenger ? "host" : "challenger", "ครบ 15 ตา ตัดสินด้วยคะแนนรวม"); return; }
      else { room.finalDuel = true; room.turn = 1; room.board = pair(() => []); room.notice = "คะแนนรวมเสมอ เลือกมอนสเตอร์ที่เหลือวัด ATK + SUP"; }
      startSelection(room, now);
    }
  }
  if (room.phase === "select") {
    for (const side of sides) {
      const shouldPick = room.turn === 1 || side === room.opener || Boolean(room.picks[room.opener]);
      if (!room.picks[side] && shouldPick && (room.seats[side]?.id === PENTAD_BOT_ID || now >= room.deadline)) {
        const available = pentadAvailable(room, side, room.turn === 1 ? "monster" : "skill");
        if (room.seats[side]?.id === PENTAD_BOT_ID) room.picks[side] = choosePentadBotCard(room,side,available);
        else room.picks[side] = choose(available);
      }
    }
    if (sides.every(side => room.picks[side])) revealPicks(room, now);
  }
  if (room.phase === "target") tickChoices(room, now);
}

export function applyPentadAction(room: PentadRoom, actor: PentadParticipant, body: Record<string, unknown>, now = Date.now()) {
  const action = String(body.action || "");
  const side = pentadSeat(room, actor.id);
  const requirePhase = (...phases: PentadRoom["phase"][]) => { if (!phases.includes(room.phase)) throw new Error("สถานะเกมเปลี่ยนแล้ว กรุณาลองอีกครั้ง"); };
  const requireSeat = () => { if (!side) throw new Error("เฉพาะผู้เล่นเท่านั้น"); return side; };
  if (action === "join") {
    if (room.forfeit?.loser.id === actor.id) throw new Error("ออกจากสนามแล้ว ไม่สามารถกลับเข้าร่วมได้");
    if (side || room.spectators.some(p => p.id === actor.id)) return;
    if (room.access === "private") {
      const [salt,hash]=String(room.passwordHash || "").split(":");
      const expected=Buffer.from(hash || "","hex"),actual=scryptSync(String(body.password || ""),salt || "",32);
      if (expected.length !== actual.length || !timingSafeEqual(expected,actual)) throw new Error("รหัสผ่านห้องไม่ถูกต้อง");
    }
    if (room.phase === "waiting" && !room.seats.challenger && !body.spectate) room.seats.challenger = actor;
    else { if (room.spectators.length >= 10) throw new Error("ผู้ชมเต็มแล้ว"); room.spectators.push(actor); }
    return;
  }
  if (!side && !room.spectators.some(p => p.id === actor.id)) {
    if (action === "leave") return;
    throw new Error("กรุณาเข้าร่วมห้องก่อน");
  }
  if (action === "chat") {
    const text = String(body.text || "").trim().slice(0, 240);
    if (!text) return;
    if (room.chat.some(item => item.id.startsWith(`${actor.id}:`) && now - item.at < 600)) throw new Error("ส่งข้อความเร็วเกินไป");
    room.chat.push({ id: `${actor.id}:${now}`, name: actor.name, text, at: now }); room.chat = room.chat.slice(-80); return;
  }
  if (action === "leave") {
    if (side) {
      if (!["waiting", "finished"].includes(room.phase)) {
        const winner = otherPentadSide(side);
        if (room.seats[winner]) room.forfeit = { at: now, winner: room.seats[winner]!, loser: actor };
        finish(room, winner, "อีกฝ่ายออกจากเกม");
      }
      room.seats[side] = null;
      if (side === "host" && room.phase === "waiting" && room.seats.challenger && room.seats.challenger.id !== PENTAD_BOT_ID) { room.seats.host = room.seats.challenger; room.seats.challenger = null; }
    }
    room.spectators = room.spectators.filter(p => p.id !== actor.id); return;
  }
  if (action === "bot") { requirePhase("waiting"); if (requireSeat() !== "host" || (room.seats.challenger && room.seats.challenger.id !== PENTAD_BOT_ID)) throw new Error("เพิ่มบอทไม่ได้"); room.seats.challenger = room.seats.challenger ? null : { id: PENTAD_BOT_ID, name: "BOT Level.99", image: "/avatar.png" }; return; }
  if (action === "start") {
    requirePhase("waiting"); if (requireSeat() !== "host" || !room.seats.challenger) throw new Error("รอผู้ท้าชิงก่อน");
    room.phase = "deck"; room.deadline = now + PENTAD_DECK_MS; room.epoch++;
    if (room.deckSource === "random") {
      room.pools = makePentadPools(random);
      room.decks = pair(emptyPentadDeck);
    }
    if (room.seats.challenger.id === PENTAD_BOT_ID) { room.decks.challenger = tournamentPentadDeck(room); room.ready.challenger = true; }
    return;
  }
  if (action === "refresh") return;
  if (action === "complete") {
    if (room.phase !== "result" || Number(body.roundId) !== room.rounds.at(-1)?.id || !side) return;
    room.completedBy = [...new Set([...(room.completedBy || []), actor.id])];
    if (sides.every(player => room.seats[player]?.id === PENTAD_BOT_ID || room.completedBy!.includes(room.seats[player]?.id || ""))) room.deadline = now;
    return;
  }
  const player = requireSeat();
  if (action === "target" && Number(body.epoch) === room.epoch - 1 && room.phase === "result") return;
  if (Number(body.epoch) !== room.epoch) throw new Error("คำสั่งนี้เป็นของตาก่อนหน้า");
  if (action === "deck" || action === "ready") {
    requirePhase("deck");
    if (room.ready[player]) throw new Error("ยืนยันเด็คแล้ว");
    const raw = body.deck as Partial<PentadDeck> | undefined;
    const deck = { monsters: raw?.monsters, hand: raw?.hand, reserve: raw?.reserve };
    if (!Object.values(deck).every(cards => Array.isArray(cards) && cards.every(no => typeof no === "string"))) throw new Error("ข้อมูลเด็คไม่ถูกต้อง");
    const valid = deck as PentadDeck;
    if (room.pools && (["monsters","hand","reserve"] as const).some(group=>valid[group].some(no=>!room.pools![group].includes(no)))) throw new Error("การ์ดไม่ได้อยู่ในพูลของกองนี้");
    const errors = validatePentadDeck(valid, action === "deck");
    if (errors.length) throw new Error(errors.join(" / "));
    completePentadDeck(valid,random,room.pools);
    room.decks[player] = structuredClone(valid); room.ready[player] = action === "ready"; return;
  }
  if (action === "surrender") { requirePhase("deck", "select", "target", "result"); finish(room, otherPentadSide(player), "ยอมแพ้"); return; }
  if (action === "pick") {
    requirePhase("select");
    if (room.picks[player]) return;
    if (room.turn > 1 && player !== room.opener && !room.picks[room.opener]) throw new Error("รอฝ่ายเปิดก่อนลงสกิล");
    const no = String(body.cardNo || "");
    if (!pentadAvailable(room, player, room.turn === 1 ? "monster" : "skill").includes(no)) throw new Error("การ์ดนี้ใช้ไปแล้วหรือไม่ได้อยู่ในมือ");
    room.picks[player] = no; return;
  }
  if (action === "target") {
    requirePhase("target");
    const requested = body.choiceIndex === undefined ? undefined : room.choices[Number(body.choiceIndex)];
    if (requested && requested.side === player && requested.value === String(body.target) && requested.cardNo === body.cardNo && (requested.sourceCardNo || "") === (body.sourceCardNo || "")) return;
    const choice = room.choices.find(item => !item.value);
    if (!choice || choice.side !== player) throw new Error("ยังไม่ถึงลำดับเลือกเป้าหมาย");
    if (body.choiceIndex !== undefined && (requested !== choice || choice.cardNo !== body.cardNo || (choice.sourceCardNo || "") !== (body.sourceCardNo || ""))) throw new Error("คำขอเลือกเป้าหมายเปลี่ยนแล้ว");
    const value = String(body.target || "");
    if (!choice.options.includes(value)) throw new Error("เป้าหมายไม่เข้าเงื่อนไข");
    choice.value = value; settleChoice(room, choice, room.choices.indexOf(choice)); return;
  }
  throw new Error("ไม่พบคำสั่ง");
}

export function publicPentadRoom(room: PentadRoom, id: string) {
  const copy = structuredClone(room);
  delete copy.passwordHash;
  const side = pentadSeat(room, id);
  // Opposing deck order and concealed picks never cross the API boundary.
  for (const seat of sides) if (seat !== side) {
    copy.decks[seat] = { monsters: [], hand: [], reserve: Array(room.decks[seat].reserve.length).fill("") };
    if (room.phase === "select") {
      copy.picks[seat] = room.picks[seat] ? "hidden" : "";
      copy.board[seat][room.turn-1] = "";
      copy.boost[seat] = "";
    }
    if (room.phase !== "result" && room.phase !== "finished") {
      copy.targets[seat] = "";
      if (copy.copiedSkills) copy.copiedSkills[seat] = "";
      copy.choices = copy.choices.map(choice => choice.side === seat ? { ...choice, options: [], value: "" } : choice);
    }
  }
  return copy;
}

export async function createPentadRoom(actor: PentadParticipant, deckSource: "all" | "random" = "all", options: {access?:string;password?:string;playWithBot?:boolean} = {}) {
  await ensureSchema();
  const access=options.access === "private" ? "private" : "public";
  const password=String(options.password || "").trim();
  if (access === "private" && (password.length < 4 || password.length > 128)) throw new Error("รหัสห้องส่วนตัวต้องมี 4–128 ตัว");
  for (let attempt = 0; attempt < 8; attempt++) {
    const room = newPentadRoom(String(randomInt(100000, 1000000)), actor);
    room.deckSource = deckSource;
    room.access=access;
    if (access === "private") { const salt=randomBytes(16).toString("hex");room.passwordHash=`${salt}:${scryptSync(password,salt,32).toString("hex")}`; }
    if (options.playWithBot) { applyPentadAction(room,actor,{action:"bot"});applyPentadAction(room,actor,{action:"start"}); }
    const inserted = await prisma.$executeRawUnsafe(`INSERT INTO "PentadRoom" ("code", "data") VALUES ($1, $2::jsonb) ON CONFLICT DO NOTHING`, room.code, JSON.stringify(room));
    if (inserted) return publicPentadRoom(room,actor.id);
  }
  throw new Error("สร้างห้องไม่สำเร็จ กรุณาลองอีกครั้ง");
}

export async function mutatePentadRoom(code: string, actor: PentadParticipant, body?: Record<string, unknown>) {
  await ensureSchema();
  if (!body) {
    const rows = await prisma.$queryRawUnsafe<{ data: PentadRoom }[]>(`SELECT "data" FROM "PentadRoom" WHERE "code" = $1`, code);
    const room = rows[0]?.data;
    if (!room) throw new Error("ไม่พบห้อง");
    if (!pentadSeat(room, actor.id) && !room.spectators.some(p => p.id === actor.id)) throw new Error("กรุณาเข้าร่วมห้องก่อน");
    const now = Date.now();
    const pending = room.choices.find(choice => !choice.value);
    const botCanPick = sides.some(side => room.seats[side]?.id === PENTAD_BOT_ID && !room.picks[side] && (room.turn === 1 || side === room.opener || Boolean(room.picks[room.opener])));
    const needsTick = (room.deadline > 0 && now >= room.deadline) ||
      (room.phase === "deck" && room.deckSource === "random" && !room.pools) ||
      (room.phase === "deck" && sides.every(side => room.ready[side])) ||
      (room.phase === "select" && (botCanPick || sides.every(side => room.picks[side]))) ||
      (room.phase === "target" && (!pending || !pending.deadline || now >= pending.deadline || room.seats[pending.side]?.id === PENTAD_BOT_ID));
    // Idle spectator reads never contend with a player's card mutation lock.
    if (!needsTick) return publicPentadRoom(room, actor.id);
  }
  // PostgreSQL row locks protect simultaneous commands across separate server instances.
  return prisma.$transaction(async tx => {
    const rows = await tx.$queryRawUnsafe<{ data: PentadRoom }[]>(`SELECT "data" FROM "PentadRoom" WHERE "code" = $1 FOR UPDATE`, code);
    const room = rows[0]?.data;
    if (!room) throw new Error("ไม่พบห้อง");
    const before = JSON.stringify(room);
    const now = Date.now(); tickPentadRoom(room, now);
    if (body) applyPentadAction(room, actor, body, now);
    else if (!pentadSeat(room, actor.id) && !room.spectators.some(p => p.id === actor.id)) throw new Error("กรุณาเข้าร่วมห้องก่อน");
    tickPentadRoom(room, now);
    if (room.forfeit && !room.forfeitRankedAt) {
      if (![room.forfeit.winner.id, room.forfeit.loser.id].includes(PENTAD_BOT_ID)) await recordForfeitRank(tx, `pentad:${room.code}:${room.createdAt}`, room.forfeit);
      room.forfeitRankedAt = now;
    }
    if (body?.action === "leave" && !sides.some(side=>room.seats[side] && room.seats[side]!.id !== PENTAD_BOT_ID)) {
      await tx.$executeRawUnsafe(`DELETE FROM "PentadRoom" WHERE "code" = $1`,code);
      return null;
    }
    if (before !== JSON.stringify(room)) {
      room.version++; room.updatedAt = now;
      await tx.$executeRawUnsafe(`UPDATE "PentadRoom" SET "data" = $2::jsonb, "updatedAt" = NOW() WHERE "code" = $1`, code, JSON.stringify(room));
    }
    return publicPentadRoom(room, actor.id);
  }, { timeout: 10_000 });
}
export async function listPentadRooms() {
  await ensureSchema();
  await prisma.$executeRawUnsafe(`DELETE FROM "PentadRoom" WHERE COALESCE("data"->'seats'->'host'->>'id','') IN ('','pentad-bot') AND COALESCE("data"->'seats'->'challenger'->>'id','') IN ('','pentad-bot')`);
  const rows = await prisma.$queryRawUnsafe<{ data: PentadRoom }[]>(`SELECT "data" FROM "PentadRoom" WHERE "updatedAt" > NOW() - INTERVAL '2 hours' ORDER BY "updatedAt" DESC LIMIT 80`);
  return rows.filter(({data})=>data.access !== "private").map(({ data }) => ({ code: data.code, phase: data.phase, host: data.seats.host?.name || "PLAYER", challenger: data.seats.challenger?.name || "", spectators: data.spectators.length }));
}
