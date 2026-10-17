import type {GameCollection,SavedGameDeck} from './game-collection';
import {getImageProps} from 'next/image';
import {triadCardByNo,triadCards} from './triad-dominion';
import {gameCardThumbnail} from './game-card-art';
const values=new Map<string,{value:GameCollection;at:number}>(),pending=new Map<string,Promise<GameCollection>>();
const revisions=new Map<string,number>();
const thumbnails=new Map<string,HTMLImageElement>();
function warmCollectionImages(value:GameCollection){
 if(typeof Image==='undefined')return;
 const cards=value.owned.length?value.owned.slice(0,24).map(item=>triadCardByNo.get(item.cardNo)):triadCards.slice(0,12);
 for(const card of cards){if(!card)continue;const {props}=getImageProps({src:gameCardThumbnail(card.cardNo)||card.sourceImage,unoptimized:true,alt:'',width:320,height:436});if(thumbnails.has(props.src))continue;const image=new Image();image.decoding='async';image.onload=()=>{void image.decode().catch(()=>{})};image.onerror=()=>thumbnails.delete(props.src);image.src=props.src;thumbnails.set(props.src,image)}
}
export const cachedGameCollection=(owner:string)=>values.get(owner)?.value;
export function loadGameCollection(owner:string,force=false){
 const cached=values.get(owner);if(!force&&cached&&Date.now()-cached.at<30000)return Promise.resolve(cached.value);
 const existing=pending.get(owner);if(existing)return existing;
 const revision=revisions.get(owner)||0;
 const task=fetch('/api/game-collection',{cache:'no-store'}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error||'โหลดคลังการ์ดไม่สำเร็จ');if((revisions.get(owner)||0)!==revision)return values.get(owner)?.value||data as GameCollection;values.set(owner,{value:data,at:Date.now()});warmCollectionImages(data);return data as GameCollection}).finally(()=>pending.delete(owner));pending.set(owner,task);return task;
}
export async function mutateGameCollection(owner:string,body:Record<string,unknown>){
 const response=await fetch('/api/game-collection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),data=await response.json();
 if(!response.ok)throw Error(data.error||'บันทึกไม่สำเร็จ');
 revisions.set(owner,(revisions.get(owner)||0)+1);
 const cached=values.get(owner)?.value;
 if(cached){let decks=cached.decks,owned=cached.owned;if(data.deck){const deck=data.deck as SavedGameDeck;decks=[deck,...decks.filter(item=>item.id!==deck.id)]}if(body.action==='delete')decks=decks.filter(deck=>deck.id!==body.id);if(body.action==='favorite')owned=owned.map(card=>card.cardNo===body.cardNo?{...card,favorite:Boolean(body.favorite)}:card);values.set(owner,{at:Date.now(),value:{...cached,decks,owned}})}
 return data as {deck?:SavedGameDeck;ok?:boolean};
}
