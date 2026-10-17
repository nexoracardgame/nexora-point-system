import {triadCardByNo} from './triad-dominion';
import {validateTriadDeckMode} from './triad-deck-rules';
import {validatePentadDeck} from './pentad-dominion';

export const deckFormats={'triad-all':'TRIAD · ALL IN ONE','triad-monster':'TRIAD · MONSTER','triad-skill':'TRIAD · SKILL',pentad:'PENTAD · 5 ใบ'} as const;
export type DeckFormat=keyof typeof deckFormats;
export type DeckGroup='main'|'monsters'|'hand'|'reserve';
export type DeckCards=Record<DeckGroup,string[]>;
export type OwnedGameCard={cardNo:string;quantity:number;favorite:boolean;acquiredAt:string};
export type SavedGameDeck={id:string;name:string;format:DeckFormat;cards:DeckCards;version:number;updatedAt:string};
export type GameCollection={owned:OwnedGameCard[];decks:SavedGameDeck[];wallet:{nexPoint:number;coin:number}};
export const emptyDeckCards=():DeckCards=>({main:[],monsters:[],hand:[],reserve:[]});
export const deckCardNos=(cards:DeckCards)=>Object.values(cards).flat();
export function parseDeckCards(value:unknown):DeckCards{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('ข้อมูลเด็คไม่ถูกต้อง');
 const result=emptyDeckCards(),raw=value as Record<string,unknown>;
 for(const group of Object.keys(result) as DeckGroup[]){const items=raw[group];if(!Array.isArray(items)||items.length>30||items.some(no=>typeof no!=='string'||!triadCardByNo.has(no)))throw Error('พบข้อมูลการ์ดที่ไม่ถูกต้อง');result[group]=[...items] as string[]}
 return result;
}
export function validateCollectionDeck(format:DeckFormat,cards:DeckCards,owned:readonly OwnedGameCard[],partial=false){
 const errors:string[]=[],stock=new Map(owned.map(card=>[card.cardNo,card.quantity])),counts=new Map<string,number>();
 for(const no of deckCardNos(cards)){if(!triadCardByNo.has(no)){errors.push('ไม่พบข้อมูลการ์ด '+no);continue}counts.set(no,(counts.get(no)||0)+1);if(counts.get(no)!>(stock.get(no)||0))errors.push('No.'+no+' เกินจำนวนที่เป็นเจ้าของ')}
 if(format==='pentad'){
  if(cards.main.length)errors.push('PENTAD ไม่ใช้กองหลัก TRIAD');
  errors.push(...validatePentadDeck(cards,partial));
 }else{
  if(cards.monsters.length||cards.hand.length||cards.reserve.length)errors.push('TRIAD ใช้กองหลักเท่านั้น');
  if(partial){if(cards.main.length>20)errors.push('เด็คต้องไม่เกิน 20 ใบ');if(format==='triad-monster'&&cards.main.some(no=>triadCardByNo.get(no)?.kind!=='monster'))errors.push('โหมด MONSTER ใช้ได้เฉพาะมอนสเตอร์');if(format==='triad-skill'){for(const kind of ['monster','skill'])if(cards.main.filter(no=>triadCardByNo.get(no)?.kind===kind).length>10)errors.push('โหมด SKILL ใช้มอนสเตอร์ 10 ใบ และสกิล 10 ใบ')}}
  else errors.push(...validateTriadDeckMode(format==='triad-monster'?'monster':format==='triad-skill'?'skill':'all',cards.main).errors);
 }
 return [...new Set(errors)];
}
