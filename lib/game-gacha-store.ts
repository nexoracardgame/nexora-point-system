import 'server-only';
import {randomInt,randomUUID} from 'node:crypto';
import type {Prisma} from '@prisma/client';
import {prisma} from './prisma';
import {CollectionError,ensureGameCollection} from './game-collection-store';
import {gachaPolicy,rollGachaPack,type GachaReceipt,type GachaState} from './game-gacha';
let schema:Promise<void>|undefined;
function hasUnlimitedGameCoin(role:unknown){return ['admin','gm','superadmin'].includes(String(role||'').trim().toLowerCase())}
export async function ensureGameGacha(){
 await ensureGameCollection();
 return schema??=prisma.$transaction(async tx=>{await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtextextended('nexora-game-gacha-schema',0))");await tx.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "GameGachaDraw" ("userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,"requestId" TEXT NOT NULL,"receipt" JSONB NOT NULL,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY("userId","requestId"))')}).catch(error=>{schema=undefined;throw error});
}
export async function readGameGacha(owner:string):Promise<GachaState>{
 await ensureGameGacha();
 const [user,rows]=await Promise.all([prisma.user.findUnique({where:{id:owner},select:{coin:true,role:true}}),prisma.$queryRawUnsafe<{receipt:GachaReceipt}[]>('SELECT "receipt" FROM "GameGachaDraw" WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT 10',owner)]);
 if(!user)throw new CollectionError('ไม่พบบัญชี',404);
 return {coin:user.coin,unlimitedCoin:hasUnlimitedGameCoin(user.role),history:rows.map(row=>row.receipt)};
}
export async function openGamePackInTransaction(tx:Prisma.TransactionClient,owner:string,requestId:string,rng=randomInt){
 await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1,0))','game-collection:'+owner);
 const users=await tx.$queryRawUnsafe<{coin:number;role:string;now:Date}[]>('SELECT "coin","role",CURRENT_TIMESTAMP AS "now" FROM "User" WHERE "id"=$1 FOR UPDATE',owner);
 if(!users[0])throw new CollectionError('ไม่พบบัญชี',404);
 const previous=await tx.$queryRawUnsafe<{receipt:GachaReceipt}[]>('SELECT "receipt" FROM "GameGachaDraw" WHERE "userId"=$1 AND "requestId"=$2',owner,requestId);
 const unlimitedCoin=hasUnlimitedGameCoin(users[0].role);
 if(previous[0])return {receipt:previous[0].receipt,coin:users[0].coin,unlimitedCoin,replayed:true};
 if(!unlimitedCoin&&users[0].coin<gachaPolicy.price)throw new CollectionError('COIN ไม่เพียงพอ ต้องใช้ 79 COIN',422);
 const createdAt=users[0].now,receipt:GachaReceipt={id:requestId,policyVersion:gachaPolicy.version,price:gachaPolicy.price,chargedCoin:unlimitedCoin?0:gachaPolicy.price,testDraw:unlimitedCoin,createdAt:createdAt.toISOString(),...rollGachaPack(max=>rng(max),createdAt)};
 const updated=unlimitedCoin?[{coin:users[0].coin}]:await tx.$queryRawUnsafe<{coin:number}[]>('UPDATE "User" SET "coin"="coin"-$1 WHERE "id"=$2 AND "coin">=$1 RETURNING "coin"',gachaPolicy.price,owner);
 if(!updated.length)throw new CollectionError('COIN ไม่เพียงพอ',422);
 const permanent=new Map<string,number>();
 for(let slot=0;slot<receipt.cards.length;slot++){const card=receipt.cards[slot];if(!card.days)permanent.set(card.cardNo,(permanent.get(card.cardNo)||0)+1);else await tx.$executeRawUnsafe('INSERT INTO "GameTimedCard"("id","userId","cardNo","expiresAt","acquiredAt") VALUES($1,$2,$3,$4,$5)',randomUUID(),owner,card.cardNo,new Date(card.expiresAt!),createdAt)}
 const payload=[...permanent].map(([cardNo,quantity])=>({cardNo,quantity}));
 await tx.$executeRawUnsafe('INSERT INTO "GameOwnedCard"("userId","cardNo","quantity") SELECT $1,x."cardNo",x."quantity" FROM jsonb_to_recordset($2::jsonb) AS x("cardNo" TEXT,"quantity" INTEGER) ON CONFLICT("userId","cardNo") DO UPDATE SET "quantity"="GameOwnedCard"."quantity"+EXCLUDED."quantity","updatedAt"=NOW()',owner,JSON.stringify(payload));
 await tx.$executeRawUnsafe('INSERT INTO "GameCardGrant"("id","userId","reference","source","payload") VALUES($1,$2,$3,$4,$5::jsonb)',randomUUID(),owner,'gacha:'+requestId,'gacha',JSON.stringify(payload));
 await tx.$executeRawUnsafe('INSERT INTO "GameGachaDraw"("userId","requestId","receipt","createdAt") VALUES($1,$2,$3::jsonb,$4)',owner,requestId,JSON.stringify(receipt),createdAt);
 return {receipt,coin:updated[0].coin,unlimitedCoin,replayed:false};
}
export async function openGamePack(owner:string,requestId:string){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId))throw new CollectionError('รหัสคำขอไม่ถูกต้อง');
 await ensureGameGacha();
 return prisma.$transaction(tx=>openGamePackInTransaction(tx,owner,requestId),{maxWait:10000,timeout:20000});
}
