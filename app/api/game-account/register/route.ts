import {NextRequest,NextResponse} from 'next/server';
import {gameAuthAddress} from '@/lib/game-credentials';
import {beginGameEmailRegistration} from '@/lib/game-email-registration';

export const runtime='nodejs';
export async function POST(request:NextRequest){
 const origin=request.headers.get('origin');
 if(!origin||origin!==request.nextUrl.origin)return NextResponse.json({error:'คำขอไม่ถูกต้อง'},{status:403});
 if(!request.headers.get('content-type')?.startsWith('application/json'))return NextResponse.json({error:'คำขอไม่ถูกต้อง'},{status:415});
 try{
  const reader=request.body?.getReader();if(!reader)return NextResponse.json({error:'คำขอไม่ถูกต้อง'},{status:400});
  const chunks:Uint8Array[]=[];let bytes=0;
  while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>4096){await reader.cancel();return NextResponse.json({error:'ข้อมูลยาวเกินไป'},{status:413})}chunks.push(value)}
  const data=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length}
  let body;try{body=JSON.parse(new TextDecoder().decode(data))}catch{return NextResponse.json({error:'คำขอไม่ถูกต้อง'},{status:400})}
  if(!body||body.password!==body.confirmPassword)return NextResponse.json({error:'รหัสผ่านทั้งสองช่องไม่ตรงกัน'},{status:400});
  const result=await beginGameEmailRegistration(body.username,body.password,body.email,gameAuthAddress(Object.fromEntries(request.headers)));
  return NextResponse.json(result.ok?result:{error:result.error},{status:result.ok?202:result.status||400,headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'สมัครสมาชิกไม่สำเร็จ กรุณาลองอีกครั้ง'},{status:503})}
}
