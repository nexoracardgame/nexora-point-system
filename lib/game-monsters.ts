import {triadCards,type TriadCard} from './triad-dominion';
import {gameCardThumbnail} from './game-card-art';

export const monsterElements={earth:'ดิน',water:'น้ำ',wood:'ไม้',fire:'ไฟ',gold:'ทอง',unknown:'ไม่ระบุ'};
export type MonsterDetails={stars:number;rarity:string|null;lore:string|null;characterArt:string|null};
// Editorial metadata is separate from combat rules and future gacha drop rates.
export const monsterDetails:Record<string,Partial<MonsterDetails>>={};
export const gameMonsters=triadCards.filter(card=>card.kind==='monster');
export function describeMonster(card:TriadCard):MonsterDetails{
 const power=Math.max(card.attack,card.support);
 const stars=power>=9500?5:power>=8000?4:power>=6500?3:power>=5000?2:1;
 return {stars,rarity:null,lore:null,characterArt:null,...monsterDetails[card.cardNo]};
}
export function monsterThumbnail(card:TriadCard){return gameCardThumbnail(card.cardNo)||card.sourceImage}
export function warmMonsterImages(cards:readonly TriadCard[],full=false){
 if(typeof Image==='undefined')return()=>{};
 const images=cards.slice(0,full?3:12).map(card=>{const image=new Image();image.decoding='async';image.src=full?(describeMonster(card).characterArt||card.sourceImage):monsterThumbnail(card);void image.decode().catch(()=>{});return image});
 return()=>{images.forEach(image=>{image.onload=null;image.onerror=null})};
}
