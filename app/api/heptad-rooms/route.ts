import { after, NextResponse } from 'next/server';
import { getApiActor } from '@/lib/admin-auth';
import { getServerSupabaseClient } from '@/lib/supabase-server';
import { findActiveGameRoom } from '@/lib/active-game-room';
import { createHeptadRoom, listHeptadRooms, mutateHeptadRoom } from '@/lib/heptad-room-store';

export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store, max-age=0'}});
const fail=(error:unknown)=>{
  if(error instanceof Error&&error.message==='ไม่พบห้อง')return json({error:'ห้องถูกปิดแล้ว',closed:true},404);
  const databaseError=error&&typeof error==='object'&&('code' in error||'clientVersion' in error);
  return json({error:databaseError?'เซิร์ฟเวอร์ยังไม่พร้อม กรุณาลองอีกครั้ง':error instanceof Error?error.message:'เซิร์ฟเวอร์ไม่พร้อม'},databaseError?503:409);
};
function notify(code:string,action:string){after(async()=>{
  const client=getServerSupabaseClient();if(!client)return;const channel=client.channel(`heptad:${code}`);
  try{await channel.send({type:'broadcast',event:'changed',payload:{code,action}},{timeout:500});}catch{/* Polling remains available. */}finally{void client.removeChannel(channel);}
});}
export async function GET(request:Request){
  const actor=await getApiActor();if(!actor)return json({error:'unauthorized'},401);
  const code=new URL(request.url).searchParams.get('room');
  try{if(!code)return json({rooms:await listHeptadRooms()});if(!/^\d{6}$/.test(code))return json({error:'รหัสห้องไม่ถูกต้อง'},400);
    return json({room:await mutateHeptadRoom(code,{id:actor.id,name:actor.name||'PLAYER',image:actor.image||'/avatar.png'})});
  }catch(error){return fail(error);}
}
export async function POST(request:Request){
  const actor=await getApiActor();if(!actor)return json({error:'unauthorized'},401);
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;if(!body)return json({error:'ข้อมูลไม่ถูกต้อง'},400);
  const participant={id:actor.id,name:actor.name||'PLAYER',image:actor.image||'/avatar.png'};
  try{
    if(body.action==='create'||body.action==='join'){const active=await findActiveGameRoom(actor.id);if(active&&(body.action==='create'||active.mode!=='heptad'||active.code!==body.code))return json({error:'กรุณาออกจากห้องเดิมก่อน',resume:active},409);}
    if(body.action==='create')return json({room:await createHeptadRoom(participant,{access:String(body.access||'public'),password:String(body.password||'')})});
    const code=String(body.code||'');if(!/^\d{6}$/.test(code))return json({error:'รหัสห้องไม่ถูกต้อง'},400);
    const room=await mutateHeptadRoom(code,participant,body);notify(code,String(body.action||''));return json({room});
  }catch(error){
    if(error instanceof Error&&error.message==='สถานะตาเปลี่ยนแล้ว'){
      try{return json({room:await mutateHeptadRoom(String(body.code||''),participant),ignored:true,reason:'stale_round'});}catch(refreshError){return fail(refreshError);}
    }
    return fail(error);
  }
}
