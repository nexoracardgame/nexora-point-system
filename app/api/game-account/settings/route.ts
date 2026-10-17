import {NextRequest,NextResponse} from 'next/server';
import {getServerSession} from 'next-auth';
import {authOptions} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {ensureGameAccount,nextNameChange,validGameName} from '@/lib/game-account';
import {getLocalProfileByUserId,upsertLocalProfile} from '@/lib/local-profile-store';
import {ensureGameProfile} from '@/lib/game-profile-store';

export async function GET(){
 const session=await getServerSession(authOptions);if(!session?.user?.id)return NextResponse.json({error:'Unauthorized'},{status:401});
 try{await ensureGameAccount();const id=session.user.id;const [user,rows,links]=await Promise.all([prisma.user.findUnique({where:{id},select:{name:true,displayName:true,image:true}}),prisma.$queryRawUnsafe<{nameChangedAt:Date|null}[]>('SELECT "nameChangedAt" FROM "GameAccountSettings" WHERE "userId"=$1',id),prisma.authIdentity.findMany({where:{userId:id},select:{provider:true,email:true}})]);if(!user)return NextResponse.json({error:'ไม่พบบัญชี'},{status:404});return NextResponse.json({name:user.displayName||user.name||'',image:user.image||'',email:session.user.email||links.find(link=>link.email)?.email||'',providers:links.map(link=>link.provider),nextNameChangeAt:nextNameChange(rows[0]?.nameChangedAt||null)},{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({error:'โหลดบัญชีไม่สำเร็จ กรุณาลองอีกครั้ง'},{status:503})}
}
export async function POST(req:NextRequest){
 const session=await getServerSession(authOptions);if(!session?.user?.id)return NextResponse.json({error:'Unauthorized'},{status:401});
 if(req.headers.get('origin')!==req.nextUrl.origin)return NextResponse.json({error:'Forbidden'},{status:403});
 if(!req.headers.get('content-type')?.startsWith('application/json'))return NextResponse.json({error:'Invalid content type'},{status:415});
 try{
  const reader=req.body?.getReader();if(!reader)throw Error('body');let size=0;const chunks:Uint8Array[]=[];while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>160000){await reader.cancel();return NextResponse.json({error:'ไฟล์ใหญ่เกินไป'},{status:413})}chunks.push(part.value)}
  const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!validGameName(body.name))return NextResponse.json({error:'ชื่อผู้เล่นต้องมี 2–32 ตัวอักษร'},{status:400});
  let image:string|undefined;
  if(body.image!==undefined){if(typeof body.image!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(body.image))return NextResponse.json({error:'รูปไม่ถูกต้อง'},{status:400});const sharp=(await import('sharp')).default;const bytes=Buffer.from(body.image.split(',')[1],'base64');const meta=await sharp(bytes,{limitInputPixels:262144}).metadata();if(meta.format!=='jpeg'||!meta.width||!meta.height||meta.width>512||meta.height>512)throw Error('image');image='data:image/jpeg;base64,'+(await sharp(bytes).resize(256,256,{fit:'cover'}).jpeg({quality:85}).toBuffer()).toString('base64')}
  await ensureGameAccount();if(image)await ensureGameProfile();const id=session.user.id;
  const result=await prisma.$transaction(async tx=>{
   const users=await tx.$queryRawUnsafe<{name:string|null;displayName:string|null;image:string|null}[]>('SELECT "name","displayName","image" FROM "User" WHERE "id"=$1 FOR UPDATE',id);const user=users[0];if(!user)throw Error('user');
   const rows=await tx.$queryRawUnsafe<{nameChangedAt:Date|null}[]>('SELECT "nameChangedAt" FROM "GameAccountSettings" WHERE "userId"=$1',id);let changedAt=rows[0]?.nameChangedAt||null;const name=body.name.trim();
   if(name!==(user.displayName||user.name||'')){const next=nextNameChange(changedAt);if(next&&Date.parse(next)>Date.now())return {blocked:true as const,nextNameChangeAt:next};changedAt=new Date();await tx.$executeRawUnsafe('INSERT INTO "GameAccountSettings" ("userId","nameChangedAt") VALUES ($1,$2) ON CONFLICT ("userId") DO UPDATE SET "nameChangedAt"=EXCLUDED."nameChangedAt"',id,changedAt)}
   const updated=await tx.user.update({where:{id},data:{name,displayName:name,...(image?{image}:{})},select:{name:true,image:true}});if(image)await tx.$executeRawUnsafe('UPDATE "GameAppearance" SET "avatar"=\'\',"updatedAt"=NOW() WHERE "userId"=$1',id);return {blocked:false as const,name:updated.name!,image:updated.image||'',nextNameChangeAt:nextNameChange(changedAt)};
  });
  if(result.blocked)return NextResponse.json({error:'เปลี่ยนชื่อได้ทุก 7 วัน',nextNameChangeAt:result.nextNameChangeAt},{status:429});
  const profile=await getLocalProfileByUserId(id).catch(()=>null);
  await upsertLocalProfile(id,{displayName:result.name,image:result.image,username:profile?.username||null,coverImage:profile?.coverImage||null,coverPosition:profile?.coverPosition??50,bio:profile?.bio||null,lineUrl:profile?.lineUrl||null,facebookUrl:profile?.facebookUrl||null});
  return NextResponse.json({ok:true,...result},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง'},{status:503})}
}
