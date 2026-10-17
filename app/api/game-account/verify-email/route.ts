import {NextRequest,NextResponse} from 'next/server';
import {gameAuthAddress,allowGameAuth} from '@/lib/game-credentials';
import {verifyGameRegistration} from '@/lib/game-email-registration';
export async function POST(request:NextRequest){
 if(request.headers.get('origin')!==request.nextUrl.origin)return NextResponse.json({error:'Forbidden'},{status:403});
 if(!request.headers.get('content-type')?.startsWith('application/json'))return NextResponse.json({error:'Invalid content type'},{status:415});
 try{const reader=request.body?.getReader();if(!reader)return NextResponse.json({error:'Invalid request'},{status:400});const chunks:Uint8Array[]=[];let size=0;while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>1024){await reader.cancel();return NextResponse.json({error:'Invalid request'},{status:413})}chunks.push(part.value)}const text=Buffer.concat(chunks).toString('utf8');
 if(!await allowGameAuth('verify-email:'+gameAuthAddress(Object.fromEntries(request.headers)),30,900))return NextResponse.json({error:'กรุณาลองใหม่ภายหลัง'},{status:429});
 const ok=await verifyGameRegistration(JSON.parse(text).token);return NextResponse.json(ok?{ok:true}:{error:'ลิงก์หมดอายุ ถูกใช้แล้ว หรือไม่ถูกต้อง กรุณาสมัครใหม่'},{status:ok?200:400,headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'ยืนยันไม่สำเร็จ กรุณาลองใหม่'},{status:503})}
}
