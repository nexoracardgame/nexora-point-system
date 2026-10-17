import {getServerSession} from 'next-auth';
import {NextResponse} from 'next/server';
import {authOptions} from '@/lib/auth';
import {CollectionError,readGameCollection,saveGameDeck,deleteGameDeck,favoriteGameCard} from '@/lib/game-collection-store';
const response=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){
 const session=await getServerSession(authOptions);if(!session?.user?.id)return response({error:'Unauthorized'},401);
 try{return response(await readGameCollection(session.user.id))}catch{return response({error:'โหลดคลังการ์ดไม่สำเร็จ กรุณาลองใหม่'},503)}
}
export async function POST(request:Request){
 const session=await getServerSession(authOptions);if(!session?.user?.id)return response({error:'Unauthorized'},401);
 if(Number(request.headers.get('content-length')||0)>20000)return response({error:'ข้อมูลมีขนาดใหญ่เกินไป'},413);
 let body;try{const text=await request.text();if(text.length>20000)return response({error:'ข้อมูลมีขนาดใหญ่เกินไป'},413);body=JSON.parse(text)}catch{return response({error:'ข้อมูลไม่ถูกต้อง'},400)}
 if(!body||typeof body!=='object'||Array.isArray(body))return response({error:'ข้อมูลไม่ถูกต้อง'},400);
 try{
  if(body.action==='save')return response({deck:await saveGameDeck(session.user.id,body)});
  if(body.action==='delete'&&typeof body.id==='string'&&body.id.length<=100&&Number.isInteger(body.version)&&body.version>0){await deleteGameDeck(session.user.id,body.id,body.version);return response({ok:true})}
  if(body.action==='favorite'&&typeof body.cardNo==='string'&&typeof body.favorite==='boolean'){await favoriteGameCard(session.user.id,body.cardNo,body.favorite);return response({ok:true})}
  return response({error:'คำสั่งไม่ถูกต้อง'},400);
 }catch(error){return response({error:error instanceof CollectionError?error.message:'บันทึกไม่สำเร็จ กรุณาลองใหม่'},error instanceof CollectionError?error.status:503)}
}
