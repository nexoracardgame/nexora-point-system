import type {GameAppearance} from './game-profile-options';
export type GameProfileDetails={user?:{id:string;name:string;image:string};appearance:GameAppearance;available:boolean;stats:{wins:number;losses:number}|null;rank:{name:string;nextWins:number|null;nextName:string|null}};
const values=new Map<string,GameProfileDetails>(),pending=new Map<string,Promise<GameProfileDetails>>();
const identities=new Map<string,{id:string;name:string;image:string}>(),updated=new Map<string,number>();
export const cachedGameIdentity=(id:string)=>values.get(id)?.user||identities.get(id);
export function primeGameIdentity(id:string,name:string,image:string){identities.set(id,{id,name,image});}
export const cachedGameProfile=(id:string)=>values.get(id);
export function updateCachedGameAppearance(id:string,appearance:GameAppearance){const value=values.get(id);if(value)values.set(id,{...value,appearance});}
export function loadGameProfile(id:string){
 const cached=values.get(id);if(cached&&Date.now()-(updated.get(id)||0)<30000)return Promise.resolve(cached);
 const existing=pending.get(id);if(existing)return existing;
 const request=fetch('/api/game-profile/details?id='+encodeURIComponent(id),{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Profile unavailable');const data=await r.json() as GameProfileDetails;values.set(id,data);updated.set(id,Date.now());return data}).finally(()=>pending.delete(id));pending.set(id,request);return request;
}
