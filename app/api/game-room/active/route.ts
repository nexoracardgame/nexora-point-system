import {NextResponse} from 'next/server';
import {getApiActor} from '@/lib/admin-auth';
import {findActiveGameRoom} from '@/lib/active-game-room';
export async function GET(){const actor=await getApiActor();if(!actor)return NextResponse.json({error:'Unauthorized'},{status:401});try{return NextResponse.json({room:await findActiveGameRoom(actor.id)},{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({error:'ตรวจสอบห้องไม่สำเร็จ'},{status:503,headers:{'Cache-Control':'no-store'}})}}
