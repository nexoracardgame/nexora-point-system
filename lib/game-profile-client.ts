import type {GameAppearance} from './game-profile-options';
export type GameProfileDetails={appearance:GameAppearance;available:boolean;stats:{wins:number;losses:number}|null;rank:{name:string;nextWins:number|null;nextName:string|null}};
const values=new Map<string,GameProfileDetails>(),pending=new Map<string,Promise<GameProfileDetails>>();
export const cachedGameProfile=(id:string)=>values.get(id);
export function updateCachedGameAppearance(id:string,appearance:GameAppearance){const value=values.get(id);if(value)values.set(id,{...value,appearance});}
export function loadGameProfile(id:string){
 const existing=pending.get(id);if(existing)return existing;
 const request=fetch('/api/game-profile/details',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Profile unavailable');const data=await r.json() as GameProfileDetails;values.set(id,data);return data}).finally(()=>pending.delete(id));pending.set(id,request);return request;
}
