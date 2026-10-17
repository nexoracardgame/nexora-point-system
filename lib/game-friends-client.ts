import {warmGameProfile} from './game-profile-client';

export type GameFriend={id:string;friendId?:string;fromUserId?:string;displayName:string;username:string|null;image:string;bio?:string;relation?:'none'|'incoming'|'outgoing'|'friends'|'self';requestId?:string|null};
type Snapshot={friends:GameFriend[];requests:GameFriend[];at:number};
const snapshots=new Map<string,Snapshot>(),pending=new Map<string,Promise<Snapshot>>();
export const gameFriendId=(player:GameFriend)=>player.friendId||player.fromUserId||player.id;
export function cachedGameFriends(owner:string){
 if(!owner)return;
 const cached=snapshots.get(owner);if(cached)return cached;
 try{const stored=JSON.parse(sessionStorage.getItem('nexora:friends:'+owner)||'null');if(stored&&Date.now()-stored.at<300000&&Array.isArray(stored.friends)&&Array.isArray(stored.requests)){snapshots.set(owner,stored);return stored as Snapshot}}catch{}
}
export function loadGameFriends(owner:string,force=false){
 const existing=pending.get(owner);if(existing&&!force)return existing;
 const cached=cachedGameFriends(owner);if(!force&&cached&&Date.now()-cached.at<15000)return Promise.resolve(cached);
 const request=fetch('/api/community/friends',{cache:'no-store'}).then(async response=>{
  if(!response.ok)throw Error(response.status===401?'กรุณาเข้าสู่ระบบก่อน':'โหลดรายชื่อไม่สำเร็จ');
  const data=await response.json(),snapshot:Snapshot={friends:data.friends||[],requests:data.requests||[],at:Date.now()};
  if(pending.get(owner)===request){snapshots.set(owner,snapshot);try{sessionStorage.setItem('nexora:friends:'+owner,JSON.stringify(snapshot))}catch{}}
  return snapshot;
 }).finally(()=>{if(pending.get(owner)===request)pending.delete(owner)});pending.set(owner,request);return request;
}
export async function warmGameProfiles(ids:string[]){
 const unique=[...new Set(ids.filter(Boolean))];let cursor=0;
 await Promise.all(Array.from({length:Math.min(4,unique.length)},async()=>{while(cursor<unique.length)await warmGameProfile(unique[cursor++])}));
}
export async function prepareGameFriends(owner:string){
 const data=await loadGameFriends(owner);
 const ids=[...data.friends,...data.requests].map(gameFriendId);
 await warmGameProfiles(ids.slice(0,12));
 void warmGameProfiles(ids.slice(12));
 return data;
}
