import {gameHeroes,type GameAppearance} from './game-profile-options';
export type GameProfileDetails={user?:{id:string;name:string;image:string};appearance:GameAppearance;available:boolean;stats:{wins:number;losses:number}|null;rank:{name:string;nextWins:number|null;nextName:string|null}};
const values=new Map<string,GameProfileDetails>(),pending=new Map<string,Promise<GameProfileDetails>>();
const identities=new Map<string,{id:string;name:string;image:string}>(),updated=new Map<string,number>();
export const cachedGameIdentity=(id:string)=>values.get(id)?.user||identities.get(id);
export function primeGameIdentity(id:string,name:string,image:string){identities.set(id,{id,name,image});}
export const cachedGameProfile=(id:string)=>{
 const existing=values.get(id);if(existing)return existing;
 try{if(typeof sessionStorage==='undefined')return;const stored=JSON.parse(sessionStorage.getItem('nexora:profile:'+id)||'null');if(stored&&Date.now()-stored.at<300000&&stored.value?.user?.id===id&&stored.value.stats&&stored.value.available){values.set(id,stored.value);updated.set(id,stored.at);return stored.value as GameProfileDetails}}catch{}
};
const artwork=new Map<string,Promise<void>>();
export async function prepareGameProfile(id:string){
 const details=await loadGameProfile(id);
 if(typeof Image==='undefined')return details;
 const sources=['/images/versus/arena.png','/images/triad/nexora-official-logo.webp','/images/lobby-play/profile-avatar-frame.png','/images/lobby-play/profile-name-frame.png','/images/lobby-play/profile-rank-label.png',gameHeroes.find(hero=>hero.id===details.appearance.hero)?.image||gameHeroes[0].image,details.appearance.avatar||details.user?.image].filter((src):src is string=>Boolean(src));
 await Promise.all(sources.map(src=>{let ready=artwork.get(src);if(!ready){ready=new Promise<void>(resolve=>{const image=new Image();image.onload=()=>{void image.decode().catch(()=>{}).then(()=>resolve())};image.onerror=()=>{artwork.delete(src);resolve()};image.src=src});artwork.set(src,ready)}return ready}));
 return details;
}
export function warmGameProfile(id:string){return prepareGameProfile(id).catch(()=>undefined);}
export function updateCachedGameAppearance(id:string,appearance:GameAppearance){const value=values.get(id);if(value)values.set(id,{...value,appearance});}
export function loadGameProfile(id:string){
 const cached=cachedGameProfile(id);if(cached&&Date.now()-(updated.get(id)||0)<30000)return Promise.resolve(cached);
 const existing=pending.get(id);if(existing)return existing;
 const request=fetch('/api/game-profile/details?id='+encodeURIComponent(id),{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Profile unavailable');const data=await r.json() as GameProfileDetails;if(data.user?.id!==id)throw Error('Profile identity mismatch');if(!data.available||!data.stats)throw Error('Incomplete profile');values.set(id,data);updated.set(id,Date.now());try{sessionStorage.setItem('nexora:profile:'+id,JSON.stringify({at:Date.now(),value:data}))}catch{}return data}).finally(()=>pending.delete(id));pending.set(id,request);return request;
}
