import {triadCards} from './triad-dominion';
import {rateMonster} from './game-monster-rating';
import {rateGameSkill} from './game-skill-rating';

// Bump the policy version when changing price, odds, eligibility or rating rules.
export const gachaPolicy={version:1,price:79,size:7,starDenominator:6000,starWeights:[5320,300,200,120,60],extraPermanentDenominator:50,temporaryDays:[1,3,7,14],temporaryWeights:[60,25,10,5]} as const;
export type GachaCard={cardNo:string;kind:'monster'|'skill';stars:number;days:0|1|3|7|14;expiresAt:string|null;guaranteedPermanent:boolean};
export type GachaReceipt={id:string;policyVersion:number;price:number;createdAt:string;maxStars:number;cards:GachaCard[]};
export type GachaState={coin:number;history:GachaReceipt[]};
export const gachaCatalog=triadCards.filter(card=>card.kind!=='unknown').map(card=>({cardNo:card.cardNo,kind:card.kind as 'monster'|'skill',stars:card.kind==='monster'?rateMonster(card).stars:rateGameSkill(card).stars}));
const pools=Array.from({length:5},(_,index)=>({monster:gachaCatalog.filter(card=>card.kind==='monster'&&card.stars===index+1),skill:gachaCatalog.filter(card=>card.kind==='skill'&&card.stars===index+1)}));
if(pools.some(pool=>!pool.monster.length||!pool.skill.length))throw Error('Every gacha star/kind pool must contain reviewed cards');
export function weightedIndex(weights:readonly number[],draw:number){let remaining=draw;for(let i=0;i<weights.length;i++){remaining-=weights[i];if(remaining<0)return i}throw Error('Invalid random draw')}
export function rollGachaPack(randomInt:(max:number)=>number,createdAt:Date):Pick<GachaReceipt,'maxStars'|'cards'>{
 const maxStars=weightedIndex(gachaPolicy.starWeights,randomInt(gachaPolicy.starDenominator))+1;
 const featured=randomInt(gachaPolicy.size),permanent=randomInt(gachaPolicy.size),extra=randomInt(gachaPolicy.extraPermanentDenominator)===0?(permanent+1+randomInt(gachaPolicy.size-1))%gachaPolicy.size:-1;
 const cards=Array.from({length:gachaPolicy.size},(_,slot):GachaCard=>{
  const stars=slot===featured?maxStars:1,kind=randomInt(2)===0?'monster':'skill',pool=pools[stars-1][kind],card=pool[randomInt(pool.length)];
  const days=slot===permanent||slot===extra?0:gachaPolicy.temporaryDays[weightedIndex(gachaPolicy.temporaryWeights,randomInt(100))];
  return {...card,days,expiresAt:days?new Date(createdAt.getTime()+days*86400000).toISOString():null,guaranteedPermanent:slot===permanent};
 });
 return {maxStars,cards};
}
