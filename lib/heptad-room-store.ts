import { randomInt, randomBytes, scryptSync } from 'node:crypto';
import { prisma } from './prisma';
import { newPentadRoom, applyPentadAction, publicPentadRoom, pentadSeat, PENTAD_BOT_ID, type PentadRoom, type PentadParticipant } from './pentad-room-store';
import { pentadElementRelation, otherPentadSide, type PentadSide } from './pentad-dominion';
import { triadCards,triadCardByNo, triadSkillRuleByNo, triadSkillElementConditionMatches } from './triad-dominion';
import {battleBotOutcome,battleBotRisk} from './battle-bot-evaluation';
import { completeHeptadMatchDeck, emptyHeptadDeck, heptadCanCallSpecial, HEPTAD_TURNS, HEPTAD_TIERS, validateHeptadMatchDeck, type HeptadDeck, type HeptadTurn, type HeptadTier, type HeptadBoard, type HeptadFight } from './heptad-rules';
import { resolveHeptadClash, type HeptadCast, type HeptadResult } from './heptad-resolution';
import { recordForfeitRank } from './battle-forfeit-rank';
import { PENTAD_ELEMENT_SCENE_MS } from './pentad-element-presentation';
import { legalTargetPreview } from './battle-target-preview';

const sides=['host','challenger'] as const;
const pair=<T>(value:()=>T):Record<PentadSide,T>=>({host:value(),challenger:value()});
const random=()=>randomInt(0x1000000)/0x1000000;
export type HeptadRound=HeptadResult&{id:number;fight:number;turn:HeptadTurn;board:Record<PentadSide,HeptadBoard>;casts:HeptadCast[];finalDuel:boolean;elementPresented?:boolean};
type Choice=HeptadCast&{options:string[];value:string;preview?:string;copyChoice?:boolean};
export type HeptadRoom={
  code:string;version:number;createdAt:number;updatedAt:number;lobby:PentadRoom;tier:HeptadTier;
  phase:'waiting'|'deck'|'select'|'element'|'special'|'target'|'result'|'finished';epoch:number;deadline:number;
  decks:Record<PentadSide,HeptadDeck[]>;ready:Record<PentadSide,boolean>;used:Record<PentadSide,string[][]>;
  board:Record<PentadSide,HeptadBoard>;picks:Record<PentadSide,string>;special:Record<PentadSide,string>;
  specialUsed:Record<PentadSide,number>;specialOrder:PentadSide[];choices:Choice[];casts:HeptadCast[];
  score:Record<PentadSide,number>;fight:HeptadFight;turn:HeptadTurn;opener:PentadSide;
  finalDuel:boolean;finalPool:Record<PentadSide,string[]>;rounds:HeptadRound[];
  winner:PentadSide|'draw'|'';notice:string;rankedAt?:number;completedBy?:string[];elementPresented?:boolean;elementCompletedBy?:string[];temporaryMains?:Partial<Record<PentadSide,string>>;
};
export function newHeptadRoom(code:string,actor:PentadParticipant,now=Date.now()):HeptadRoom{
  return {code,version:0,createdAt:now,updatedAt:now,lobby:newPentadRoom(code,actor,now),tier:'all',phase:'waiting',epoch:0,deadline:0,
    decks:pair(()=>Array.from({length:3},emptyHeptadDeck)),ready:pair(()=>false),used:pair(()=>[[],[],[]]),board:pair(()=>({})),picks:pair(()=>''),special:pair(()=>''),specialUsed:pair(()=>0),specialOrder:[],choices:[],casts:[],score:pair(()=>0),fight:1,turn:1,opener:'host',finalDuel:false,finalPool:pair(()=>[]),rounds:[],winner:'',notice:''};
}
export const heptadSeat=(room:HeptadRoom,id:string)=>pentadSeat(room.lobby,id);
const bot=(room:HeptadRoom,side:PentadSide)=>room.lobby.seats[side]?.id===PENTAD_BOT_ID;
const member=(room:HeptadRoom,id:string)=>Boolean(heptadSeat(room,id)||room.lobby.spectators.some(person=>person.id===id));
export function heptadAvailable(room:HeptadRoom,side:PentadSide):string[]{
  if(room.finalDuel)return room.finalPool[side];
  const deck=room.decks[side][room.fight-1];
  const pile=HEPTAD_TURNS[room.turn-1].kind==='monster'?deck.monsters:deck.skills;
  const remaining=[...pile];for(const no of room.used[side][room.fight-1]){const index=remaining.indexOf(no);if(index>=0)remaining.splice(index,1);}return remaining;
}
function finish(room:HeptadRoom,winner:HeptadRoom['winner'],notice:string){room.phase='finished';room.winner=winner;room.notice=notice;room.deadline=0;room.epoch++;room.lobby.phase='finished';}
function selection(room:HeptadRoom,now:number){
  room.elementPresented=false;room.elementCompletedBy=[];
  room.phase='select';room.picks=pair(()=>'');room.special=pair(()=>'');room.specialOrder=[];room.casts=[];room.choices=[];room.temporaryMains={};room.deadline=now+120000;room.epoch++;
  const empty=sides.filter(side=>!heptadAvailable(room,side).length);
  if(empty.length)finish(room,room.score.host===room.score.challenger?'draw':room.score.host>room.score.challenger?'host':'challenger','การ์ดที่ใช้ตัดสินหมดแล้ว นับคะแนนสะสม');
}
function use(room:HeptadRoom,side:PentadSide,no:string){if(no&&no!=='__pass__')room.used[side][room.fight-1].push(no);}
function remainingMonsters(room:HeptadRoom,side:PentadSide){return room.decks[side].flatMap((deck,index)=>{
  const cards=[...deck.monsters,...deck.monsterReserve];for(const no of room.used[side][index]){const i=cards.indexOf(no);if(i>=0)cards.splice(i,1);}return cards;
});}
function targetOptions(room:HeptadRoom,cast:HeptadCast):string[]{
  const no=cast.copied||cast.cardNo,rule=triadSkillRuleByNo.get(no);if(!rule)return [];
  if(no==='245')return [...new Set(Object.values(room.board[otherPentadSide(cast.side)]).filter(value=>triadCardByNo.get(value||'')?.kind==='skill'&&value!=='245'))].map(value=>`copy:${value}`);
  if(no==='254')return ['draw-skill','reroll-own','reroll-opponent'];
  if(no==='232'){
    const slots=room.turn===1?[1]:[1,room.turn<=4?2:5];
    const targets=sides.flatMap(side=>slots.filter(slot=>triadCardByNo.get(room.board[side][slot as HeptadTurn]||'')?.kind==='monster').map(slot=>`${side==='host'?'player':'bot'}-${slot===1?'top':'secondary'}`));
    return targets.flatMap(first=>targets.filter(second=>second!==first).map(second=>`${first}>${second}`));
  }
  if(!/เลือก|choose|target/i.test(rule.text)&&!['own-one','opponent-one','any-one'].includes(rule.target))return [];
  const candidates=rule.target.startsWith('own')?[cast.side]:rule.target.startsWith('opponent')?[otherPentadSide(cast.side)]:sides;
  const branch=room.turn<=4?2:5;
  return candidates.flatMap(side=>(room.turn===1?[1]:[1,branch]).filter(slot=>{const card=triadCardByNo.get(room.board[side][slot as HeptadTurn]||'');if(card?.kind!=='monster')return false;
    if(no==='225'&&card.attack>5000||no==='226'&&card.attack>3000||no==='231'&&card.attack===card.support||no==='227'&&Math.max(card.attack,card.support)<=7000)return false;
    return triadSkillElementConditionMatches(rule,card);
  }).map(slot=>`${side==='host'?'player':'bot'}-${slot===1?'top':'secondary'}`));
}
function resolve(room:HeptadRoom,now:number){
  const board=structuredClone(room.board);
  for(const side of sides)if(room.temporaryMains?.[side])board[side][1]=room.temporaryMains[side];
  const result=resolveHeptadClash({board,turn:room.turn,opener:room.opener,casts:room.casts,finalDuel:room.finalDuel,seed:`heptad:${room.code}:${room.fight}:${room.turn}:${room.rounds.length}`});
  const round:HeptadRound={...result,id:room.rounds.length+1,fight:room.fight,turn:room.turn,board,casts:structuredClone(room.casts),finalDuel:room.finalDuel,elementPresented:room.elementPresented};
  room.rounds.push(round);
  if(!room.finalDuel&&result.winner!=='draw')room.score[result.winner]++;
  const supportScenes=room.turn>1&&!room.finalDuel?14000:0;
  room.completedBy=[];room.phase='result';room.deadline=now+Math.max(12000,Math.min(90000,12000+result.events.length*6500+supportScenes+(result.elementClash?8000:0)));room.epoch++;
}
function prepareTargets(room:HeptadRoom,now:number){
  room.phase='target';room.choices=room.casts.map(cast=>({...cast,options:targetOptions(room,cast),value:''})).filter(choice=>choice.options.length);
  room.deadline=now+30000;room.epoch++;tickTargets(room,now);
}
function settleTarget(room:HeptadRoom,choice:Choice,value:string){
  choice.value=value;
  const cast=room.casts.find(item=>item.side===choice.side&&item.kind===choice.kind&&item.cardNo===choice.cardNo);if(!cast)return;
  if(value==='__expired__'){room.casts=room.casts.filter(item=>item!==cast);return;}
  if(value.startsWith('copy:')){
    cast.copied=value.slice(5);const options=targetOptions(room,cast);
    if(options.length)room.choices.splice(room.choices.indexOf(choice)+1,0,{...cast,options,value:'',copyChoice:true});return;
  }
  cast.target=value;
  if((cast.copied||cast.cardNo)==='254'){
    const side=value==='reroll-opponent'?otherPentadSide(cast.side):cast.side;
    const deck=room.decks[side][room.fight-1];const no=(value==='draw-skill'?deck.skillReserve:deck.monsterReserve).shift();
    if(no){if(value==='draw-skill'){cast.cardNo=no;cast.copied=undefined;const options=targetOptions(room,cast);if(options.length)room.choices.push({...cast,options,value:''});}
      else{room.temporaryMains??={};room.temporaryMains[side]=no;room.casts=room.casts.filter(item=>item!==cast);}}
    else room.casts=room.casts.filter(item=>item!==cast);
  }
}
function tickTargets(room:HeptadRoom,now:number){
  for(const choice of room.choices){if(choice.value)continue;
    if(bot(room,choice.side)){
      let best=choice.options[0],value=-Infinity;
      for(const option of choice.options){const trial=structuredClone(room);const cloned=trial.choices[room.choices.indexOf(choice)];settleTarget(trial,cloned,option);const score=heptadBotValue(trial,choice.side,trial.casts);if(score>value){value=score;best=option;}}
      settleTarget(room,choice,best);
    }
    else if(now>=room.deadline)settleTarget(room,choice,'__expired__');
    else return;
  }
  resolve(room,now);
}
function reveal(room:HeptadRoom,now:number){
  for(const side of sides){const no=room.picks[side];room.board[side][room.turn]=no==='__pass__'?'':no;use(room,side,no);
    if(room.finalDuel){const i=room.finalPool[side].indexOf(no);if(i>=0)room.finalPool[side].splice(i,1);}}
  room.casts=[];
  const order=room.specialOrder.length?room.specialOrder:[room.opener,otherPentadSide(room.opener)];
  for(const side of order)if(room.special[side]&&room.special[side]!=='__decline__')room.casts.push({side,cardNo:room.special[side],kind:'special'});
  if([1,2,5].includes(room.turn)&&!room.finalDuel){
    const a=triadCardByNo.get(room.picks.host),b=triadCardByNo.get(room.picks.challenger);
    const relation=a&&b?pentadElementRelation(a.element,b.element):null;
    if(relation?.winner){resolve(room,now);return;}
    if(relation?.boosted){const side=relation.boosted,no=room.decks[side][room.fight-1].skillReserve.shift();if(no)room.casts.push({side,cardNo:no,kind:'boost'});}
  }
  if(!room.finalDuel&&HEPTAD_TURNS[room.turn-1].kind==='skill')for(const side of [room.opener,otherPentadSide(room.opener)])if(room.picks[side]!=='__pass__')room.casts.push({side,cardNo:room.picks[side],kind:'normal'});
  prepareTargets(room,now);
}
function heptadBotValue(room:HeptadRoom,side:PentadSide,casts:HeptadCast[]){
 const result=resolveHeptadClash({board:room.board,turn:room.turn,opener:room.opener,casts,finalDuel:room.finalDuel,seed:`bot:${room.code}:${room.fight}:${room.turn}`});
 return battleBotOutcome(result.winner,side,result.totals[side],result.totals[otherPentadSide(side)]);
}
function bestHeptadCast(room:HeptadRoom,side:PentadSide,no:string,kind:HeptadCast['kind'],base:HeptadCast[]=[]){
 const cast:HeptadCast={side,cardNo:no,kind};let best=-Infinity,target='';
 const options=targetOptions(room,cast);
 for(const option of options.length?options:['']){
  const trial=structuredClone(room);trial.casts=[...base,{...cast}];
  if(option){const choice:Choice={...cast,options,value:''};trial.choices=[choice];settleTarget(trial,choice,option);
   // Copy effects can introduce a second target decision; search that too.
   const follow=trial.choices.find(item=>!item.value);
   if(follow){for(const next of follow.options){const copied=structuredClone(trial);settleTarget(copied,copied.choices.find(item=>!item.value)!,next);const score=heptadBotValue(copied,side,copied.casts);if(score>best){best=score;target=option;}}continue;}
  }
  const score=heptadBotValue(trial,side,trial.casts);if(score>best){best=score;target=option;}
 }
 return {score:best,target};
}
export function chooseHeptadBotCard(room:HeptadRoom,side:PentadSide,available=heptadAvailable(room,side)){
 const enemy=otherPentadSide(side),kind=HEPTAD_TURNS[room.turn-1].kind;
 // Opposing unrevealed hands and picks never enter the search.
 const seen=new Set([...room.used[enemy].flat(),...Object.values(room.board[enemy])]);
 const pool=triadCards.filter(card=>card.kind===kind&&!seen.has(card.cardNo));
 const ranked=pool.sort((a,b)=>kind==='monster'?(room.turn<=4?b.attack-a.attack:b.support-a.support):Number(triadSkillRuleByNo.get(b.cardNo)?.effects.reduce((n,e)=>n+Math.abs(e.delta),0)||0)-Number(triadSkillRuleByNo.get(a.cardNo)?.effects.reduce((n,e)=>n+Math.abs(e.delta),0)||0));
 const responses=[...new Set([ranked[0]?.cardNo,ranked[Math.floor(ranked.length/3)]?.cardNo,ranked[Math.floor(ranked.length*2/3)]?.cardNo,ranked.at(-1)?.cardNo].filter((no):no is string=>Boolean(no)))];
 let best=available[0]||'__pass__',value=-Infinity;
 for(const no of [...new Set(available)]){
  const scores=responses.map(response=>{const trial=structuredClone(room);trial.decks[enemy]=Array.from({length:3},emptyHeptadDeck);trial.board[side][room.turn]=no;trial.board[enemy][room.turn]=response;
   if(kind==='monster')return heptadBotValue(trial,side,[]);
   const enemyCast:HeptadCast={side:enemy,cardNo:response,kind:'normal'};
   const enemyTarget=bestHeptadCast(trial,enemy,response,'normal');enemyCast.target=enemyTarget.target;
   return bestHeptadCast(trial,side,no,'normal',[enemyCast]).score;
  });
  const card=triadCardByNo.get(no),rule=triadSkillRuleByNo.get(no);
  const future=card?.kind==='monster'?(room.turn===1?card.attack+card.support:room.turn<5?card.support:0):rule?.effects.reduce((n,e)=>n+Math.abs(e.delta),0)||0;
  const score=battleBotRisk(scores)-future*.03;
  if(score>value){value=score;best=no;}
 }
 return best;
}
function beginSpecial(room:HeptadRoom,now:number){
  room.phase='special';room.deadline=now+30000;room.epoch++;
  for(const side of sides)if(!heptadCanCallSpecial(room.fight,room.turn,room.specialUsed[side])||!room.decks[side][room.fight-1].special.some(no=>!room.used[side][room.fight-1].includes(no)))room.special[side]='__decline__';
}
export function heptadSpecialResponder(room:HeptadRoom):PentadSide|undefined{
  return [room.opener,otherPentadSide(room.opener)].find(side=>!room.special[side]);
}
export function tickHeptadRoom(room:HeptadRoom,now=Date.now()){
  if(room.phase==='deck'){
    if(now>=room.deadline)for(const side of sides){room.decks[side]=completeHeptadMatchDeck(room.decks[side],room.tier,random);room.ready[side]=true;}
    if(sides.every(side=>room.ready[side]))selection(room,now);
  }
  if(room.phase==='result'&&now>=room.deadline){
    const last=room.rounds.at(-1)!;
    if(room.finalDuel){if(last.winner!=='draw'){finish(room,last.winner,'ตัดสินมอนสเตอร์สุดท้ายด้วย ATK + SUP');return;}room.board=pair(()=>({}));selection(room,now);return;}
    if(last.elementClash&&last.winner==='draw'&&sides.every(side=>triadCardByNo.get(room.picks[side])?.kind==='monster')){
      for(const side of sides)delete room.board[side][room.turn];room.notice='พลังเท่ากัน เลือกมอนสเตอร์ใหม่ในตาเดิม';selection(room,now);return;
    }
    if(last.winner!=='draw')room.opener=last.winner;
    if(room.turn<7)room.turn=(room.turn+1) as HeptadTurn;
    else if(room.fight<3){room.fight=(room.fight+1) as HeptadFight;room.turn=1;room.board=pair(()=>({}));room.specialUsed=pair(()=>0);}
    else if(room.score.host!==room.score.challenger){finish(room,room.score.host>room.score.challenger?'host':'challenger','ครบ 3 ไฟต์ 21 ตา');return;}
    else{room.finalDuel=true;room.finalPool=pair(()=>[]);for(const side of sides)room.finalPool[side]=remainingMonsters(room,side);room.turn=1;room.board=pair(()=>({}));}
    selection(room,now);
  }
  if(room.phase==='select'){
    for(const side of sides)if(!room.picks[side]&&(HEPTAD_TURNS[room.turn-1].kind==='monster'||side===room.opener||room.picks[room.opener])){
      if(bot(room,side))room.picks[side]=chooseHeptadBotCard(room,side);
      else if(now>=room.deadline)room.picks[side]='__pass__';
    }
    if(sides.every(side=>room.picks[side])){
      if(!room.finalDuel&&[2,5].includes(room.turn)&&sides.every(side=>{const card=triadCardByNo.get(room.picks[side]);return card?.kind==='monster'&&card.element!=='unknown';})){
        room.phase='element';room.elementPresented=true;room.elementCompletedBy=[];room.deadline=now+PENTAD_ELEMENT_SCENE_MS+15000;room.epoch++;
      }else if(!room.finalDuel&&room.turn>=2&&room.turn<=6)beginSpecial(room,now);
      else reveal(room,now);
    }
  }
  if(room.phase==='element'&&(now>=room.deadline||sides.every(side=>bot(room,side)?now>=room.deadline-15000:(room.elementCompletedBy||[]).includes(room.lobby.seats[side]?.id||'')))){
    const a=triadCardByNo.get(room.picks.host)!,b=triadCardByNo.get(room.picks.challenger)!;
    if(pentadElementRelation(a.element,b.element).winner)reveal(room,now);else beginSpecial(room,now);
  }
  if(room.phase==='special'){
    for(const side of [room.opener,otherPentadSide(room.opener)])if(!room.special[side]){
      if(bot(room,side)){const cards=room.decks[side][room.fight-1].special.filter(no=>!room.used[side][room.fight-1].includes(no));
        const trial=structuredClone(room);for(const player of sides)trial.board[player][room.turn]=room.picks[player]==='__pass__'||player!==side&&HEPTAD_TURNS[room.turn-1].kind==='skill'?'':room.picks[player];
        trial.decks[otherPentadSide(side)]=Array.from({length:3},emptyHeptadDeck);
        const base:HeptadCast[]=room.specialOrder.filter(player=>player===side).map(player=>({side:player,cardNo:room.special[player],kind:'special'}));
        if(HEPTAD_TURNS[room.turn-1].kind==='skill')base.push({side,cardNo:room.picks[side],kind:'normal'});
        let no='__decline__',value=heptadBotValue(trial,side,base)+500;
        for(const card of cards){const candidate=bestHeptadCast(trial,side,card,'special',base);if(candidate.score>value){value=candidate.score;no=card;}}
        room.special[side]=no;
        if(no!=='__decline__'){room.specialUsed[side]++;use(room,side,no);room.specialOrder.push(side);}
      }else if(now>=room.deadline)room.special[side]='__decline__';
      else break;
      room.deadline=now+30000;
    }
    if(sides.every(side=>room.special[side]))reveal(room,now);
  }
  if(room.phase==='target')tickTargets(room,now);
}

export function applyHeptadAction(room:HeptadRoom,actor:PentadParticipant,body:Record<string,unknown>,now=Date.now()){
  const action=String(body.action||''),side=heptadSeat(room,actor.id),controller=room.lobby.ownerId===actor.id;
  if(['join','leave','watch','seat','bot','chat'].includes(action)){
    room.lobby.phase=room.phase==='waiting'?'waiting':room.phase==='finished'?'finished':'select';
    applyPentadAction(room.lobby,actor,body,now);
    if(room.lobby.forfeit&&room.phase!=='finished')finish(room,side?otherPentadSide(side):'draw','อีกฝ่ายออกจากเกม');return;
  }
  if(!member(room,actor.id))throw Error('กรุณาเข้าร่วมห้องก่อน');
  if(action==='refresh')return;
  if(action==='mode'){if(room.phase!=='waiting'||!controller)throw Error('เปลี่ยนโหมดไม่ได้');if(!HEPTAD_TIERS.some(tier=>tier.id===body.tier))throw Error('ระดับไม่ถูกต้อง');room.tier=body.tier as HeptadTier;return;}
  if(action==='start'){
    if(room.phase!=='waiting'||!controller||!room.lobby.seats.host||!room.lobby.seats.challenger)throw Error('รอผู้เล่นครบสองฝ่าย');
    room.phase='deck';room.deadline=now+600000;room.epoch++;room.lobby.phase='deck';
    for(const player of sides)if(bot(room,player)){room.decks[player]=completeHeptadMatchDeck(room.decks[player],room.tier,random);room.ready[player]=true;}return;
  }
  if(!side)throw Error('เฉพาะผู้เล่นในสนาม');
  if(action==='surrender'){if(['waiting','finished'].includes(room.phase))throw Error('ยอมแพ้ไม่ได้');finish(room,otherPentadSide(side),'ยอมแพ้');return;}
  if(action==='complete'){if(room.phase==='result'&&Number(body.roundId)===room.rounds.at(-1)?.id){room.completedBy=[...new Set([...(room.completedBy||[]),actor.id])];if(sides.every(player=>bot(room,player)||room.completedBy!.includes(room.lobby.seats[player]?.id||'')))room.deadline=Math.min(room.deadline,now+250);}return;}
  if(Number(body.epoch)!==room.epoch)throw Error('สถานะตาเปลี่ยนแล้ว');
  if(action==='element-complete'){
    if(room.phase!=='element')return;
    room.elementCompletedBy=[...new Set([...(room.elementCompletedBy||[]),actor.id])];return;
  }
  if(action==='ready'){
    if(room.phase!=='deck'||room.ready[side])throw Error('ยืนยันเด็คไม่ได้');
    const errors=validateHeptadMatchDeck(body.decks,room.tier);if(errors.length)throw Error(errors.join(' / '));
    room.decks[side]=structuredClone(body.decks as HeptadDeck[]);room.ready[side]=true;return;
  }
  if(action==='pick'){
    if(room.phase!=='select'||room.picks[side])throw Error('ลงการ์ดไม่ได้');
    if(HEPTAD_TURNS[room.turn-1].kind==='skill'&&side!==room.opener&&!room.picks[room.opener])throw Error('รอฝ่ายเปิดก่อน');
    const no=String(body.cardNo||'');if(!heptadAvailable(room,side).includes(no))throw Error('การ์ดไม่ได้อยู่ในมือหรือใช้ไปแล้ว');room.picks[side]=no;return;
  }
  if(action==='special'){
    if(room.phase!=='special'||room.special[side])throw Error('ตอบรับการ์ดเสริมไปแล้ว');
    if(heptadSpecialResponder(room)!==side)throw Error('รอฝ่ายที่มีสิทธิ์เลือกก่อน');
    const no=String(body.cardNo||'');
    if(!no){if(body.slot!==undefined)throw Error('กรุณาเลือกการ์ดเสริมพิเศษ');room.special[side]='__decline__';room.deadline=now+30000;return;}
    const pool=room.decks[side][room.fight-1].special.filter(no=>!room.used[side][room.fight-1].includes(no));
    if(!heptadCanCallSpecial(room.fight,room.turn,room.specialUsed[side])||!pool.includes(no))throw Error('ใช้สิทธิ์เสริมไม่ได้');
    room.special[side]=no;room.specialUsed[side]++;use(room,side,no);room.specialOrder.push(side);room.deadline=now+30000;return;
  }
  if(action==='target'){
    const choice=room.choices.find(item=>!item.value);const value=String(body.target||'');
    if(body.preview===true){
      if(room.phase!=='target'||choice?.side!==side||body.cardNo!==choice.cardNo||Number(body.choiceIndex)!==room.choices.indexOf(choice)||!legalTargetPreview(choice.options,value))throw Error('เป้าหมายไม่ถูกต้อง');
      choice.preview=value;return;
    }
    if(room.phase!=='target'||choice?.side!==side||!choice.options.includes(value))throw Error('เป้าหมายไม่ถูกต้อง');settleTarget(room,choice,value);return;
  }
  throw Error('ไม่พบคำสั่ง');
}

export function publicHeptadRoom(room:HeptadRoom,id:string):HeptadRoom{
  const copy=structuredClone(room),side=heptadSeat(room,id);copy.lobby=publicPentadRoom(room.lobby,id);
  delete copy.temporaryMains;
  for(const seat of sides)if(seat!==side){
    copy.decks[seat]=[];copy.finalPool[seat]=[];
    if(['select','element','special'].includes(room.phase)){
      if(room.phase!=='element'&&!room.elementPresented)copy.picks[seat]=room.picks[seat]?'hidden':'';
      const special=room.special[seat];copy.special[seat]=special==='__decline__'?'__decline__':special?'confirmed':'';
      if(special&&special!=='__decline__')copy.used[seat][room.fight-1]=copy.used[seat][room.fight-1].filter(no=>no!==special);
    }
  }
  return copy;
}

const globals=globalThis as typeof globalThis&{heptadSchema?:Promise<void>};
async function schema(){globals.heptadSchema??=prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "HeptadRoom" ("code" TEXT PRIMARY KEY,"data" JSONB NOT NULL,"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW())`).then(()=>{}).catch(error=>{globals.heptadSchema=undefined;throw error});await globals.heptadSchema;}
export async function createHeptadRoom(actor:PentadParticipant,options:{access?:string;password?:string}={}){
  await schema();const password=String(options.password||'').trim();if(options.access==='private'&&(password.length<4||password.length>128))throw Error('รหัสห้องส่วนตัวต้องมี 4–128 ตัว');
  for(let attempt=0;attempt<8;attempt++){
    const room=newHeptadRoom(String(randomInt(100000,1000000)),actor);room.lobby.access=options.access==='private'?'private':'public';
    if(room.lobby.access==='private'){const salt=randomBytes(16).toString('hex');room.lobby.passwordHash=`${salt}:${scryptSync(password,salt,32).toString('hex')}`;}
    if(await prisma.$executeRawUnsafe(`INSERT INTO "HeptadRoom" ("code","data") VALUES ($1,$2::jsonb) ON CONFLICT DO NOTHING`,room.code,JSON.stringify(room)))return publicHeptadRoom(room,actor.id);
  }throw Error('สร้างห้องไม่สำเร็จ');
}
export async function mutateHeptadRoom(code:string,actor:PentadParticipant,body?:Record<string,unknown>){
  await schema();
  if(!body){const rows=await prisma.$queryRawUnsafe<{data:HeptadRoom}[]>(`SELECT data FROM "HeptadRoom" WHERE code=$1`,code);const room=rows[0]?.data;if(!room)throw Error('ไม่พบห้อง');if(!member(room,actor.id))throw Error('กรุณาเข้าร่วมห้องก่อน');
    const before=JSON.stringify(room);tickHeptadRoom(room);if(before===JSON.stringify(room))return publicHeptadRoom(room,actor.id);}
  return prisma.$transaction(async tx=>{
    const rows=await tx.$queryRawUnsafe<{data:HeptadRoom}[]>(`SELECT data FROM "HeptadRoom" WHERE code=$1 FOR UPDATE`,code);const room=rows[0]?.data;if(!room)throw Error('ไม่พบห้อง');
    if(!body&&!member(room,actor.id))throw Error('กรุณาเข้าร่วมห้องก่อน');
    const before=JSON.stringify(room),now=Date.now();
    // Departure remains valid even when a deadline advances during the request.
    if(body?.action!=='leave'&&body?.action!=='surrender')tickHeptadRoom(room,now);
    if(body)applyHeptadAction(room,actor,body,now);tickHeptadRoom(room,now);
    if(room.phase==='finished'&&room.winner!=='draw'&&room.winner&&!room.rankedAt){const winner=room.lobby.seats[room.winner]||room.lobby.forfeit?.winner,loser=room.lobby.seats[otherPentadSide(room.winner)]||room.lobby.forfeit?.loser;
      if(winner&&loser&&winner.id!==PENTAD_BOT_ID&&loser.id!==PENTAD_BOT_ID)await recordForfeitRank(tx,`heptad:${code}:${room.createdAt}`,{winner,loser,at:now});room.rankedAt=now;}
    if(body?.action==='leave'&&!room.lobby.spectators.length&&!sides.some(side=>room.lobby.seats[side]&&room.lobby.seats[side]!.id!==PENTAD_BOT_ID)){await tx.$executeRawUnsafe(`DELETE FROM "HeptadRoom" WHERE code=$1`,code);return null;}
    if(before!==JSON.stringify(room)){room.version++;room.updatedAt=now;await tx.$executeRawUnsafe(`UPDATE "HeptadRoom" SET data=$2::jsonb,"updatedAt"=NOW() WHERE code=$1`,code,JSON.stringify(room));}
    return publicHeptadRoom(room,actor.id);
  },{timeout:10000});
}
export async function listHeptadRooms(){await schema();const rows=await prisma.$queryRawUnsafe<{data:HeptadRoom}[]>(`SELECT data FROM "HeptadRoom" WHERE "updatedAt">NOW()-INTERVAL '2 hours' ORDER BY "updatedAt" DESC LIMIT 80`);return rows.filter(({data})=>data.lobby.access!=='private').map(({data})=>({code:data.code,host:data.lobby.seats.host?.name||'ผู้ชมเป็นหัวห้อง',phase:data.phase,spectators:data.lobby.spectators.length}));}
