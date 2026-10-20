import { resolveTriadTurn, triadCardByNo, type TriadTurnResult, type TriadTriangle } from './triad-dominion';
import { comparePentadPower, pentadElementRelation, type PentadSide } from './pentad-dominion';
import { heptadTurnCards, type HeptadBoard, type HeptadTurn } from './heptad-rules';

export type HeptadCast = { side: PentadSide; cardNo: string; target?: string; copied?: string; kind?: 'normal' | 'special' | 'boost' };
export type HeptadResult = {
  powerBefore?: TriadTurnResult['powerBefore'];
  winner: PentadSide | 'draw'; totals: Record<PentadSide, number>;
  attack: Record<PentadSide, number>; support: Record<PentadSide, number>;
  reason: string; events: TriadTurnResult['skillEvents'];
  effective: Record<PentadSide, string>; elementClash: boolean;
};

export function resolveHeptadClash(input: {
  board: Record<PentadSide, HeptadBoard>; turn: HeptadTurn; opener: PentadSide;
  casts: HeptadCast[]; finalDuel?: boolean; seed: string;
}): HeptadResult {
  const sides = ['host', 'challenger'] as const;
  const cards = { host: heptadTurnCards(input.board.host,input.turn), challenger: heptadTurnCards(input.board.challenger,input.turn) };
  const clashCards = sides.map(side => triadCardByNo.get(input.turn === 1 ? cards[side].main : cards[side].branch));
  const relation = clashCards[0] && clashCards[1] ? pentadElementRelation(clashCards[0].element,clashCards[1].element) : null;
  const elementClash = [1,2,5].includes(input.turn) && !input.finalDuel;
  const metric = input.turn === 1 ? 'combined' : input.turn <= 4 ? 'attack' : 'support';
  const basic = (side: PentadSide, stat: 'attack' | 'support') => [cards[side].main,cards[side].branch].reduce((n,no)=>n+(triadCardByNo.get(no)?.[stat]||0),0);
  const attack = { host:basic('host','attack'),challenger:basic('challenger','attack') };
  const support = { host:basic('host','support'),challenger:basic('challenger','support') };
  const effective = { host:cards.host.main,challenger:cards.challenger.main };
  const events: TriadTurnResult['skillEvents'] = [];
  // Elemental victories score directly; stat skills do not override affinity.
  if (elementClash && relation?.winner) return {winner:relation.winner,totals:metric==='combined'?{host:attack.host+support.host,challenger:attack.challenger+support.challenger}:metric==='attack'?attack:support,attack,support,reason:'ธาตุพิชิต',events,effective,elementClash};

  // Every resolution starts from card data again. No stat buff survives a turn.
  const metrics:('attack'|'support')[]=metric==='combined'?['attack','support']:[metric];
  for (const stat of metrics) {
    const engineTurn = stat === 'attack' ? 2 : 3;
    const skillLane = engineTurn === 2 ? 'left' : 'right';
    const monsterLane = engineTurn === 2 ? 'right' : 'left';
    let adjustments = { player:0,opponent:0 };
    let totals = {host:basic('host',stat),challenger:basic('challenger',stat)};
    // Special cards precede the regular pair; the caller's sequence is preserved.
    const batches: HeptadCast[][] = [];
    const normal = input.casts.filter(cast=>cast.kind==='normal');
    for (const cast of input.casts.filter(cast=>!normal.includes(cast))) batches.push([cast]);
    if (normal.length) batches.push(normal);
    for (const batch of batches) {
      const own = batch.find(cast=>cast.side==='host'), enemy=batch.find(cast=>cast.side==='challenger');
      const triangle = (side:PentadSide,skill=''):TriadTriangle => ({top:effective[side],left:'',right:'',[monsterLane]:cards[side].branch,[skillLane]:skill});
      const target=(cast:HeptadCast|undefined)=>cast?.target||'';
      const result=resolveTriadTurn({turn:engineTurn,includeOtherMonster:true,scoreAdjustments:adjustments,
        combinedStatConditions:metric==='combined',player:triangle('host',own?.cardNo),opponent:triangle('challenger',enemy?.cardNo),
        prioritySide:(batch.length===1?batch[0].side:input.opener)==='host'?'player':'opponent',
        skillTargets:{player:own?{[own.cardNo]:target(own)}:{},opponent:enemy?{[enemy.cardNo]:target(enemy)}:{}},
        copiedSkillCardNos:{player:own?.copied,opponent:enemy?.copied},randomMonsterSeed:input.seed,
      });
      totals={host:result.playerTotal,challenger:result.opponentTotal};
      if (result.skillEvents.some(event=>event.cardNo==='265'&&!event.blocked)) {
        effective.host=result.effectivePlayer.top;effective.challenger=result.effectiveOpponent.top;
      }
      adjustments={player:totals.host-basic('host',stat),opponent:totals.challenger-basic('challenger',stat)};
      const offset=metric==='combined'?(stat==='attack'?{host:basic('host','support'),challenger:basic('challenger','support')}:attack):{host:0,challenger:0};
      events.push(...result.skillEvents.map(event=>({...event,powerAfter:event.powerAfter&&{player:event.powerAfter.player+offset.host,opponent:event.powerAfter.opponent+offset.challenger}})));
    }
    if(stat==='attack')Object.assign(attack,totals);else Object.assign(support,totals);
  }
  const totals=metric==='combined'?{host:attack.host+support.host,challenger:attack.challenger+support.challenger}:metric==='attack'?{...attack}:{...support};
  const winner=totals.host!==totals.challenger?(totals.host>totals.challenger?'host':'challenger'):elementClash?comparePentadPower(attack,support):'draw';
  if(events.length)events[events.length-1].powerAfter={player:totals.host,opponent:totals.challenger};
  return {winner,totals,attack,support,effective,elementClash,reason:input.finalDuel?'ตัดสินด้วย ATK + SUP':metric==='combined'?'พลังรวม ATK + SUP':metric==='attack'?'ATTACK หลัก + รอง + สกิลตานี้':'SUPPORT หลัก + รอง + สกิลตานี้',events:events.filter((event,i,all)=>all.findIndex(other=>other.side===event.side&&other.cardNo===event.cardNo&&other.summary===event.summary)===i)};
}
