import {createHash,randomUUID} from 'node:crypto';
import {prisma} from './prisma';
import {ensureUserSessionSchema} from './auth-session-control';
import {hashGamePassword,normalizeGameUsername,validGamePassword,validGameUsername,verifyGamePassword} from './game-password';

let ready:Promise<void>|undefined;
export function ensureGameCredentialsSchema(){
 return ready??=(async()=>{
  await ensureUserSessionSchema();
  await prisma.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "GameCredential" ("username" TEXT PRIMARY KEY,"userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,"passwordHash" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT NOW())');
  await prisma.$executeRawUnsafe('ALTER TABLE "GameCredential" DROP CONSTRAINT IF EXISTS "GameCredential_userId_key"');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "GameCredential_userId_idx" ON "GameCredential"("userId")');
  await prisma.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "GameAuthAttempt" ("key" TEXT PRIMARY KEY,"count" INTEGER NOT NULL,"expiresAt" TIMESTAMP(3) NOT NULL)');
  await prisma.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "GameAuthAttempt_expiresAt_idx" ON "GameAuthAttempt"("expiresAt")');
  await prisma.$executeRawUnsafe('DELETE FROM "GameAuthAttempt" WHERE "expiresAt"<NOW()-INTERVAL \'1 day\'');
 })().catch(error=>{ready=undefined;throw error});
}
export function gameAuthAddress(headers:Record<string,unknown>){
 const value=headers['x-vercel-forwarded-for']||headers['x-forwarded-for']||headers['x-real-ip']||'unknown';
 return String(value).split(',')[0].trim().slice(0,100);
}
export async function allowGameAuth(key:string,limit:number,seconds:number){
 await ensureGameCredentialsSchema();
 const hashed=createHash('sha256').update(key).digest('hex');
 const rows=await prisma.$queryRawUnsafe<{count:number}[]>('INSERT INTO "GameAuthAttempt" ("key","count","expiresAt") VALUES ($1,1,NOW()+$2::int*INTERVAL \'1 second\') ON CONFLICT ("key") DO UPDATE SET "count"=CASE WHEN "GameAuthAttempt"."expiresAt"<NOW() THEN 1 ELSE "GameAuthAttempt"."count"+1 END,"expiresAt"=CASE WHEN "GameAuthAttempt"."expiresAt"<NOW() THEN NOW()+$2::int*INTERVAL \'1 second\' ELSE "GameAuthAttempt"."expiresAt" END RETURNING "count"',hashed,seconds);
 return rows[0]?.count<=limit;
}
export async function registerGameCredential(usernameInput:unknown,password:unknown,address:string){
 const username=normalizeGameUsername(usernameInput);
 if(!validGameUsername(username)||!validGamePassword(password))return {ok:false as const,error:'ใช้ Username 3–24 ตัว (a–z, 0–9, _ หรือ -) และรหัสผ่าน 12–128 ตัว'};
 if(!await allowGameAuth('register:'+address,5,3600))return {ok:false as const,error:'สมัครหลายครั้งเกินไป กรุณาลองใหม่ภายหลัง',status:429};
 const passwordHash=await hashGamePassword(password),id=randomUUID();
 try{
  await prisma.$transaction(async tx=>{
   await tx.user.create({data:{id,lineId:'credentials:'+id,name:username,displayName:username,image:'/avatar.png',role:'USER'}});
   await tx.$executeRawUnsafe('INSERT INTO "GameCredential" ("username","userId","passwordHash") VALUES ($1,$2,$3)',username,id,passwordHash);
  });
  return {ok:true as const};
 }catch(error){if((error as {code?:string}).code==='P2002'||(error as {meta?:{code?:string}}).meta?.code==='23505')return {ok:false as const,error:'ไม่สามารถใช้ Username นี้ได้ กรุณาเลือกชื่ออื่น',status:409};throw error}
}
const dummyHash='scrypt$131072$8$1$'+'00'.repeat(24)+'$'+'00'.repeat(64);
export async function authenticateGameCredential(usernameInput:unknown,password:unknown,address:string){
 const username=normalizeGameUsername(usernameInput);
 if(!validGameUsername(username)||!validGamePassword(password))return null;
 if(!await allowGameAuth('login-ip:'+address,30,900)||!await allowGameAuth('login-user:'+username,10,900))return null;
 const rows=await prisma.$queryRawUnsafe<{userId:string;passwordHash:string}[]>('SELECT "userId","passwordHash" FROM "GameCredential" WHERE "username"=$1 LIMIT 1',username);
 const row=rows[0],valid=await verifyGamePassword(password,row?.passwordHash||dummyHash);
 if(!row||!valid)return null;
 const user=await prisma.user.findUnique({where:{id:row.userId},select:{id:true,name:true,image:true,role:true,lineId:true}});
 return user||null;
}
