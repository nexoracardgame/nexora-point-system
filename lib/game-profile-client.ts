import type {GameAppearance} from './game-profile-options';
export type GameProfileDetails={user?:{id:string;name:string;image:string};appearance:GameAppearance;available:boolean;stats:{wins:number;losses:number}|null;rank:{name:string;nextWins:number|null;nextName:string|null}};
const values=new Map<string,GameProfileDetails>(),pending=new Map<string,Promise<GameProfileDetails>>();
const identities=new Map<string,{id:string;name:string;image:string}>(),updated=new Map<string,number>();
export const cachedGameIdentity=(id:string)=>values.get(id)?.user||identities.get(id);
export function primeGameIdentity(id:string,name:string,image:string){identities.set(id,{id,name,image});}
export const cachedGameProfile=(id:string)=>{
 const existing=values.get(id);if(existing)return existing;
 if(typeof sessionStorage==='undefined')return;
 try{const stored=JSON.parse(sessionStorage.getItem('nexora:profile:'+id)||'null');if(stored&&Date.now()-stored.at<300000&&stored.value?.user?.id===id&&stored.value.stats&&stored.value.available){values.set(id,stored.value);updated.set(id,stored.at);return stored.value as GameProfileDetails}}catch{}
};
export function warmGameProfile(id:string){return loadGameProfile(id).catch(()=>undefined);}
export function updateCachedGameAppearance(id:string,appearance:GameAppearance){const value=values.get(id);if(value)values.set(id,{...value,appearance});}
export function loadGameProfile(id:string){
 const cached=cachedGameProfile(id);if(cached&&Date.now()-(updated.get(id)||0)<30000)return Promise.resolve(cached);
 const existing=pending.get(id);if(existing)return existing;
 const request=fetch('/api/game-profile/details?id='+encodeURIComponent(id),{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Profile unavailable');const data=await r.json() as GameProfileDetails;if(data.user?.id!==id)throw Error('Profile identity mismatch');values.set(id,data);updated.set(id,Date.now());try{sessionStorage.setItem('nexora:profile:'+id,JSON.stringify({at:Date.now(),value:data}))}catch{}return data}).finally(()=>pending.delete(id));pending.set(id,request);return request;
}
