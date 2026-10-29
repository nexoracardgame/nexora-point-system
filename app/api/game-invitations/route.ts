import {after,NextResponse} from 'next/server';
import {getApiActor} from '@/lib/admin-auth';
import {getServerSupabaseClient} from '@/lib/supabase-server';
import {TRIAD_ROOM_REALTIME_CHANNEL,TRIAD_ROOM_REALTIME_EVENT} from '@/lib/triad-room-realtime';
import {createGameInvitation,listGameInvitations,respondGameInvitation,type InvitationMode} from '@/lib/game-invitation-store';
export const dynamic='force-dynamic';
const modes=['triad','pentad','heptad'];
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
function notify(userId:string,room?:{mode:string;code:string}){after(async()=>{
 const client=getServerSupabaseClient();if(!client)return;
 for(const name of [`game-invitations:${userId}`,...(room?[room.mode==='triad'?TRIAD_ROOM_REALTIME_CHANNEL:`${room.mode}:${room.code}`]:[])]){
  const channel=client.channel(name);try{await channel.send({type:'broadcast',event:name===TRIAD_ROOM_REALTIME_CHANNEL?TRIAD_ROOM_REALTIME_EVENT:'changed',payload:{action:'invitation',code:room?.code}},{timeout:500});}catch{}finally{void client.removeChannel(channel)}
 }
});}
export async function GET(request:Request){
 const actor=await getApiActor();if(!actor)return json({error:'unauthorized'},401);
 const params=new URL(request.url).searchParams,mode=params.get('mode')||'',code=params.get('code')||'';
 if((mode||code)&&(!modes.includes(mode)||!/^\d{6}$/.test(code)))return json({error:'ห้องไม่ถูกต้อง'},400);
 try{return json({invitations:await listGameInvitations(actor.id,mode as InvitationMode||undefined,code||undefined)});}catch{return json({error:'โหลดคำเชิญไม่สำเร็จ'},503);}
}
export async function POST(request:Request){
 const actor=await getApiActor();if(!actor)return json({error:'unauthorized'},401);
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'Origin ไม่ถูกต้อง'},403);
 const body=await request.json().catch(()=>null);if(!body)return json({error:'ข้อมูลไม่ถูกต้อง'},400);
 const person={id:actor.id,name:actor.name||'PLAYER',image:actor.image||'/avatar.png'};
 try{
  if(body.action==='invite'){
   if(!modes.includes(body.mode)||!/^\d{6}$/.test(body.code)||typeof body.toId!=='string'||body.toId.length>200)return json({error:'ข้อมูลคำเชิญไม่ถูกต้อง'},400);
   const invitation=await createGameInvitation(person,body.toId,body.mode,body.code);notify(body.toId);return json({invitation});
  }
  if(body.action==='accept'||body.action==='decline'){
   if(typeof body.id!=='string'||body.id.length>100)return json({error:'คำเชิญไม่ถูกต้อง'},400);
   const room=await respondGameInvitation(person,body.id,body.action==='accept');notify(actor.id,room||undefined);return json({room});
  }
  return json({error:'คำสั่งไม่ถูกต้อง'},400);
 }catch(error){return json({error:error instanceof Error&&!('code' in error)?error.message:'ระบบยังไม่พร้อม กรุณาลองใหม่'},409);}
}
