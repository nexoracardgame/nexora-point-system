import {getServerSession} from 'next-auth';
import {NextResponse} from 'next/server';
import {authOptions} from '@/lib/auth';
import {CollectionError} from '@/lib/game-collection-store';
import {readGameGacha,openGamePack} from '@/lib/game-gacha-store';
import {gachaPolicy} from '@/lib/game-gacha';
const response=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){const session=await getServerSession(authOptions);if(!session?.user?.id)return response({error:'Unauthorized'},401);try{return response(await readGameGacha(session.user.id))}catch{return response({error:'โหลดหน้าสุ่มการ์ดไม่สำเร็จ'},503)}}
export async function POST(request:Request){
 const session=await getServerSession(authOptions);if(!session?.user?.id)return response({error:'Unauthorized'},401);
 if(request.headers.get('origin')!==new URL(request.url).origin)return response({error:'Origin ไม่ถูกต้อง'},403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))return response({error:'ข้อมูลไม่ถูกต้อง'},415);
 if(Number(request.headers.get('content-length')||0)>1000)return response({error:'ข้อมูลใหญ่เกินไป'},413);
 try{const text=await request.text();if(text.length>1000)return response({error:'ข้อมูลใหญ่เกินไป'},413);const body=JSON.parse(text);if(!body||typeof body.requestId!=='string'||Object.keys(body).some(key=>!['requestId','policyVersion','packIndex'].includes(key))||(body.packIndex!==undefined&&(!Number.isInteger(body.packIndex)||body.packIndex<0||body.packIndex>2))||typeof body.policyVersion!=='number')return response({error:'ข้อมูลไม่ถูกต้อง'},400);if(body.policyVersion!==gachaPolicy.version)return response({error:'อัตราสุ่มมีการอัปเดต กรุณาโหลดเกมใหม่ก่อนยืนยัน'},409);return response(await openGamePack(session.user.id,body.requestId,body.packIndex??1))}catch(error){if(error instanceof SyntaxError)return response({error:'ข้อมูลไม่ถูกต้อง'},400);return response({error:error instanceof CollectionError?error.message:'ยังยืนยันผลไม่ได้ กรุณาตรวจสอบคำขอเดิมอีกครั้ง'},error instanceof CollectionError?error.status:503)}
}
