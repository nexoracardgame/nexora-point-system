import {NextRequest,NextResponse} from 'next/server';
import {getServerSession} from 'next-auth';
import {authOptions} from '@/lib/auth';
import {readGameAppearance,saveGameAppearance} from '@/lib/game-profile-store';
import {gameAvatars,gameFrames,gameHeroes} from '@/lib/game-profile-options';
export async function GET(){const session=await getServerSession(authOptions);if(!session?.user?.id)return NextResponse.json({error:'Unauthorized'},{status:401});try{return NextResponse.json(await readGameAppearance(session.user.id),{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({error:'โหลดโปรไฟล์ไม่สำเร็จ'},{status:503})}}
export async function POST(req:NextRequest){
 const session=await getServerSession(authOptions);if(!session?.user?.id)return NextResponse.json({error:'Unauthorized'},{status:401});
 if(req.headers.get('origin')!==req.nextUrl.origin)return NextResponse.json({error:'Forbidden'},{status:403});
 if(!req.headers.get('content-type')?.startsWith('application/json'))return NextResponse.json({error:'Invalid content type'},{status:415});
 try{
  const reader=req.body?.getReader();if(!reader)return NextResponse.json({error:'Invalid body'},{status:400});const chunks:Uint8Array[]=[];let size=0;
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>350000){await reader.cancel();return NextResponse.json({error:'รูปใหญ่เกินไป'},{status:413})}chunks.push(part.value)}
  const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if(typeof value.avatar!=='string'||!gameFrames.some(f=>f.id===value.frame)||!gameHeroes.some(h=>h.id===value.hero))return NextResponse.json({error:'ตัวเลือกไม่ถูกต้อง'},{status:400});
  if(value.avatar!==''&&!gameAvatars.includes(value.avatar)){
   if(!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(value.avatar))return NextResponse.json({error:'รูปไม่ถูกต้อง'},{status:400});
   const bytes=Buffer.from(value.avatar.split(',')[1],'base64');
   const sharp=(await import('sharp')).default;const meta=await sharp(bytes,{limitInputPixels:1048576}).metadata();if(meta.format!=='jpeg'||!meta.width||!meta.height||meta.width>512||meta.height>512)return NextResponse.json({error:'รูปไม่ถูกต้อง'},{status:400});
  }
  await saveGameAppearance(session.user.id,{avatar:value.avatar,frame:value.frame,hero:value.hero});return NextResponse.json({ok:true});
 }catch{return NextResponse.json({error:'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง'},{status:400})}
}
