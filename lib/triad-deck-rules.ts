import {triadCardByNo} from './triad-dominion';

export function countTriadDeck(deck:readonly string[]){
 const cards=deck.map(no=>triadCardByNo.get(no)).filter(card=>card&&card.kind!=='unknown');
 return {total:cards.length,monsters:cards.filter(card=>card?.kind==='monster').length,skills:cards.filter(card=>card?.kind==='skill').length};
}
export function validateTriadDeckMode(mode:'all'|'monster'|'skill',deck:readonly string[]){
 const {total,monsters,skills}=countTriadDeck(deck),errors:string[]=[];
 if(total!==20)errors.push('เด็คต้องมีการ์ดทั้งหมด 20 ใบ');
 if(mode==='all'&&monsters<3)errors.push('โหมด ALL IN ONE ต้องมีการ์ดมอนสเตอร์อย่างน้อย 3 ใบ');
 if(mode==='monster'&&(monsters!==20||skills>0))errors.push('โหมด MONSTER ต้องใช้การ์ดมอนสเตอร์ครบ 20 ใบ');
 if(mode==='skill'&&(monsters!==10||skills!==10))errors.push('โหมด SKILL ต้องมีการ์ดมอนสเตอร์ 10 ใบ และการ์ดสกิล 10 ใบ');
 return {ok:errors.length===0,errors};
}
