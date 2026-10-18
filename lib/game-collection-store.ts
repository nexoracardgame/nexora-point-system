import 'server-only';
import {randomUUID} from 'node:crypto';
import type {Prisma} from '@prisma/client';
import {prisma} from './prisma';
import {triadCardByNo} from './triad-dominion';
import {deckFormats,parseDeckCards,validateCollectionDeck,type DeckFormat,type DeckCards,type OwnedGameCard,type SavedGameDeck,type GameCollection} from './game-collection';

export class CollectionError extends Error{constructor(message:string,public status=400){super(message)}}
let schema:Promise<void>|undefined;
export function ensureGameCollection(){
 return schema??=prisma.$transaction(async tx=>{
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtextextended('nexora-game-collection-schema',0))");
  await tx.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "GameOwnedCard" ("userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,"cardNo" TEXT NOT NULL,"quantity" INTEGER NOT NULL CHECK ("quantity">0 AND "quantity"<=1000000),"favorite" BOOLEAN NOT NULL DEFAULT FALSE,"acquiredAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),PRIMARY KEY ("userId","cardNo"))');
  await tx.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "GameSavedDeck" ("id" TEXT PRIMARY KEY,"userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,"name" TEXT NOT NULL,"format" TEXT NOT NULL,"cards" JSONB NOT NULL,"version" INTEGER NOT NULL DEFAULT 1,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),"updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  await tx.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "GameSavedDeck_owner" ON "GameSavedDeck"("userId")');
  await tx.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "GameCardGrant" ("id" TEXT PRIMARY KEY,"userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,"reference" TEXT NOT NULL,"source" TEXT NOT NULL,"payload" JSONB NOT NULL,"createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE("userId","reference"))');
  await tx.$executeRawUnsafe('CREATE TABLE IF NOT EXISTS "GameTimedCard" ("id" TEXT PRIMARY KEY,"userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,"cardNo" TEXT NOT NULL,"expiresAt" TIMESTAMPTZ NOT NULL,"favorite" BOOLEAN NOT NULL DEFAULT FALSE,"acquiredAt" TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  await tx.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "GameTimedCard_active" ON "GameTimedCard"("userId","expiresAt")');
 }).catch(error=>{schema=undefined;throw error});
}
type OwnedRow=Omit<OwnedGameCard,'acquiredAt'>&{acquiredAt:Date};
type DeckRow=Omit<SavedGameDeck,'updatedAt'>&{updatedAt:Date};
async function ownedRows(db:Prisma.TransactionClient,owner:string){
 const [permanent,timed]=await Promise.all([db.$queryRawUnsafe<OwnedRow[]>('SELECT "cardNo","quantity","favorite","acquiredAt" FROM "GameOwnedCard" WHERE "userId"=$1 ORDER BY "acquiredAt" DESC,"cardNo"',owner),db.$queryRawUnsafe<{cardNo:string;quantity:number;favorite:boolean;acquiredAt:Date;expiresAt:Date}[]>('SELECT "cardNo",COUNT(*)::int AS "quantity",BOOL_OR("favorite") AS "favorite",MIN("acquiredAt") AS "acquiredAt",MIN("expiresAt") AS "expiresAt" FROM "GameTimedCard" WHERE "userId"=$1 AND "expiresAt">CURRENT_TIMESTAMP GROUP BY "cardNo"',owner)]);
 const combined=new Map(permanent.map(row=>[row.cardNo,{...row,permanentQuantity:row.quantity,temporaryQuantity:0,expiresAt:null as string|null}]));
 for(const row of timed){const before=combined.get(row.cardNo);combined.set(row.cardNo,{cardNo:row.cardNo,quantity:(before?.quantity||0)+row.quantity,favorite:Boolean(before?.favorite||row.favorite),acquiredAt:before?.acquiredAt||row.acquiredAt,permanentQuantity:before?.permanentQuantity||0,temporaryQuantity:row.quantity,expiresAt:row.expiresAt.toISOString()})}
 return [...combined.values()];
}
const serializeOwned=(rows:Awaited<ReturnType<typeof ownedRows>>):OwnedGameCard[]=>rows.map(row=>({...row,acquiredAt:row.acquiredAt.toISOString()}));
const serializeDeck=(row:DeckRow):SavedGameDeck=>({...row,cards:parseDeckCards(row.cards),updatedAt:row.updatedAt.toISOString()});
async function lockOwner(tx:Prisma.TransactionClient,owner:string){await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtextextended($1,0))','game-collection:'+owner)}
export async function readGameCollection(owner:string):Promise<GameCollection>{
 await ensureGameCollection();
 const [owned,decks,wallet]=await Promise.all([ownedRows(prisma,owner),prisma.$queryRawUnsafe<DeckRow[]>('SELECT "id","name","format","cards","version","updatedAt" FROM "GameSavedDeck" WHERE "userId"=$1 ORDER BY "updatedAt" DESC',owner),prisma.user.findUnique({where:{id:owner},select:{nexPoint:true,coin:true}})]);
 if(!wallet)throw new CollectionError('ไม่พบบัญชีผู้เล่น',404);
 return {owned:serializeOwned(owned),decks:decks.map(serializeDeck),wallet};
}
export async function saveGameDeck(owner:string,input:{id?:string;version?:number;name:unknown;format:unknown;cards:unknown}){
 if(input.id!==undefined&&(typeof input.id!=='string'||!input.id||input.id.length>100))throw new CollectionError('รหัสเด็คไม่ถูกต้อง');
 if(typeof input.name!=='string'||!input.name.trim()||input.name.trim().length>40)throw new CollectionError('ชื่อเด็คต้องมี 1–40 ตัวอักษร');
 if(typeof input.format!=='string'||!Object.hasOwn(deckFormats,input.format))throw new CollectionError('รูปแบบเด็คไม่ถูกต้อง');
 let cards:DeckCards;try{cards=parseDeckCards(input.cards)}catch{throw new CollectionError('ข้อมูลการ์ดไม่ถูกต้อง')}
 const format=input.format as DeckFormat,name=input.name.trim();
 await ensureGameCollection();
 return prisma.$transaction(async tx=>{
  await lockOwner(tx,owner);
  const owned=serializeOwned(await ownedRows(tx,owner)),errors=validateCollectionDeck(format,cards,owned,true);
  if(errors.length)throw new CollectionError(errors.join('\n'),422);
  let rows:DeckRow[];
  if(input.id){
   if(!Number.isInteger(input.version)||input.version!<1)throw new CollectionError('เวอร์ชันเด็คไม่ถูกต้อง');
   rows=await tx.$queryRawUnsafe<DeckRow[]>('UPDATE "GameSavedDeck" SET "name"=$1,"format"=$2,"cards"=$3::jsonb,"version"="version"+1,"updatedAt"=NOW() WHERE "id"=$4 AND "userId"=$5 AND "version"=$6 RETURNING "id","name","format","cards","version","updatedAt"',name,format,JSON.stringify(cards),input.id,owner,input.version);
   if(!rows.length)throw new CollectionError('เด็คถูกแก้ไขจากอุปกรณ์อื่นหรือไม่พบเด็ค กรุณาโหลดใหม่ก่อนบันทึก',409);
  }else{
   const count=await tx.$queryRawUnsafe<{count:number}[]>('SELECT COUNT(*)::int AS "count" FROM "GameSavedDeck" WHERE "userId"=$1',owner);
   if(count[0].count>=20)throw new CollectionError('บันทึกเด็คได้สูงสุด 20 เด็ค',422);
   rows=await tx.$queryRawUnsafe<DeckRow[]>('INSERT INTO "GameSavedDeck"("id","userId","name","format","cards") VALUES($1,$2,$3,$4,$5::jsonb) RETURNING "id","name","format","cards","version","updatedAt"',randomUUID(),owner,name,format,JSON.stringify(cards));
  }
  return serializeDeck(rows[0]);
 });
}
export async function deleteGameDeck(owner:string,id:string,version:number){
 await ensureGameCollection();
 const rows=await prisma.$queryRawUnsafe<{id:string}[]>('DELETE FROM "GameSavedDeck" WHERE "id"=$1 AND "userId"=$2 AND "version"=$3 RETURNING "id"',id,owner,version);
 if(!rows.length)throw new CollectionError('เด็คถูกแก้ไขจากอุปกรณ์อื่นหรือไม่พบเด็ค',409);
}
export async function favoriteGameCard(owner:string,cardNo:string,favorite:boolean){
 await ensureGameCollection();
 await prisma.$transaction(async tx=>{const permanent=await tx.$executeRawUnsafe('UPDATE "GameOwnedCard" SET "favorite"=$1,"updatedAt"=NOW() WHERE "userId"=$2 AND "cardNo"=$3',favorite,owner,cardNo);const timed=await tx.$executeRawUnsafe('UPDATE "GameTimedCard" SET "favorite"=$1 WHERE "userId"=$2 AND "cardNo"=$3 AND "expiresAt">CURRENT_TIMESTAMP',favorite,owner,cardNo);if(!permanent&&!timed)throw new CollectionError('ยังไม่ได้เป็นเจ้าของการ์ดใบนี้',404)});
}
// Trusted reward/gacha services only. No player-facing grant endpoint exists.
export async function grantPermanentGameCards(owner:string,reference:string,source:'reward'|'gacha'|'admin'|'migration',items:{cardNo:string;quantity:number}[]){
 if(!reference||reference.length>160||!['reward','gacha','admin','migration'].includes(source)||!Array.isArray(items)||!items.length||items.length>300)throw new CollectionError('ข้อมูลการรับการ์ดไม่ถูกต้อง');
 const quantities=new Map<string,number>();
 for(const item of items){if(!triadCardByNo.has(item.cardNo)||!Number.isSafeInteger(item.quantity)||item.quantity<1||item.quantity>100000)throw new CollectionError('จำนวนหรือหมายเลขการ์ดไม่ถูกต้อง');quantities.set(item.cardNo,(quantities.get(item.cardNo)||0)+item.quantity)}
 const payload=[...quantities].sort(([a],[b])=>a.localeCompare(b)).map(([cardNo,quantity])=>({cardNo,quantity}));
 await ensureGameCollection();
 return prisma.$transaction(async tx=>{
  await lockOwner(tx,owner);
  const previous=await tx.$queryRawUnsafe<{source:string;payload:typeof payload}[]>('SELECT "source","payload" FROM "GameCardGrant" WHERE "userId"=$1 AND "reference"=$2',owner,reference);
  if(previous.length){const prior=previous[0];if(prior.source!==source||prior.payload.length!==payload.length||prior.payload.some((item,index)=>item.cardNo!==payload[index].cardNo||item.quantity!==payload[index].quantity))throw new CollectionError('รหัสการรับการ์ดซ้ำแต่ข้อมูลไม่ตรงกัน',409);return {applied:false}}
  await tx.$executeRawUnsafe('INSERT INTO "GameCardGrant"("id","userId","reference","source","payload") VALUES($1,$2,$3,$4,$5::jsonb)',randomUUID(),owner,reference,source,JSON.stringify(payload));
  await tx.$executeRawUnsafe('INSERT INTO "GameOwnedCard"("userId","cardNo","quantity") SELECT $1,x."cardNo",x."quantity" FROM jsonb_to_recordset($2::jsonb) AS x("cardNo" TEXT,"quantity" INTEGER) ON CONFLICT("userId","cardNo") DO UPDATE SET "quantity"="GameOwnedCard"."quantity"+EXCLUDED."quantity","updatedAt"=NOW()',owner,JSON.stringify(payload));
  return {applied:true};
 });
}
