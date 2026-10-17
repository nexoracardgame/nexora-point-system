import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {prisma} from './prisma';
import {allowGameAuth,ensureGameCredentialsSchema} from './game-credentials';
import {hashGamePassword,normalizeGameUsername,validGamePassword,validGameUsername} from './game-password';
import {gameMailReady,sendGameVerificationEmail} from './game-verification-mail';
let ready:Promise<void>|undefined;
export function ensureGameEmailSchema(){return ready??=(async()=>{
 await ensureGameCredentialsSchema();
 await prisma.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "GameEmailRegistration" ("username" TEXT PRIMARY KEY,"email" TEXT NOT NULL UNIQUE,"passwordHash" TEXT NOT NULL,"tokenHash" TEXT NOT NULL UNIQUE,"expiresAt" TIMESTAMPTZ NOT NULL)');
 await prisma.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "GameAccountEmail" ("userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,"email" TEXT NOT NULL UNIQUE,"verifiedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW())');
})().catch(error=>{ready=undefined;throw error})}
export function normalizeGameEmail(value:unknown){return typeof value==='string'?value.trim().toLowerCase():''}
export function validGameEmail(value:string){return value.length<=254&&/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(value)}
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export async function beginGameEmailRegistration(usernameInput:unknown,password:unknown,emailInput:unknown,address:string){
 const username=normalizeGameUsername(usernameInput),email=normalizeGameEmail(emailInput);
 if(!validGameUsername(username)||!validGamePassword(password)||!validGameEmail(email))return {ok:false as const,error:'กรุณาตรวจ Username รหัสผ่าน และอีเมลให้ถูกต้อง',status:400};
 if(!gameMailReady())return {ok:false as const,error:'ระบบส่งอีเมลยืนยันยังไม่พร้อมให้บริการ กรุณาใช้ Google หรือ LINE ก่อน',status:503};
 if(!await allowGameAuth('email-register:'+address,5,3600)||!await allowGameAuth('email-register-address:'+email,3,3600))return {ok:false as const,error:'ส่งคำขอหลายครั้งเกินไป กรุณาลองใหม่ภายหลัง',status:429};
 await ensureGameEmailSchema();
 const token=randomBytes(32).toString('hex'),tokenHash=digest(token),passwordHash=await hashGamePassword(password);
 try{
  await prisma.$transaction(async tx=>{
   const existing=await tx.$queryRawUnsafe<unknown[]>('SELECT "username" FROM "GameCredential" WHERE "username"=$1',username);
   const emails=await tx.$queryRawUnsafe<unknown[]>('SELECT "email" FROM "GameAccountEmail" WHERE "email"=$1 UNION SELECT "email" FROM "AuthIdentity" WHERE LOWER("email")=$1',email);
   if(existing.length||emails.length)throw Error('ACCOUNT_EXISTS');
   await tx.$executeRawUnsafe('DELETE FROM "GameEmailRegistration" WHERE "expiresAt"<NOW()');
   const count=await tx.$executeRawUnsafe('INSERT INTO "GameEmailRegistration" ("username","email","passwordHash","tokenHash","expiresAt") VALUES ($1,$2,$3,$4,NOW()+INTERVAL \'30 minutes\') ON CONFLICT ("username") DO UPDATE SET "passwordHash"=EXCLUDED."passwordHash","tokenHash"=EXCLUDED."tokenHash","expiresAt"=EXCLUDED."expiresAt" WHERE "GameEmailRegistration"."email"=EXCLUDED."email"',username,email,passwordHash,tokenHash);
   if(count!==1)throw Error('ACCOUNT_EXISTS');
  });
 }catch{return {ok:false as const,error:'ไม่สามารถใช้ Username หรืออีเมลนี้ได้ กรุณาตรวจสอบหรือเข้าสู่ระบบด้วยบัญชีเดิม',status:409}}
 try{await sendGameVerificationEmail(email,token)}catch{await prisma.$executeRawUnsafe('DELETE FROM "GameEmailRegistration" WHERE "tokenHash"=$1',tokenHash);return {ok:false as const,error:'ส่งอีเมลไม่สำเร็จ กรุณาลองสมัครอีกครั้งภายหลัง',status:503}}
 return {ok:true as const,verificationRequired:true,email};
}
export async function verifyGameRegistration(token:unknown){
 if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))return false;
 await ensureGameEmailSchema();
 return prisma.$transaction(async tx=>{
  const rows=await tx.$queryRawUnsafe<{username:string;email:string;passwordHash:string}[]>('DELETE FROM "GameEmailRegistration" WHERE "tokenHash"=$1 AND "expiresAt">NOW() RETURNING "username","email","passwordHash"',digest(token));
  const pending=rows[0];if(!pending)return false;
  const id=randomUUID();await tx.user.create({data:{id,lineId:'credentials:'+id,name:pending.username,displayName:pending.username,image:'/avatar.png',role:'USER'}});
  await tx.$executeRawUnsafe('INSERT INTO "GameCredential" ("username","userId","passwordHash") VALUES ($1,$2,$3)',pending.username,id,pending.passwordHash);
  await tx.$executeRawUnsafe('INSERT INTO "GameAccountEmail" ("userId","email") VALUES ($1,$2)',id,pending.email);
  return true;
 });
}
