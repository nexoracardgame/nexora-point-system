import {triadCards,type TriadCard} from './triad-dominion';
import {gameCardThumbnail} from './game-card-art';
import {rateMonster} from './game-monster-rating';
export {monsterTiers,monsterRatingPolicy,monsterStarBands} from './game-monster-rating';

export const monsterElements={earth:'ดิน',water:'น้ำ',wood:'ไม้',fire:'ไฟ',gold:'ทอง',unknown:'ไม่ระบุ'};
export type MonsterDetails=ReturnType<typeof rateMonster>&{lore:string|null;characterArt:string|null};
// Only editorial fields may be overridden; ratings always come from the shared policy.
export const monsterDetails:Record<string,Partial<Pick<MonsterDetails,'lore'|'characterArt'>>>={};
export const gameMonsters=triadCards.filter(card=>card.kind==='monster');
export function describeMonster(card:TriadCard):MonsterDetails{
 return {lore:null,characterArt:null,...monsterDetails[card.cardNo],...rateMonster(card)};
}
export function monsterThumbnail(card:TriadCard){return gameCardThumbnail(card.cardNo)||card.sourceImage}
export function warmMonsterImages(cards:readonly TriadCard[],full=false){
 if(typeof Image==='undefined')return()=>{};
 const images=cards.slice(0,full?3:12).map(card=>{const image=new Image();image.decoding='async';image.src=full?(describeMonster(card).characterArt||card.sourceImage):monsterThumbnail(card);void image.decode().catch(()=>{});return image});
 return()=>{images.forEach(image=>{image.onload=null;image.onerror=null})};
}
